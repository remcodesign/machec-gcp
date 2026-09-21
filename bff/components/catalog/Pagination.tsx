import Link from "next/link";
import { catalogHref } from "@/lib/catalogParams";
import type { CatalogFilters, PaginationMeta } from "@/types/catalog";

interface PaginationProps {
    filters: CatalogFilters;
    meta: PaginationMeta;
    path: string;
}

export function Pagination({ filters, meta, path }: PaginationProps) {
    if (meta.last_page <= 1) return null;

    const pages = Array.from({ length: meta.last_page }, (_, index) => index + 1);

    return (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Paginering">
            {meta.current_page > 1 && <Link className="border border-stone-300 px-3 py-2 text-sm hover:border-stone-950" href={catalogHref(path, filters, { page: meta.current_page - 1 })}>←</Link>}
            {pages.map((page) => (
                <Link key={page} className={`border px-3 py-2 text-sm ${page === meta.current_page ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 hover:border-stone-950"}`} href={catalogHref(path, filters, { page })}>
                    {page}
                </Link>
            ))}
            {meta.current_page < meta.last_page && <Link className="border border-stone-300 px-3 py-2 text-sm hover:border-stone-950" href={catalogHref(path, filters, { page: meta.current_page + 1 })}>→</Link>}
        </nav>
    );
}