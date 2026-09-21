import { notFound } from "next/navigation";
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

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const filters = parseCatalogFilters(rawSearchParams, slug);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <Suspense fallback={<ProductCardSkeleton />}>
        <CategoryListing slug={slug} filters={filters} />
      </Suspense>
    </main>
  );
}

async function CategoryListing({
  slug,
  filters,
}: {
  slug: string;
  filters: ReturnType<typeof parseCatalogFilters>;
}) {
  const [{ data: categories }, products] = await Promise.all([
    getCatalogCategories(),
    getCatalogProducts(filters),
  ]);
  const category = categories.find((item) => item.slug === slug);

  if (!category) notFound();

  return (
    <>
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Categorie
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 max-w-2xl text-stone-600">
            {category.description}
          </p>
        )}
      </div>
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterSidebar
          categories={categories}
          filters={filters}
          path={`/categories/${slug}`}
        />
        <section>
          <ResultsBar meta={products.meta} sort={filters.sort} />
          <div className="mt-5">
            <ProductGrid products={products.data} />
          </div>
          <Pagination
            filters={filters}
            meta={products.meta}
            path={`/categories/${slug}`}
          />
        </section>
      </div>
    </>
  );
}
