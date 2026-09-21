import Link from "next/link";
import { catalogBrands, filterLabels, filterSchema } from "@/lib/filterSchema";
import { catalogHref } from "@/lib/catalogParams";
import type { Category, CatalogFilters } from "@/types/catalog";

interface FilterSidebarProps {
    categories: Category[];
    filters: CatalogFilters;
    path: string;
}

const options: Record<string, string[]> = {
    component_type: ["Aardlekschakelaar", "Installatieautomaat", "Hoofdschakelaar"],
    amperage: ["16A", "40A", "63A"],
    insert_type: ["Wandcontactdoos", "Schakelaar", "Dimmer"],
    mounting: ["Inbouw", "Opbouw"],
    cable_type: ["VD-draad", "XMvK-kabel", "YMvK-kabel"],
    cores_and_thickness: ["1x2.5 mm²", "2x1.5 mm²", "3G2.5 mm²", "5G2.5 mm²"],
    material_type: ["Lasdoppen", "Inbouwdozen", "Buizen"],
};

export function FilterSidebar({ categories, filters, path }: FilterSidebarProps) {
    const category = typeof filters.category === "string" ? filters.category : undefined;
    const conditionalFilters = category ? filterSchema.category_conditional[category] ?? [] : [];

    return (
        <aside className="border border-stone-200 bg-[#fffdf8] p-5 lg:sticky lg:top-6 lg:self-start" aria-label="Filter producten">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-stone-950">Filter</h2>
                <Link className="text-xs font-medium text-amber-700 hover:text-stone-950" href={path}>
                    Wissen
                </Link>
            </div>
            <form className="mt-5 space-y-5" action={path}>
                <label className="block text-sm font-medium text-stone-700">
                    {filterLabels.category}
                    <select name="category" defaultValue={category ?? ""} className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm">
                        <option value="">Alle categorieën</option>
                        {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                    </select>
                </label>
                <label className="block text-sm font-medium text-stone-700">
                    {filterLabels.brand}
                    <select name="brand" defaultValue={typeof filters.brand === "string" ? filters.brand : ""} className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm">
                        <option value="">Alle merken</option>
                        {catalogBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                </label>
                <fieldset>
                    <legend className="text-sm font-medium text-stone-700">{filterLabels.price_range}</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <input name="price_min" defaultValue={typeof filters.price_min === "string" ? filters.price_min : ""} className="w-full border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Vanaf" inputMode="numeric" />
                        <input name="price_max" defaultValue={typeof filters.price_max === "string" ? filters.price_max : ""} className="w-full border border-stone-300 bg-white px-3 py-2 text-sm" placeholder="Tot" inputMode="numeric" />
                    </div>
                </fieldset>
                {conditionalFilters.map((key) => (
                    <label key={key} className="block text-sm font-medium text-stone-700">
                        {filterLabels[key] ?? key}
                        <select name={key} defaultValue={typeof filters[key] === "string" ? filters[key] : ""} className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm">
                            <option value="">Alle opties</option>
                            {(options[key] ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </label>
                ))}
                <button className="w-full rounded-full bg-stone-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700" type="submit">
                    Toon resultaten
                </button>
            </form>
            <Link className="mt-4 block text-center text-sm text-stone-500 hover:text-stone-950" href={catalogHref(path, filters, { page: undefined })}>
                Huidige selectie delen
            </Link>
        </aside>
    );
}