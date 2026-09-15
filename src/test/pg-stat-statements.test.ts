import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildReport,
  classifyCriticalQuery,
  CRITICAL_QUERIES,
  MAX_TOP_N,
  parseTopN,
  REGIME,
  renderMarkdown,
  resolveLocalTarget,
  type StatRow,
} from "../../scripts/obs/pg-stat-statements";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const evidencePath = join(root, "docs", "evidence", "pg-stat-statements-2026-09-15.md");

const CREDENTIAL = "s3cr3t-not-leaked";

function row(overrides: Partial<StatRow> = {}): StatRow {
  return {
    query: "select 1",
    calls: 1,
    total_exec_time: 1,
    mean_exec_time: 1,
    rows: 1,
    ...overrides,
  };
}

describe("§16.3 — guarda de host loopback do coletor pg_stat_statements", () => {
  it("aceita loopback explícito (127.0.0.1, localhost, ::1)", () => {
    const localhost = resolveLocalTarget({
      DATABASE_ADMIN_URL: `postgresql://postgres:${CREDENTIAL}@localhost:5435/pqdl_pgstat`,
    });
    expect(localhost.host).toBe("localhost");
    expect(localhost.database).toBe("pqdl_pgstat");

    const ipv4 = resolveLocalTarget({
      DATABASE_ADMIN_URL: "postgresql://postgres@127.0.0.1:5435/pqdl_pgstat",
    });
    expect(ipv4.host).toBe("127.0.0.1");

    const ipv6 = resolveLocalTarget({
      DATABASE_ADMIN_URL: "postgresql://postgres@[::1]:5435/pqdl_pgstat",
    });
    expect(ipv6.host).toBe("::1");
  });

  it("recusa host não-loopback com erro explícito e sem vazar a connection string", () => {
    const remote = [
      `postgresql://user:${CREDENTIAL}@db.neon.tech:5432/prod`,
      `postgresql://user:${CREDENTIAL}@10.0.0.5:5432/prod`,
      `postgresql://user:${CREDENTIAL}@pg.internal.example.com/prod`,
    ];
    for (const connectionString of remote) {
      const attempt = () => resolveLocalTarget({ DATABASE_ADMIN_URL: connectionString });
      expect(attempt).toThrow(/loopback/i);
      try {
        attempt();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).not.toContain(CREDENTIAL);
        expect(message).not.toContain("db.neon.tech");
      }
    }
  });

  it("falha fechado com NODE_ENV=production, URL ausente ou malformada", () => {
    expect(() =>
      resolveLocalTarget({
        NODE_ENV: "production",
        DATABASE_ADMIN_URL: "postgresql://postgres@127.0.0.1:5435/pqdl_pgstat",
      }),
    ).toThrow(/production/i);
    expect(() => resolveLocalTarget({})).toThrow(/DATABASE_ADMIN_URL/);
    expect(() => resolveLocalTarget({ DATABASE_ADMIN_URL: "não é uma url" })).toThrow(
      /malformada/i,
    );
  });

  it("limita o top-N a um intervalo declarado", () => {
    expect(parseTopN([], 10)).toBe(10);
    expect(parseTopN(["--top=3"], 10)).toBe(3);
    expect(parseTopN(["--top=9999"], 10)).toBe(MAX_TOP_N);
    expect(() => parseTopN(["--top=zero"], 10)).toThrow(/inteiro positivo/i);
  });
});

