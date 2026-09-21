"use client";

import { useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ViewToggle } from "@/components/catalog/ViewToggle";
import type { Product } from "@/types/catalog";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ViewToggle layout={layout} onChange={setLayout} />
      </div>
      {products.length === 0 ? (
        <p className="border border-dashed border-stone-300 px-5 py-12 text-center text-stone-600">
          Geen producten gevonden.
        </p>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>
      ) : (
        <div>
          {products.map((product) => (
            <ProductCard key={product.sku} layout="list" product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
