// F-C6-2: a prova de banco de `src/test/products-fk-conflict.test.ts` (os 4 casos
// que exigem `DATABASE_ADMIN_URL`) **não** entrava em `npm run db:test` — rodava
// só pelo `npm run test`, onde o bloco de banco é pulado em silêncio (sem a URL
// o relatório é `5 passed | 4 skipped` com exit 0). Este passo encadeia a prova
// na suíte de banco e falha alto em dois casos:
//
//   1. `DATABASE_ADMIN_URL` ausente (`requireAdminUrl`);
//   2. o bloco de banco ter sido **pulado** (gate de loopback do próprio teste):
//      o resumo do reporter JSON precisa ter 0 testes pendentes. Sem isso, o
//      passo passaria com os 4 casos pulados — exatamente o buraco que F-C6-2
//      fecha.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireAdminUrl } from "./migrate";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const testFile = "src/test/products-fk-conflict.test.ts";

/** Resumo do reporter JSON do vitest (só o que este passo lê). */
interface VitestSummary {
  numTotalTests: number;
  numPassedTests: number;
  numPendingTests: number;
  numFailedTests: number;
}

function vitestBin(): string {
  const bin = join(repoRoot, "node_modules", "vitest", "vitest.mjs");
  assert.ok(existsSync(bin), `vitest não encontrado em ${bin} (rode npm ci)`);
  return bin;
}

async function main(): Promise<void> {
  const adminUrl = requireAdminUrl();
  const scratch = mkdtempSync(join(tmpdir(), "trk-d2-fk-"));
  const summaryPath = join(scratch, "summary.json");
  try {
    const result = spawnSync(
      process.execPath,
      [
        vitestBin(),
        "run",
        testFile,
        "--reporter=default",
        "--reporter=json",
        `--outputFile.json=${summaryPath}`,
      ],
      { cwd: repoRoot, stdio: "inherit", env: process.env },
    );
    assert.equal(result.error, undefined, `falha ao executar o vitest: ${result.error?.message}`);
    assert.equal(result.signal, null, `vitest terminou por sinal ${result.signal}`);
    assert.equal(
      result.status,
      0,
      `a prova de banco reprovou (exit ${result.status}); ver a saída do vitest acima`,
    );

    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as VitestSummary;
    assert.equal(summary.numFailedTests, 0, "a prova de banco reprovou (ver a saída acima)");
    assert.equal(
      summary.numPendingTests,
      0,
      `a prova de banco foi pulada (${summary.numPendingTests} testes pendentes): ` +
        "o gate de loopback do teste exige DATABASE_ADMIN_URL local, e DATABASE_URL/" +
        "DATABASE_URL_UNPOOLED locais quando definidas — nenhuma URL remota pode " +
        "segurar uma credencial de produção aqui",
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
