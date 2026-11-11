import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as s from "../drizzle/schema";
import { getDb } from "./db";
import { assertOrderStatusMatchesFulfillment, getInventoryTransition } from "./order-inventory";
import { isPrivateReviewBlobUrl, reviewImageEndpoint } from "./review-images";

export type Category = "women" | "kids";
export type OrderStatus = typeof s.orderStatusEnum.enumValues[number];

let lastPublicActionCleanupAt = 0;
const orderLockingStatuses = ["received", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"] as const;

export async function consumePublicActionQuota(
  quotas: Array<{ subjectHash: string; bucketKey: string; limit: number }>,
) {
  const db = requireDb();
  const now = new Date();
  if (now.getTime() - lastPublicActionCleanupAt > 6 * 60 * 60 * 1000) {
    await db.delete(s.publicActionRateLimits).where(lt(s.publicActionRateLimits.updatedAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
    lastPublicActionCleanupAt = now.getTime();
  }

  class QuotaExceededError extends Error {}
  try {
    await db.transaction(async (tx) => {
      for (const quota of quotas) {
        const rows = await tx.insert(s.publicActionRateLimits).values({
          subjectHash: quota.subjectHash,
          bucketKey: quota.bucketKey,
          actionCount: 1,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [s.publicActionRateLimits.subjectHash, s.publicActionRateLimits.bucketKey],
          set: {
            actionCount: sql`${s.publicActionRateLimits.actionCount} + 1`,
            updatedAt: now,
          },
          setWhere: lt(s.publicActionRateLimits.actionCount, quota.limit),
        }).returning({ id: s.publicActionRateLimits.id });
        if (rows.length === 0) throw new QuotaExceededError();
      }
    });
    return true;
  } catch (error) {
    if (error instanceof QuotaExceededError) return false;
    throw error;
  }
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Neon PostgreSQL is not configured");
  return db;
}

function toCents(value: string | number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error("Invalid monetary value");
  return Math.round(number * 100);
}

function fromCents(value: number) {
  return (value / 100).toFixed(2);
}

async function loadProducts(options: { category?: Category; size?: string; includeDrafts?: boolean }) {
  const db = requireDb();
  const where = and(
    options.category ? eq(s.products.category, options.category) : undefined,
    options.includeDrafts ? undefined : eq(s.products.isPublished, true),
  );
  const productRows = await db.select().from(s.products).where(where).orderBy(desc(s.products.createdAt));
  if (productRows.length === 0) return [];

  const ids = productRows.map((product) => product.id);
  const [images, variants] = await Promise.all([
    db.select().from(s.productImages).where(inArray(s.productImages.productId, ids)).orderBy(asc(s.productImages.sortOrder)),
    db.select().from(s.productVariants).where(inArray(s.productVariants.productId, ids)).orderBy(asc(s.productVariants.id)),
  ]);

  const imageMap = new Map<number, typeof images>();
  const variantMap = new Map<number, typeof variants>();
  for (const image of images) imageMap.set(image.productId, [...(imageMap.get(image.productId) ?? []), image]);
  for (const variant of variants) variantMap.set(variant.productId, [...(variantMap.get(variant.productId) ?? []), variant]);

  return productRows
    .map((product) => ({
      ...product,
      images: imageMap.get(product.id) ?? [],
      variants: variantMap.get(product.id) ?? [],
    }))
    .filter((product) => {
      if (!options.size) return true;
      return product.variants.some((variant) => variant.size === options.size && variant.stock > 0);
    });
}

export async function listPublicProducts(options: { category?: Category; size?: string }) {
  return loadProducts(options);
}

export async function listAdminProducts() {
  return loadProducts({ includeDrafts: true });
}

export async function getPublicProduct(id: number) {
  const db = requireDb();
  const [product] = await db.select().from(s.products).where(and(eq(s.products.id, id), eq(s.products.isPublished, true))).limit(1);
  if (!product) return null;

  const [images, variants, reviewRows] = await Promise.all([
    db.select().from(s.productImages).where(eq(s.productImages.productId, id)).orderBy(asc(s.productImages.sortOrder)),
    db.select().from(s.productVariants).where(eq(s.productVariants.productId, id)).orderBy(asc(s.productVariants.id)),
    db.select().from(s.reviews).where(and(eq(s.reviews.productId, id), eq(s.reviews.approved, true))).orderBy(desc(s.reviews.createdAt)),
  ]);
  const reviewIds = reviewRows.map((review) => review.id);
  const reviewPhotoRows = reviewIds.length
    ? await db.select().from(s.reviewImages).where(inArray(s.reviewImages.reviewId, reviewIds)).orderBy(asc(s.reviewImages.sortOrder))
    : [];
  const reviewPhotos = new Map<number, typeof reviewPhotoRows>();
  for (const photo of reviewPhotoRows) reviewPhotos.set(photo.reviewId, [...(reviewPhotos.get(photo.reviewId) ?? []), photo]);

  return {
    ...product,
    images,
    variants,
    reviews: reviewRows.map((review) => ({
      ...review,
      images: (reviewPhotos.get(review.id) ?? []).map((photo) => ({ ...photo, url: reviewImageEndpoint(photo.id) })),
    })),
  };
}

export async function saveProduct(input: {
  id?: number;
  name: string;
  category: Category;
  price: string;
  description: string;
  fabric: string;
  embroidery: string;
  stones: string;
  design: string;
  isPublished: boolean;
  images: Array<{ url: string; alt: string }>;
  variants: Array<{ size: string; stock: number }>;
}) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    let productId = input.id;
    let oldImages: Array<{ url: string }> = [];
    const productValues = {
      name: input.name,
      category: input.category,
      price: input.price,
      description: input.description,
      fabric: input.fabric,
      embroidery: input.embroidery,
      stones: input.stones,
      design: input.design,
      isPublished: input.isPublished,
      updatedAt: now,
    };

    if (productId) {
      const [existingProduct] = await tx.select({ id: s.products.id }).from(s.products)
        .where(eq(s.products.id, productId)).for("update").limit(1);
      if (!existingProduct) throw new Error("Product not found");
      const openOrders = await tx.select({ id: s.orders.id })
        .from(s.orderItems)
        .innerJoin(s.orders, eq(s.orderItems.orderId, s.orders.id))
        .where(and(eq(s.orderItems.productId, productId), inArray(s.orders.status, orderLockingStatuses)))
        .limit(1);
      if (openOrders.length) throw new Error("Product has open orders");
      oldImages = await tx.select({ url: s.productImages.url }).from(s.productImages).where(eq(s.productImages.productId, productId));
      await tx.update(s.products).set(productValues).where(eq(s.products.id, productId));
      await tx.delete(s.productImages).where(eq(s.productImages.productId, productId));
      await tx.delete(s.productVariants).where(eq(s.productVariants.productId, productId));
    } else {
      const [created] = await tx.insert(s.products).values(productValues).returning({ id: s.products.id });
      productId = created.id;
    }

    if (input.images.length) {
      await tx.insert(s.productImages).values(
        input.images.map((image, sortOrder) => ({ productId: productId!, url: image.url, alt: image.alt, sortOrder })),
      );
    }
    if (input.variants.length) {
      await tx.insert(s.productVariants).values(
        input.variants.map((variant) => ({ productId: productId!, size: variant.size, stock: variant.stock, updatedAt: now })),
      );
    }
    const [saved] = await tx.select().from(s.products).where(eq(s.products.id, productId!)).limit(1);
    return {
      product: saved,
      deletedImageUrls: oldImages.map((image) => image.url).filter((url) => !input.images.some((item) => item.url === url)),
    };
  });
}

