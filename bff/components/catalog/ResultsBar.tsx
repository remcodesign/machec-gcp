import type { PaginationMeta } from "@/types/catalog";
import { SortSelect } from "@/components/catalog/SortSelect";

interface ResultsBarProps {
    meta: PaginationMeta;
    sort?: string;
}

export function ResultsBar({ meta, sort }: ResultsBarProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-stone-600">
                Toont <span className="font-semibold text-stone-950">{meta.from ?? 0}–{meta.to ?? 0}</span> van {meta.total} producten
            </p>
            <SortSelect value={sort} />
        </div>
    );
}