import { describe, expect, it } from "vitest";
import { isCurrentOwner } from "./owner";

describe("current store owner authorization", () => {
  it("allows only the configured owner with the admin role", () => {
    expect(isCurrentOwner({ openId: "owner-1", role: "admin" }, "owner-1")).toBe(true);
    expect(isCurrentOwner({ openId: "other-admin", role: "admin" }, "owner-1")).toBe(false);
    expect(isCurrentOwner({ openId: "owner-1", role: "user" }, "owner-1")).toBe(false);
  });

  it("fails closed when the owner is not configured or the user is absent", () => {
    expect(isCurrentOwner({ openId: "owner-1", role: "admin" }, "")).toBe(false);
    expect(isCurrentOwner(null, "owner-1")).toBe(false);
  });
});