export async function deleteProduct(id: number) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: s.products.id }).from(s.products).where(eq(s.products.id, id)).for("update").limit(1);
    if (!product) return [];
    const reservedOrders = await tx.select({ id: s.orders.id })
      .from(s.orderItems)
      .innerJoin(s.orders, eq(s.orderItems.orderId, s.orders.id))
      .where(and(
        eq(s.orderItems.productId, id),
        inArray(s.orders.status, orderLockingStatuses),
      ))
      .limit(1);
    if (reservedOrders.length) throw new Error("Product has open orders");

    const oldProductImages = await tx.select({ url: s.productImages.url }).from(s.productImages).where(eq(s.productImages.productId, id));
    const productReviews = await tx.select({ id: s.reviews.id }).from(s.reviews).where(eq(s.reviews.productId, id));
    const reviewIds = productReviews.map((review) => review.id);
    const oldReviewImages = reviewIds.length
      ? await tx.select({ url: s.reviewImages.url }).from(s.reviewImages).where(inArray(s.reviewImages.reviewId, reviewIds))
      : [];
    await tx.delete(s.products).where(eq(s.products.id, id));
    return [...oldProductImages, ...oldReviewImages].map((image) => image.url);
  });
}

export async function submitReview(input: {
  productId: number;
  customerName: string;
  rating: number;
  comment: string;
  images: string[];
}) {
  if (!input.images.every((url) => isPrivateReviewBlobUrl(url, input.productId))) {
    throw new Error("Review images must be private uploads for the selected product");
  }
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: s.products.id }).from(s.products).where(and(eq(s.products.id, input.productId), eq(s.products.isPublished, true))).limit(1);
    if (!product) throw new Error("Product is unavailable");
    const [review] = await tx.insert(s.reviews).values({
      productId: input.productId,
      customerName: input.customerName,
      rating: input.rating,
      comment: input.comment,
      approved: false,
    }).returning({ id: s.reviews.id });
    if (input.images.length) {
      await tx.insert(s.reviewImages).values(input.images.map((url, sortOrder) => ({ reviewId: review.id, url, sortOrder })));
    }
    return { id: review.id, approved: false };
  });
}

