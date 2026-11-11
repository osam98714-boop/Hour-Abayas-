import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StoreProduct } from "@/lib/store-types";

export type CartItem = {
  variantId: number;
  productId: number;
  productName: string;
  category: "women" | "kids";
  size: string;
  unitPrice: string;
  quantity: number;
  stock: number;
  imageUrl: string | null;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: StoreProduct, variantId: number, quantity: number) => boolean;
  updateQuantity: (variantId: number, quantity: number) => void;
  removeItem: (variantId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
    return {
      items,
      itemCount,
      subtotal,
      addItem(product, variantId, quantity) {
        const variant = product.variants.find((item) => item.id === variantId);
        if (!variant || variant.stock <= 0 || quantity < 1) return false;
        setItems((current) => {
          const existing = current.find((item) => item.variantId === variantId);
          if (existing) {
            return current.map((item) => item.variantId === variantId
              ? { ...item, quantity: Math.min(variant.stock, item.quantity + quantity), stock: variant.stock }
              : item);
          }
          return [...current, {
            variantId,
            productId: product.id,
            productName: product.name,
            category: product.category,
            size: variant.size,
            unitPrice: product.price,
            quantity: Math.min(quantity, variant.stock),
            stock: variant.stock,
            imageUrl: product.images[0]?.url ?? null,
          }];
        });
        return true;
      },
      updateQuantity(variantId, quantity) {
        setItems((current) => current.map((item) => item.variantId === variantId
          ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) }
          : item));
      },
      removeItem(variantId) {
        setItems((current) => current.filter((item) => item.variantId !== variantId));
      },
      clear() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
