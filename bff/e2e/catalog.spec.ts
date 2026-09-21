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

// These two helpers make the pagination and category-narrowing tests below
// independent of the exact seeded catalog size — dev DBs routinely pick up
// ad-hoc categories/products beyond docs_local/pim-seed-catalog.json (e.g.
// testing a new admin feature), and a hardcoded "12 products"/"5 options"
// assertion breaks on that drift even though nothing storefront-side is
// actually wrong. Both query PIM Core's DB directly (never through the BFF
// or PIM Core's own read API) so they're a genuinely independent oracle,
// not the same code path the test is trying to verify.
function publishedProductCount(): number {
  const output = execSync(
    `ddev artisan tinker --execute "echo \\App\\Models\\Product::where('status','published')->count();"`,
    { cwd: PIM_CORE_DIR },
  ).toString();

  return Number(output.trim());
}

function categorySlugsForBrand(brand: string): string[] {
  const output = execSync(
    `ddev artisan tinker --execute "echo \\App\\Models\\Product::where('brand','${brand}')->where('status','published')->with('category')->get()->pluck('category.slug')->unique()->sort()->values()->toJson();"`,
    { cwd: PIM_CORE_DIR },
  ).toString();

  return JSON.parse(output.trim()) as string[];
}

function publishedProductCountForBrand(brand: string): number {
  const output = execSync(
    `ddev artisan tinker --execute "echo \\App\\Models\\Product::where('brand','${brand}')->where('status','published')->count();"`,
    { cwd: PIM_CORE_DIR },
  ).toString();

  return Number(output.trim());
}

function publishedProductCountForCategoryAttribute(
  categorySlug: string,
  attributeKey: string,
  value: string,
): number {
  const output = execSync(
    `ddev artisan tinker --execute "echo \\App\\Models\\Product::where('status','published')->where('attributes->${attributeKey}','${value}')->whereRelation('category','slug','${categorySlug}')->count();"`,
    { cwd: PIM_CORE_DIR },
  ).toString();

  return Number(output.trim());
}

// "€ 44,95" (nl-NL, lib/formatPrice.ts) → 4495 (price_cents) — lets a test
// assert on the actual price a card renders instead of a hardcoded product
// name/brand that only happens to be the one seed product in range today.
function parsePriceCents(text: string): number {
  const match = text.match(/([\d.]+),(\d{2})/);

  if (!match) throw new Error(`Could not parse a price out of "${text}"`);

  return Number(match[1].replaceAll(".", "")) * 100 + Number(match[2]);
}

// D40's cache-aside serves the category taxonomy from Firestore for up to
// its TTL — bust the cached doc directly (the emulator's own REST API)
// instead of waiting it out, so this test doesn't need a 60s sleep.
async function bustCategoriesCache() {
  await fetch(CATEGORIES_CACHE_DOC_URL, { method: "DELETE" });
}

// Exercises the D40/D75 catalog-read path end to end against the real
// backend (PIM Core's seeded demo catalog, docs_local/pim-seed-catalog.json)
// rather than a mock, since the pagination and single-SKU-lookup bugs this
// guards were both PIM Core response-shape bugs that unit tests mocking the
// wrong shape never caught.

