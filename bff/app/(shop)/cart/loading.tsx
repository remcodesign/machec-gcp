import { CartSkeleton } from "@/components/cart/CartSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
        Winkelmand
      </h1>
      <div className="mt-8">
        <CartSkeleton />
      </div>
    </main>
  );
}
