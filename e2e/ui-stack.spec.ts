import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const authEmail = process.env.E2E_AUTH_EMAIL ?? "";
const authPassword = process.env.E2E_AUTH_PASSWORD ?? "";
async function expectNoBlockingAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
}

async function login(page: Page): Promise<void> {
  expect(authEmail, "E2E_AUTH_EMAIL deve estar configurada").not.toBe("");
  expect(authPassword, "E2E_AUTH_PASSWORD deve estar configurada").not.toBe("");
  await page.goto("/auth");
  await page.getByLabel("E-mail").fill(authEmail);
  await page.getByLabel("Senha").fill(authPassword);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

test("public UI uses valid composed controls and has no serious a11y violations", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /entenda a faixa de preço/i })).toBeVisible();
  await expect(page.locator("a button, button a")).toHaveCount(0);

  const startLink = page.getByRole("link", { name: /começar agora/i });
  await startLink.focus();
  await expect(startLink).toBeFocused();

  await expectNoBlockingAxeViolations(page);
});

test("authentication controls keep accessible names", async ({ page, browserName }) => {
  await page.context().clearCookies();
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);

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

  if (browserName === "chromium") await login(page);
});

test("authenticated shell uses an HttpOnly session and accessible navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();

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
  expect(serverFnRequest.headers().authorization).toBeUndefined();

  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name.includes("session_token"));
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain("session_token");
  const storageKeys = await page.evaluate(() => [
    ...Object.keys(window.localStorage),
    ...Object.keys(window.sessionStorage),
  ]);
  expect(storageKeys.filter((key) => /token|session|auth/i.test(key))).toEqual([]);
});

test("manual simulation has no fictitious current volume and labels hypothetical results", async ({
  page,
}) => {
  await page.goto("/simulacoes");

  await expect(page.getByRole("heading", { name: "Simulações" })).toBeVisible();
  const volume = page.getByLabel("Vendas simuladas (unidades)");
  await expect(volume).toHaveValue("");
  await expect(page.getByText(/nenhum volume padrão é presumido/i)).toBeVisible();
  await expect(page.getByText("Cenário atual", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Diferença vs. atual", { exact: true })).toHaveCount(0);

  await volume.fill("100");

  await expect(page.getByText("Faturamento simulado", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Resultado operacional simulado dentro do escopo informado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Informado manualmente", { exact: true })).toBeVisible();

  const price = page.getByLabel("Preço de venda simulado (R$)");
  await price.fill("");
  await expect(
    page.getByText("Preencha os campos indicados da simulação para calcular."),
  ).toBeVisible();
  await expect(price).toHaveAttribute("aria-describedby", "simulation-field-message");
  await price.fill("20");
  await expect(page.getByText("Faturamento simulado", { exact: true })).toBeVisible();
  await expectNoBlockingAxeViolations(page);

  await page.goto("/inicio");
  await expect(page.getByText("Faturamento real", { exact: true })).toBeVisible();
  await expect(page.getByText("Nenhuma venda real registrada.", { exact: true })).toBeVisible();
  await expect(page.getByText("Faturamento p/ equilíbrio", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Margem média", { exact: true })).toHaveCount(0);
  await expectNoBlockingAxeViolations(page);
});

test("diagnostic forms prices only from explicit assumptions", async ({ page }) => {
  await page.goto("/diagnostico");

  await expect(page.getByRole("heading", { name: "Meu Diagnóstico" })).toBeVisible();
  const variableUnitCost = page.getByLabel("Outros custos variáveis por unidade (R$)");
  const targetRate = page.getByLabel("Margem de contribuição alvo (%)");
  await expect(variableUnitCost).toHaveValue("");
  await expect(targetRate).toHaveValue("");
  await expect(page.getByText(/valores ausentes não são tratados como zero/i)).toBeVisible();
  await expect(page.getByText(/despesas variáveis periódicas cadastradas/i)).toBeVisible();
  await expect(page.getByText(/preço sugerido/i)).toHaveCount(0);

  await variableUnitCost.fill("2");
  await targetRate.fill("20");

  const minimumCard = page
    .getByText("Preço mínimo para custos unitários", { exact: true })
    .locator("..");
  const targetCard = page.getByText("Preço para margem-alvo", { exact: true }).locator("..");
  const marketCard = page
    .getByText("Preço médio de mercado informado", { exact: true })
    .locator("..");
  await expect(minimumCard).toContainText("14,12");
  await expect(targetCard).toContainText("18,46");
  await expect(marketCard).toContainText("18,00");

  await targetRate.fill("90");
  await expect(targetRate).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("Revise os custos, as taxas e a margem alvo");
  await targetRate.fill("20");
  await expectNoBlockingAxeViolations(page);
});

test("financial query failure is not rendered as empty or zero data", async ({ page }) => {
  await page.route("**/_serverFn/**", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });

  await page.goto("/simulacoes");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os dados financeiros",
  );
  await expect(page.getByText(/cadastre um produto para criar/i)).toHaveCount(0);
  await expect(page.getByText(/^Referência de atendimento: SIM-/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expectNoBlockingAxeViolations(page);

  await page.goto("/inicio");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar o resumo financeiro",
  );
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toHaveCount(0);
  await expect(page.getByText(/^Referência de atendimento: DASH-/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expectNoBlockingAxeViolations(page);

  await page.goto("/diagnostico");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os dados do diagnóstico",
  );
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expectNoBlockingAxeViolations(page);
});
