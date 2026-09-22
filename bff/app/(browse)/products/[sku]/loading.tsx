import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <ProductCardSkeleton />
    </main>
  );
}
