import { describe, expect, it } from "vitest";
import { assertOrderStatusMatchesFulfillment, getInventoryTransition } from "./order-inventory";

describe("order inventory transitions", () => {
  it("keeps stock available while an order is new and when that order is cancelled", () => {
    expect(getInventoryTransition("received", "received")).toBe("none");
    expect(getInventoryTransition("received", "cancelled")).toBe("none");
  });

  it("reserves stock when a new order is confirmed, including a direct completion", () => {
    expect(getInventoryTransition("received", "confirmed")).toBe("reserve");
    expect(getInventoryTransition("received", "completed")).toBe("reserve");
  });

  it("keeps a reservation during fulfillment and releases it on cancellation", () => {
    expect(getInventoryTransition("confirmed", "preparing")).toBe("none");
    expect(getInventoryTransition("out_for_delivery", "cancelled")).toBe("release");
  });

  it("does not allow canceled/completed orders to change, or confirmed orders to return to new", () => {
    expect(() => getInventoryTransition("cancelled", "confirmed")).toThrow("Terminal orders");
    expect(() => getInventoryTransition("cancelled", "cancelled")).toThrow("Terminal orders");
    expect(() => getInventoryTransition("completed", "cancelled")).toThrow("Terminal orders");
    expect(() => getInventoryTransition("completed", "completed")).toThrow("Terminal orders");
    expect(() => getInventoryTransition("confirmed", "received")).toThrow("return to received");
  });

  it("keeps pickup and delivery statuses aligned with the fulfillment mode", () => {
    expect(() => assertOrderStatusMatchesFulfillment("ready_for_pickup", "delivery")).toThrow("requires pickup");
    expect(() => assertOrderStatusMatchesFulfillment("out_for_delivery", "pickup")).toThrow("requires delivery");
    expect(() => assertOrderStatusMatchesFulfillment("ready_for_pickup", "pickup")).not.toThrow();
  });
});
