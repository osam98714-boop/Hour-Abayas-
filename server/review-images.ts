export const REVIEW_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export function reviewImageEndpoint(id: number) {
  return `/api/review-images/${id}`;
}

export function isPrivateReviewBlobUrl(value: string, productId: number) {
  if (!Number.isSafeInteger(productId) || productId < 1) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".private.blob.vercel-storage.com") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) return false;
    const pathname = decodeURIComponent(url.pathname);
    return new RegExp(`^/reviews/${productId}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`, "i").test(pathname);
  } catch {
    return false;
  }
}
