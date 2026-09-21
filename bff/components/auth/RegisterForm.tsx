"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export function RegisterForm() {
  const { register, isLoading, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await register({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="register-name"
        >
          Naam
        </label>
        <input
          autoComplete="name"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="register-name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="register-email"
        >
          E-mailadres
        </label>
        <input
          autoComplete="email"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="register-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="register-password"
        >
          Wachtwoord
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="register-password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="register-password-confirmation"
        >
          Herhaal wachtwoord
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
          id="register-password-confirmation"
          minLength={8}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          required
          type="password"
          value={passwordConfirmation}
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
        className="w-full bg-stone-950 px-4 py-3 font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? "Bezig..." : "Account aanmaken"}
      </button>
    </form>
  );
}
