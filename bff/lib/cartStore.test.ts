import { describe, expect, it } from "vitest";
import { createCartStore } from "./cartStore";

class FakeDocRef {
  constructor(
    private readonly store: Map<string, unknown>,
    private readonly key: string,
  ) {}

  async get() {
    const data = this.store.get(this.key);
    return { exists: data !== undefined, data: () => data };
  }

  async set(value: unknown) {
    this.store.set(this.key, value);
  }
}

function createFakeFirestore() {
  const collections = new Map<string, Map<string, unknown>>();

  return {
    collection(name: string) {
      if (!collections.has(name)) collections.set(name, new Map());
      const store = collections.get(name)!;
      return {
        doc(id: string) {
          return new FakeDocRef(store, id);
        },
      };
    },
    _collections: collections,
  };
}

describe("cartStore", () => {
  it("a cart with no Firestore document yet reads back as empty", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    const cart = await store.getCart("cart-1");

    expect(cart).toEqual({ cart_id: "cart-1", items: [] });
  });

  it("adding a new sku to an empty cart creates one line", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    const cart = await store.addItem("cart-1", "SKU-1", 2);

    expect(cart).toEqual({
      cart_id: "cart-1",
      items: [{ sku: "SKU-1", quantity: 2 }],
    });
  });

  it("adding the same sku twice increments the existing line instead of duplicating it", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    await store.addItem("cart-1", "SKU-1", 1);
    const cart = await store.addItem("cart-1", "SKU-1", 3);

    expect(cart.items).toEqual([{ sku: "SKU-1", quantity: 4 }]);
  });

  it("adding a second, distinct sku appends its own line", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    await store.addItem("cart-1", "SKU-1", 1);
    const cart = await store.addItem("cart-1", "SKU-2", 5);

    expect(cart.items).toEqual([
      { sku: "SKU-1", quantity: 1 },
      { sku: "SKU-2", quantity: 5 },
    ]);
  });

  it("setItemQuantity sets an exact quantity on an existing line", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    await store.addItem("cart-1", "SKU-1", 1);
    const cart = await store.setItemQuantity("cart-1", "SKU-1", 9);

    expect(cart.items).toEqual([{ sku: "SKU-1", quantity: 9 }]);
  });

  it("setItemQuantity with quantity <= 0 removes the line", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    await store.addItem("cart-1", "SKU-1", 1);
    await store.addItem("cart-1", "SKU-2", 1);
    const cart = await store.setItemQuantity("cart-1", "SKU-1", 0);

    expect(cart.items).toEqual([{ sku: "SKU-2", quantity: 1 }]);
  });

  it("removing the last item empties the cart without an error", async () => {
    const store = createCartStore({
      firestore: createFakeFirestore() as never,
    });

    await store.addItem("cart-1", "SKU-1", 1);
    const cart = await store.setItemQuantity("cart-1", "SKU-1", 0);

    expect(cart).toEqual({ cart_id: "cart-1", items: [] });
  });

  it("two different cart ids are stored under two different documents", async () => {
    const firestore = createFakeFirestore();
    const store = createCartStore({ firestore: firestore as never });

    await store.addItem("cart-1", "SKU-1", 1);
    await store.addItem("cart-2", "SKU-1", 1);

    expect(firestore._collections.get("carts")?.size).toBe(2);
  });
});