export async function listAdminReviews() {
  const db = requireDb();
  const rows = await db
    .select({ review: s.reviews, productName: s.products.name })
    .from(s.reviews)
    .innerJoin(s.products, eq(s.reviews.productId, s.products.id))
    .orderBy(asc(s.reviews.approved), desc(s.reviews.createdAt));
  const ids = rows.map((row) => row.review.id);
  const images = ids.length
    ? await db.select().from(s.reviewImages).where(inArray(s.reviewImages.reviewId, ids)).orderBy(asc(s.reviewImages.sortOrder))
    : [];
  const map = new Map<number, typeof images>();
  for (const image of images) map.set(image.reviewId, [...(map.get(image.reviewId) ?? []), image]);
  return rows.map(({ review, productName }) => ({
    ...review,
    productName,
    images: (map.get(review.id) ?? []).map((image) => ({ ...image, url: reviewImageEndpoint(image.id) })),
  }));
}

export async function getReviewImageForServing(id: number) {
  const db = requireDb();
  const [image] = await db.select({
    url: s.reviewImages.url,
    approved: s.reviews.approved,
    productId: s.reviews.productId,
  }).from(s.reviewImages)
    .innerJoin(s.reviews, eq(s.reviewImages.reviewId, s.reviews.id))
    .where(eq(s.reviewImages.id, id))
    .limit(1);
  return image ?? null;
}

export async function setReviewApproved(id: number, approved: boolean) {
  const db = requireDb();
  await db.update(s.reviews).set({ approved }).where(eq(s.reviews.id, id));
}

export async function deleteReview(id: number) {
  const db = requireDb();
  const images = await db.select({ url: s.reviewImages.url }).from(s.reviewImages).where(eq(s.reviewImages.reviewId, id));
  await db.delete(s.reviews).where(eq(s.reviews.id, id));
  return images.map((image) => image.url);
}

