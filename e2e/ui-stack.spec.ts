import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginWithUI } from "./helpers/authentication";

const authEmail = process.env.E2E_AUTH_EMAIL ?? "";
const authPassword = process.env.E2E_AUTH_PASSWORD ?? "";

function memberEmail(): string {
  if (process.env.E2E_AUTH_MEMBER_EMAIL) return process.env.E2E_AUTH_MEMBER_EMAIL;
  const [localPart, domain] = authEmail.split("@");
  if (!localPart || !domain) return "";
  return `${localPart}+member@${domain}`;
}

const memberPassword = process.env.E2E_AUTH_MEMBER_PASSWORD ?? authPassword;

async function settleFiniteAnimations(page: Page) {
  // DBT-126: o axe amostrava o texto do alerta DURANTE a animação `enter` no
  // WebKit e lia a cor composta com α<1 (3,8:1 em vez dos 5,19:1 reais). Esperar
  // as animações FINITAS assentarem não afrouxa a regra de contraste nem filtra
  // engines; animações infinitas (spinners) são ignoradas para o teste não travar.
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getTiming();
      return animation.playState === "running" && timing?.iterations !== Infinity;
    });
    // Numa matriz paralela o engine pode throttle de animações e `finished`
    // nunca resolver; o axe não depende do último frame, então o teto evita
    // travar o teste (o settle continua esperando quando a animação termina).
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  });
}

async function expectNoBlockingAxeViolations(page: Page) {
  // DBT-126: além de esperar as animações finitas, força `prefers-reduced-motion`
  // — a folha estática zera durações nesse modo. Assim uma animação que comece
  // DEPOIS da espera (corrida sob carga) não deixa o axe amostrar opacidade
  // intermediária; a regra de contraste e o conjunto de engines permanecem.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settleFiniteAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
}

async function signInWithBetterAuth(page: Page, email: string, password: string): Promise<void> {
  const pageUrl = page.url();
  const origin = pageUrl.startsWith("http")
    ? new URL(pageUrl).origin
    : (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173");
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin, "sec-fetch-site": "same-origin" },
    data: { email, password },
  });
  expect(response.status(), "The fixture's Better Auth sign-in must succeed").toBe(200);
}

async function login(page: Page): Promise<void> {
  await loginWithUI(page, { email: authEmail, password: authPassword });
}

test("public UI uses valid composed controls and has no serious a11y violations", async ({
  page,
}) => {
  await page.context().clearCookies();
  const response = await page.goto("/");

  await expect(page.getByRole("heading", { name: /entenda a faixa de preço/i })).toBeVisible();
  await expect(page.locator("a button, button a")).toHaveCount(0);
  expect(response).not.toBeNull();
  const reportOnlyCsp = response?.headers()["content-security-policy-report-only"] ?? "";
  expect(reportOnlyCsp).toContain("script-src 'self'");
  expect(reportOnlyCsp).toContain("report-uri /api/csp-report");
  expect(reportOnlyCsp).toContain("report-to csp-endpoint");
  expect(response?.headers()["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"');
  // Sem CSP_ENFORCE o header de enforcement não existe — é o switch de rollback por env.
  expect(response?.headers()["content-security-policy"]).toBeUndefined();
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  // DBT-157: enquanto a CSP é Report-Only, XFO é a defesa efetiva contra embed.
  expect(response?.headers()["x-frame-options"]).toBe("DENY");

  const startLink = page.getByRole("link", { name: /começar agora/i });
  await startLink.focus();
  await expect(startLink).toBeFocused();

  await expectNoBlockingAxeViolations(page);
});

// O canal apontado por `report-uri` precisa existir de fato: apontar para uma rota
// inexistente tornaria a coleta (e o gate de zero violações) silenciosamente vazia.
test("the CSP report channel answers 204 for a violation report", async ({ request }) => {
  const report = await request.post("/api/csp-report", {
    headers: { "content-type": "application/csp-report" },
    data: JSON.stringify({
      "csp-report": {
        "document-uri": "https://preview.invalid/inicio",
        "effective-directive": "script-src",
        "blocked-uri": "https://cdn.example/blocked.js",
      },
    }),
  });

  expect(report.status()).toBe(204);
  expect(report.headers()["cache-control"]).toBe("no-store");
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

test("authentication matrix rejects invalid Better Auth credentials and protects routes", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/auth");

  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: {
      origin: new URL(page.url()).origin,
      "sec-fetch-site": "same-origin",
    },
    data: { email: authEmail, password: `${authPassword}-invalid` },
  });
  expect(response.status()).toBe(401);

  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/auth\?redirect=%2Finicio/);
});

