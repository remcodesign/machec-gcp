import { execSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const PIM_CORE_DIR = path.resolve(__dirname, "../../../machec-pim-core");
const CATEGORIES_CACHE_DOC_URL =
  "http://localhost:8080/v1/projects/machec-local/databases/(default)/documents/catalog_cache/categories";

function setGroepenkastFilterableAttributes(phpArrayLiteral: string) {
  execSync(
    `ddev artisan tinker --execute "\\App\\Models\\Category::where('slug','groepenkast-componenten')->update(['filterable_attributes' => ${phpArrayLiteral}]);"`,
    { cwd: PIM_CORE_DIR },
  );
}

// D40's cache-aside serves the category taxonomy from Firestore for up to
// its TTL — bust the cached doc directly (the emulator's own REST API)
// instead of waiting it out, so this test doesn't need a 60s sleep.
async function bustCategoriesCache() {
  await fetch(CATEGORIES_CACHE_DOC_URL, { method: "DELETE" });
}

// Exercises the D40/D75 catalog-read path end to end against the real
// backend (PIM Core's seeded demo catalog, docs_local/pim-seed-catalog.json:
// 12 published products) rather than a mock, since the pagination and
// single-SKU-lookup bugs this guards were both PIM Core response-shape bugs
// that unit tests mocking the wrong shape never caught.

test("the all-products listing paginates the full published catalog 6 at a time instead of silently truncating to page 1", async ({
  page,
}) => {
  await page.goto("/products");

  const cards = page.locator("article");
  await expect(cards).toHaveCount(6);
  await expect(
    page.getByRole("main").getByText(/van 12 producten/).first(),
  ).toBeVisible();

  const pagination = page.getByRole("navigation", { name: "Paginering" });
  await expect(pagination).toBeVisible();

  const firstPageNames = await page
    .locator("article h3")
    .allTextContents();

  await pagination.getByRole("link", { name: "2" }).click();

  await expect(page).toHaveURL(/page=2/);
  // The card count stays 6 on both pages, so it alone never proves the
  // content actually swapped — wait for the first heading to genuinely
  // change before reading the rest of the grid.
  await expect(page.locator("article h3").first()).not.toHaveText(
    firstPageNames[0] ?? "",
  );

  const secondPageNames = await page
    .locator("article h3")
    .allTextContents();

  for (const name of secondPageNames) {
    expect(firstPageNames).not.toContain(name);
  }
});

test("a product past the first page of results still resolves on its own detail page instead of 404", async ({
  page,
}) => {
  // prod_12 (Pipelife Flexbuis) sorts well past the first 6 products under
  // the default name_asc order — the exact case that previously 404'd
  // because getProduct() only ever searched page 1 for a client-side sku
  // match, and PIM Core's own filter scope silently ignored a `sku` query
  // parameter it never implemented.
  await page.goto("/products/prod_12");

  await expect(
    page.getByRole("heading", { name: /Pipelife Flexbuis/i }),
  ).toBeVisible();
  await expect(page.getByText("404")).toHaveCount(0);
});

test("the Producten nav link is marked active on /products and stays active on a product detail page", async ({
  page,
}) => {
  await page.goto("/products");
  await expect(
    page.getByRole("link", { name: "Producten" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/products/prod_01");
  await expect(
    page.getByRole("link", { name: "Producten" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
  );
});

test("selecting a brand filter applies it immediately, with no separate 'apply' step", async ({
  page,
}) => {
  await page.goto("/products");

  await page.getByLabel("Merk").selectOption("Gira");

  await expect(page).toHaveURL(/brand=Gira/);
  await expect(page.getByRole("main").getByText(/van 2 producten/).first()).toBeVisible();
  const cards = page.locator("article");
  await expect(cards).toHaveCount(2);
  for (const text of await page.locator("article").allTextContents()) {
    expect(text).toContain("Gira");
  }
});

test("changing category on a /categories/[slug] page navigates to the new category's own path, clearing the previous category's attribute filter", async ({
  page,
}) => {
  await page.goto(
    "/categories/groepenkast-componenten?amperage=16A",
  );
  await expect(page.getByRole("main").getByText(/van 1 producten/).first()).toBeVisible();

  const filterSidebar = page.getByRole("complementary", {
    name: "Filter producten",
  });
  await filterSidebar
    .getByLabel("Categorie")
    .selectOption("installatiemateriaal");

  // "category" is /categories/[slug]'s own path segment, never a query
  // param — selecting a different one has to swap the URL's path (not add
  // a "category" query key onto the old category's own URL, which
  // parseCatalogFilters would just ignore in favor of the route's slug).
  await expect(page).toHaveURL(/\/categories\/installatiemateriaal$/);
  await expect(page.url()).not.toContain("amperage");
  // Scoped to the visible sidebar, not the whole page — Next's streamed RSC
  // payload embeds a second, hidden copy of prior render output in a
  // <script> tag, which a page-wide getByText would also match.
  await expect(filterSidebar.getByText("Amperage")).toHaveCount(0);
  await expect(filterSidebar.getByText("Type materiaal")).toBeVisible();
});

test("typing a price filter debounces instead of firing a request on every keystroke, and settles on the final value", async ({
  page,
}) => {
  await page.goto("/products");

  const priceMin = page.getByPlaceholder("Vanaf");
  // Type digit by digit, faster than the debounce window, the way a real
  // user typing "40" would — only the final value should ever reach the URL.
  // The field is euros (matching every other price shown in the app), so
  // "40" has to become price_min=4000 (cents) at the URL boundary.
  await priceMin.pressSequentially("40", { delay: 50 });

  // Mid-typing the URL must not have already jumped to an intermediate value.
  await expect(page).not.toHaveURL(/price_min=4$/);
  await expect(page).toHaveURL(/price_min=4000/, { timeout: 8000 });
});

test("filtering by a euro price range finds a product priced in between, converting the typed euros to PIM Core's own price_cents", async ({
  page,
}) => {
  // Regression: the price filter's price_min/price_max query params are
  // price_cents server-side (Product.php compares straight against
  // pim_products.price_cents), but the "Vanaf"/"Tot" inputs used to pass
  // the typed value straight through with no unit conversion — so typing
  // "45" for a product priced €44,95 searched for 45 CENTS, not €45, and
  // silently found nothing.
  await page.goto("/categories/kabels-draden");

  const filterSidebar = page.getByRole("complementary", {
    name: "Filter producten",
  });
  await filterSidebar.getByPlaceholder("Vanaf").fill("0");
  await filterSidebar.getByPlaceholder("Tot").fill("45");

  await expect(page).toHaveURL(/price_max=4500/, { timeout: 8000 });
  await expect(
    page.getByRole("main").getByText(/van \d+ producten/).first(),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article h3")).toContainText(/Donné/i);
});

test("a price_min filter with no price_max never 422s PIM Core's lte/gte comparison rule and still narrows the results", async ({
  page,
}) => {
  // Regression: CatalogProductsRequestData's price_min/price_max rules used
  // to require the OTHER bound to be present to run lte:price_max/
  // gte:price_min at all, so a lone ?price_min=4000 (exactly what typing
  // only "Vanaf" produces) always 422'd and surfaced as an uncaught
  // PimClientError in the <ProductListing> Server Component.
  await page.goto("/products?price_min=4000");

  await expect(page.getByText(/PimClientError|HTTP 422/)).toHaveCount(0);
  await expect(
    page.getByRole("main").getByText(/van \d+ producten/).first(),
  ).toBeVisible();
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();

  await page.goto("/products?price_max=200");
  await expect(page.getByText(/PimClientError|HTTP 422/)).toHaveCount(0);
  await expect(cards.first()).toBeVisible();
});

test("Huidige selectie delen copies the current filtered URL to the clipboard and confirms it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/products");

  await page.getByLabel("Merk").selectOption("Gira");
  await expect(page).toHaveURL(/brand=Gira/);

  const filterSidebar = page.getByRole("complementary", {
    name: "Filter producten",
  });
  await filterSidebar
    .getByRole("button", { name: "Huidige selectie delen" })
    .click();

  await expect(filterSidebar.getByRole("status")).toHaveText(
    "Link gekopieerd naar klembord",
  );

  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(clipboardText).toBe(page.url());
  expect(clipboardText).toContain("brand=Gira");
});

test("a filterable_attributes change made directly in PIM Core's category record shows up in the storefront filter sidebar with no BFF code change, once the cache-aside entry refreshes", async ({
  page,
}) => {
  // Proves lib/filterSchema.ts's category_conditional was actually removed
  // as a second, static source of truth — mutates PIM Core's own category
  // row (never this app's code) to add a brand-new attribute key, and
  // expects it to reach the sidebar purely through getCatalogCategories()'s
  // existing D40 cache-aside read.
  try {
    setGroepenkastFilterableAttributes(
      "['component_type','amperage','voltage']",
    );
    await bustCategoriesCache();

    await page.goto("/categories/groepenkast-componenten");

    const filterSidebar = page.getByRole("complementary", {
      name: "Filter producten",
    });
    // No Dutch label exists anywhere for "voltage" either — it falls back
    // to the raw attribute key, same as filterLabels already does for any
    // key it doesn't recognize.
    await expect(filterSidebar.getByText("voltage")).toBeVisible();
  } finally {
    setGroepenkastFilterableAttributes("['component_type','amperage']");
    await bustCategoriesCache();
  }
});
