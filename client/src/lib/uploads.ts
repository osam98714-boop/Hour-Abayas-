import { upload } from "@vercel/blob/client";

const PRODUCT_MAX_BYTES = 12 * 1024 * 1024;
const REVIEW_MAX_BYTES = 4 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function compressIfNeeded(file: File, maxBytes: number): Promise<File> {
  if (!acceptedTypes.has(file.type)) throw new Error("اختاري صورة بصيغة JPG أو PNG أو WebP.");
  if (file.size <= maxBytes) return file;

  const image = await createImageBitmap(file);
  const scale = Math.min(1, 2600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر تجهيز الصورة للرفع.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  let blob: Blob | null = null;
  for (const quality of [0.88, 0.78, 0.68, 0.58]) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= maxBytes) break;
  }
  if (!blob || blob.size > maxBytes) throw new Error("حجم الصورة ما زال كبيرًا؛ اختاري صورة أصغر.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: Date.now() });
}

export async function uploadStoreImage(file: File, purpose: "product" | "review" | "announcement", productId?: number) {
  if (purpose === "review") {
    if (!Number.isSafeInteger(productId) || !productId || productId < 1) throw new Error("معرّف المنتج غير صالح.");
    const prepared = await compressIfNeeded(file, REVIEW_MAX_BYTES);
    const response = await fetch(`/api/review-upload?productId=${productId}`, {
      method: "POST",
      headers: { "Content-Type": prepared.type },
      body: prepared,
    });
    const result = await response.json().catch(() => null) as { url?: string; error?: string } | null;
    if (!response.ok || !result?.url) throw new Error(result?.error || "تعذر رفع صورة التقييم بأمان.");
    return result.url;
  }

  const prepared = await compressIfNeeded(file, PRODUCT_MAX_BYTES);
  const prefix = purpose === "announcement" ? "announcements" : "products";
  const pathname = `${prefix}/${crypto.randomUUID()}.${extensionFor(prepared.type)}`;
  const result = await upload(pathname, prepared, {
    access: "public",
    contentType: prepared.type,
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ purpose }),
    multipart: false,
  });
  return result.url;
}
