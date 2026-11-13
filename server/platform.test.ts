import { afterEach, describe, expect, it, vi } from "vitest";
import { publicPlatformConfig, publicPlatformScript } from "./_core/publicConfig";
import { getSessionCookieOptions } from "./_core/cookies";
import { isCurrentOwner } from "./_core/owner";
import { listLLMModels } from "./_core/llm";
import { storagePut } from "./storage";
import { ADMIN_SESSION_COOKIE } from "../shared/const";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("store platform integration", () => {
  it("exposes only named browser-safe runtime configuration", () => {
    const env = {
      MANUS_API_KEY: "server-only-test",
      MANUS_JWT_SECRET: "signing-only-test",
      DATABASE_URL: "db-only-test",
      MANUS_API_BROWSER_KEY: "public-browser-test",
      MANUS_ANALYTICS_ENDPOINT: "https://analytics.example",
      MANUS_ANALYTICS_WEBSITE_ID: "site-test",
    };
    expect(publicPlatformConfig(env)).toEqual({ apiUrl: "", apiBrowserKey: "public-browser-test" });
    const script = publicPlatformScript(env);
    for (const value of [env.MANUS_API_KEY, env.MANUS_JWT_SECRET, env.DATABASE_URL]) expect(script).not.toContain(value);
  });

  it("omits Manus proxy values from external Vercel builds", () => {
    const config = publicPlatformConfig({
      VERCEL_BUILD: "1",
      MANUS_API_URL: "https://forge.manus.ai",
      MANUS_API_BROWSER_KEY: "must-not-ship",
    });
    expect(config).toEqual({ apiUrl: "", apiBrowserKey: "" });
    expect(publicPlatformScript({ VERCEL: "1", MANUS_API_BROWSER_KEY: "must-not-ship" })).not.toContain("must-not-ship");
  });

  it("does not guess a production API when the project environment is absent", async () => {
    vi.stubEnv("MANUS_API_URL", "");
    vi.stubEnv("MANUS_API_KEY", "test-only");
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(listLLMModels()).rejects.toThrow("MANUS_API_URL");
    expect(request).not.toHaveBeenCalled();
  });

  it("refuses a server-side Blob upload when Vercel storage is not configured", async () => {
    vi.stubEnv("PRODUCT_BLOB_READ_WRITE_TOKEN", "");
    await expect(storagePut("products/test-image.jpg", Buffer.from([1, 2, 3]), "image/jpeg"))
      .rejects.toThrow("Vercel Blob is not configured");
  });

  it("uses a distinct secure admin cookie behind HTTPS Preview and Vercel", () => {
    expect(ADMIN_SESSION_COOKIE).not.toBe("app_session_id");
    const previewRequest = { protocol: "http", hostname: "project.manuspre.computer", headers: {} } as never;
    const localRequest = { protocol: "http", hostname: "localhost", headers: {} } as never;
    expect(getSessionCookieOptions(previewRequest)).toMatchObject({ secure: true, httpOnly: true, sameSite: "none" });
    expect(getSessionCookieOptions(localRequest)).toMatchObject({ secure: false, httpOnly: true, sameSite: "lax" });
  });

  it("grants admin access only to the newly authenticated environment session", () => {
    expect(isCurrentOwner({ id: 4, openId: "old-manus-user", loginMethod: "manus", role: "admin" })).toBe(false);
    expect(isCurrentOwner({ id: -1, openId: "hour-admin:verified", loginMethod: "environment", role: "admin" })).toBe(true);
  });
});
