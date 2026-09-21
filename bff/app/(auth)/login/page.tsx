import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="border-b border-stone-200 bg-[#fffdf8]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Welkom terug
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">
            Inloggen
          </h1>
          <p className="mt-5 max-w-md leading-7 text-stone-600">
            Log in om je bestelling af te ronden en je gegevens veilig te
            bewaren.
          </p>
        </div>
        <div className="max-w-lg border-t border-stone-300 pt-8 lg:ml-auto lg:w-full">
          <LoginForm />
          <p className="mt-6 text-sm text-stone-600">
            Nog geen account?{" "}
            <Link
              className="font-medium text-amber-700 hover:text-stone-950"
              href="/register"
            >
              Account aanmaken
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
