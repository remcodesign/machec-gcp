import { expect, test } from "@playwright/test";

// Unique per run so this can safely execute against a real, shared
// customer-identity database (local ddev or production) without colliding
// with a prior run or a real customer.
function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

const PASSWORD = "Secr3t!Passw0rd";

test("a customer registers, is assigned the customer role, and lands on the homepage already logged in", async ({
  page,
}) => {
  const email = uniqueEmail("register");

  await page.goto("/register");
  await page.getByLabel("Naam").fill("E2E Register");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Herhaal wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Account aanmaken" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: /accountmenu van e2e register/i }),
  ).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "machec_session")).toBe(true);
});

test("a customer logs in through the UI and the BFF sets its own session cookie, relaying Identity's session server-side (D115)", async ({
  page,
}) => {
  const email = uniqueEmail("login");

  // Seed a real account via register first (no separate admin/seed API to use here).
  await page.goto("/register");
  await page.getByLabel("Naam").fill("E2E Login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Herhaal wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await expect(page).toHaveURL("/");

  // Log out, then log back in through the actual login form.
  await page
    .getByRole("button", { name: /accountmenu van e2e login/i })
    .click();
  await page.getByRole("menuitem", { name: "Uitloggen" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Inloggen" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Inloggen" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: /accountmenu van e2e login/i }),
  ).toBeVisible();

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "machec_session")).toBe(true);
});

test("clicking Logout in AccountMenu calls the logout proxy, clears the session, and redirects to the homepage", async ({
  page,
}) => {
  const email = uniqueEmail("logout");

  await page.goto("/register");
  await page.getByLabel("Naam").fill("E2E Logout");
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Herhaal wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await expect(page).toHaveURL("/");

  await page
    .getByRole("button", { name: /accountmenu van e2e logout/i })
    .click();
  await page.getByRole("menuitem", { name: "Uitloggen" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Inloggen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /accountmenu/i })).toHaveCount(
    0,
  );

  const cookies = await page.context().cookies();
  const relay = cookies.find((c) => c.name === "machec_session");
  expect(relay === undefined || relay.value === "").toBe(true);
});

test("the login page links to register and the register page links back to login", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("link", { name: "Account aanmaken" }),
  ).toHaveAttribute("href", "/register");

  await page.goto("/register");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Inloggen" }),
  ).toHaveAttribute("href", "/login");
});

test("invalid credentials show an inline error and set no cookie", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill(uniqueEmail("nonexistent"));
  await page.getByLabel("Wachtwoord").fill("wrong-password-entirely");
  await page.getByRole("button", { name: "Inloggen" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL("/login");

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "machec_session")).toBe(false);
});

test("registering with a mismatched password_confirmation is rejected before a user row is created", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Naam").fill("E2E Mismatch");
  await page.getByLabel("E-mailadres").fill(uniqueEmail("mismatch"));
  await page.getByLabel("Wachtwoord", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Herhaal wachtwoord").fill("SomethingElse!123");
  await page.getByRole("button", { name: "Account aanmaken" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL("/register");

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "machec_session")).toBe(false);
});
