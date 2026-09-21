"use client";

// Catches errors thrown by the root layout itself (e.g. SiteHeader/SiteFooter's own data
// fetch) — app/error.tsx cannot, since it renders inside the layout it would need to guard.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="nl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fffdf8] px-5 text-center text-stone-950">
        <h1 className="text-2xl font-semibold tracking-tight">
          Er ging iets mis
        </h1>
        <p className="text-stone-600">
          De site kon niet worden geladen. Probeer het opnieuw.
        </p>
        <button
          className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
          onClick={reset}
        >
          Opnieuw proberen
        </button>
      </body>
    </html>
  );
}
