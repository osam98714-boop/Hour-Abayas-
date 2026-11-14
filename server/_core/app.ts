import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import express, { type Express, type Request, type Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ZodError, z } from "zod";
import { appRouter } from "../routers";
import { isPostgresDatabaseConfigured } from "../db";
import { getPublicProduct, getReviewImageForServing, consumePublicActionQuota } from "../store-data";
import { hashRateLimitSubject, rateLimitBuckets } from "../public-rate-limits";
import { isPrivateReviewBlobUrl, REVIEW_IMAGE_MAX_BYTES } from "../review-images";
import { isCurrentOwner } from "./owner";
import { createContext } from "./context";
import { authenticateAdminRequest } from "./adminAuth";
import { publicPlatformScript } from "./publicConfig";

const productUploadPayloadSchema = z.object({ purpose: z.enum(["product", "announcement"]) });
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maximumProductImageSize = 12 * 1024 * 1024;

class UploadRateLimitError extends Error {}
class UploadQuotaUnavailableError extends Error {}

function parseProductUploadPayload(value: string | null) {
  if (!value) throw new Error("Upload purpose is required");
  return productUploadPayloadSchema.parse(JSON.parse(value));
}

function validProductUploadPath(pathname: string, purpose: "product" | "announcement") {
  if (!/^[A-Za-z0-9_./-]{1,240}$/.test(pathname) || pathname.includes("..")) return false;
  const prefix = purpose === "announcement" ? "announcements" : "products";
  return new RegExp(`^${prefix}/[A-Za-z0-9_-]{8,80}\\.(?:webp|png|jpe?g)$`, "i").test(pathname);
}

async function enforceReviewUploadQuota(req: Request) {
  const secret = process.env.MANUS_JWT_SECRET;
  if (!secret) throw new UploadQuotaUnavailableError();
  const clientAddress = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const subjectHash = hashRateLimitSubject(`ip:${clientAddress}`, secret);
  const buckets = rateLimitBuckets("review-upload", now);

  let allowed: boolean;
  try {
    allowed = await consumePublicActionQuota([
      { subjectHash, bucketKey: buckets.quarterHour, limit: 6 },
      { subjectHash, bucketKey: buckets.day, limit: 20 },
      { subjectHash: "global", bucketKey: buckets.day, limit: 25 },
    ]);
  } catch {
    throw new UploadQuotaUnavailableError();
  }
  if (!allowed) throw new UploadRateLimitError();
}

function registerProductBlobUploadRoute(app: Express) {
  app.post("/api/blob/upload", async (req: Request, res: Response) => {
    const token = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
    if (!token) {
      res.status(503).json({ error: "لم يتم ربط مخزن Vercel Blob لهذا المشروع بعد." });
      return;
    }

    try {
      const body = req.body as HandleUploadBody;
      if (!body || typeof body !== "object" || !("type" in body)) {
        res.status(400).json({ error: "طلب رفع غير صالح." });
        return;
      }

      if (body.type === "blob.generate-client-token") {
        parseProductUploadPayload(body.payload.clientPayload);
        const user = await authenticateAdminRequest(req);
        if (!isCurrentOwner(user)) {
          res.status(403).json({ error: "رفع الصور متاح لمدير المتجر فقط." });
          return;
        }
      }

      const response = await handleUpload({
        token,
        request: req,
        body,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const { purpose } = parseProductUploadPayload(clientPayload);
          if (!validProductUploadPath(pathname, purpose)) throw new Error("Invalid store image path");
          return {
            allowedContentTypes: [...allowedImageTypes],
            maximumSizeInBytes: maximumProductImageSize,
            validUntil: Date.now() + 5 * 60 * 1000,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ purpose }),
          };
        },
      });
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        res.status(400).json({ error: "بيانات الصورة غير صالحة." });
        return;
      }
      console.error("[Blob product upload] Request rejected:", error instanceof Error ? error.name : "unknown");
      res.status(400).json({ error: "تعذر إصدار إذن رفع الصورة." });
    }
  });
}

