import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts/m02-work-package-guard.mjs");
const templatePath = resolve(root, "docs/evidence/_templates/work-package.md");
const realTemplate = readFileSync(templatePath, "utf8");

const tmp = mkdtempSync(join(tmpdir(), "wp-guard-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fixture(name: string, content: string): string {
  const file = join(tmp, name);
  writeFileSync(file, content);
  return file;
}

function run(template?: string) {
  const args = template === undefined ? [] : ["--template", template];
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

/** Substitui a célula "como demonstrar" (3ª) da linha do item 17 do template real. */
function comDemonstracao(valor: string): string {
  const linha = realTemplate.split("\n").find((l) => /^\|\s*17\s*\|/.test(l));
  if (linha === undefined) throw new Error("linha do item 17 ausente no template real");
  const partes = linha.split("|");
  partes[3] = ` ${valor} `;
  return realTemplate.replace(linha, partes.join("|"));
}

describe("guard do contrato de work package (falsificação em CI)", () => {
  it("o template real passa com 17 itens", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("OK (17 itens");
    expect(result.status).toBe(0);
  });

  it("item 17 removido reprova por contagem", () => {
    const semItem17 = realTemplate.replace(/\n\| 17\s+\|[^\n]*/, "");
    const result = run(fixture("sem-item17.md", semItem17));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("esperado 17");
  });

  it("demonstração vazia no item 17 reprova (S6 N4 do WP-R5)", () => {
    const vazia = comDemonstracao("");
    expect(vazia).not.toBe(realTemplate);
    const result = run(fixture("demo-vazia.md", vazia));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("demonstracao degenerada ou vazia");
  });

  it("demonstração de fachada (`aaaa`) no item 17 reprova", () => {
    const result = run(fixture("demo-fachada.md", comDemonstracao("aaaa")));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("demonstracao degenerada ou vazia");
  });

  it("origem degenerada reprova nomeando o item", () => {
    const degenerate = realTemplate.replace("WP3 C5/N1; WP5 C2/N1", "N/A");
    const result = run(fixture("origem-na.md", degenerate));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origem degenerada");
  });

  it("origem degenerada de 5 caracteres reprova (pino do DEGENERATE, não do length)", () => {
    const degenerate = realTemplate.replace("WP3 C5/N1; WP5 C2/N1", "?????");
    const result = run(fixture("origem-interrogacoes.md", degenerate));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origem degenerada");
  });

  it("coluna extra no checklist reprova pela contagem de colunas", () => {
    const extra = realTemplate.replace(/(\| origem \(S6\)[^|]*\|)/, "$1 extra |");
    const result = run(fixture("coluna-extra.md", extra));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("5 colunas");
  });

  it("campo de auto-verificação pré-S6 ausente reprova (KPI)", () => {
    const semKpi = realTemplate.replace("Auto-verificação pré-S6", "KPIs");
    const result = run(fixture("sem-kpi.md", semKpi));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("auto-verificacao pre-S6");
  });

  it("template inexistente sai com erro nomeado (exit 1)", () => {
    const result = run(join(tmp, "nao-existe.md"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("template ilegivel");
  });
});
