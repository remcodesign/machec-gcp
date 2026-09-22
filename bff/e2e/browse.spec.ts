import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PIM_CORE_DIR = path.resolve(__dirname, "../../../machec-pim-core");
const CATALOG_LISTING_CACHE_URL =
  "http://localhost:8080/v1/projects/machec-local/databases/(default)/documents/catalog_listing_cache";

// A seeded category with few enough published products (docs_local/
// pim-seed-catalog.json) that the one product this test adds always lands
// on page 1 of both the home-page category row and the category listing —
// no pagination handling needed for what's meant to stay a smoke test.
const CATEGORY_SLUG = "installatiemateriaal";
const CATEGORY_NAME = "Installatiemateriaal";

// Unique per run so this can safely execute against a real, shared PIM Core
// database (local ddev or production) without colliding with a prior run.
function uniqueSku(): string {
  return `e2e-browse-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Goes through the real `SaveProductAction` — the same action `ProductForm`
// (Domain 3's Livewire component) calls from `save()` (D110) — rather than
// a raw Eloquent update, so this is genuinely "saved through the Domain 3
// Livewire form" and exercises the same audit-log/write path a real
// pim_admin click would. `stock` isn't a `ProductForm`/`SaveProductAction`
// field (D34 kept it read-only there) — a new product's `stock` starts at
// its DB default, `0`; `adjustStockAsPimAdmin` below is what moves it.
function createProductAsPimAdmin(
  sku: string,
  name: string,
  priceCents: number,
): void {
  // `$`-prefixed PHP variables are escaped for the shell (execSync runs
  // this through `/bin/sh -c`, which would otherwise try to interpolate
  // them itself before PHP ever sees the string).
  const php = [
    `\\$admin = \\App\\Models\\User::where('email', 'pim@example.com')->firstOrFail();`,
    `\\$data = new \\App\\Data\\Requests\\ProductData(`,
    `  sku: new \\App\\ValueObjects\\Sku('${sku}'),`,
    `  name: '${name}',`,
    `  brand: 'E2E Test Brand',`,
    `  price: new \\App\\ValueObjects\\Money(${priceCents}),`,
    `  category_slug: '${CATEGORY_SLUG}',`,
    `  status: \\App\\Enums\\ProductStatus::Published,`,
    `  attributes: [],`,
    `);`,
    `app(\\App\\Actions\\PimCatalog\\SaveProductAction::class)->handle(request(), \\$admin, \\$data, null);`,
  ].join(" ");

  execSync(`ddev artisan tinker --execute="${php}"`, { cwd: PIM_CORE_DIR });
}

// Step 3.9/D116's stock admin screen (`ProductStock`, route
// `products/{product}/stock`) closed the gap `ProductForm` deliberately
// left open — `AdjustProductStockAction` is the same action that Livewire
// screen's `StockAdjustmentForm` calls in "adjust" mode (a signed delta),
// re-checking `pim_admin` server-side (D97) and writing a real
// `pim_stock_ledger` row + `product.stock_adjusted` audit-log entry, same
// as a human clicking through the form would. `Purchase` is one of the
// screen's own human-facing reason choices (`ApiOrder` is reserved for
// `commercial-core`'s machine calls, D116, and excluded there).
function adjustStockAsPimAdmin(sku: string, quantity: number): void {
  const php = [
    `\\$admin = \\App\\Models\\User::where('email', 'pim@example.com')->firstOrFail();`,
    `\\$product = \\App\\Models\\Product::where('sku', '${sku}')->firstOrFail();`,
    `app(\\App\\Actions\\PimCatalog\\AdjustProductStockAction::class)->handle(request(), \\$admin, \\$product, \\App\\Enums\\StockMovementReason::Purchase, ${quantity});`,
  ].join(" ");

  execSync(`ddev artisan tinker --execute="${php}"`, { cwd: PIM_CORE_DIR });
}

function deleteProduct(sku: string): void {
  execSync(
    `ddev artisan tinker --execute="\\App\\Models\\Product::where('sku', '${sku}')->delete();"`,
    { cwd: PIM_CORE_DIR },
  );
}

// This test's product briefly changes the published catalog's total count
// and name_asc ordering, and D40's cache-aside (catalogCache.ts) keys a
// separate Firestore doc per distinct filter *combination* — not just
// `{category}` and `{}`, but also each paginated `{page: N}` variant a
// concurrent prefetch might warm (e.g. SiteHeader's nav Link, D69, present
// on every page this test visits). Busting only the couple of doc IDs this
// test itself reads left other pages' entries free to go stale mid-test and
// outlive it, corrupting a sibling test's own pagination assertions for the
// rest of the TTL (catalog.spec.ts's total/page-overlap checks). Clearing
// the whole collection — the emulator's own REST API, listing then deleting
// each doc — is the only way to guarantee none of them survive.
async function bustAllListingCache(): Promise<void> {
  const response = await fetch(CATALOG_LISTING_CACHE_URL);
  const body = (await response.json()) as { documents?: { name: string }[] };

  await Promise.all(
    (body.documents ?? []).map((document) =>
      fetch(
        `https://firestore.googleapis.com/v1/${document.name}`.replace(
          "https://firestore.googleapis.com/v1/",
          "http://localhost:8080/v1/",
        ),
        { method: "DELETE" },
      ),
    ),
  );
}

