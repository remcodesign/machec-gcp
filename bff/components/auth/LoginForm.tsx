"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login({ email, password });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="login-email"
        >
          E-mailadres
        </label>
        <input
          autoComplete="email"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="login-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="login-password"
        >
          Wachtwoord
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="login-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      {error ? (
        <p
          className="border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        className="w-full cursor-pointer bg-stone-950 px-4 py-3 font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Bezig..." : "Inloggen"}
      </button>
    </form>
  );
}
