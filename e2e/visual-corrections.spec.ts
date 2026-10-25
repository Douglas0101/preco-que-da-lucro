import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoAxeViolations(page: Page) {
  await page.waitForTimeout(250);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/**
 * O SSR entrega o formulário antes de o React anexar os handlers: um clique
 * nesse intervalo não troca o modo e o título fica no valor inicial (a mesma
 * classe documentada em `e2e/helpers/authentication.ts`). A resposta de
 * `get-session` prova que o efeito de montagem do `/auth` rodou — e o efeito só
 * existe depois da hidratação —, então o clique seguinte encontra handlers
 * vivos. Medido no push de `main` (run 40150376452): o clique sem espera deixou
 * `Entrar · Preço que Dá Lucro` no título por 5 s.
 */
async function gotoAuthHydrated(page: Page): Promise<void> {
  const hydrated = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/auth/get-session",
    { timeout: 15_000 },
  );
  await page.goto("/auth");
  await hydrated;
}

test("404 em pt-BR, com título próprio e link para o início", async ({ page }) => {
  const response = await page.goto("/rota-inexistente");
  expect(response?.status()).toBe(404);

  await expect(page).toHaveTitle("Página não encontrada · Preço que Dá Lucro");
  await expect(page.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(page.getByText("A página que você procura não existe ou foi movida.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ir para o início" })).toHaveAttribute("href", "/");

  await expectNoAxeViolations(page);
});

test("auth: autocomplete correto e título por modo", async ({ page }) => {
  await page.context().clearCookies();
  await gotoAuthHydrated(page);
  await expect(page).toHaveTitle("Entrar · Preço que Dá Lucro");

  await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Senha")).toHaveAttribute("autocomplete", "current-password");

  await page.getByRole("button", { name: "Cadastre-se" }).click();
  await expect(page).toHaveTitle("Criar conta · Preço que Dá Lucro");
  await expect(page.getByRole("heading", { level: 2, name: "Vamos começar juntos" })).toBeVisible();

  await expect(page.getByLabel("Como podemos te chamar?")).toHaveAttribute("autocomplete", "name");
  await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Senha")).toHaveAttribute("autocomplete", "new-password");

  await expectNoAxeViolations(page);
});

// Cada rota abre a própria página: encadear um segundo `page.goto` na mesma
// página aborta a navegação do primeiro redirect (Firefox: NS_BINDING_ABORTED;
// WebKit: rejeição de carga abortada) e a asserção passaria a medir o aborto do
// teste, não a rota. Mesmo precedente de `docs/evidence/f-b1-e2e-2026-09-20`.
test("rotas protegidas anônimas redirecionam sem 401 de dashboard", async ({ context }) => {
  await context.clearCookies();

  for (const path of ["/inicio", "/novo-produto"]) {
    const page = await context.newPage();
    const authFailures: string[] = [];
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("response", (response) => {
      if (response.url().includes("/_serverFn/") && response.status() === 401) {
        authFailures.push(response.url());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Content[- ]Security[- ]Policy/i.test(text)) return;
      consoleErrors.push(text);
    });

    await page.goto(path);
    await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: 15_000 });

    expect({ path, authFailures }).toEqual({ path, authFailures: [] });
    expect({ path, pageErrors }).toEqual({ path, pageErrors: [] });
    expect({ path, consoleErrors }).toEqual({ path, consoleErrors: [] });

    await page.close();
  }
});

test("links secundários de auth têm alvo de pelo menos 24px no mobile", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only");

  await page.context().clearCookies();
  await gotoAuthHydrated(page);

  const forgot = await page.getByRole("button", { name: "Esqueci minha senha" }).boundingBox();
  expect(forgot?.height ?? 0).toBeGreaterThanOrEqual(24);

  const signup = await page.getByRole("button", { name: "Cadastre-se" }).boundingBox();
  expect(signup?.height ?? 0).toBeGreaterThanOrEqual(24);

  await page.getByRole("button", { name: "Cadastre-se" }).click();
  const back = await page.getByRole("button", { name: "Voltar para entrar" }).boundingBox();
  expect(back?.height ?? 0).toBeGreaterThanOrEqual(24);
});
