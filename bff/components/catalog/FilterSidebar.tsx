"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { filterLabels } from "@/lib/filterSchema";
import { catalogHref } from "@/lib/catalogParams";
import type { Category, CatalogFacets, CatalogFilters } from "@/types/catalog";

interface FilterSidebarProps {
  categories: Category[];
  // getCatalogFacets() (D40 cache-aside) — every list here is already
  // computed with every *other* currently-selected filter applied, so a
  // value that can no longer be reached given the current selection is
  // simply absent, never a separately-disabled option to filter out here.
  facets: CatalogFacets;
  filters: CatalogFilters;
  path: string;
}

// Long enough that a full "216" (three keystrokes) doesn't fire three
// requests against catalogCache.ts/PIM Core, short enough to still read as
// live filtering rather than a stale/broken control.
const PRICE_DEBOUNCE_MS = 500;

// price_min/price_max travel through the URL and PIM Core's own filter
// scope as price_cents (Product.php compares straight against
// pim_products.price_cents), the same unit formatPrice.ts already assumes
// everywhere else a price is shown — but these are the only inputs where a
// person types a price, so they're the one place a euro/cents mismatch is
// reachable: typing "45" meaning €45 would otherwise filter for 45 cents.
function centsToEuroInput(cents: string | number | undefined): string {
  if (cents === undefined || cents === "") return "";
  const value = Number(cents) / 100;
  return Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

function euroInputToCents(euros: string): string {
  if (!euros.trim()) return "";
  const value = Number.parseFloat(euros.replace(",", "."));
  return Number.isFinite(value) ? String(Math.round(value * 100)) : "";
}

export function FilterSidebar({
  categories,
  facets,
  filters,
  path,
}: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category =
    typeof filters.category === "string" ? filters.category : undefined;
  // Sourced from live category data (getCatalogCategories(), D40
  // cache-aside) rather than a static schema, so a filterable_attributes
  // key PIM Core's admin adds shows up here with nothing to keep in sync.
  const conditionalFilters =
    categories.find((item) => item.slug === category)?.filterable_attributes ??
    [];
  // Every attribute key any category declares — used only to strip a
  // now-irrelevant attribute filter from the URL when the category changes.
  const allConditionalKeys = Array.from(
    new Set(categories.flatMap((item) => item.filterable_attributes)),
  );

  function navigate(nextParams: URLSearchParams, destination: string = path) {
    nextParams.delete("page");
    const queryString = nextParams.toString();
    router.push(queryString ? `${destination}?${queryString}` : destination);
  }

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    // On /categories/[slug], "category" is the route's own path segment,
    // never a query-string key (parseCatalogFilters's categoryOverride)
    // — changing it has to swap the URL's path, not just add a "category"
    // query param onto the current category's own URL, which would leave
    // the page rendering the old category with a query param that does
    // nothing (parseCatalogFilters always prefers the route's own slug).
    const destination =
      key === "category" && path.startsWith("/categories/")
        ? value
          ? `/categories/${value}`
          : "/products"
        : path;

    if (key === "category" && path.startsWith("/categories/")) {
      params.delete("category");
    } else if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    if (key === "category") {
      for (const attributeKey of allConditionalKeys) {
        params.delete(attributeKey);
      }
    }

    navigate(params, destination);
  }

  const [priceMin, setPriceMin] = useState(centsToEuroInput(filters.price_min));
  const [priceMax, setPriceMax] = useState(centsToEuroInput(filters.price_max));
  const priceDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Re-sync the locally-typed price fields when a navigation lands with a
  // different filters.price_min/max than what's currently being edited (a
  // Wissen click, a browser back/forward, or a filter applied elsewhere) —
  // adjusted during render, per React's own guidance, rather than via an
  // effect that would set state one render late.
  const [syncedPriceFilters, setSyncedPriceFilters] = useState(filters);
  if (
    filters.price_min !== syncedPriceFilters.price_min ||
    filters.price_max !== syncedPriceFilters.price_max
  ) {
    setSyncedPriceFilters(filters);
    setPriceMin(centsToEuroInput(filters.price_min));
    setPriceMax(centsToEuroInput(filters.price_max));
  }

  useEffect(() => {
    return () => clearTimeout(priceDebounce.current);
  }, []);

  function schedulePriceFilter(nextMinEuros: string, nextMaxEuros: string) {
    clearTimeout(priceDebounce.current);
    priceDebounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const nextMinCents = euroInputToCents(nextMinEuros);
      const nextMaxCents = euroInputToCents(nextMaxEuros);

      if (nextMinCents) params.set("price_min", nextMinCents);
      else params.delete("price_min");

      if (nextMaxCents) params.set("price_max", nextMaxCents);
      else params.delete("price_max");

      navigate(params);
    }, PRICE_DEBOUNCE_MS);
  }

  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const shareStatusReset = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(shareStatusReset.current);
  }, []);

  async function shareCurrentSelection() {
    const href = catalogHref(path, filters, { page: undefined });
    const url =
      typeof window === "undefined" ? href : `${window.location.origin}${href}`;

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }

    clearTimeout(shareStatusReset.current);
    shareStatusReset.current = setTimeout(() => setShareStatus("idle"), 2500);
  }

  return (
    <aside
      className="border border-stone-200 bg-[#fffdf8] p-5 lg:sticky lg:top-6 lg:self-start"
      aria-label="Filter producten"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-stone-950">Filter</h2>
        <Link
          className="text-xs font-medium text-amber-700 hover:text-stone-950"
          href={path}
        >
          Wissen
        </Link>
      </div>
      <div className="mt-5 space-y-5">
        <label className="block text-sm font-medium text-stone-700">
          {filterLabels.category}
          <select
            value={category ?? ""}
            onChange={(event) => applyFilter("category", event.target.value)}
            className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Alle categorieën</option>
            {categories
              // Narrowed to what facets.category (exclude-self) says is
              // still reachable given brand/price — but the current route's
              // own category always stays listed even if a since-applied
              // filter would otherwise exclude it, so a /categories/[slug]
              // page never renders a <select> whose own selected value is
              // missing from its own options.
              .filter(
                (item) =>
                  facets.category.includes(item.slug) || item.slug === category,
              )
              .map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          {filterLabels.brand}
          <select
            value={typeof filters.brand === "string" ? filters.brand : ""}
            onChange={(event) => applyFilter("brand", event.target.value)}
            className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Alle merken</option>
            {facets.brand.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-stone-700">
            {filterLabels.price_range}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500"
              >
                €
              </span>
              <input
                name="price_min"
                value={priceMin}
                onChange={(event) => {
                  setPriceMin(event.target.value);
                  schedulePriceFilter(event.target.value, priceMax);
                }}
                className="w-full border border-stone-300 bg-white py-2 pl-7 pr-3 text-sm"
                placeholder="Vanaf"
                inputMode="decimal"
              />
            </div>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500"
              >
                €
              </span>
              <input
                name="price_max"
                value={priceMax}
                onChange={(event) => {
                  setPriceMax(event.target.value);
                  schedulePriceFilter(priceMin, event.target.value);
                }}
                className="w-full border border-stone-300 bg-white py-2 pl-7 pr-3 text-sm"
                placeholder="Tot"
                inputMode="decimal"
              />
            </div>
          </div>
        </fieldset>
        {conditionalFilters.map((key) => (
          <label key={key} className="block text-sm font-medium text-stone-700">
            {filterLabels[key] ?? key}
            <select
              value={typeof filters[key] === "string" ? filters[key] : ""}
              onChange={(event) => applyFilter(key, event.target.value)}
              className="mt-2 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Alle opties</option>
              {(facets.attributes[key] ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={shareCurrentSelection}
        className="cursor-pointer mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-sky-700 hover:text-sky-900"
      >
        {shareStatus === "copied" ? (
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757M10.81 15.312a4.5 4.5 0 0 1-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757"
            />
          </svg>
        )}
        Huidige selectie delen
      </button>
      <p
        role="status"
        className={`mt-2 text-center text-xs transition-opacity ${
          shareStatus === "idle" ? "opacity-0" : "opacity-100"
        } ${shareStatus === "error" ? "text-red-700" : "text-emerald-700"}`}
      >
        {shareStatus === "copied" && "Link gekopieerd naar klembord"}
        {shareStatus === "error" &&
          "Kopiëren is niet gelukt — probeer het opnieuw"}
      </p>
    </aside>
  );
}
