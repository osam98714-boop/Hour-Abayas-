import { describe, expect, it } from "vitest";
import { restoreVercelApiRequestUrl } from "./_core/vercelApiPath";

const routeParameter = "__hour_abayas_original_api_path";

describe("Vercel Express path adapter", () => {
  it("restores nested tRPC routes and preserves the original query string", () => {
    const url = `/api/index?${routeParameter}=%2Fapi%2Ftrpc%2Fstore.list&batch=1&input=%7B%22json%22%3A%7B%7D%7D`;
    expect(restoreVercelApiRequestUrl(url)).toBe(
      "/api/trpc/store.list?batch=1&input=%7B%22json%22%3A%7B%7D%7D",
    );
  });

  it("restores health and admin-session routes under the API namespace", () => {
    expect(restoreVercelApiRequestUrl(`/api/index?${routeParameter}=%2Fapi%2Fhealth`)).toBe("/api/health");
    expect(restoreVercelApiRequestUrl(`/api/index?${routeParameter}=%2Fapi%2Ftrpc%2Fauth.login`)).toBe("/api/trpc/auth.login");
  });

  it("leaves ordinary URLs unchanged when they have no rewrite marker", () => {
    const url = "/api/index?health=1";
    expect(restoreVercelApiRequestUrl(url)).toBe(url);
  });

  it("rejects rewrite targets outside the API namespace and traversal paths", () => {
    expect(() => restoreVercelApiRequestUrl(`/api/index?${routeParameter}=%2Fadmin`)).toThrow();
    expect(() => restoreVercelApiRequestUrl(`/api/index?${routeParameter}=%2Fapi%2F..%2Fadmin`)).toThrow();
  });
});