export async function createOrder(input: {
  customerName: string;
  phone: string;
  address: string;
  fulfillment: "delivery" | "pickup";
  items: Array<{ variantId: number; quantity: number }>;
}) {
  const db = requireDb();
  const quantities = new Map<number, number>();
  for (const item of input.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
  const requested = Array.from(quantities.entries()).map(([variantId, quantity]) => ({ variantId, quantity })).sort((a, b) => a.variantId - b.variantId);
  if (requested.length === 0) throw new Error("The cart is empty");

  return db.transaction(async (tx) => {
    const initialVariants = await tx.select({ id: s.productVariants.id, productId: s.productVariants.productId })
      .from(s.productVariants)
      .where(inArray(s.productVariants.id, requested.map((item) => item.variantId)))
      .orderBy(asc(s.productVariants.productId), asc(s.productVariants.id));
    if (initialVariants.length !== requested.length) throw new Error("A selected product is no longer available");
    const productIds = [...new Set(initialVariants.map((variant) => variant.productId))].sort((left, right) => left - right);
    for (const productId of productIds) {
      const [product] = await tx.select({ id: s.products.id }).from(s.products)
        .where(eq(s.products.id, productId)).for("update").limit(1);
      if (!product) throw new Error("A selected product is no longer available");
    }

    const checkedItems: Array<{
      variantId: number;
      productId: number;
      productName: string;
      size: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }> = [];

    for (const requestedItem of requested) {
      const [variant] = await tx
        .select()
        .from(s.productVariants)
        .where(eq(s.productVariants.id, requestedItem.variantId))
        .for("update")
        .limit(1);
      if (!variant || variant.stock < requestedItem.quantity) throw new Error("A selected size is no longer available in that quantity");
      const [product] = await tx.select().from(s.products).where(eq(s.products.id, variant.productId)).limit(1);
      if (!product || !product.isPublished) throw new Error("A selected product is no longer available");

      const itemCents = toCents(product.price) * requestedItem.quantity;
      checkedItems.push({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        size: variant.size,
        quantity: requestedItem.quantity,
        unitPrice: fromCents(toCents(product.price)),
        lineTotal: fromCents(itemCents),
      });
    }

    const subtotalCents = checkedItems.reduce((sum, item) => sum + toCents(item.lineTotal), 0);
    const deliveryFeeCents = input.fulfillment === "delivery" ? 1500 : 0;
    const now = new Date();
    const orderCode = `HA-${Date.now().toString(36).toUpperCase()}-${nanoid(5).toUpperCase()}`;
    const [createdOrder] = await tx.insert(s.orders).values({
      orderCode,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      fulfillment: input.fulfillment,
      status: "received",
      subtotal: fromCents(subtotalCents),
      deliveryFee: fromCents(deliveryFeeCents),
      total: fromCents(subtotalCents + deliveryFeeCents),
      updatedAt: now,
    }).returning({ id: s.orders.id, orderCode: s.orders.orderCode, total: s.orders.total });

    await tx.insert(s.orderItems).values(checkedItems.map((item) => ({
      orderId: createdOrder.id,
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })));

    return { orderCode: createdOrder.orderCode, total: createdOrder.total };
  });
}

export async function listAdminOrders() {
  const db = requireDb();
  const rows = await db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(200);
  if (!rows.length) return [];
  const ids = rows.map((order) => order.id);
  const items = await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, ids)).orderBy(asc(s.orderItems.id));
  const map = new Map<number, typeof items>();
  for (const item of items) map.set(item.orderId, [...(map.get(item.orderId) ?? []), item]);
  return rows.map((order) => ({ ...order, items: map.get(order.id) ?? [] }));
}

