import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoBlockingAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
}

async function installAuthenticatedSupabaseContract(page: Page) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "teste@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Teste" },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    aud: "authenticated",
    exp: now + 3_600,
    iat: now,
    role: "authenticated",
    sub: user.id,
  })}.test-signature`;
  const session = JSON.stringify({
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    expires_at: now + 3_600,
    expires_in: 3_600,
    token_type: "bearer",
    user,
  });

  await page.addInitScript((storedSession) => {
    const originalGetItem = Storage.prototype.getItem;
    localStorage.setItem("sb-e2e-auth-token", storedSession);
    Storage.prototype.getItem = function getItem(key) {
      if (/^sb-.*-auth-token$/.test(key)) return storedSession;
      return originalGetItem.call(this, key);
    };
  }, session);

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "*/0" },
      body: "[]",
    });
  });

  return accessToken;
}

test("public UI uses valid composed controls and has no serious a11y violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /descubra o preço certo/i })).toBeVisible();
  await expect(page.locator("a button, button a")).toHaveCount(0);

  const startLink = page.getByRole("link", { name: /começar agora/i });
  await startLink.focus();
  await expect(startLink).toBeFocused();

  await expectNoBlockingAxeViolations(page);
});

test("authentication controls keep accessible names", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/auth$/);

  const googleButton = page.getByRole("button", { name: "Continuar com Google" });
  const email = page.getByLabel("E-mail");
  const password = page.getByLabel("Senha");
  const submit = page.getByRole("button", { name: "Entrar", exact: true });

  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(page.locator("button button, a button, button a")).toHaveCount(0);

  await googleButton.focus();
  await expect(googleButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
});

test("authenticated shell keeps responsive navigation and accessible structure", async ({
  page,
}) => {
  const accessToken = await installAuthenticatedSupabaseContract(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("heading", { name: "Bem-vindo!" })).toBeVisible();

  const mobileMenu = page.getByRole("button", { name: "Abrir menu de navegação" });
  if (await mobileMenu.isVisible()) await mobileMenu.click();

  const productsLink = page.getByRole("link", { name: "Meus Produtos" }).filter({ visible: true });
  await expect(productsLink).toBeVisible();
  await productsLink.focus();
  await expect(productsLink).toBeFocused();
  await expect(page.locator("button button, a button, button a")).toHaveCount(0);

  if (await mobileMenu.isVisible()) await page.keyboard.press("Escape");
  await expectNoBlockingAxeViolations(page);

  const serverFnRequestPromise = page.waitForRequest(
    (request) => request.headers()["x-tsr-serverfn"] === "true",
  );
  await page.goto("/novo-produto");
  const serverFnRequest = await serverFnRequestPromise;
  expect(serverFnRequest.headers().authorization).toBe(`Bearer ${accessToken}`);
});
