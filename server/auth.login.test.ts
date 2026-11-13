import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE } from "../shared/const";
import { authenticateAdminSession } from "./_core/adminAuth";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createContext(cookieCalls: CookieCall[] = []): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      hostname: "hour-abayas-makkah.vercel.app",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
}

describe("admin credential login", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_USERNAME", "store-owner");
    vi.stubEnv("ADMIN_PASSWORD", "local-test-password-not-for-production");
    vi.stubEnv("MANUS_JWT_SECRET", "unit-test-secret-that-is-at-least-32-characters-long");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sets a secure HttpOnly admin session cookie after valid credentials", async () => {
    const cookieCalls: CookieCall[] = [];
    const caller = appRouter.createCaller(createContext(cookieCalls));
    const result = await caller.auth.login({
      username: " STORE-OWNER ",
      password: "local-test-password-not-for-production",
    });

    expect(result).toEqual({ success: true });
    expect(cookieCalls).toHaveLength(1);
    expect(cookieCalls[0]).toMatchObject({
      name: ADMIN_SESSION_COOKIE,
      options: { httpOnly: true, secure: true, sameSite: "none", path: "/" },
    });
    expect(cookieCalls[0]?.options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    expect(cookieCalls[0]?.value).not.toContain("local-test-password-not-for-production");
    await expect(authenticateAdminSession(cookieCalls[0]!.value)).resolves.toMatchObject({
      name: "store-owner",
      role: "admin",
      loginMethod: "environment",
    });
  });

  it("does not issue a cookie for incorrect credentials", async () => {
    const cookieCalls: CookieCall[] = [];
    const caller = appRouter.createCaller(createContext(cookieCalls));

    await expect(caller.auth.login({ username: "store-owner", password: "wrong-password" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookieCalls).toHaveLength(0);
  });

  it("invalidates an existing session when the Vercel credentials change", async () => {
    const cookieCalls: CookieCall[] = [];
    const caller = appRouter.createCaller(createContext(cookieCalls));
    await caller.auth.login({ username: "store-owner", password: "local-test-password-not-for-production" });
    vi.stubEnv("ADMIN_PASSWORD", "rotated-test-password-not-for-production");

    await expect(authenticateAdminSession(cookieCalls[0]!.value)).resolves.toBeNull();
  });
});
