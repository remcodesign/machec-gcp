import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/assertSameOrigin";
import { CART_COOKIE, cartStore } from "@/lib/cartStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sku: string }> },
) {
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
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    return NextResponse.json(
      { message: "A whole-number quantity is required" },
      { status: 422 },
    );
  }

  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;
  if (!cartId) {
    return NextResponse.json({ message: "No cart to update" }, { status: 404 });
  }

  const { sku } = await context.params;
  const cart = await cartStore.setItemQuantity(cartId, sku, quantity);

  return NextResponse.json(cart);
}
