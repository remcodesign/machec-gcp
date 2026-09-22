"use client";

import { useCart } from "@/hooks/useCart";
import { stockLabel } from "@/lib/stockLabel";
import type { Product } from "@/types/catalog";

interface AddToCartButtonProps {
  className: string;
  label: string;
  product: Product;
}

// The one place ProductCard (grid + list) and ProductDetail wire up "Add to
// cart" — sharing this means a behavior change (the header count refresh
// fix, the submit cooldown) lands for all three at once instead of having
// to be repeated per call site.
export function AddToCartButton({
  className,
  label,
  product,
}: AddToCartButtonProps) {
  const { addItem, isSubmitting } = useCart();
  const inStock = stockLabel(product.stock).inStock;

  return (
    <button
      className={className}
      disabled={!inStock || isSubmitting}
      onClick={() => void addItem(product.sku)}
      type="button"
    >
      {label}
    </button>
  );
}
