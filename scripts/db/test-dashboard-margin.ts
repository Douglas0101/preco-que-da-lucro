// DBT-88 (lado runner): `src/test/dashboard-consolidated-margin.db.test.ts`
// tem 4 casos gated por banco (`dbDescribe` via `dbPrecondition()`). Nenhum
// passo assertava que eles **executaram** — se o gate de loopback fechasse, o
// arquivo viraria `4 skipped` com exit 0 e a cadeia seguiria verde sem ter
// exercitado o caminho real da margem consolidada. O runner falha alto em:
//   1. `DATABASE_ADMIN_URL` ausente (`requireAdminUrl`);
//   2. o bloco de banco ter sido **pulado** (0 pendentes exigido);
//   3. a identidade de algum dos quatro casos obrigatórios faltar: três
//      estados honestos e preço real distinto do catálogo por tenant.
//
// A execução usa a API `vitest/node` (`startVitest` com filtro de arquivo) em
// vez de spawnar um subprocesso: o alvo é um literal fixo do repositório e a
// superfície de comando é zero — o veredito vem do resumo JSON do reporter.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startVitest } from "vitest/node";
import { requireAdminUrl } from "./migrate";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const testFile = "src/test/dashboard-consolidated-margin.db.test.ts";

/** Identidades obrigatórias: estados honestos e preço real por tenant. */
const REQUIRED_CASES = [
  "estado empty: tenant sem vendas reais não inventa margem",
  "estado ok: Σ(qty × mc unitária) ÷ receita líquida, em Decimal",
  "estado incomplete: produto vendido sem custo calculável desclassifica o agregado",
  "preço real e identidade: duas unidades vendidas a 40 não usam catálogo de 25",
] as const;

interface VitestSummary {
  numTotalTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numFailedTests: number;
  testResults: Array<{ assertionResults: Array<{ title: string; status: string }> }>;
}

async function main(): Promise<void> {
  const adminUrl = requireAdminUrl();
  const scratch = mkdtempSync(join(tmpdir(), "trk-dbt88-"));
  const summaryPath = join(scratch, "summary.json");
  try {
    try {
      const context = await startVitest("test", [testFile], {
        root: repoRoot,
        run: true,
        watch: false,
        reporters: ["default", "json"],
        outputFile: { json: summaryPath },
      });
      assert.ok(context, "o Vitest não produziu contexto de execução");
      try {
        assert.deepEqual(
          context.state.getUnhandledErrors(),
          [],
          "erros não tratados na prova de banco",
        );
      } finally {
        await context.close();
      }
    } catch (error) {
      assert.fail(
        `a prova de banco falhou ao executar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as VitestSummary;
    assert.ok(
      summary.numTotalTests >= REQUIRED_CASES.length,
      `a prova de banco não produziu casos suficientes: ${summary.numTotalTests} < ${REQUIRED_CASES.length} ` +
        "— os três estados honestos da margem consolidada são o contrato de fechamento " +
        "do DBT-88; um arquivo menor sairia 0 e deixaria o passo verde com a " +
        "cobertura de banco encolhida em silêncio (fail-open)",
    );
    const cases = summary.testResults.flatMap((file) => file.assertionResults);
    for (const title of REQUIRED_CASES) {
      const matches = cases.filter((test) => test.title === title);
      assert.equal(matches.length, 1, `identidade obrigatória ausente/duplicada: ${title}`);
      assert.equal(matches[0].status, "passed", `caso obrigatório não executado: ${title}`);
    }
    assert.equal(summary.numFailedTests, 0, "a prova de banco reprovou (ver a saída acima)");
    assert.equal(
      summary.numPendingTests,
      0,
      `a prova de banco foi pulada (${summary.numPendingTests} testes pendentes): ` +
        "o gate de loopback do teste exige DATABASE_ADMIN_URL local e DATABASE_URL local",
    );
    assert.equal(
      summary.numPassedTests,
      summary.numTotalTests,
      `prova de banco incompleta: ${summary.numPassedTests}/${summary.numTotalTests}`,
    );
    console.log(
      `prova de banco (${testFile}) contra 127.0.0.1: ${summary.numPassedTests} passed ` +
        `(${summary.numTotalTests}), 0 skipped — admin=${new URL(adminUrl).host}`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

await main();
