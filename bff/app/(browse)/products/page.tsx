import { Suspense } from "react";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ResultsBar } from "@/components/catalog/ResultsBar";
import { getCatalogCategories, getCatalogProducts } from "@/hooks/useCatalog";
import {
  parseCatalogFilters,
  type PageSearchParams,
} from "@/lib/catalogParams";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const filters = parseCatalogFilters(await searchParams);

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
      <Suspense fallback={<ProductCardSkeleton />}>
        <ProductListing filters={filters} />
      </Suspense>
    </main>
  );
}

async function ProductListing({
  filters,
}: {
  filters: ReturnType<typeof parseCatalogFilters>;
}) {
  const [{ data: categories }, products] = await Promise.all([
    getCatalogCategories(),
    getCatalogProducts(filters),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <FilterSidebar
        categories={categories}
        filters={filters}
        path="/products"
      />
      <section>
        <ResultsBar meta={products.meta} sort={filters.sort} />
        <div className="mt-5">
          <ProductGrid products={products.data} />
        </div>
        <Pagination filters={filters} meta={products.meta} path="/products" />
      </section>
    </div>
  );
}
