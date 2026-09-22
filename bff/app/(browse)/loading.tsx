import { CategoryListSkeleton } from "@/components/catalog/CategoryListSkeleton";
import { ProductCardSkeleton } from "@/components/catalog/ProductCardSkeleton";

export default function Loading() {
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
        <CategoryListSkeleton />
        <div className="mt-16">
          <ProductCardSkeleton />
        </div>
      </div>
    </main>
  );
}
