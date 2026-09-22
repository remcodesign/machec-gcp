import { cache } from "react";
import { getCatalogProduct } from "@/hooks/useCatalog";
import { cartStore } from "@/lib/cartStore";
import type { Product } from "@/types/catalog";

export interface ResolvedCartLine {
  sku: string;
  quantity: number;
  product: Product;
}

export interface ResolvedCart {
  lines: ResolvedCartLine[];
  itemCount: number;
}

// The one place a cart doc's raw { sku, quantity } lines get turned into
// something the storefront can show or count — used by both app/layout.tsx
// (the header's item-count badge, D119) and app/(shop)/cart/page.tsx (the
// cart page itself), so the two can never again disagree on what counts as
// "in the cart" the way they did before this existed (D123: the header
// summed every raw line including ones whose sku no longer resolves in the
// catalog, the cart page silently dropped those same lines when rendering,
// and neither ever told Firestore about the difference).
//
// Wrapped in React's per-request cache() since layout.tsx and page.tsx both
// call this for the same cartId in the same render pass — without it,
// that's two Firestore reads (and, on a prune, two writes) for one page view.
export const getResolvedCart = cache(
  async (cartId: string | undefined): Promise<ResolvedCart> => {
    if (!cartId) {
      return { lines: [], itemCount: 0 };
    }

    const cart = await cartStore.getCart(cartId);
    const resolved = await Promise.all(
      cart.items.map(async (item): Promise<ResolvedCartLine | null> => {
        const product = await getCatalogProduct(item.sku);
        return product
          ? { sku: item.sku, quantity: item.quantity, product }
          : null;
      }),
    );

    const lines = resolved.filter(
      (line): line is ResolvedCartLine => line !== null,
    );

    if (lines.length !== cart.items.length) {
      await cartStore.replaceItems(
        cartId,
        lines.map(({ sku, quantity }) => ({ sku, quantity })),
      );
    }

    return {
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  },
);
