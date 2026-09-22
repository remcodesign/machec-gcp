import { formatPrice } from "@/lib/formatPrice";

interface CartSummaryProps {
  itemCount: number;
  totalCents: number;
}

export function CartSummary({ itemCount, totalCents }: CartSummaryProps) {
  return (
    <aside className="h-fit border border-stone-200 bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
        Overzicht
      </h2>
      <p className="mt-4 text-sm text-stone-600">
        {itemCount} {itemCount === 1 ? "artikel" : "artikelen"}
      </p>
      <p className="mt-2 flex items-baseline justify-between text-lg font-semibold text-stone-950">
        <span>Totaal</span>
        <span>{formatPrice(totalCents)}</span>
      </p>
      <p className="mt-1 text-xs text-stone-500">
        Een schatting — de definitieve prijs wordt bij het afronden bepaald.
      </p>
      <button
        className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-stone-300 px-5 py-3 font-medium text-stone-500"
        disabled
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        Naar de kassa
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
      </button>
      <p className="mt-2 text-center text-xs text-stone-500">
        Binnenkort beschikbaar!
      </p>
    </aside>
  );
}
