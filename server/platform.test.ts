import { afterEach, describe, expect, it, vi } from "vitest";
import { publicPlatformConfig, publicPlatformScript } from "./_core/publicConfig";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { listLLMModels } from "./_core/llm";
import { storagePut } from "./storage";
import { COOKIE_NAME, LOCAL_OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE } from "../shared/const";
import { getOAuthStateCookieName } from "./_core/cookies";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("current platform integration", () => {
  it("exposes only named public runtime configuration", () => {
    const env = { MANUS_PROJECT_ID: "project-test", MANUS_API_KEY: "server-only-test", MANUS_JWT_SECRET: "signing-only-test", DATABASE_URL: "db-only-test", MANUS_API_BROWSER_KEY: "public-browser-test", MANUS_ANALYTICS_ENDPOINT: "https://analytics.example", MANUS_ANALYTICS_WEBSITE_ID: "site-test" };
    expect(publicPlatformConfig(env)).toMatchObject({ projectId: "project-test", apiBrowserKey: "public-browser-test" });
    const script = publicPlatformScript(env);
    for (const value of [env.MANUS_API_KEY, env.MANUS_JWT_SECRET, env.DATABASE_URL]) expect(script).not.toContain(value);
    const appended: unknown[] = [];
    const fakeDocument = { createElement: () => ({ setAttribute() {} }), head: { appendChild: (node: unknown) => appended.push(node) } };
    new Function("window", "document", script)({}, fakeDocument);
    expect(appended).toHaveLength(0);
    new Function("window", "document", publicPlatformScript({}))({}, fakeDocument);
    expect(appended).toHaveLength(0);
  });
  it("omits Manus proxy values from external Vercel builds", () => {
    const config = publicPlatformConfig({
      VERCEL_BUILD: "1",
      MANUS_PROJECT_ID: "project-test",
      MANUS_OAUTH_PORTAL_URL: "https://auth.example",
      MANUS_API_URL: "https://forge.manus.ai",
      MANUS_API_BROWSER_KEY: "must-not-ship",
    });
    expect(config).toMatchObject({ projectId: "project-test", oauthPortalUrl: "https://auth.example", apiUrl: "", apiBrowserKey: "" });
    expect(publicPlatformScript({ VERCEL: "1", MANUS_API_BROWSER_KEY: "must-not-ship" })).not.toContain("must-not-ship");
  });
  it("does not guess a production API when the project environment is absent", async () => {
    vi.stubEnv("MANUS_API_URL", ""); vi.stubEnv("MANUS_API_KEY", "test-only");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    await expect(listLLMModels()).rejects.toThrow("MANUS_API_URL");
    expect(request).not.toHaveBeenCalled();
  });
  it("refuses a server-side Blob upload when Vercel storage is not configured", async () => {
    vi.stubEnv("PRODUCT_BLOB_READ_WRITE_TOKEN", "");
    await expect(storagePut("products/test-image.jpg", Buffer.from([1, 2, 3]), "image/jpeg"))
      .rejects.toThrow("Vercel Blob is not configured");
  });
  it("uses a distinct secure app cookie behind the HTTPS Preview proxy", () => {
    expect(COOKIE_NAME).not.toBe("app_session_id");
    const previewRequest = { protocol: "http", hostname: "project.manuspre.computer", headers: {} } as never;
    const localRequest = { protocol: "http", hostname: "localhost", headers: {} } as never;
    expect(getSessionCookieOptions(previewRequest)).toMatchObject({ secure: true, httpOnly: true, sameSite: "none" });
    expect(getSessionCookieOptions(localRequest)).toMatchObject({ secure: false, httpOnly: true, sameSite: "lax" });
    expect(getOAuthStateCookieName(previewRequest)).toBe(OAUTH_STATE_COOKIE);
    expect(getOAuthStateCookieName(localRequest)).toBe(LOCAL_OAUTH_STATE_COOKIE);
  });
  it("binds signed app sessions to this project and accepts an empty display name", async () => {
    vi.stubEnv("MANUS_PROJECT_ID", "project-test");
    vi.stubEnv("MANUS_JWT_SECRET", "unit-test-signing-key-never-deployed");
    const token = await sdk.signSession({ openId: "user-test", appId: "project-test", name: "" });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: "user-test" });
    vi.stubEnv("MANUS_PROJECT_ID", "different-project");
    expect(await sdk.verifySession(token)).toBeNull();
  });
});
