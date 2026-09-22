import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Assortiment
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">
          Alle producten
        </h1>
      </div>
      <ProductCardSkeleton />
    </main>
  );
}
