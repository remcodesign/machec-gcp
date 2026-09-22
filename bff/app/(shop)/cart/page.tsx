import { cookies } from "next/headers";
import Link from "next/link";
import { CartLine } from "@/components/cart/CartLine";
import { CartSummary } from "@/components/cart/CartSummary";
import { getResolvedCart } from "@/hooks/useResolvedCart";
import { CART_COOKIE } from "@/lib/cartStore";

function EmptyCart() {
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

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;
  const { lines, itemCount } = await getResolvedCart(cartId);

  if (lines.length === 0) {
    return <EmptyCart />;
  }

  const totalCents = lines.reduce(
    (sum, line) => sum + line.product.price_cents * line.quantity,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
        Winkelmand
      </h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul>
          {lines.map((line) => (
            <CartLine
              key={line.sku}
              product={line.product}
              quantity={line.quantity}
            />
          ))}
        </ul>
        <CartSummary itemCount={itemCount} totalCents={totalCents} />
      </div>
    </main>
  );
}
