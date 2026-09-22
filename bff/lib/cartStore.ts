import type { Firestore } from "@google-cloud/firestore";
import { getFirestoreClient } from "@/lib/firestoreClient";
import type { Cart, CartItem } from "@/types/cart";

const CARTS_COLLECTION = "carts";

// The httpOnly cookie both cart-mutating routes read/mint (Step 6.1) — a
// single source so the two route.ts files never drift on the name.
export const CART_COOKIE = "cart_id";

interface CartStoreDependencies {
  firestore: Firestore;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCartItem(value: unknown): value is CartItem {
  return (
    isRecord(value) &&
    typeof value.sku === "string" &&
    typeof value.quantity === "number"
  );
}

function itemsOf(value: unknown): CartItem[] {
  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items.filter(isCartItem);
  }

  return [];
}

async function readCart(firestore: Firestore, cartId: string): Promise<Cart> {
  const snapshot = await firestore
    .collection(CARTS_COLLECTION)
    .doc(cartId)
    .get();

  return {
    cart_id: cartId,
    items: itemsOf(snapshot.exists ? snapshot.data() : undefined),
  };
}

// carts/{cart_id} has no TTL, by design (D85) — it persists until converted
// to an order or abandoned, so this never writes an expiresAt field the way
// catalogCache.ts's cache-aside documents do.
async function writeItems(
  firestore: Firestore,
  cartId: string,
  items: CartItem[],
): Promise<Cart> {
  await firestore.collection(CARTS_COLLECTION).doc(cartId).set({ items });

  return { cart_id: cartId, items };
}

export function createCartStore(
  dependencies: CartStoreDependencies = { firestore: getFirestoreClient() },
) {
  const { firestore } = dependencies;

  return {
    getCart: (cartId: string) => readCart(firestore, cartId),

    // Upserts by incrementing an existing line — never a second row for the
    // same sku (D-shape: CartItem stores only { sku, quantity }, never a price).
    addItem: async (
      cartId: string,
      sku: string,
      quantity: number,
    ): Promise<Cart> => {
      const cart = await readCart(firestore, cartId);
      const hasLine = cart.items.some((item) => item.sku === sku);
      const items = hasLine
        ? cart.items.map((item) =>
            item.sku === sku
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...cart.items, { sku, quantity }];

      return writeItems(firestore, cartId, items);
    },

    // Sets an exact quantity; quantity <= 0 removes the line — quantity-stepping
    // and removal share this one code path instead of a separate DELETE.
    setItemQuantity: async (
      cartId: string,
      sku: string,
      quantity: number,
    ): Promise<Cart> => {
      const cart = await readCart(firestore, cartId);

      if (quantity <= 0) {
        return writeItems(
          firestore,
          cartId,
          cart.items.filter((item) => item.sku !== sku),
        );
      }

      const hasLine = cart.items.some((item) => item.sku === sku);
      const items = hasLine
        ? cart.items.map((item) =>
            item.sku === sku ? { ...item, quantity } : item,
          )
        : [...cart.items, { sku, quantity }];

      return writeItems(firestore, cartId, items);
    },

    // Overwrites the whole line list verbatim — used to prune lines whose
    // sku no longer resolves in the catalog (deleted/unpublished since it
    // was added), so a stale line doesn't keep inflating item counts
    // forever with nothing left to show or buy.
    replaceItems: (cartId: string, items: CartItem[]): Promise<Cart> =>
      writeItems(firestore, cartId, items),
  };
}

export const cartStore = createCartStore();
