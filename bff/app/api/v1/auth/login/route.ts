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
    !isNonEmptyString(payload.email) ||
    !isNonEmptyString(payload.password)
  ) {
    return NextResponse.json(
      { message: "Email and password are required" },
      { status: 422 },
    );
  }

  return proxyAuthRequest("/api/v1/auth/login", {
    body: { email: payload.email, password: payload.password },
  });
}
