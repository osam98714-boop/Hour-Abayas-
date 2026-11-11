import type { User } from "../../drizzle/schema";

export function isCurrentOwner(
  user: Pick<User, "openId" | "role"> | null | undefined,
  configuredOwnerId = process.env.OWNER_OPEN_ID,
): boolean {
  const expectedOwnerId = configuredOwnerId?.trim();
  return Boolean(expectedOwnerId && user && user.role === "admin" && user.openId === expectedOwnerId);
}
