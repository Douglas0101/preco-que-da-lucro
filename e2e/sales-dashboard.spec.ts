import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, request, test as base, type BrowserContext, type Page } from "@playwright/test";
import { hashPassword } from "../src/server/auth/password.server";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

interface SalesTenant {
  userId: string;
  tenantId: string;
  productId: string;
  email: string;
  password: string;
  productName: string;
}

const QUANTIDADE = "2";
const PRECO_UNITARIO = "25";
// Quantidade × preço unitário: 2 × R$ 25,00 = R$ 50,00 (líquido = bruto quando não informado).
const VALOR_VENDA = /R\$\s?50,00/;

function adminUrl(): string {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL deve estar configurada para o seed E2E de vendas");
  return url;
}

// SQL deliberado: mesmo padrão de scripts/e2e/seed-auth.ts — fixture isolada por
// test (tenant próprio) via DATABASE_ADMIN_URL; nenhum input externo nas listas
// de tabelas e todos os valores são parametrizados.
// pi-lens-ignore: no-sql-in-code
async function seedTenant(projectName: string): Promise<SalesTenant> {
  const userId = randomUUID();
  const tenantId = randomUUID();
  const productId = randomUUID();
  const password = randomUUID();
  const email = `e2e-sales-${projectName.toLowerCase()}-${userId.slice(0, 8)}@example.test`;
  const productName = "Produto E2e Vendas";

  const client = new Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into users (id, name, email, email_verified) values ($1, 'E2e Vendas', $2, true)`,
      [userId, email],
    );
    await client.query(
      `insert into accounts (id, account_id, provider_id, user_id, password, issuer)
       values ($1, $2, 'credential', $2, $3, 'local:credential')`,
      [`e2e-sales-credential-${userId}`, userId, await hashPassword(password)],
    );
    await client.query(
      `insert into tenants (id, name, slug, kind) values ($1, 'Tenant E2e Vendas', $2, 'personal')`,
      [tenantId, `e2e-sales-${tenantId.slice(0, 8)}`],
    );
    await client.query(
      `insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')`,
      [tenantId, userId],
    );
    await client.query(
      `insert into profiles (id, tenant_id, user_id, email, display_name)
       values ($1, $2, $1, $3, 'E2e Vendas')`,
      [userId, tenantId, email],
    );
    await client.query(
      `insert into products (id, tenant_id, user_id, name, current_price, yield_qty, yield_unit, tax_rate)
       values ($1, $2, $3, $4, '20.0000', '10.000000', 'unidade', '0.100000')`,
      [productId, tenantId, userId, productName],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  return { userId, tenantId, productId, email, password, productName };
}

