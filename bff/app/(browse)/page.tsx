import { Suspense } from "react";
import { CategoryList } from "@/components/catalog/CategoryList";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CategoryListSkeleton } from "@/components/catalog/CategoryListSkeleton";
import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";
import { getCatalogCategories, getCatalogProducts } from "@/hooks/useCatalog";
import type { Category, Product } from "@/types/catalog";

function shuffle(products: Product[]): Product[] {
  return [...products].sort(() => Math.random() - 0.5);
}

async function HomeCatalog() {
  const [{ data: categories }, { data: products }] = await Promise.all([
    getCatalogCategories(),
    getCatalogProducts(),
  ]);
  const categoryRows = await Promise.all(
    categories.map(async (category) => ({
      category,
      products: (
        await getCatalogProducts({ category: category.slug })
      ).data.slice(0, 4),
    })),
  );

  return (
    <>
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Voor vandaag
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Uitgelicht
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shuffle(products)
            .slice(0, 4)
            .map((product) => (
              <ProductCard key={product.sku} product={product} />
            ))}
        </div>
      </section>
      {categoryRows.map(({ category, products: rowProducts }) => (
        <CategoryRow
          key={category.slug}
          category={category}
          products={rowProducts}
        />
      ))}
    </>
  );
}

function CategoryRow({
  category,
  products,
}: {
  category: Category;
  products: Product[];
}) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
          {category.name}
        </h2>
        <a
          className="text-sm font-medium text-amber-700 hover:text-stone-950"
          href={`/categories/${category.slug}`}
        >
          Bekijk alles →
        </a>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.sku} product={product} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <main>
      <section className="border-b border-stone-200 bg-stone-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-8 lg:py-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
              MACHEC installatiemateriaal
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Goed materiaal. Direct gevonden.
            </h1>
          </div>
          <p className="max-w-md text-lg leading-8 text-stone-300">
            Een helder assortiment voor elektrische installatie, geselecteerd
            voor werk dat gewoon goed moet worden uitgevoerd.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
        <Suspense fallback={<CategoryListSkeleton />}>
          <CategoryNavigation />
        </Suspense>
        <div className="mt-16">
          <Suspense fallback={<ProductCardSkeleton />}>
            <HomeCatalog />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function CategoryNavigation() {
  const { data: categories } = await getCatalogCategories();

  return (
    <section>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Assortiment
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          Kies een categorie
        </h2>
      </div>
      <CategoryList categories={categories} />
    </section>
  );
}