test("the all-products listing paginates the full published catalog 6 at a time instead of silently truncating to page 1", async ({
  page,
}) => {
  const total = publishedProductCount();
  expect(total).toBeGreaterThan(0);

  await page.goto("/products");

  const cards = page.locator("article");
  await expect(cards).toHaveCount(Math.min(total, 6));
  await expect(
    page
      .getByRole("main")
      .getByText(new RegExp(`van ${total} producten`))
      .first(),
  ).toBeVisible();

  if (total <= 6) {
    // Nothing to paginate — the rest of this test only makes sense once a
    // second page genuinely exists.
    await expect(
      page.getByRole("navigation", { name: "Paginering" }),
    ).toHaveCount(0);
    return;
  }

  const pagination = page.getByRole("navigation", { name: "Paginering" });
  await expect(pagination).toBeVisible();

  const firstPageNames = await page.locator("article h3").allTextContents();

  await pagination.getByRole("link", { name: "2" }).click();

  await expect(page).toHaveURL(/page=2/);
  // The card count stays 6 on both pages, so it alone never proves the
  // content actually swapped — wait for the first heading to genuinely
  // change before reading the rest of the grid.
  await expect(page.locator("article h3").first()).not.toHaveText(
    firstPageNames[0] ?? "",
  );

  const secondPageNames = await page.locator("article h3").allTextContents();

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
  await expect(page.getByRole("link", { name: "Producten" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/products/prod_01");
  await expect(page.getByRole("link", { name: "Producten" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Home" })).not.toHaveAttribute(
    "aria-current",
  );
});

test("selecting a brand filter applies it immediately, with no separate 'apply' step", async ({
  page,
}) => {
  await page.goto("/products");

  const filterSidebar = page.getByRole("complementary", {
    name: "Filter producten",
  });
  const brandSelect = filterSidebar.getByLabel("Merk");
  // FilterSidebar streams in inside the same Suspense boundary as the
  // product grid (D65) — allTextContents() below doesn't auto-wait the way
  // a `toBeVisible()`/action-based call does, so without this the select
  // can still be read while the page is showing its loading skeleton.
  await expect(brandSelect).toBeVisible();
  const brand = (await brandSelect.locator("option").allTextContents()).find(
    (label) => label !== "Alle merken",
  );
  expect(brand).toBeTruthy();

  const expectedCount = publishedProductCountForBrand(brand!);
  expect(expectedCount).toBeGreaterThan(0);

  await brandSelect.selectOption(brand!);

  await expect(page).toHaveURL(
    new RegExp(`brand=${encodeURIComponent(brand!)}`),
  );
  await expect(
    page
      .getByRole("main")
      .getByText(new RegExp(`van ${expectedCount} producten`))
      .first(),
  ).toBeVisible();

  const cards = page.locator("article");
  await expect(cards).toHaveCount(Math.min(expectedCount, 6));
  for (const text of await cards.allTextContents()) {
    expect(text).toContain(brand);
  }
});

test("selecting a brand narrows the category select down to only the categories that brand still has products in", async ({
  page,
}) => {
  await page.goto("/products");

  const filterSidebar = page.getByRole("complementary", {
    name: "Filter producten",
  });
  const categorySelect = filterSidebar.getByLabel("Categorie");
  const brandSelect = filterSidebar.getByLabel("Merk");
  // See the identical comment in the previous test — allTextContents()
  // doesn't auto-wait for the Suspense-streamed sidebar to actually land.
  await expect(brandSelect).toBeVisible();

  // Picks whichever brand the sidebar itself lists first (getFacets()'s own
  // brand list is already alphabetically sorted, PIM Core-side) instead of
  // hardcoding one, so this test doesn't depend on a specific seeded brand
  // still existing/still being scoped to one category.
  const brand = (await brandSelect.locator("option").allTextContents()).find(
    (label) => label !== "Alle merken",
  );
  expect(brand).toBeTruthy();

  // Independent oracle: which category slugs that brand's published
  // products actually reach, queried straight from PIM Core's DB — not
  // derived from the same getCatalogFacets() call the sidebar itself uses,
  // so a bug in that call can't accidentally make this test agree with it.
  const expectedSlugs = categorySlugsForBrand(brand!).sort();

  const allSlugsBefore = await categorySelect
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .filter(Boolean),
    );
  // Only a meaningful regression guard if the picked brand doesn't already
  // reach every category — otherwise selecting it would narrow nothing and
  // the assertion below would pass even with the narrowing code removed.
  expect(expectedSlugs.length).toBeLessThan(allSlugsBefore.length);

  await brandSelect.selectOption(brand!);
  await expect(page).toHaveURL(
    new RegExp(`brand=${encodeURIComponent(brand!)}`),
  );

  const narrowedSlugs = await categorySelect
    .locator("option")
    .evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .filter(Boolean)
        .sort(),
    );

  expect(narrowedSlugs).toEqual(expectedSlugs);
});

test("changing category on a /categories/[slug] page navigates to the new category's own path, clearing the previous category's attribute filter", async ({
  page,
}) => {
  const expectedCount = publishedProductCountForCategoryAttribute(
    "groepenkast-componenten",
    "amperage",
    "16A",
  );
  expect(expectedCount).toBeGreaterThan(0);

  await page.goto("/categories/groepenkast-componenten?amperage=16A");
  await expect(
    page
      .getByRole("main")
      .getByText(new RegExp(`van ${expectedCount} producten`))
      .first(),
  ).toBeVisible();

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
    page
      .getByRole("main")
      .getByText(/van \d+ producten/)
      .first(),
  ).toBeVisible();

  // The bug being guarded against made this silently return zero results
  // (searching for 45 cents, not €45) — the count itself isn't a fixed
  // contract (whatever's seeded in this price band can grow), but "at
  // least one result, and every result genuinely priced within the typed
  // range" is the actual invariant a correct euro→cents conversion must
  // satisfy.
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  const priceTexts = await cards
    .locator("p", { hasText: "€" })
    .allTextContents();
  expect(priceTexts.length).toBeGreaterThan(0);

  for (const text of priceTexts) {
    const cents = parsePriceCents(text);
    expect(cents).toBeGreaterThanOrEqual(0);
    expect(cents).toBeLessThanOrEqual(4500);
  }
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
    page
      .getByRole("main")
      .getByText(/van \d+ producten/)
      .first(),
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
