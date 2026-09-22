import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PIM_CORE_DIR = path.resolve(__dirname, "../../../machec-pim-core");
const CATEGORY_SLUG = "installatiemateriaal";

// Unique per run so this can safely execute against a real, shared PIM Core
// database (local ddev or production) without colliding with a prior run —
// same reasoning as e2e/browse.spec.ts's uniqueSku().
function uniqueSku(label: string): string {
  return `e2e-cart-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Same SaveProductAction path browse.spec.ts already goes through (D110) —
// a real pim_admin write, not a raw Eloquent update.
function createProductAsPimAdmin(
  sku: string,
  name: string,
  priceCents: number,
): void {
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

// Same AdjustProductStockAction path browse.spec.ts already goes through
// (D116) — a real pim_admin stock write, not a raw column update.
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

// Regression test for a real bug: CartLine's +/-/Verwijderen buttons stayed
// disabled forever after the very first click, because useCart's
// "mountedRef" only got initialized true via useRef's initializer, never
// reset inside the mount effect itself — so React's dev-mode StrictMode
// double-invoke (mount -> unmount -> mount) left it permanently false for
// the real, still-live instance that followed. Every getByLabel(...).click()
// below is followed by toBeEnabled(), which is exactly the assertion that
// used to hang/fail once the cooldown lock never released.
test("adding two products, stepping both up and one back down leaves a cart of 3 items total", async ({
  page,
}) => {
  const skuA = uniqueSku("a");
  const skuB = uniqueSku("b");
  const nameA = `E2E Cart A ${Date.now()}`;
  const nameB = `E2E Cart B ${Date.now()}`;

  createProductAsPimAdmin(skuA, nameA, 1000);
  createProductAsPimAdmin(skuB, nameB, 2000);
  adjustStockAsPimAdmin(skuA, 5);
  adjustStockAsPimAdmin(skuB, 5);

  try {
    // Add the first product from its own detail page — this lands straight
    // on the cart page (D-decision from this session: addItem navigates to
    // /cart on success rather than staying put).
    const cartHeading = page.getByRole("heading", {
      name: "Winkelmand",
      level: 1,
    });
    const lineA = page.locator("li").filter({ hasText: nameA });
    const lineB = page.locator("li").filter({ hasText: nameB });
    // The header's own /cart nav link, not the h1 above — this is the count
    // badge added on top of D69, which only push()ing to /cart (without a
    // router.refresh()) failed to update, since Next reused its cached
    // layout render across that navigation.
    const cartNavLink = page.getByRole("link", { name: /^Winkelmand/ });

    await page.goto(`/products/${skuA}`);
    await expect(cartNavLink).toHaveText("Winkelmand");
    await page
      .getByRole("button", { name: "Toevoegen aan winkelmand" })
      .click();
    await page.waitForURL("/cart");
    await expect(cartHeading).toBeVisible();
    await expect(lineA).toBeVisible();
    await expect(cartNavLink).toHaveText("Winkelmand (1)");

    // Add the second product, staying from that last addition straight into
    // the cart again — never going back to the cart page by hand.
    await page.goto(`/products/${skuB}`);
    await page
      .getByRole("button", { name: "Toevoegen aan winkelmand" })
      .click();
    await page.waitForURL("/cart");
    await expect(cartHeading).toBeVisible();
    await expect(lineB).toBeVisible();
    await expect(cartNavLink).toHaveText("Winkelmand (2)");

    // Two lines, quantity 1 each — 2 items total so far.
    await expect(page.getByText("2 artikelen")).toBeVisible();
    const quantityOf = (line: typeof lineA) =>
      line
        .getByLabel("Aantal verhogen")
        .locator("xpath=preceding-sibling::span[1]");

    // Step both up by one (1 -> 2 each), then one back down (B: 2 -> 1):
    // 2 + 2 - 1 = 3. Each click is followed by the buttons actually coming
    // back — the regression this test exists to catch.
    await lineA.getByLabel("Aantal verhogen").click();
    await expect(lineA.getByLabel("Aantal verhogen")).toBeEnabled();
    await expect(lineA.getByLabel("Aantal verlagen")).toBeEnabled();

    await lineB.getByLabel("Aantal verhogen").click();
    await expect(lineB.getByLabel("Aantal verhogen")).toBeEnabled();
    await expect(lineB.getByLabel("Aantal verlagen")).toBeEnabled();

    await lineB.getByLabel("Aantal verlagen").click();
    // Back at quantity 1 — "−" floors there and disables itself; only
    // Verwijderen removes the line from here.
    await expect(lineB.getByLabel("Aantal verlagen")).toBeDisabled();
    await expect(lineB.getByLabel("Aantal verhogen")).toBeEnabled();

    await expect(quantityOf(lineA)).toHaveText("2");
    await expect(quantityOf(lineB)).toHaveText("1");
    await expect(page.getByText("3 artikelen")).toBeVisible();
  } finally {
    deleteProduct(skuA);
    deleteProduct(skuB);
  }
});

// D118's CSRF guard already has mocked route-level coverage
// (app/api/v1/cart/items/route.test.ts), but this is the one test that hits
// the real, running server — no mocked cartStore, no mocked cookies() — so
// a forged cross-site request is proven to be rejected by the actual
// deployed guard, not just by a test double standing in for it. Uses
// Playwright's `request` fixture (a raw APIRequestContext, not a browser
// page) specifically so the Origin header can be set to something a real
// browser would never send on its own same-origin fetch — that's the
// exact "third-party page" scenario D118's own reasoning describes.
test("a forged cross-site request to either cart-mutating route is rejected with 403 by the real server, minting no cart cookie and writing nothing", async ({
  request,
}) => {
  const forgedOrigin = { origin: "https://evil.example.com" };

  const postResponse = await request.post("/api/v1/cart/items", {
    headers: forgedOrigin,
    data: { sku: "any-sku", quantity: 1 },
  });
  expect(postResponse.status()).toBe(403);
  expect(postResponse.headers()["set-cookie"]).toBeUndefined();

  const patchResponse = await request.patch("/api/v1/cart/items/any-sku", {
    headers: forgedOrigin,
    data: { quantity: 1 },
  });
  expect(patchResponse.status()).toBe(403);
});
