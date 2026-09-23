import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditSecrets } from "../../scripts/m02-secrets-audit";

/**
 * Closure test de DBT-19 — falsificabilidade das duas guardas que o registry declara
 * contrato e que hoje não rodam em gate nenhum (`m02:boundaries`) ou rodam só na light
 * (`m02:secrets-audit`).
 *
 * Regra que este arquivo serve: **nenhum gate pode ser encadeado antes de provar que sabe
 * reprovar**. Ele NÃO altera gate nenhum — é a prova que precede o encadeamento.
 *
 * Isolamento: `m02:boundaries` não aceita raiz/fixture (caminhos fixos em
 * `scripts/m02-boundaries.ts:55-56`), então a prova o executa sobre uma **cópia** da árvore
 * mínima em `mkdtemp` — o repositório real **nunca** é mutado (o plano original previa mutar
 * `matrix.yaml` e restaurar por sha256; a cópia isolada elimina esse risco).
 */

const ROOT = process.cwd();
const TSX = join(ROOT, "node_modules/.bin/tsx");
const MATRIX = join(ROOT, "docs/specs/M-02/matrix.yaml");

const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function runGuard(script: string, cwd: string) {
  const result = spawnSync(TSX, [script], { cwd, encoding: "utf8" });
  return { status: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

/** Cópia mínima: o guard lê apenas a matriz e usa `existsSync` nos caminhos de catálogo. */
function boundaryFixture(): { dir: string; matrixPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "dbt19-boundary-"));
  fixtures.push(dir);
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "docs/specs/M-02"), { recursive: true });
  writeFileSync(
    join(dir, "scripts/m02-boundaries.ts"),
    readFileSync(join(ROOT, "scripts/m02-boundaries.ts")),
  );
  const matrixPath = join(dir, "docs/specs/M-02/matrix.yaml");
  writeFileSync(matrixPath, readFileSync(MATRIX));

  const matrix = JSON.parse(readFileSync(MATRIX, "utf8")) as {
    policy: {
      catalog: {
        services: Record<string, { path: string; status: string }>;
        repositories: Record<string, { path: string; status: string }>;
      };
    };
  };
  for (const entry of Object.values({
    ...matrix.policy.catalog.services,
    ...matrix.policy.catalog.repositories,
  })) {
    if (entry.status === "contract-only") continue;
    const target = join(dir, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    if (!readFileSync) continue;
    writeFileSync(target, "");
  }
  return { dir, matrixPath };
}

describe("DBT-19 · falsificabilidade das guardas", () => {
  it("T1 — m02:boundaries fica VERDE na árvore real (sem falso positivo)", () => {
    const { status, out } = runGuard(join(ROOT, "scripts/m02-boundaries.ts"), ROOT);
    expect(out).toContain("boundary is clean");
    expect(status).toBe(0);
  });

  it("T2 — m02:boundaries REPROVA quando uma boundary é violada (fixture isolado)", () => {
    const { dir, matrixPath } = boundaryFixture();
    // Controle positivo ANTES da mutação: prova que o RED abaixo vem da violação, não do fixture.
    expect(runGuard(join(dir, "scripts/m02-boundaries.ts"), dir).status).toBe(0);

    const matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as {
      bffs: Array<{ path: string; databasePaths: string[] }>;
    };
    matrix.bffs[0].databasePaths.push("src/not-allowlisted/evil.server.ts");
    writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));

    const { status, out } = runGuard(join(dir, "scripts/m02-boundaries.ts"), dir);
    expect(status).toBe(1);
    expect(out).toContain("src/not-allowlisted/evil.server.ts");
  });

  it("T4 — m02:boundaries NÃO devolve sucesso com a matriz ausente (fail-closed)", () => {
    const { dir, matrixPath } = boundaryFixture();
    rmSync(matrixPath);
    const { status } = runGuard(join(dir, "scripts/m02-boundaries.ts"), dir);
    // Fail-closed: nunca 0. O código exato ainda é 1 (stack cru) e não 2 de precondição —
    // AC-02 do SDD-20260923-boundary-guard-dbt19 exige a distinção; este caso é o que a mede.
    expect(status).not.toBe(0);
  });

  it("T5 — m02:secrets-audit DETECTA literal de segredo sem vazar o valor", () => {
    const dir = mkdtempSync(join(tmpdir(), "dbt19-audit-"));
    fixtures.push(dir);
    mkdirSync(join(dir, "src"), { recursive: true });
    // Montado em runtime: o literal completo nunca aparece neste arquivo versionado.
    const fake = `ghp_${"A".repeat(40)}`;
    writeFileSync(join(dir, "src/leak.ts"), `const k = "${fake}";\n`);

    const report = auditSecrets(dir);
    expect(report.possible_secret_literals).toHaveLength(1);
    expect(report.possible_secret_literals[0].path).toBe("src/leak.ts");
    expect(JSON.stringify(report)).not.toContain(fake);
  });

  it("GAP DECLARADO — o CLI do secrets-audit NÃO reprova na presença do literal (exit 0)", () => {
    // Tripwire de dívida, não comportamento desejado: o audit DETECTA (T5) mas o exit code
    // ignora `possible_secret_literals` (`scripts/m02-secrets-audit.ts`: `failures.length ? 2 : 0`).
    // Encadear esta guarda como está daria cobertura de SEGREDO apenas aparente. Quando a guarda
    // for corrigida para reprovar no literal, INVERTER esta asserção para `toBe(1)`.
    const dir = mkdtempSync(join(tmpdir(), "dbt19-audit-cli-"));
    fixtures.push(dir);
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(
      join(dir, "scripts/m02-secrets-audit.ts"),
      readFileSync(join(ROOT, "scripts/m02-secrets-audit.ts")),
    );
    writeFileSync(join(dir, "src/leak.ts"), `const k = "ghp_${"A".repeat(40)}";\n`);

    const { status, out } = runGuard(join(dir, "scripts/m02-secrets-audit.ts"), dir);
    expect(JSON.parse(out).possible_secret_literals).toHaveLength(1);
    expect(status).toBe(0);
  });
});
