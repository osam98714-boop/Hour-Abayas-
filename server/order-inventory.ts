import type { OrderStatus } from "./store-data";
import type { Fulfillment } from "../drizzle/schema";

export type InventoryTransition = "none" | "reserve" | "release";

export function getInventoryTransition(current: OrderStatus, next: OrderStatus): InventoryTransition {
  if (current === "cancelled" || current === "completed") {
    throw new Error("Terminal orders cannot be reopened or changed");
  }
  if (current === next) return "none";
  if (current !== "received" && next === "received") {
    throw new Error("Confirmed orders cannot return to received status");
  }
  if (current === "received") return next === "cancelled" ? "none" : "reserve";
  if (next === "cancelled") return "release";
  return "none";
}

export function assertOrderStatusMatchesFulfillment(status: OrderStatus, fulfillment: Fulfillment) {
  if (status === "ready_for_pickup" && fulfillment !== "pickup") {
    throw new Error("Pickup status requires pickup fulfillment");
  }
  if (status === "out_for_delivery" && fulfillment !== "delivery") {
    throw new Error("Delivery status requires delivery fulfillment");
  }
}
