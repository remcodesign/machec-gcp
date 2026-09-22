"use client";

import Link from "next/link";
import { GhostImage } from "@/components/catalog/GhostImage";
import { formatPrice } from "@/lib/formatPrice";
import { useCart } from "@/hooks/useCart";
import type { Product } from "@/types/catalog";

interface CartLineProps {
  product: Product;
  quantity: number;
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin text-stone-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

export function CartLine({ product, quantity }: CartLineProps) {
  const { setQuantity, isSubmitting } = useCart();

  function handleStep(delta: number) {
    const next = quantity + delta;
    // Stepping down never removes the line — only Verwijderen does that.
    // Reaching 1 and refusing to go lower via "−" keeps that distinction
    // between "I want fewer" and "I want none" explicit.
    if (next < 1) return;
    void setQuantity(product.sku, next);
  }

  function handleRemove() {
    void setQuantity(product.sku, 0);
  }

  return (
    <li
      aria-busy={isSubmitting}
      className={`flex gap-4 border-b border-stone-200 py-4 transition-opacity ${
        isSubmitting ? "opacity-60" : ""
      }`}
    >
      <GhostImage alt={product.name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <Link
          className="font-medium text-stone-950 hover:text-amber-700"
          href={`/products/${product.sku}`}
        >
          {product.name}
        </Link>
        <p className="mt-1 text-sm text-stone-500">
          {formatPrice(product.price_cents)} per stuk
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center border border-stone-300">
            <button
              aria-label="Aantal verlagen"
              className="h-8 w-8 cursor-pointer text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
              disabled={isSubmitting || quantity <= 1}
              onClick={() => handleStep(-1)}
              type="button"
            >
              −
            </button>
            <span className="flex w-8 items-center justify-center text-center text-sm font-medium text-stone-950">
              {isSubmitting ? (
                <Spinner />
              ) : (
                <span aria-live="polite">{quantity}</span>
              )}
            </span>
            <button
              aria-label="Aantal verhogen"
              className="h-8 w-8 cursor-pointer text-stone-600 disabled:cursor-not-allowed disabled:text-stone-300"
              disabled={isSubmitting}
              onClick={() => handleStep(1)}
              type="button"
            >
              +
            </button>
          </div>
          <button
            className="cursor-pointer text-sm text-stone-500 underline-offset-2 hover:text-red-700 hover:underline disabled:cursor-not-allowed disabled:text-stone-300"
            disabled={isSubmitting}
            onClick={handleRemove}
            type="button"
          >
            {isSubmitting ? "Bezig…" : "Verwijderen"}
          </button>
        </div>
      </div>
      <p className="self-center font-semibold text-stone-950">
        {formatPrice(product.price_cents * quantity)}
      </p>
    </li>
  );
}
