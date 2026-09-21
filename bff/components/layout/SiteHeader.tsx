"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { useAuth } from "@/hooks/useAuth";

function navLinkClassName(isActive: boolean): string {
  const base = "border-b-2 pb-1 transition-colors hover:text-stone-950";

  return isActive
    ? `${base} border-stone-950 text-stone-950`
    : `${base} border-transparent`;
}

export function SiteHeader() {
  const { isLoading, logout, user } = useAuth();
  const pathname = usePathname();
  const isHomeActive = pathname === "/";
  const isProductsActive = pathname === "/products" || pathname.startsWith("/products/");
  const isCartActive = pathname === "/cart";

  return (
    <header className="border-b border-stone-200 bg-[#fffdf8]">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-xl font-semibold tracking-tight text-stone-950"
        >
          MACHEC<span className="text-amber-600">.</span>
        </Link>
        <nav
          className="flex items-center gap-5 text-sm font-medium text-stone-600"
          aria-label="Hoofdnavigatie"
        >
          <Link
            className={navLinkClassName(isHomeActive)}
            href="/"
            aria-current={isHomeActive ? "page" : undefined}
          >
            Home
          </Link>
          <Link
            className={navLinkClassName(isProductsActive)}
            href="/products"
            aria-current={isProductsActive ? "page" : undefined}
          >
            Producten
          </Link>
          <Link
            className={navLinkClassName(isCartActive)}
            href="/cart"
            aria-current={isCartActive ? "page" : undefined}
          >
            Winkelmand
          </Link>
          {user ? (
            <AccountMenu isLoading={isLoading} onLogout={logout} user={user} />
          ) : (
            <Link
              className="rounded-full bg-stone-950 px-4 py-2 text-white transition-colors hover:bg-amber-700"
              href="/login"
            >
              Inloggen
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
