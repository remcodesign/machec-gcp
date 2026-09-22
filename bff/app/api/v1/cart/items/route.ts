import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/assertSameOrigin";
import { CART_COOKIE, cartStore } from "@/lib/cartStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cartCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

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
  const quantity = payload?.quantity;
  if (
    !payload ||
    !isNonEmptyString(payload.sku) ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { message: "sku and a positive integer quantity are required" },
      { status: 422 },
    );
  }

  const cookieStore = await cookies();
  const existingCartId = cookieStore.get(CART_COOKIE)?.value;
  const cartId = existingCartId ?? randomUUID();

  const cart = await cartStore.addItem(cartId, payload.sku, quantity);

  const response = NextResponse.json(cart);
  if (!existingCartId) {
    response.cookies.set(CART_COOKIE, cartId, cartCookieOptions());
  }

  return response;
}
