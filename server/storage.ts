import { del, put } from "@vercel/blob";

function normalizeKey(key: string) {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

/** Server-side helper retained for optional internal utilities; storefront uploads use signed client uploads. */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const token = process.env.PRODUCT_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Vercel Blob is not configured");
  const key = normalizeKey(relKey);
  const body = typeof data === "string" || Buffer.isBuffer(data) ? data : Buffer.from(data);
  const blob = await put(key, body, { access: "public", contentType, token, addRandomSuffix: true });
  return { key: blob.pathname, url: blob.url };
}

export async function deleteStoredImages(urls: string[]) {
  const productUrls: string[] = [];
  const reviewUrls: string[] = [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com")) continue;
      if (parsed.pathname.startsWith("/products/")) productUrls.push(url);
      if (parsed.pathname.startsWith("/reviews/")) reviewUrls.push(url);
    } catch {
      continue;
    }
  }

  const deleteGroup = async (safeUrls: string[], token: string | undefined, label: "products" | "reviews") => {
    if (!safeUrls.length || !token) return;
    try {
      await del(safeUrls, { token });
    } catch (error) {
      console.error(`[Vercel Blob ${label}] Could not delete an old image:`, error instanceof Error ? error.name : "unknown error");
    }
  };
  await Promise.all([
    deleteGroup(productUrls, process.env.PRODUCT_BLOB_READ_WRITE_TOKEN, "products"),
    deleteGroup(reviewUrls, process.env.REVIEW_BLOB_READ_WRITE_TOKEN, "reviews"),
  ]);
}