async function purgeTenant(tenant: SalesTenant): Promise<void> {
  const client = new Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    await client.query("begin");
    for (const table of [
      "ai_daily_budgets",
      "ai_usage",
      "audit_events",
      "calculation_snapshots",
      "chat_messages",
      "chat_conversations",
      "expenses",
      "idempotency_records",
      "market_prices",
      "product_ingredients",
      "product_packaging",
      "purchase_price_history",
      "sales_fees",
      "simulations",
      "tool_executions",
      "profiles",
      // sales_items cai por CASCADE de sales; products só depois de tudo que referencia produto.
      "sales",
      "products",
    ]) {
      // pi-lens-ignore: no-sql-in-code
      await client.query(`delete from ${table} where tenant_id = $1`, [tenant.tenantId]);
    }
    await client.query("delete from tenant_memberships where tenant_id = $1", [tenant.tenantId]);
    await client.query("delete from tenants where id = $1", [tenant.tenantId]);
    await client.query("delete from users where id = $1", [tenant.userId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

interface SalesSession {
  tenant: SalesTenant;
  cookies: Parameters<BrowserContext["addCookies"]>[0][number][];
}

// Dedicated TEST-NET-3 fixture buckets cannot randomly collide with the
// ui-stack/global-setup/redirect-control TEST-NET-2 buckets. Three sales sign-ins
// per project stay within the unchanged five-per-minute Better Auth rule.
function signInBucketIp(projectName: string): string {
  const ips: Record<string, string> = {
    chromium: "203.0.113.1",
    firefox: "203.0.113.2",
    webkit: "203.0.113.3",
    mobile: "203.0.113.4",
  };
  const ip = ips[projectName];
  if (!ip) throw new Error("Sales fixture requires a documented project IP");
  return ip;
}

const test = base.extend<{ salesSession: SalesSession }>({
  // Tenant isolado por test: a suíte ui-stack exige "Nenhuma venda real
  // registrada." no tenant demo, então vendas E2E nunca podem tocar nele.
  // Por test (não por worker) porque o Playwright reutiliza workers entre
  // projects sob fullyParallel, o que compartilharia vendas entre cenários.
  //
  // A troca de cookies vive DENTRO do fixture, não num `beforeEach`: assim um
  // teste que só lê a tela (janela, foco, placeholder) não pede `salesSession` e
  // não paga sign-in. O bucket aceita 5/min; com `beforeEach` os sete testes do
  // arquivo faziam sete logins e o sexto recebia HTTP 429 (medido em F3).
  salesSession: async ({ context }, proceed, testInfo) => {
    const tenant = await seedTenant(testInfo.project.name);
    try {
      const api = await request.newContext({
        baseURL,
        extraHTTPHeaders: {
          origin: baseURL,
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": signInBucketIp(testInfo.project.name),
        },
      });
      try {
        const response = await api.post("/api/auth/sign-in/email", {
          data: { email: tenant.email, password: tenant.password },
        });
        expect(response.status(), "The sales fixture's Better Auth sign-in must succeed").toBe(200);
        const cookies = (await api.storageState()).cookies;
        await context.clearCookies();
        await context.addCookies(cookies);
        await proceed({ tenant, cookies });
      } finally {
        await api.dispose();
      }
    } finally {
      await purgeTenant(tenant);
    }
  },
});

function metricCard(page: Page, label: string) {
  // O rótulo é renderizado como nó próprio. `hasText` (substring, case-insensitive)
  // casaria também cards cujo *explain* menciona o mesmo termo — ex.: o card de
  // margem consolidada explica "quantas unidades de cada produto foram vendidas",
  // e o filtro por "Produtos" resolvia 2 elementos (strict mode violation).
  // Ancorar no texto exato mantém a asserção e remove a ambiguidade.
  return page.locator("div.grid.gap-4 > div.bg-card").filter({
    has: page.getByText(label, { exact: true }),
  });
}

async function registerSaleViaForm(
  page: Page,
  tenant: SalesTenant,
  occurredAt: Date = new Date(),
): Promise<void> {
  await page.goto("/vendas");
  await expect(page.getByRole("heading", { name: "Vendas", exact: true })).toBeVisible();

  await page.getByLabel("Produto", { exact: true }).click();
  await page.getByRole("option", { name: tenant.productName, exact: true }).click();
  await page.getByLabel("Data da venda").fill(inputDate(occurredAt));
  await page.getByLabel("Quantidade").fill(QUANTIDADE);
  await page.getByLabel("Preço unitário (R$)").fill(PRECO_UNITARIO);
  await page.getByRole("button", { name: "Registrar venda" }).click();

  await expect(page.getByText("Venda registrada", { exact: true })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Oráculo de janela (WP dashboard-periodo-2026-10-26).
//
// Independente da aplicação: offset literal `-03:00` + calendário em São Paulo
// por `Intl`. Nunca uma data fixa — um `01/10/2026 – 31/10/2026` hard-coded
// quebraria no dia seguinte e seria um teste que mente a partir de novembro.
// ---------------------------------------------------------------------------
const BUSINESS_TZ = "America/Sao_Paulo";
const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BUSINESS_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const INPUT_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayLabel(instant: Date): string {
  return DAY_LABEL.format(instant);
}

/** `yyyy-mm-dd` para o input `type="date"`, no fuso do negócio. */
function inputDate(instant: Date): string {
  return INPUT_DATE.format(instant);
}

function brtMidnight(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T00:00:00-03:00`);
}

function businessYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month") };
}

function monthStart(): Date {
  const { year, month } = businessYearMonth();
  return brtMidnight(year, month, 1);
}

function nextMonthStart(): Date {
  const { year, month } = businessYearMonth();
  return month === 12 ? brtMidnight(year + 1, 1, 1) : brtMidnight(year, month + 1, 1);
}

function quarterStart(): Date {
  const { year, month } = businessYearMonth();
  return brtMidnight(year, Math.floor((month - 1) / 3) * 3 + 1, 1);
}

function nextQuarterStart(): Date {
  const { year, month } = businessYearMonth();
  const endIndex = Math.floor((month - 1) / 3) * 3 + 3;
  return brtMidnight(year + Math.floor(endIndex / 12), (endIndex % 12) + 1, 1);
}

function yearStart(): Date {
  return brtMidnight(businessYearMonth().year, 1, 1);
}

function nextYearStart(): Date {
  return brtMidnight(businessYearMonth().year + 1, 1, 1);
}

function previousMonthStart(): Date {
  const { year, month } = businessYearMonth();
  return month === 1 ? brtMidnight(year - 1, 12, 1) : brtMidnight(year, month - 1, 1);
}

/** Janela exibida (`to` é exclusivo; o usuário lê o último dia inclusivo). */
function windowLabel(from: Date, to: Date): string {
  return `${dayLabel(from)} – ${dayLabel(new Date(to.getTime() - 1))}`;
}

/** O trimestre corrente começou neste mês? (Q4 em outubro, Q1 em janeiro…) */
function isFirstMonthOfQuarter(): boolean {
  return (businessYearMonth().month - 1) % 3 === 0;
}

test("E4 — estado vazio mostra SEM VENDAS e nunca DADOS INCOMPLETOS (INV-006)", async ({
  page,
  salesSession: { tenant },
}) => {
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();

  const revenue = metricCard(page, "Faturamento real");
  await expect(revenue).toContainText("—");
  await expect(revenue).toContainText("Nenhuma venda real registrada.");

  const margin = metricCard(page, "Margem consolidada");
  await expect(margin).toContainText("—");
  // ADR-041 §3: `empty` (nada a vender ainda) não é `incomplete` (dado ausente).
  await expect(margin.getByText("SEM VENDAS", { exact: true })).toBeVisible();
  await expect(margin).not.toContainText("DADOS INCOMPLETOS");
  await expect(margin).toContainText("Sem vendas na janela");

  await expect(metricCard(page, "Produtos")).toContainText("1");
  await expect(metricCard(page, "Despesas fixas por mês")).toBeVisible();
});

test("registrar venda pelo formulário aparece em Vendas recentes", async ({
  page,
  salesSession: { tenant },
}) => {
  await registerSaleViaForm(page, tenant);

  const recent = page.locator("div.bg-card", {
    has: page.getByText("Vendas recentes"),
  });
  await expect(recent.getByText(/registrada\(s\)/i)).toBeVisible();
  await expect(recent.getByText(tenant.productName)).toContainText(VALOR_VENDA);
});

test("venda registrada aparece no faturamento real nos períodos Mês e Ano", async ({
  page,
  salesSession: { tenant },
}) => {
  await registerSaleViaForm(page, tenant);

  await page.goto("/inicio");
  const periodGroup = page.getByRole("group", { name: "Período do faturamento" });
  await expect(periodGroup.getByRole("button", { name: "Mês", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const revenue = metricCard(page, "Faturamento real");
  await expect(revenue).toContainText(VALOR_VENDA);
  await expect(revenue).toContainText("1 venda(s) na janela");
  await expect(metricCard(page, "Produtos")).toContainText("1");
  // Preço real25 diverge do catálogo20; sem custo e taxa10%, contribuição45/50=90%.
  // O oracle não reutiliza o helper de cálculo da aplicação.
  const margin = metricCard(page, "Margem consolidada");
  await expect(margin).toContainText(/90,00\s?%/);
  await expect(margin).not.toContainText("DADOS INCOMPLETOS");

  await periodGroup.getByRole("button", { name: "Ano", exact: true }).click();
  await expect(periodGroup.getByRole("button", { name: "Ano", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(revenue).toContainText(VALOR_VENDA);
  await expect(revenue).toContainText("1 venda(s) na janela");
  await expect(margin).toContainText(/90,00\s?%/);
});

// ---------------------------------------------------------------------------
// F3 — janela, foco e integridade (WP dashboard-periodo-2026-10-26).
// ---------------------------------------------------------------------------

test("E1 — venda do mês anterior não entra em Mês e entra no Ano", async ({
  page,
  salesSession: { tenant },
}) => {
  await registerSaleViaForm(page, tenant, previousMonthStart());

  await page.goto("/inicio");
  const revenue = metricCard(page, "Faturamento real");
  await expect(revenue).toContainText("—");
  await expect(revenue).toContainText("Nenhuma venda real registrada.");

  const periodGroup = page.getByRole("group", { name: "Período do faturamento" });
  await periodGroup.getByRole("button", { name: "Ano", exact: true }).click();
  await expect(page.getByTestId("period-window")).toContainText(
    windowLabel(yearStart(), nextYearStart()),
  );

  if (businessYearMonth().month === 1) {
    // Em janeiro o mês anterior é do ano anterior: fora da janela anual também.
    // A expectativa é derivada do calendário, não fixada — senão o teste mentiria
    // por onze meses e quebraria em janeiro.
    await expect(revenue).toContainText("—");
  } else {
    await expect(revenue).toContainText(VALOR_VENDA);
    await expect(revenue).toContainText("1 venda(s) na janela");
  }
});

test("E2 — janela exibida por período e selo de coincidência do trimestre", async ({ page }) => {
  await page.goto("/inicio");
  const windowText = page.getByTestId("period-window");
  await expect(windowText).toContainText(windowLabel(monthStart(), nextMonthStart()));

  const periodGroup = page.getByRole("group", { name: "Período do faturamento" });
  await periodGroup.getByRole("button", { name: "Trimestre", exact: true }).click();
  await expect(windowText).toContainText(windowLabel(quarterStart(), nextQuarterStart()));

  const coincidence = page.getByText("Coincidente com o mês atual", { exact: true });
  if (isFirstMonthOfQuarter()) {
    // Q4 começa em outubro, Q1 em janeiro: a janela do trimestre é a do mês.
    await expect(coincidence).toBeVisible();
  } else {
    await expect(coincidence).toHaveCount(0);
  }
});

test("E3 — trocar período preserva o foco no botão (DBT-165, WCAG 2.4.3)", async ({ page }) => {
  await page.goto("/inicio");
  const periodGroup = page.getByRole("group", { name: "Período do faturamento" });
  const quarter = periodGroup.getByRole("button", { name: "Trimestre", exact: true });

  // Teclado: o nó do botão não pode ser substituído pela troca de período.
  await quarter.focus();
  await page.keyboard.press("Space");
  await expect(quarter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("period-window")).toContainText(
    windowLabel(quarterStart(), nextQuarterStart()),
  );
  expect(await page.evaluate(() => (document.activeElement?.textContent ?? "").trim())).toBe(
    "Trimestre",
  );

  // Mouse: mesmo contrato.
  const year = periodGroup.getByRole("button", { name: "Ano", exact: true });
  await year.click();
  await expect(year).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (document.activeElement?.textContent ?? "").trim())).toBe("Ano");
});

test("E5 — durante a troca a janela antiga permanece e o grid não desmonta", async ({ page }) => {
  await page.goto("/inicio");
  const windowText = page.getByTestId("period-window");
  const monthWindow = windowLabel(monthStart(), nextMonthStart());
  await expect(windowText).toContainText(monthWindow);

  // Atrasa SÓ a próxima leitura do dashboard. Sem o atraso o placeholder dura
  // poucos milissegundos e a asserção viraria uma corrida (medido em F3: ~32 ms
  // no ambiente local).
  let delayed = false;
  await page.route("**/_serverFn/**", async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await route.continue();
  });

  const periodGroup = page.getByRole("group", { name: "Período do faturamento" });
  await periodGroup.getByRole("button", { name: "Ano", exact: true }).click();

  const realized = page.locator('section[aria-labelledby="inicio-realizado"]');
  await expect(realized).toHaveAttribute("aria-busy", "true");
  // Rótulo antigo enquanto o número antigo está na tela: nunca Outubro com
  // números de Setembro, nunca "Ano" com a janela do mês.
  await expect(windowText).toContainText(monthWindow);
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();
  await expect(periodGroup.getByRole("button", { name: "Ano", exact: true })).toBeVisible();

  await expect(realized).toHaveAttribute("aria-busy", "false", { timeout: 15_000 });
  await expect(windowText).toContainText(windowLabel(yearStart(), nextYearStart()));
});