describe("§16.3 — relatório de queries críticas (linhas sintéticas, sem rede)", () => {
  it("classifica as três queries críticas do §16.4 e reporta alvos ausentes", () => {
    const rows: StatRow[] = [
      row({
        query:
          "select * from products where tenant_id = $1 and archived_at is null order by created_at desc",
        calls: 5,
        total_exec_time: 3.1,
        mean_exec_time: 0.62,
        rows: 10_000,
      }),
      row({
        // `limit 1` nunca aparece no `pg_stat_statements`: o Postgres o
        // normaliza como mais uma constante (`limit $3`, texto real capturado
        // no container efêmero da evidência de 2026-09-15).
        query:
          "select *\n        from purchase_price_history\n        where tenant_id = $1 and ingredient_id = $2\n        order by valid_from desc, recorded_at desc limit $3",
        calls: 4,
        total_exec_time: 0.36,
        mean_exec_time: 0.09,
        rows: 4,
      }),
      row({ query: "select pg_sleep(0)", calls: 1, total_exec_time: 0.01, mean_exec_time: 0.01 }),
    ];
    const report = buildReport(rows, 10);
    expect(report.missingCritical).toEqual(["dashboard.productIngredients"]);
    expect(report.critical.map((entry) => entry.critical)).toEqual([
      "products.list",
      "purchasePrice.latest",
    ]);
    expect(
      classifyCriticalQuery(
        "  SELECT * FROM products\n  WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY created_at DESC  ",
      ),
    ).toBe("products.list");
    expect(
      classifyCriticalQuery(
        "select * from product_ingredients where tenant_id = $1 and product_id = any($2)",
      ),
    ).toBe("dashboard.productIngredients");
    expect(classifyCriticalQuery("select current_database()")).toBeNull();
  });

  it("ordena por total_exec_time desc, aplica top-N e redige parâmetros", () => {
    const report = buildReport(
      [
        row({
          query: "select * from products where sku = 'AB-123' and tenant_id = $1",
          total_exec_time: 1,
        }),
        row({ query: "select * from products where sku = $1", total_exec_time: 9 }),
        row({ query: "select * from products where sku = $1", total_exec_time: 5 }),
      ],
      2,
    );
    expect(report.top).toHaveLength(2);
    expect(report.top.map((entry) => entry.total_exec_time)).toEqual([9, 5]);
    const redacted = report.top[0]?.redacted_query ?? "";
    expect(redacted).not.toContain("AB-123");
    expect(report.top.some((entry) => entry.redacted_query.includes("AB-123"))).toBe(false);
  });

  it("o markdown carrega as colunas exigidas, o regime CONTROLADO e nada de literal", () => {
    const rows: StatRow[] = [
      row({
        query:
          "select * from products where tenant_id = '70000000-0000-4000-8000-000000000701' and archived_at is null order by created_at desc",
        calls: 7,
        total_exec_time: 4.2,
        mean_exec_time: 0.6,
        rows: 14_000,
      }),
    ];
    const markdown = renderMarkdown({
      generatedAt: "2026-09-15T00:00:00.000Z",
      host: "127.0.0.1",
      database: "pqdl_pgstat",
      topN: 10,
      totalStatements: 1,
      ...buildReport(rows, 10),
    });
    for (const column of ["calls", "total_exec_time_ms", "mean_exec_time_ms", "rows", "query"]) {
      expect(markdown).toContain(column);
    }
    expect(markdown).toContain(REGIME);
    expect(REGIME).toBe("CONTROLLED");
    expect(markdown).not.toContain("70000000-0000-4000-8000-000000000701");
  });

  it("a evidência versionada declara os 7 rótulos do §35 e o regime CONTROLADO", () => {
    const evidence = readFileSync(evidencePath, "utf8");
    for (const label of [
      "hypothesis",
      "metric",
      "before",
      "change",
      "after",
      "result",
      "decision",
    ]) {
      expect(evidence).toMatch(new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}\\s*:\\*\\*`, "im"));
    }
    expect(evidence).toContain("CONTROLLED");
    expect(evidence).toMatch(/Neon[^\n]*pendente|pendente[^\n]*Neon/i);
    expect(evidence).not.toMatch(/^\s*[-*]\s*\*\*regime:\*\*\s*OBSERVED/m);
    expect(CRITICAL_QUERIES).toHaveLength(3);
  });
});
