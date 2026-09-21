import Link from "next/link";
import { GhostImage } from "@/components/catalog/GhostImage";
import { formatPrice } from "@/lib/formatPrice";
import type { Product } from "@/types/catalog";

interface ProductCardProps {
    layout?: "grid" | "list";
    product: Product;
}

export function ProductCard({ layout = "grid", product }: ProductCardProps) {
    if (layout === "list") {
        return (
            <article className="flex gap-4 border-b border-stone-200 py-4">
                <GhostImage alt="" size="sm" />
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{product.brand}</p>
                    <Link className="mt-1 font-medium text-stone-950 hover:text-amber-700" href={`/products/${product.sku}`}>
                        {product.name}
                    </Link>
                    <p className="mt-2 font-semibold text-stone-950">{formatPrice(product.price_cents)}</p>
                </div>
                <button className="self-center rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-400" disabled>
                    Toevoegen
                </button>
            </article>
        );
    }

    return (
        <article className="group overflow-hidden border border-stone-200 bg-white">
            <Link href={`/products/${product.sku}`} className="block">
                <GhostImage alt="" />
                <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{product.brand}</p>
                    <h3 className="mt-2 min-h-12 text-base font-medium leading-6 text-stone-950 group-hover:text-amber-700">
                        {product.name}
                    </h3>
                    <p className="mt-3 font-semibold text-stone-950">{formatPrice(product.price_cents)}</p>
                </div>
            </Link>
            <div className="px-4 pb-4">
                <button className="w-full rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-400" disabled>
                    Toevoegen aan winkelmand
                </button>
            </div>
        </article>
    );
}