"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface SortSelectProps {
    value?: string;
}

export function SortSelect({ value = "name_asc" }: SortSelectProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    function updateSort(nextSort: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", nextSort);
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
    }

    return (
        <label className="flex items-center gap-2 text-sm text-stone-600">
            Sorteer op
            <select value={value} onChange={(event) => updateSort(event.target.value)} className="border border-stone-300 bg-white px-3 py-2 font-medium text-stone-950">
                <option value="name_asc">Naam oplopend</option>
                <option value="name_desc">Naam aflopend</option>
                <option value="price_asc">Prijs laag naar hoog</option>
                <option value="price_desc">Prijs hoog naar laag</option>
            </select>
        </label>
    );
}