export async function updateOrder(input: { id: number; status: OrderStatus; deliveryFee?: string }) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.orders).where(eq(s.orders.id, input.id)).for("update").limit(1);
    if (!existing) return false;
    const now = new Date();
    assertOrderStatusMatchesFulfillment(input.status, existing.fulfillment);
    const inventoryTransition = getInventoryTransition(existing.status, input.status);

    if (inventoryTransition === "reserve") {
      const items = (await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, input.id)))
        .sort((left, right) => (left.productId ?? 0) - (right.productId ?? 0) || left.size.localeCompare(right.size));
      const validItems = items.filter((item): item is typeof item & { productId: number } => item.productId !== null);
      if (validItems.length !== items.length) throw new Error("Product was removed before order confirmation");
      const productIds = [...new Set(validItems.map((item) => item.productId))].sort((left, right) => left - right);
      for (const productId of productIds) {
        const [product] = await tx.select({ id: s.products.id }).from(s.products)
          .where(eq(s.products.id, productId)).for("update").limit(1);
        if (!product) throw new Error("Product was removed before order confirmation");
      }
      for (const item of validItems) {
        const [variant] = await tx.select().from(s.productVariants)
          .where(and(eq(s.productVariants.productId, item.productId), eq(s.productVariants.size, item.size)))
          .for("update")
          .limit(1);
        if (!variant || variant.stock < item.quantity) throw new Error("Stock changed before order confirmation");
        const updated = await tx.update(s.productVariants)
          .set({ stock: sql`${s.productVariants.stock} - ${item.quantity}`, updatedAt: now })
          .where(and(eq(s.productVariants.id, variant.id), gte(s.productVariants.stock, item.quantity)))
          .returning({ id: s.productVariants.id });
        if (updated.length === 0) throw new Error("Stock changed before order confirmation");
      }
    }

    if (inventoryTransition === "release") {
      const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, input.id));
      for (const item of items) {
        if (!item.productId) continue;
        await tx.insert(s.productVariants).values({
          productId: item.productId,
          size: item.size,
          stock: item.quantity,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [s.productVariants.productId, s.productVariants.size],
          set: {
            stock: sql`${s.productVariants.stock} + ${item.quantity}`,
            updatedAt: now,
          },
        });
      }
    }

    const deliveryFee = existing.fulfillment === "pickup" ? "0.00" : input.deliveryFee ?? existing.deliveryFee;
    const total = fromCents(toCents(existing.subtotal) + toCents(deliveryFee));
    await tx.update(s.orders).set({
      status: input.status,
      deliveryFee,
      total,
      updatedAt: now,
    }).where(eq(s.orders.id, input.id));
    return true;
  });
}

export async function listContactLinks(activeOnly = false) {
  const db = requireDb();
  return db.select().from(s.contactLinks)
    .where(activeOnly ? eq(s.contactLinks.active, true) : undefined)
    .orderBy(asc(s.contactLinks.sortOrder), asc(s.contactLinks.id));
}

export async function createContactLink(input: { label: string; channel: string; url: string }) {
  const db = requireDb();
  const [created] = await db.insert(s.contactLinks).values({ ...input, active: true }).returning();
  return created;
}

export async function deleteContactLink(id: number) {
  const db = requireDb();
  await db.delete(s.contactLinks).where(eq(s.contactLinks.id, id));
}

export async function getDashboardStats() {
  const db = requireDb();
  const [[productCounts], [orderCounts], [reviewCounts], recentOrders] = await Promise.all([
    db.select({ total: count(), published: sql<number>`count(*) filter (where ${s.products.isPublished} = true)` }).from(s.products),
    db.select({ total: count(), pending: sql<number>`count(*) filter (where ${s.orders.status} = 'received')` }).from(s.orders),
    db.select({ pending: count() }).from(s.reviews).where(eq(s.reviews.approved, false)),
    db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(5),
  ]);
  return {
    products: Number(productCounts.total),
    publishedProducts: Number(productCounts.published),
    orders: Number(orderCounts.total),
    newOrders: Number(orderCounts.pending),
    pendingReviews: Number(reviewCounts.pending),
    recentOrders,
  };
}
