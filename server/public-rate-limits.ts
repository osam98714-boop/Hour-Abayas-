import { createHmac } from "node:crypto";

export function normalizePhoneNumber(value: string) {
  const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return Array.from(value.trim(), (character) => {
    const arabicIndex = arabicIndicDigits.indexOf(character);
    if (arabicIndex >= 0) return String(arabicIndex);
    const persianIndex = persianDigits.indexOf(character);
    if (persianIndex >= 0) return String(persianIndex);
    return character;
  }).join("").replace(/\D/g, "");
}

export function hashRateLimitSubject(value: string, secret = process.env.MANUS_JWT_SECRET) {
  if (!secret) throw new Error("A rate-limit signing secret is required");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function rateLimitBuckets(action: string, now = Date.now()) {
  const quarterHourStart = Math.floor(now / (15 * 60 * 1000)) * 15 * 60 * 1000;
  const day = new Date(now).toISOString().slice(0, 10);
  return {
    quarterHour: `${action}:q:${quarterHourStart}`,
    day: `${action}:d:${day}`,
  };
}
