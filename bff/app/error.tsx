"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-4 px-5 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Er ging iets mis</h1>
            <p className="text-stone-600">
                Deze pagina kon niet worden geladen. Probeer het opnieuw.
            </p>
            <button
                className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
                onClick={reset}
            >
                Opnieuw proberen
            </button>
        </main>
    );
}
