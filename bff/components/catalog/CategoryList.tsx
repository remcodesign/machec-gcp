import Link from "next/link";
import type { Category } from "@/types/catalog";

interface CategoryListProps {
    categories: Category[];
}

export function CategoryList({ categories }: CategoryListProps) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
                <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className="border border-stone-200 bg-white p-5 transition-colors hover:border-amber-600"
                >
                    <h3 className="font-medium text-stone-950">{category.name}</h3>
                    {category.description && <p className="mt-2 text-sm leading-6 text-stone-600">{category.description}</p>}
                </Link>
            ))}
        </div>
    );
}