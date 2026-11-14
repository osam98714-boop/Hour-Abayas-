import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const productCategoryEnum = pgEnum("product_category", ["women", "kids"]);
export const fulfillmentModeEnum = pgEnum("fulfillment_mode", ["delivery", "pickup"]);
export type Fulfillment = typeof fulfillmentModeEnum.enumValues[number];
export const orderStatusEnum = pgEnum("order_status", [
  "received",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("open_id", { length: 128 }).notNull(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("login_method", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    lastSignedIn: timestamp("last_signed_in", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_open_id_unique").on(table.openId)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    category: productCategoryEnum("category").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    description: text("description").notNull().default(""),
    fabric: text("fabric").notNull().default(""),
    embroidery: text("embroidery").notNull().default(""),
    stones: text("stones").notNull().default(""),
    design: text("design").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("products_category_published_idx").on(table.category, table.isPublished)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    size: varchar("size", { length: 32 }).notNull(),
    stock: integer("stock").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("product_variants_product_size_unique").on(table.productId, table.size),
    index("product_variants_product_stock_idx").on(table.productId, table.stock),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: varchar("alt", { length: 240 }).notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("product_images_product_order_idx").on(table.productId, table.sortOrder)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderCode: varchar("order_code", { length: 32 }).notNull(),
    customerName: varchar("customer_name", { length: 140 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    address: text("address").notNull().default(""),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    fulfillment: fulfillmentModeEnum("fulfillment").notNull(),
    status: orderStatusEnum("status").notNull().default("received"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("orders_order_code_unique").on(table.orderCode),
    index("orders_created_status_idx").on(table.createdAt, table.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 180 }).notNull(),
    size: varchar("size", { length: 32 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull().default(""),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("reviews_product_approved_idx").on(table.productId, table.approved)],
);

export const reviewImages = pgTable(
  "review_images",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("review_images_review_order_idx").on(table.reviewId, table.sortOrder)],
);

export const contactLinks = pgTable(
  "contact_links",
  {
    id: serial("id").primaryKey(),
    label: varchar("label", { length: 80 }).notNull(),
    channel: varchar("channel", { length: 32 }).notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("contact_links_active_order_idx").on(table.active, table.sortOrder)],
);

export const storeAnnouncements = pgTable(
  "store_announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 140 }).notNull(),
    message: text("message").notNull(),
    imageUrl: text("image_url"),
    linkLabel: varchar("link_label", { length: 60 }),
    linkUrl: text("link_url"),
    active: boolean("active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("store_announcements_active_updated_idx").on(table.active, table.updatedAt)],
);

export const publicActionRateLimits = pgTable(
  "public_action_rate_limits",
  {
    id: serial("id").primaryKey(),
    subjectHash: varchar("subject_hash", { length: 64 }).notNull(),
    bucketKey: varchar("bucket_key", { length: 48 }).notNull(),
    actionCount: integer("action_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("public_action_rate_limits_subject_bucket_unique").on(table.subjectHash, table.bucketKey),
    index("public_action_rate_limits_updated_idx").on(table.updatedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type StoreOrder = typeof orders.$inferSelect;
export type StoreOrderItem = typeof orderItems.$inferSelect;
export type ProductReview = typeof reviews.$inferSelect;
export type ContactLink = typeof contactLinks.$inferSelect;
