import { describe, expect, it } from "vitest";
import { hashRateLimitSubject, normalizePhoneNumber, rateLimitBuckets } from "./public-rate-limits";

describe("public rate-limit helpers", () => {
  it("normalizes Western, Arabic-Indic, and Persian phone digits", () => {
    expect(normalizePhoneNumber("+966 ٥٠-١٢٣-٤٥٦٧")).toBe("966501234567");
    expect(normalizePhoneNumber("+966 ۵۰-۱۲۳-۴۵۶۷")).toBe("966501234567");
  });

  it("creates stable quarter-hour and UTC day bucket keys", () => {
    const first = Date.UTC(2026, 0, 2, 12, 7);
    const nearby = Date.UTC(2026, 0, 2, 12, 14);
    const nextWindow = Date.UTC(2026, 0, 2, 12, 15);
    expect(rateLimitBuckets("orders", first)).toEqual(rateLimitBuckets("orders", nearby));
    expect(rateLimitBuckets("orders", nextWindow).quarterHour).not.toBe(rateLimitBuckets("orders", first).quarterHour);
    expect(rateLimitBuckets("orders", first).day).toBe("orders:d:2026-01-02");
  });

  it("stores only a deterministic keyed HMAC, not the raw subject", () => {
    const hash = hashRateLimitSubject("phone:966501234567", "test-secret");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashRateLimitSubject("phone:966501234567", "test-secret"));
    expect(hash).not.toBe(hashRateLimitSubject("phone:966501234567", "another-secret"));
  });
});
