import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { ADMIN_SESSION_COOKIE } from "@shared/const";
import type { User } from "../../drizzle/schema";

export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_SECONDS = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
const JWT_ISSUER = "hour-abayas";
const JWT_AUDIENCE = "hour-abayas-admin";

type AdminConfig = { username: string; password: string; sessionSecret: string };

function readAdminConfig(env: NodeJS.ProcessEnv = process.env): AdminConfig {
  return {
    username: env.ADMIN_USERNAME?.trim() ?? "",
    password: env.ADMIN_PASSWORD ?? "",
    sessionSecret: env.MANUS_JWT_SECRET ?? "",
  };
}

export function hasAdminLoginConfiguration(env: NodeJS.ProcessEnv = process.env): boolean {
  const config = readAdminConfig(env);
  return Boolean(config.username && config.password && config.sessionSecret.length >= 32);
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function credentialFingerprint(config: AdminConfig): string {
  return createHmac("sha256", config.sessionSecret)
    .update(config.username.toLowerCase())
    .update("\0")
    .update(config.password)
    .digest("hex");
}

export function verifyAdminCredentials(username: string, password: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const config = readAdminConfig(env);
  if (!hasAdminLoginConfiguration(env)) return null;
  const usernameMatches = constantTimeStringEqual(username.trim().toLowerCase(), config.username.toLowerCase());
  const passwordMatches = constantTimeStringEqual(password, config.password);
  return usernameMatches && passwordMatches ? config.username : null;
}

export async function createAdminSessionToken(username: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const config = readAdminConfig(env);
  if (!hasAdminLoginConfiguration(env) || !constantTimeStringEqual(username, config.username)) {
    throw new Error("Admin login is not configured");
  }

  return new SignJWT({
    sessionType: "hour-admin",
    username: config.username,
    credentialFingerprint: credentialFingerprint(config),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(config.sessionSecret));
}

export async function authenticateAdminSession(token: string, env: NodeJS.ProcessEnv = process.env): Promise<User | null> {
  const config = readAdminConfig(env);
  if (!hasAdminLoginConfiguration(env)) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.sessionSecret), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (
      payload.sessionType !== "hour-admin" ||
      typeof payload.username !== "string" ||
      !constantTimeStringEqual(payload.username, config.username) ||
      typeof payload.credentialFingerprint !== "string" ||
      !constantTimeStringEqual(payload.credentialFingerprint, credentialFingerprint(config))
    ) return null;

    const now = new Date();
    return {
      id: -1,
      openId: `hour-admin:${createHash("sha256").update(config.username).digest("hex")}`,
      name: config.username,
      email: null,
      loginMethod: "environment",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  } catch {
    return null;
  }
}

export async function authenticateAdminRequest(
  req: Pick<Request, "headers">,
  env: NodeJS.ProcessEnv = process.env,
): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[ADMIN_SESSION_COOKIE];
  return token ? authenticateAdminSession(token, env) : null;
}
