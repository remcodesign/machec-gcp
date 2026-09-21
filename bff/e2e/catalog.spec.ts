import { expect, test } from "@playwright/test";

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
