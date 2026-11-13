import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE } from "@shared/const";
import * as data from "./store-data";
import { isPostgresDatabaseConfigured } from "./db";
import { deleteStoredImages } from "./storage";
import { getSessionCookieOptions } from "./_core/cookies";
import { ADMIN_SESSION_TTL_MS, createAdminSessionToken, hasAdminLoginConfiguration, verifyAdminCredentials } from "./_core/adminAuth";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { hashRateLimitSubject, normalizePhoneNumber, rateLimitBuckets } from "./public-rate-limits";
import { isPrivateReviewBlobUrl } from "./review-images";

const categorySchema = z.enum(["women", "kids"]);
const statusSchema = z.enum(["received", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "completed", "cancelled"]);
const publicBlobUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") && !url.hostname.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}, "Image must be stored in Vercel Blob");

function unavailable() {
  return new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "لم تُربط قاعدة بيانات Neon بعد. أضيفي متغير اتصال PostgreSQL في إعدادات Vercel.",
  });
}

function safeInternalError(error: unknown): never {
  console.error("[Store API] Request failed:", error instanceof Error ? error.name : "unknown error");
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إتمام الطلب الآن. حاولي مرة أخرى لاحقًا." });
}

function requestRateLimitError(message: string) {
  return new TRPCError({ code: "SERVICE_UNAVAILABLE", message });
}

const productInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(180),
  category: categorySchema,
  price: z.number().positive().max(100000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places"),
  description: z.string().max(6000).default(""),
  fabric: z.string().max(1200).default(""),
  embroidery: z.string().max(1200).default(""),
  stones: z.string().max(1200).default(""),
  design: z.string().max(1200).default(""),
  isPublished: z.boolean().default(true),
  images: z.array(z.object({ url: publicBlobUrlSchema, alt: z.string().max(240).default("") })).max(40),
  variants: z.array(z.object({ size: z.string().trim().min(1).max(32), stock: z.number().int().min(0).max(9999) })).max(30),
}).superRefine((value, ctx) => {
  const sizes = value.variants.map((variant) => variant.size.toLowerCase());
  if (new Set(sizes).size !== sizes.length) {
    ctx.addIssue({ code: "custom", path: ["variants"], message: "لا تكرري المقاس نفسه للمنتج." });
  }
  if (value.isPublished && value.images.length === 0) {
    ctx.addIssue({ code: "custom", path: ["images"], message: "أضيفي صورة حقيقية للمنتج قبل نشره." });
  }
  if (value.isPublished && value.variants.length === 0) {
    ctx.addIssue({ code: "custom", path: ["variants"], message: "أضيفي مقاسًا ومخزونه قبل نشر المنتج." });
  }
  if (value.isPublished && !value.description.trim()) {
    ctx.addIssue({ code: "custom", path: ["description"], message: "أضيفي وصفًا حقيقيًا قبل نشر المنتج." });
  }
  if (value.isPublished && (!value.fabric.trim() || !value.design.trim())) {
    ctx.addIssue({ code: "custom", path: [!value.fabric.trim() ? "fabric" : "design"], message: "أضيفي تفاصيل القماش والتصميم قبل نشر المنتج." });
  }
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    login: publicProcedure.input(z.object({
      username: z.string().min(1).max(128),
      password: z.string().min(1).max(256),
    })).mutation(async ({ ctx, input }) => {
      const username = verifyAdminCredentials(input.username, input.password);
      if (!username) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة." });
      }
      const token = await createAdminSessionToken(username);
      ctx.res.cookie(ADMIN_SESSION_COOKIE, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: ADMIN_SESSION_TTL_MS,
      });
      return { success: true } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(ADMIN_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  store: router({
    status: publicProcedure.query(() => ({
      databaseConfigured: isPostgresDatabaseConfigured(),
      orderProtectionConfigured: Boolean(process.env.MANUS_JWT_SECRET),
      blobConfigured: Boolean(process.env.PRODUCT_BLOB_READ_WRITE_TOKEN && process.env.REVIEW_BLOB_READ_WRITE_TOKEN),
      adminLoginConfigured: hasAdminLoginConfiguration(),
    })),
    products: router({
      list: publicProcedure
        .input(z.object({ category: categorySchema.optional(), size: z.string().trim().max(32).optional() }).optional())
        .query(async ({ input }) => {
          if (!isPostgresDatabaseConfigured()) return [];
          try {
            return await data.listPublicProducts(input ?? {});
          } catch (error) {
            safeInternalError(error);
          }
        }),
      byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) return null;
        try {
          return await data.getPublicProduct(input.id);
        } catch (error) {
          safeInternalError(error);
        }
      }),
      submitReview: publicProcedure.input(z.object({
        productId: z.number().int().positive(),
        customerName: z.string().trim().min(2).max(100),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).default(""),
        images: z.array(z.string().url().max(2048)).max(5),
      }).superRefine((value, ctx) => {
        if (!value.images.every((url) => isPrivateReviewBlobUrl(url, value.productId))) {
          ctx.addIssue({ code: "custom", path: ["images"], message: "يجب رفع صور التقييم إلى المخزن الخاص لهذا المنتج." });
        }
      })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try {
          return await data.submitReview(input);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          safeInternalError(error);
        }
      }),
    }),
    orders: router({
      create: publicProcedure.input(z.object({
        customerName: z.string().trim().min(2).max(140),
        phone: z.string().trim().min(8).max(40).refine((value) => {
          const digits = normalizePhoneNumber(value);
          return digits.length >= 8 && digits.length <= 15;
        }, "أدخلي رقم تواصل صالحًا."),
        address: z.string().trim().max(1000).default(""),
        fulfillment: z.enum(["delivery", "pickup"]),
        items: z.array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) })).min(1).max(30),
      }).superRefine((value, ctx) => {
        if (value.fulfillment === "delivery" && value.address.length < 5) {
          ctx.addIssue({ code: "custom", path: ["address"], message: "أدخلي عنوان التوصيل داخل مكة." });
        }
      })).mutation(async ({ input, ctx }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        const secret = process.env.MANUS_JWT_SECRET;
        if (!secret) throw requestRateLimitError("إعداد حماية الطلبات غير مكتمل بعد. حاولي لاحقًا.");
        try {
          const address = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
          const now = Date.now();
          const ipBuckets = rateLimitBuckets("order-ip", now);
          const phoneBuckets = rateLimitBuckets("order-phone", now);
          const globalBuckets = rateLimitBuckets("order-global", now);
          const allowed = await data.consumePublicActionQuota([
            { subjectHash: hashRateLimitSubject(`ip:${address}`, secret), bucketKey: ipBuckets.quarterHour, limit: 3 },
            { subjectHash: hashRateLimitSubject(`ip:${address}`, secret), bucketKey: ipBuckets.day, limit: 8 },
            { subjectHash: hashRateLimitSubject(`phone:${normalizePhoneNumber(input.phone)}`, secret), bucketKey: phoneBuckets.day, limit: 3 },
            { subjectHash: "global", bucketKey: globalBuckets.day, limit: 100 },
          ]);
          if (!allowed) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "أُرسلت طلبات كثيرة خلال فترة قصيرة. حاولي مرة أخرى لاحقًا." });
          }
          return await data.createOrder(input);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "";
          if (message.includes("no longer available") || message.includes("Stock changed") || message.includes("cart is empty")) {
            throw new TRPCError({ code: "CONFLICT", message: "تغيّر المخزون أثناء إتمام الطلب. حدّثي السلة قبل المحاولة." });
          }
          safeInternalError(error);
        }
      }),
    }),
    contacts: router({
      list: publicProcedure.query(async () => {
        if (!isPostgresDatabaseConfigured()) return [];
        try {
          return await data.listContactLinks(true);
        } catch (error) {
          safeInternalError(error);
        }
      }),
    }),
  }),
  admin: router({
    dashboard: adminProcedure.query(async () => {
      if (!isPostgresDatabaseConfigured()) throw unavailable();
      try { return await data.getDashboardStats(); } catch (error) { safeInternalError(error); }
    }),
    products: router({
      list: adminProcedure.query(async () => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { return await data.listAdminProducts(); } catch (error) { safeInternalError(error); }
      }),
      save: adminProcedure.input(productInput).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try {
          const result = await data.saveProduct({ ...input, price: input.price.toFixed(2) });
          await deleteStoredImages(result.deletedImageUrls);
          return result.product;
        } catch (error) {
          if (error instanceof Error && error.message === "Product has open orders") {
            throw new TRPCError({ code: "CONFLICT", message: "لا يمكن تعديل المنتج ما دامت هناك طلبات جديدة أو نشطة مرتبطة به. أكملي الطلبات أو ألغِيها أولًا." });
          }
          safeInternalError(error);
        }
      }),
      delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try {
          const urls = await data.deleteProduct(input.id);
          await deleteStoredImages(urls);
          return { success: true } as const;
        } catch (error) {
          if (error instanceof Error && error.message === "Product has open orders") {
            throw new TRPCError({ code: "CONFLICT", message: "لا يمكن حذف المنتج ما دامت هناك طلبات جديدة أو نشطة مرتبطة به. أكملي الطلبات أو ألغِيها أولًا." });
          }
          safeInternalError(error);
        }
      }),
    }),
    orders: router({
      list: adminProcedure.query(async () => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { return await data.listAdminOrders(); } catch (error) { safeInternalError(error); }
      }),
      update: adminProcedure.input(z.object({
        id: z.number().int().positive(),
        status: statusSchema,
        deliveryFee: z.number().min(0).max(5000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6).optional(),
      })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try {
          const { deliveryFee, ...rest } = input;
          const result = await data.updateOrder({ ...rest, deliveryFee: deliveryFee?.toFixed(2) });
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "الطلب غير موجود." });
          return { success: true } as const;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof Error) {
            const conflicts: Record<string, string> = {
              "Terminal orders cannot be reopened or changed": "الطلب المكتمل أو الملغي نهائي ولا يمكن تغيير حالته.",
              "Confirmed orders cannot return to received status": "لا يمكن إرجاع الطلب المؤكد إلى حالة جديد.",
              "Stock changed before order confirmation": "لم يعد المخزون كافيًا لتأكيد هذا الطلب. راجعي المقاسات المتاحة.",
              "Product was removed before order confirmation": "أُزيل أحد المنتجات قبل تأكيد الطلب. لا يمكن تأكيده.",
              "Pickup status requires pickup fulfillment": "لا يمكن وضع طلب التوصيل في حالة جاهز للاستلام.",
              "Delivery status requires delivery fulfillment": "لا يمكن وضع طلب الاستلام في حالة خرج للتوصيل.",
            };
            const conflictMessage = conflicts[error.message];
            if (conflictMessage) throw new TRPCError({ code: "CONFLICT", message: conflictMessage });
          }
          safeInternalError(error);
        }
      }),
    }),
    reviews: router({
      list: adminProcedure.query(async () => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { return await data.listAdminReviews(); } catch (error) { safeInternalError(error); }
      }),
      setApproved: adminProcedure.input(z.object({ id: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { await data.setReviewApproved(input.id, input.approved); return { success: true } as const; } catch (error) { safeInternalError(error); }
      }),
      delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { const urls = await data.deleteReview(input.id); await deleteStoredImages(urls); return { success: true } as const; } catch (error) { safeInternalError(error); }
      }),
    }),
    contacts: router({
      list: adminProcedure.query(async () => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { return await data.listContactLinks(false); } catch (error) { safeInternalError(error); }
      }),
      create: adminProcedure.input(z.object({
        label: z.string().trim().min(2).max(80),
        channel: z.enum(["whatsapp", "instagram", "snapchat", "tiktok", "facebook", "group", "other"]),
        url: z.string().url().max(1200).refine((value) => ["https:", "http:"].includes(new URL(value).protocol), "Only web links are allowed"),
      })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { return await data.createContactLink(input); } catch (error) { safeInternalError(error); }
      }),
      delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
        if (!isPostgresDatabaseConfigured()) throw unavailable();
        try { await data.deleteContactLink(input.id); return { success: true } as const; } catch (error) { safeInternalError(error); }
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
