import { describe, expect, it } from "vitest";
import { isPrivateReviewBlobUrl, reviewImageEndpoint, REVIEW_IMAGE_MAX_BYTES } from "./review-images";

const validReviewImage = "https://store-id.private.blob.vercel-storage.com/reviews/42/550e8400-e29b-41d4-a716-446655440000.webp";

describe("private review image references", () => {
  it("accepts only a private same-product Vercel Blob upload", () => {
    expect(isPrivateReviewBlobUrl(validReviewImage, 42)).toBe(true);
    expect(isPrivateReviewBlobUrl(validReviewImage, 7)).toBe(false);
    expect(isPrivateReviewBlobUrl(validReviewImage.replace(".private.blob.", ".blob."), 42)).toBe(false);
    expect(isPrivateReviewBlobUrl("https://example.com/reviews/42/550e8400-e29b-41d4-a716-446655440000.webp", 42)).toBe(false);
    expect(isPrivateReviewBlobUrl(`${validReviewImage}?token=public`, 42)).toBe(false);
  });

  it("uses a stable same-origin image endpoint and stays below a 4 MiB request cap", () => {
    expect(reviewImageEndpoint(18)).toBe("/api/review-images/18");
    expect(REVIEW_IMAGE_MAX_BYTES).toBe(4 * 1024 * 1024);
  });
});
