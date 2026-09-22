"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface UseCartResult {
  isSubmitting: boolean;
  error: string | null;
  addItem: (sku: string, quantity?: number) => Promise<boolean>;
  setQuantity: (sku: string, quantity: number) => Promise<boolean>;
}

// A human "double-clicking" the same button fires several click events well
// inside one round trip — the in-flight request already blocks a re-entrant
// call, but this cooldown also covers the moment right after a fast response
// comes back, when a trigger-happy click would otherwise still get through.
// Kept short on purpose — long enough to absorb an accidental double-click,
// short enough that stepping the quantity still feels instant.
const SUBMIT_COOLDOWN_MS = 150;

async function responseMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as Record<string, unknown>).message === "string"
    ) {
      return (value as Record<string, unknown>).message as string;
    }
  } catch {
    // The status is still useful when the upstream returned no JSON body.
  }

  return `Er ging iets mis met de winkelmand (${response.status}).`;
}

export function useCart(): UseCartResult {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    // React's dev-mode StrictMode double-invoke runs mount → unmount → mount
    // once up front — resetting this back to true here (not just via the
    // useRef(true) initializer) is what makes that simulated unmount's
    // cleanup not leave the ref permanently false for the real, still-live
    // instance that follows it.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (path: string, method: "POST" | "PATCH", body: unknown) => {
      // A synchronous ref check, not just the isSubmitting state — the state
      // update that disables the button hasn't committed yet on the very
      // next click in the same tick, but this ref already has.
      if (lockedRef.current) return false;
      lockedRef.current = true;
      setError(null);
      setIsSubmitting(true);

      let succeeded = false;
      try {
        const response = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          setError(await responseMessage(response));
        } else {
          succeeded = true;
        }
      } catch {
        setError("De winkelmand is tijdelijk niet bereikbaar.");
      }

      setTimeout(() => {
        lockedRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }, SUBMIT_COOLDOWN_MS);

      return succeeded;
    },
    [],
  );

  return {
    isSubmitting,
    error,
    addItem: async (sku, quantity = 1) => {
      const succeeded = await mutate("/api/v1/cart/items", "POST", {
        sku,
        quantity,
      });
      if (succeeded) {
        // Going straight to the cart page feels more natural than staying
        // on the product page and wondering whether the click landed.
        // push() alone reuses Next's cached layout render — refresh() is
        // what actually re-runs the root layout, so the header's item
        // count reflects this addition instead of showing the stale one.
        router.push("/cart");
        router.refresh();
      }
      return succeeded;
    },
    setQuantity: async (sku, quantity) => {
      const succeeded = await mutate(`/api/v1/cart/items/${sku}`, "PATCH", {
        quantity,
      });
      if (succeeded) router.refresh();
      return succeeded;
    },
  };
}
