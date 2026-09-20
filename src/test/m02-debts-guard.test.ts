import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts/m02-debts-guard.mjs");

const tmp = mkdtempSync(join(tmpdir(), "debts-guard-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const HEADER = [
  "| id | origem | classe | severidade | closure test | evidência | status |",
  "| --- | --- | --- | --- | --- | --- | --- |",
].join("\n");

const ROW = "| DBT-01 | WP4 N1 | conformidade | alta | canario por store | selo WP4 | ABERTA |";

function fixture(name: string, content: string): string {
  const file = join(tmp, name);
  writeFileSync(file, content);
  return file;
}

function run(registry: string) {
  return spawnSync(process.execPath, [script, "--registry", registry], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

function runDefault() {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

describe("guard do registry de dívidas (DEBTS.md)", () => {
  it("o registry real passa pelo caminho default e não escreve em stderr", () => {
    const result = runDefault();
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("debts guard: OK");
    expect(result.status).toBe(0);
  });

  it("registry vazio reprova (0 = 0 não passa)", () => {
    const result = run(fixture("vazio.md", `# Registry\n\n${HEADER}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("registry vazio");
  });

  it("closure test ausente exige status NS (regra da casa)", () => {
    const semClosure = "| DBT-01 | WP4 N1 | conformidade | alta | — | selo WP4 | ABERTA |";
    const result = run(fixture("sem-closure.md", `${HEADER}\n${semClosure}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("status NS");
  });

  it("closure test ausente com status NS passa", () => {
    const semClosure = "| DBT-01 | WP4 N1 | conformidade | alta | N/A | selo WP4 | NS |";
    const result = run(fixture("sem-closure-ns.md", `${HEADER}\n${semClosure}\n`));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("debts guard: OK");
  });

  it("closure presente com status NS reprova (a fronteira na outra direção)", () => {
    const row = "| DBT-01 | WP4 N1 | conformidade | alta | canario por store | selo WP4 | NS |";
    const result = run(fixture("closure-ns.md", `${HEADER}\n${row}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("closure test presente");
  });

  it("coluna obrigatória ausente reprova pelo nome", () => {
    const semEvidencia = [
      "| id | origem | classe | severidade | closure test | status |",
      "| --- | --- | --- | --- | --- | --- |",
      ROW.replace(" | selo WP4", ""),
    ].join("\n");
    const result = run(fixture("sem-coluna.md", `${semEvidencia}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("evidencia");
  });

  it("origem degenerada reprova", () => {
    const row = ROW.replace("WP4 N1", "N/A");
    const result = run(fixture("origem-degenerada.md", `${HEADER}\n${row}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origem degenerada");
  });

  it("id duplicado reprova", () => {
    const result = run(fixture("duplicado.md", `${HEADER}\n${ROW}\n${ROW}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("duplicado");
  });

  it("classe fora da taxonomia reprova", () => {
    const row = ROW.replace("conformidade", "inventada");
    const result = run(fixture("classe.md", `${HEADER}\n${row}\n`));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("classe");
  });

  it("registry ilegível sai com erro alto (exit 2)", () => {
    const result = run(join(tmp, "nao-existe.md"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("registry ilegivel");
  });
});
