"use client";

import { useState } from "react";
import type { AuthUser } from "@/types/auth";

interface AccountMenuProps {
  isLoading: boolean;
  onLogout: () => Promise<boolean>;
  user: AuthUser;
}

export function AccountMenu({ isLoading, onLogout, user }: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  async function handleLogout() {
    await onLogout();
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Accountmenu van ${user.name}`}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 font-semibold text-white transition hover:bg-amber-700"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {initial}
      </button>
      {isOpen ? (
        <div
          className="absolute right-0 top-12 z-20 min-w-48 border border-stone-200 bg-white p-2 shadow-lg"
          role="menu"
        >
          <p className="px-3 py-2 text-sm text-stone-600">{user.name}</p>
          <button
            className="w-full px-3 py-2 text-left text-sm font-medium text-stone-950 transition hover:bg-stone-100 disabled:opacity-60"
            disabled={isLoading}
            onClick={() => void handleLogout()}
            role="menuitem"
            type="button"
          >
            Uitloggen
          </button>
        </div>
      ) : null}
    </div>
  );
}