test("authorization matrix blocks member mutations with a Better Auth session", async ({
  page,
}) => {
  expect(memberEmail(), "E2E_AUTH_MEMBER_EMAIL derivável é obrigatória").not.toBe("");
  expect(memberPassword, "E2E_AUTH_MEMBER_PASSWORD derivável é obrigatória").not.toBe("");
  await page.context().clearCookies();
  await page.goto("/auth");
  await signInWithBetterAuth(page, memberEmail(), memberPassword);
  await page.goto("/despesas");
  await expect(page.getByRole("heading", { name: "Minhas Despesas" })).toBeVisible();

  await page.getByLabel("Nome").fill("Tentativa de mutação não autorizada");
  await page.getByLabel("Valor (R$)").fill("1");
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/_serverFn/") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Adicionar despesa" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(403);
});

test("CSRF rejects a cross-site replay of a server-function mutation", async ({ page }) => {
  expect(memberEmail(), "E2E_AUTH_MEMBER_EMAIL derivável é obrigatória").not.toBe("");
  expect(memberPassword, "E2E_AUTH_MEMBER_PASSWORD derivável é obrigatória").not.toBe("");
  await page.context().clearCookies();
  await page.goto("/auth");
  await signInWithBetterAuth(page, memberEmail(), memberPassword);
  await page.goto("/despesas");

  await page.getByLabel("Nome").fill("Replay CSRF de teste");
  await page.getByLabel("Valor (R$)").fill("1");
  const requestPromise = page.waitForRequest(
    (request) => request.url().includes("/_serverFn/") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Adicionar despesa" }).click();
  const originalRequest = await requestPromise;

  const replay = await page.request.fetch(originalRequest.url(), {
    method: "POST",
    headers: {
      ...originalRequest.headers(),
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    },
    data: originalRequest.postData() ?? undefined,
  });

  expect(replay.status()).toBe(403);
});

test("authenticated shell uses an HttpOnly session and accessible navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();
  await expect(page.getByText("Faturamento real", { exact: true })).toBeVisible();
  await expect(page.getByText("Nenhuma venda real registrada.", { exact: true })).toBeVisible();
  await expect(page.getByText("Faturamento p/ equilíbrio", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Margem média", { exact: true })).toHaveCount(0);

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

  await expect(
    page.getByText("Mensagem restaurada do histórico E2E.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver produto" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Mensagem restaurada do histórico E2E.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver produto" })).toBeVisible();

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

test("products list meets WCAG AA text contrast with the seeded rows", async ({ page }) => {
  // DBT-123/DBT-159: /produtos ficou fora do gate e as duas cores medidas
  // (2,15:1 em `.text-success`, 3,20:1 no badge) só aparecem com a fixture
  // determinística do seed: margem > 30% e segundo produto incompleto.
  await page.goto("/produtos");
  await expect(page.getByRole("heading", { name: "Meus Produtos" })).toBeVisible();
  await expect(page.getByText("Produto de teste", { exact: true })).toBeVisible();
  await expect(page.getByText("DADOS INCOMPLETOS", { exact: true })).toBeVisible();

  const ratios = await page.evaluate(() => {
    // Chromium devolve `oklch(...)` em getComputedStyle; um parser numérico
    // ingênuo leria os componentes como se fossem RGB. O canvas resolve
    // qualquer cor CSS para sRGB e é o mesmo caminho do axe.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas 2d indisponível");
    const parse = (value: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0, a ?? 0];
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (foreground: number[], background: number[]) => {
      const a = luminance(foreground);
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const backgroundOf = (element: Element) => {
      let node: Element | null = element;
      while (node) {
        const [r, g, b, alpha] = parse(getComputedStyle(node).backgroundColor);
        if (alpha > 250) return [r, g, b];
        node = node.parentElement;
      }
      return [255, 255, 255];
    };
    const ratioOf = (element: Element | null) => {
      if (!element) return null;
      const [r, g, b] = parse(getComputedStyle(element).color);
      return contrast([r, g, b], backgroundOf(element));
    };
    const margin = document.querySelector(".text-success");
    const badge = [...document.querySelectorAll("span, div")].find(
      (element) => element.textContent?.trim() === "DADOS INCOMPLETOS",
    );
    return { margin: ratioOf(margin), badge: ratioOf(badge ?? null) };
  });

  expect(ratios.margin, "margem > 30% deve ter contraste AA").not.toBeNull();
  expect(ratios.badge, "badge DADOS INCOMPLETOS deve ter contraste AA").not.toBeNull();
  expect(ratios.margin ?? 0).toBeGreaterThanOrEqual(4.5);
  expect(ratios.badge ?? 0).toBeGreaterThanOrEqual(4.5);

  await expectNoBlockingAxeViolations(page);
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

test("chat HTTP dispatch survives a missing framework signal (BUG-CHAT)", async ({ page }) => {
  await page.goto("/novo-produto");
  await expect(page.getByRole("heading", { name: "Precificação de produto" })).toBeVisible();

  const probe = `BUGCHAT-${Date.now()}`;
  const assistantMessages = page.locator(
    '[role="log"] [data-slot="message"][data-align="start"]:not([data-loading="true"])',
  );
  const assistantCount = await assistantMessages.count();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/_serverFn/") &&
      response.request().method() === "POST" &&
      (response.request().postData() ?? "").includes(probe),
  );
  await page.locator("#novo-produto-mensagem").fill(probe);
  await page.getByRole("button", { name: "Enviar" }).click();
  const response = await responsePromise;
  const body = await response.text();

  expect(body).not.toContain("signals[0]");
  expect(body).not.toContain("TypeError");
  expect(response.status()).toBeLessThan(500);

  const textarea = page.locator("#novo-produto-mensagem");
  await expect(textarea).toBeEnabled({ timeout: 15_000 });
  await expect(assistantMessages.nth(assistantCount)).toBeVisible();
  await expect(assistantMessages.nth(assistantCount)).not.toBeEmpty();
  await textarea.fill(`BUGCHAT-followup-${Date.now()}`);
  await expect(page.getByRole("button", { name: "Enviar" })).toBeEnabled({ timeout: 15_000 });
});

test("floating consultor chat opens app-wide and hides on its full page", async ({ page }) => {
  await page.goto("/inicio");
  // O launcher é a entrada do fluxo: a precificação não duplica item no menu.
  await expect(
    page.getByRole("navigation", { name: "Menu principal" }).getByText("Precificação"),
  ).toHaveCount(0);
  const launcher = page.getByRole("button", {
    name: "Falar com o Simon, consultor de precificação",
  });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const dialog = page.getByRole("dialog", { name: /Simon/ });
  await expect(dialog).toBeVisible();
  // O fixture E2E restaura uma conversa: o estado determinístico do painel é o
  // histórico (o herói só aparece quando não existe turno persistido).
  await expect(dialog.getByText("Mensagem restaurada do histórico E2E.")).toBeVisible();
  await expect(dialog.getByLabel("Mensagem para o consultor")).toBeVisible();
  // O painel é um diálogo modal: precisa passar pelo mesmo crivo de a11y das rotas.
  await expectNoBlockingAxeViolations(page);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();

  // A rota completa já é o workspace: o launcher não se duplica nela.
  await page.goto("/novo-produto");
  await expect(page).toHaveTitle(/Precificação/);
  await expect(page.getByRole("heading", { name: "Precificação de produto" })).toBeVisible();
  await expect(launcher).toHaveCount(0);
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

test("sessão expirada no meio do uso volta ao login sem referência de suporte", async ({
  page,
}) => {
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();

  let failServerFunctions = false;
  await page.route("**/_serverFn/**", async (route) => {
    if (!failServerFunctions) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-correlation-id": "d1acf4d4-00e2-4c4a-8567-da06ee0f15c5",
      },
      body: JSON.stringify({
        ok: false,
        error: {
          code: "AUTHENTICATION_ERROR",
          message: "Faça login para continuar.",
          retryable: false,
          correlationId: "d1acf4d4-00e2-4c4a-8567-da06ee0f15c5",
        },
      }),
    });
  });

  // A partir daqui qualquer server function responde 401, como no instante em
  // que a sessão é revogada no servidor durante o uso.
  failServerFunctions = true;
  await page.getByRole("button", { name: "Trimestre" }).click();

  await expect(page).toHaveURL(/\/auth\?redirect=%2Finicio/, { timeout: 10_000 });
  await expect(page.getByText(/Referência de atendimento: DASH-/)).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
