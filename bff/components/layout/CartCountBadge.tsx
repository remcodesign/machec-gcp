import { cookies } from "next/headers";
import { getResolvedCart } from "@/hooks/useResolvedCart";
import { CART_COOKIE } from "@/lib/cartStore";

// The one piece of SiteHeader that reads cookies()/Firestore (D119) — kept
// out of app/layout.tsx's own top-level render and wrapped in its own
// <Suspense> there instead. A layout that reads runtime data directly
// blocks every client-side navigation on it, site-wide, before even a
// loading.tsx can show (bff/node_modules/next/dist/docs's own loading.md:
// "if the layout accesses uncached or runtime data... navigation blocks
// until the layout finishes rendering... move it into its own Suspense
// boundary"). Isolating it here means only this small badge suspends, never
// the rest of the page a customer is navigating to.
export async function CartCountBadge() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;
  const { itemCount } = await getResolvedCart(cartId);

  if (itemCount <= 0) {
    return null;
  }

  return <> ({itemCount})</>;
}
