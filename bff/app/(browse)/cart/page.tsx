import Link from "next/link";

export default function CartPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        Winkelmand
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">
        Je winkelmand is leeg
      </h1>
      <p className="mt-4 max-w-lg text-stone-600">
        Voeg producten toe vanuit het assortiment om ze hier te bekijken.
      </p>
      <Link
        className="mt-8 inline-flex rounded-full bg-stone-950 px-5 py-3 font-medium text-white transition hover:bg-amber-700"
        href="/products"
      >
        Bekijk producten
      </Link>
    </main>
  );
}
