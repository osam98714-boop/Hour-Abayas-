import type { User } from "../../drizzle/schema";

export function isCurrentOwner(
  user: Pick<User, "id" | "openId" | "loginMethod" | "role"> | null | undefined,
): boolean {
  return Boolean(
    user?.role === "admin" &&
    user.id === -1 &&
    user.loginMethod === "environment" &&
    user.openId.startsWith("hour-admin:"),
  );
}