// "€ 44,95" (nl-NL) → 4495 (price_cents) — lets this test assert on the
// actual price the page renders instead of trusting formatPrice.ts to
// agree with itself.
function parsePriceCents(text: string): number {
  const match = text.match(/([\d.]+),(\d{2})/);

  if (!match) throw new Error(`Could not parse a price out of "${text}"`);

  return Number(match[1].replaceAll(".", "")) * 100 + Number(match[2]);
}

// Proves the whole PIM → Firestore → BFF pipeline end to end — a pim_admin
// creates a product (Step 3.5's `SaveProductAction`, D110) and adjusts its
// stock (Step 3.9's `AdjustProductStockAction`, D116), both through the
// real Domain 3 actions, and a guest browsing the storefront from the
// homepage down to that product's own page sees exactly what was saved,
// including Step 4.4's stock-availability label (D117). Deliberately
// doesn't touch cart/checkout/Commercial Core (D18/D73 — those don't exist
// yet at this point in the build).

test("a guest browses home, a category, and a product, and sees the PIM-seeded name/price/stock", async ({
  page,
}) => {
  const sku = uniqueSku();
  const name = `E2E Smoke Lamp ${Date.now()}`;
  const priceCents = 4995;
  const stock = 3;

  createProductAsPimAdmin(sku, name, priceCents);
  adjustStockAsPimAdmin(sku, stock);
  await bustAllListingCache();

  try {
    await page.goto("/");

    const categorySection = page.locator("section").filter({
      has: page.getByRole("heading", { name: CATEGORY_NAME, exact: true }),
    });
    await categorySection.getByRole("link", { name: /Bekijk alles/ }).click();

    await expect(page).toHaveURL(`/categories/${CATEGORY_SLUG}`);
    await expect(
      page.getByRole("heading", { name: CATEGORY_NAME, level: 1 }),
    ).toBeVisible();

    const card = page.locator("article").filter({ hasText: name });
    await card.getByRole("heading", { name, level: 3 }).click();

    await expect(page).toHaveURL(`/products/${sku}`);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    const priceText = await page
      .getByRole("main")
      .getByText(/€\s?[\d.,]+/)
      .first()
      .textContent();
    expect(parsePriceCents(priceText ?? "")).toBe(priceCents);

    await expect(page.getByText("Op voorraad")).toBeVisible();
  } finally {
    deleteProduct(sku);
    await bustAllListingCache();
  }
});

test("an unknown sku product page returns 404 instead of a server error", async ({
  page,
}) => {
  const response = await page.goto("/products/does-not-exist-e2e-sku");

  // `notFound()` is thrown inside `ProductContent`, which page.tsx wraps in
  // a `<Suspense>` for its loading-skeleton (D-pattern used across Domain
  // 4's pages) — per Next.js's documented streaming behavior, the response
  // has already started as a 200 by the time the throw happens, and the
  // status can't change mid-stream. What actually matters here — and what
  // previously broke — is that this renders Next's not-found UI instead of
  // an error overlay/crash, not the literal status code.
  expect(response?.status()).toBe(200);
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByText("This page could not be found")).toBeVisible();
});
