import { describe, expect, it } from "vitest";
import { isCurrentOwner } from "./owner";

describe("store admin authorization", () => {
  it("allows only the verified environment-backed admin session", () => {
    expect(isCurrentOwner({ id: -1, openId: "hour-admin:verified", loginMethod: "environment", role: "admin" })).toBe(true);
    expect(isCurrentOwner({ id: 7, openId: "old-manus-user", loginMethod: "manus", role: "admin" })).toBe(false);
    expect(isCurrentOwner({ id: -1, openId: "hour-admin:verified", loginMethod: "environment", role: "user" })).toBe(false);
  });

  it("fails closed when the user is absent or lacks the complete admin identity", () => {
    expect(isCurrentOwner(null)).toBe(false);
    expect(isCurrentOwner({ id: -1, openId: "hour-admin:verified", loginMethod: null, role: "admin" })).toBe(false);
  });
});
