export interface AuthUser {
  customer_id: number;
  name: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  password_confirmation: string;
}

export function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.customer_id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string"
  );
}
