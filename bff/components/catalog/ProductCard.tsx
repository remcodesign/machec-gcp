import Link from "next/link";
import { GhostImage } from "@/components/catalog/GhostImage";
import { formatPrice } from "@/lib/formatPrice";
import { stockLabel } from "@/lib/stockLabel";
import type { Product } from "@/types/catalog";

interface ProductCardProps {
  layout?: "grid" | "list";
  product: Product;
}

export function ProductCard({ layout = "grid", product }: ProductCardProps) {
  const stock = stockLabel(product.stock);

  if (layout === "list") {
    return (
      <article className="flex gap-4 border-b border-stone-200 py-4">
        <GhostImage alt="" size="sm" />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {product.brand}
          </p>
          <Link
            className="mt-1 font-medium text-stone-950 hover:text-amber-700"
            href={`/products/${product.sku}`}
          >
            {product.name}
          </Link>
          <p className="mt-2 font-semibold text-stone-950">
            {formatPrice(product.price_cents)}
          </p>
          <p className={`mt-1 text-xs font-medium ${stock.className}`}>
            {stock.text}
          </p>
        </div>
        <button
          className="self-center cursor-not-allowed rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-400"
          disabled
        >
          Toevoegen
        </button>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden border border-stone-200 bg-white">
      <Link href={`/products/${product.sku}`} className="flex flex-1 flex-col">
        <div className="relative">
          <GhostImage alt="" />
          {stock.inStock && (
            <span
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {product.brand}
          </p>
          <h3 className="mt-2 text-base font-medium leading-6 text-stone-950 group-hover:text-amber-700">
            {product.name}
          </h3>
          <div className="mt-auto pt-3">
            <p className="font-semibold text-stone-950">
              {formatPrice(product.price_cents)}
            </p>
            <p className={`mt-1 text-xs font-medium ${stock.className}`}>
              {stock.text}
            </p>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4">
        <button
          className="w-full cursor-not-allowed rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-400"
          disabled
        >
          Toevoegen aan winkelmand
        </button>
      </div>
    </article>
  );
}
