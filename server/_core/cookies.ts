import type { CookieOptions, Request } from "express";
import { LOCAL_OAUTH_STATE_COOKIE, OAUTH_STATE_COOKIE } from "@shared/const";

function isLoopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return ["localhost", "127.0.0.1", "::1"].includes(normalized);
}

/** Only plain-HTTP loopback development uses non-Secure cookies. Public Preview and Vercel stay HTTPS-safe. */
export function isPlainLocalHttp(req: Request) {
  return req.protocol === "http" && isLoopbackHost(req.hostname);
}

export function getSessionCookieOptions(req: Request): CookieOptions {
  if (isPlainLocalHttp(req)) return { httpOnly: true, path: "/", sameSite: "lax", secure: false };
  // Preview is public HTTPS in a cross-site frame even when the upstream request is HTTP.
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

export function getOAuthStateCookieName(req: Request) {
  return isPlainLocalHttp(req) ? LOCAL_OAUTH_STATE_COOKIE : OAUTH_STATE_COOKIE;
}

export function getOAuthStateCookieOptions(req: Request): CookieOptions {
  return isPlainLocalHttp(req)
    ? { path: "/", sameSite: "lax", secure: false }
    : { path: "/", sameSite: "none", secure: true };
}
