import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type StoreProduct = RouterOutputs["store"]["products"]["list"][number];
export type StoreProductDetail = NonNullable<RouterOutputs["store"]["products"]["byId"]>;

export function formatSar(value: string | number) {
  const amount = Number(value);
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}
