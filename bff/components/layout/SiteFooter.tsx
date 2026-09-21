import Link from "next/link";
import { getCatalogCategories } from "@/hooks/useCatalog";
import type { Category } from "@/types/catalog";

export async function SiteFooter() {
  // The root layout has no error boundary of its own (global-error.tsx replaces the
  // whole page), so a transient PIM/Firestore failure here must degrade the footer's
  // category links, not take down every route on the site.
  let categories: Category[] = [];

  try {
    categories = (await getCatalogCategories()).data;
  } catch (error) {
    console.error("SiteFooter: failed to load categories", error);
  }

  return (
    <footer className="border-t border-stone-200 bg-stone-950 text-stone-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
          aria-label="Categorieën"
        >
          {categories.map((category) => (
            <Link
              key={category.slug}
              className="hover:text-white"
              href={`/categories/${category.slug}`}
            >
              {category.name}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-stone-500">
          © {new Date().getFullYear()} MACHEC
        </p>
      </div>
    </footer>
  );
}
