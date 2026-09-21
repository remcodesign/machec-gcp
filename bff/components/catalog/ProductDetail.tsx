import { GhostImage } from "@/components/catalog/GhostImage";
import { formatPrice } from "@/lib/formatPrice";
import type { Category, Product } from "@/types/catalog";

interface ProductDetailProps {
  category?: Category;
  product: Product;
}

function stockLabel(stock: number | undefined): {
  text: string;
  className: string;
} {
  if (stock === undefined)
    return { text: "Op voorraad", className: "text-emerald-700" };
  if (stock <= 0)
    return { text: "Niet op voorraad", className: "text-red-700" };

  return { text: "Op voorraad", className: "text-emerald-700" };
}

export function ProductDetail({ category, product }: ProductDetailProps) {
  const attributeKeys =
    category?.filterable_attributes ?? Object.keys(product.attributes);
  const stock = stockLabel(product.stock);

  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:gap-14">
      <GhostImage alt={product.name} size="lg" priority />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          {product.brand}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          {product.name}
        </h1>
        <p className="mt-5 text-2xl font-semibold text-stone-950">
          {formatPrice(product.price_cents)}
        </p>
        <p className={`mt-3 text-sm ${stock.className}`}>{stock.text}</p>
        <button
          className="mt-8 w-full rounded-full bg-stone-950 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          disabled
        >
          Toevoegen aan winkelmand
        </button>
        <dl className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
          {attributeKeys.map((key) => (
            <div key={key} className="flex justify-between gap-5 py-3 text-sm">
              <dt className="text-stone-500">{key.replaceAll("_", " ")}</dt>
              <dd className="font-medium text-stone-950">
                {product.attributes[key] ?? "-"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