function registerPrivateReviewUploadRoute(app: Express) {
  app.post(
    "/api/review-upload",
    express.raw({ type: [...allowedImageTypes], limit: REVIEW_IMAGE_MAX_BYTES }),
    async (req: Request, res: Response) => {
      const token = process.env.REVIEW_BLOB_READ_WRITE_TOKEN;
      if (!token || !isPostgresDatabaseConfigured()) {
        res.status(503).json({ error: "يلزم ربط Neon وVercel Blob قبل إرفاق صور التقييم." });
        return;
      }
      if (!process.env.MANUS_JWT_SECRET) {
        res.status(503).json({ error: "يلزم إعداد حماية آمنة قبل استقبال صور التقييم." });
        return;
      }

      const rawProductId = req.query.productId;
      const productId = typeof rawProductId === "string" && /^\d{1,10}$/.test(rawProductId) ? Number(rawProductId) : NaN;
      const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!Number.isSafeInteger(productId) || productId < 1) {
        res.status(400).json({ error: "معرّف المنتج غير صالح." });
        return;
      }
      if (!(allowedImageTypes as readonly string[]).includes(contentType)) {
        res.status(415).json({ error: "اختاري صورة بصيغة JPG أو PNG أو WebP." });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: "ملف الصورة فارغ أو غير صالح." });
        return;
      }
      if (req.body.length > REVIEW_IMAGE_MAX_BYTES) {
        res.status(413).json({ error: "الحد الأقصى لصورة التقييم 4 ميبيبايت." });
        return;
      }

      try {
        if (!(await getPublicProduct(productId))) {
          res.status(404).json({ error: "المنتج غير متاح لإضافة تقييم." });
          return;
        }
        await enforceReviewUploadQuota(req);
        const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
        const blob = await put(`reviews/${productId}/${randomUUID()}.${extension}`, req.body, {
          access: "private",
          contentType,
          token,
          addRandomSuffix: false,
        });
        if (!isPrivateReviewBlobUrl(blob.url, productId)) {
          res.status(503).json({ error: "تعذر التحقق من ملف الصورة المخزن." });
          return;
        }
        res.status(201).json({ url: blob.url });
      } catch (error) {
        if (error instanceof UploadRateLimitError) {
          res.status(429).json({ error: "وصلتِ إلى الحد المؤقت لرفع صور التقييم. حاولي لاحقًا." });
          return;
        }
        if (error instanceof UploadQuotaUnavailableError) {
          res.status(503).json({ error: "تعذر التحقق من حصة رفع الصور. حاولي لاحقًا." });
          return;
        }
        console.error("[Private review image upload] Request failed:", error instanceof Error ? error.name : "unknown");
        res.status(503).json({ error: "تعذر رفع الصورة بأمان. حاولي لاحقًا." });
      }
    },
  );
}

function registerPrivateReviewImageRoute(app: Express) {
  app.get("/api/review-images/:id", async (req: Request, res: Response) => {
    const imageId = /^\d{1,10}$/.test(req.params.id) ? Number(req.params.id) : NaN;
    const token = process.env.REVIEW_BLOB_READ_WRITE_TOKEN;
    if (!Number.isSafeInteger(imageId) || imageId < 1) {
      res.status(404).end();
      return;
    }
    if (!token || !isPostgresDatabaseConfigured()) {
      res.status(503).json({ error: "مخزن صور التقييم غير جاهز بعد." });
      return;
    }

    try {
      const record = await getReviewImageForServing(imageId);
      if (!record || !isPrivateReviewBlobUrl(record.url, record.productId)) {
        res.status(404).end();
        return;
      }
      if (!record.approved) {
        const user = await authenticateAdminRequest(req);
        if (!isCurrentOwner(user)) {
          res.status(404).end();
          return;
        }
      }

      const blob = await get(record.url, { access: "private", token });
      if (!blob || blob.statusCode !== 200 || !blob.stream || !blob.blob.contentType || !(allowedImageTypes as readonly string[]).includes(blob.blob.contentType)) {
        res.status(404).end();
        return;
      }
      const responseHeaders: Record<string, string> = {
        "Content-Type": blob.blob.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      };
      if (blob.blob.size !== null) responseHeaders["Content-Length"] = String(blob.blob.size);
      res.status(200).set(responseHeaders);
      const stream = Readable.fromWeb(blob.stream as unknown as NodeReadableStream<Uint8Array>);
      stream.on("error", (error) => {
        console.error("[Private review image read] Stream failed:", error instanceof Error ? error.name : "unknown");
        if (!res.headersSent) res.status(503).end();
        else res.destroy();
      });
      stream.pipe(res);
    } catch (error) {
      console.error("[Private review image read] Request failed:", error instanceof Error ? error.name : "unknown");
      if (!res.headersSent) res.status(503).json({ error: "تعذر تحميل صورة التقييم." });
    }
  });
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "hour-abayas" });
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });

  registerProductBlobUploadRoute(app);
  registerPrivateReviewUploadRoute(app);
  registerPrivateReviewImageRoute(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  app.use((error: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const statusValue = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
    const status = error instanceof SyntaxError ? 400 : typeof statusValue === "number" && statusValue >= 400 && statusValue < 600 ? statusValue : 500;
    console.error("[Express] Unhandled request error:", error instanceof Error ? error.name : "unknown");
    const message = status === 413 ? "حجم صورة التقييم يتجاوز الحد المسموح." : status === 400 ? "صيغة الطلب غير صالحة." : "حدث خطأ غير متوقع.";
    res.status(status).json({ error: message });
  });

  return app;
}
