"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  isAuthUser,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
} from "@/types/auth";

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

async function responseMessage(response: Response): Promise<string> {
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null) {
      const payload = value as Record<string, unknown>;
      if (typeof payload.message === "string") {
        return payload.message;
      }

      if (typeof payload.errors === "object" && payload.errors !== null) {
        for (const fieldErrors of Object.values(
          payload.errors as Record<string, unknown>,
        )) {
          if (
            Array.isArray(fieldErrors) &&
            typeof fieldErrors[0] === "string"
          ) {
            return fieldErrors[0];
          }
        }
      }
    }
  } catch {
    // The status is still useful when the upstream returned no JSON body.
  }

  return `Er ging iets mis (${response.status}).`;
}

function useAuthState(): AuthState {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/v1/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const value: unknown = await response.json();
        if (active && isAuthUser(value)) {
          setUser(value);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function authenticate(
    path: string,
    payload: LoginPayload | RegisterPayload,
  ): Promise<boolean> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await responseMessage(response));
        return false;
      }

      const value: unknown = await response.json();
      if (!isAuthUser(value)) {
        setError("De inlogsessie kon niet worden bevestigd.");
        return false;
      }

      setUser(value);
      router.push("/");
      router.refresh();
      return true;
    } catch {
      setError("De authenticatieservice is tijdelijk niet bereikbaar.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout(): Promise<boolean> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError(await responseMessage(response));
        return false;
      }

      setUser(null);
      router.push("/");
      router.refresh();
      return true;
    } catch {
      setError("Uitloggen is tijdelijk niet bereikbaar.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    user,
    isLoading,
    error,
    login: (payload) => authenticate("/api/v1/auth/login", payload),
    register: (payload) => authenticate("/api/v1/auth/register", payload),
    logout,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();

  return createElement(AuthContext.Provider, { value: authState }, children);
}

export function useAuth(): AuthState {
  const authState = useContext(AuthContext);
  if (!authState) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return authState;
}
