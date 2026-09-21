import { NextResponse } from "next/server";
import { isNonEmptyString, isRecord, proxyAuthRequest } from "@/lib/authProxy";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const payload = isRecord(body) ? body : null;
  if (
    !payload ||
    !isNonEmptyString(payload.name) ||
    !isNonEmptyString(payload.email) ||
    !isNonEmptyString(payload.password) ||
    !isNonEmptyString(payload.password_confirmation)
  ) {
    return NextResponse.json(
      { message: "All registration fields are required" },
      { status: 422 },
    );
  }

  return proxyAuthRequest("/api/v1/auth/register", {
    body: {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      password_confirmation: payload.password_confirmation,
    },
  });
}
