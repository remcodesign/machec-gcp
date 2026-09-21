import Link from "next/link";

export function SiteHeader() {
    return (
        <header className="border-b border-stone-200 bg-[#fffdf8]">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
                <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight text-stone-950">
                    MACHEC<span className="text-amber-600">.</span>
                </Link>
                <nav className="flex items-center gap-5 text-sm font-medium text-stone-600" aria-label="Hoofdnavigatie">
                    <Link className="transition-colors hover:text-stone-950" href="/">
                        Home
                    </Link>
                    <Link className="transition-colors hover:text-stone-950" href="/products">
                        Producten
                    </Link>
                    <Link className="transition-colors hover:text-stone-950" href="/cart">
                        Winkelmand
                    </Link>
                    <Link
                        className="rounded-full bg-stone-950 px-4 py-2 text-white transition-colors hover:bg-amber-700"
                        href="/login"
                    >
                        Inloggen
                    </Link>
                </nav>
            </div>
        </header>
    );
}