import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * WP-R8 — os tiers de CI, falsificados contra o YAML REAL.
 *
 * O teste não reimplementa a lógica de escopo: ele **extrai o script do próprio
 * `ui-stack.yml`**, substitui as expressões `${{ github.* }}` pelos valores do cenário, executa com
 * `bash` e lê o `$GITHUB_OUTPUT`. Assim o artefato medido é o que a CI vai rodar, não uma cópia que
 * pode divergir dele — que é a classe de falha que este programa persegue desde o WP-R2.
 *
 * Dois defeitos encontrados na auditoria do WP-R8 e fixados aqui:
 *   A1 `if: steps.scope.outputs.db == 'true'` pulava o tier de banco com output VAZIO (fail-open
 *      pela porta dos outputs) — a polaridade fail-closed é `!= 'false'`.
 *   A2 o ramo de base desconhecida dizia "rodando TODOS os tiers" e emitia só `db`: force-push,
 *      primeira push de branch e `workflow_dispatch` caiam em chromium-only.
 */
const root = resolve(import.meta.dirname, "../..");
const YAML = readFileSync(resolve(root, ".github/workflows/ui-stack.yml"), "utf8");
const temporarios: string[] = [];

afterAll(() => {
  for (const d of temporarios) rmSync(d, { recursive: true, force: true });
});

/** Extrai o bloco `run: |` do step com o `id` dado, ja dedentado. */
function scriptDoStep(id: string): string {
  const linhas = YAML.split("\n");
  const inicio = linhas.findIndex((l) => l.trim() === `- id: ${id}`);
  expect(inicio).toBeGreaterThan(-1);
  const runIdx = linhas.findIndex((l, k) => k > inicio && /^\s*run: \|\s*$/.test(l));
  expect(runIdx).toBeGreaterThan(inicio);
  const indent = linhas[runIdx].search(/\S/);
  const corpo: string[] = [];
  for (let k = runIdx + 1; k < linhas.length; k += 1) {
    const l = linhas[k];
    if (l.trim() === "") {
      corpo.push("");
      continue;
    }
    if (l.search(/\S/) <= indent) break;
    corpo.push(l.slice(indent + 2));
  }
  return corpo.join("\n");
}

function repoDeTeste(): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), "ci-tier-"));
  temporarios.push(dir);
  const git = (args: string[]) => spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git(["init", "-q"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  writeFileSync(join(dir, "README.md"), "s\n");
  git(["add", "-A"]);
  git(["commit", "-qm", "base"]);
  const base = git(["rev-parse", "HEAD"]).stdout.trim();
  return { dir, base };
}

function rodarEscopo(cenario: {
  dir: string;
  base: string;
  evento: string;
  before: string;
  head?: string;
}): Record<string, string> {
  // O repo VEM DO CENARIO: criar um repo proprio aqui produzia SHAs de outro repositorio e o
  // `git diff` morria com "bad object" — o teste media o nada e acusava a coisa errada.
  const { dir, base } = cenario;
  const fonte = scriptDoStep("scope")
    .replace(/\$\{\{\s*github\.event_name\s*\}\}/g, cenario.evento)
    .replace(/\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\}\}/g, cenario.base ?? base)
    .replace(/\$\{\{\s*github\.event\.before\s*\}\}/g, cenario.before)
    .replace(/\$\{\{\s*github\.sha\s*\}\}/g, cenario.head ?? base);
  writeFileSync(join(dir, "escopo.sh"), fonte);
  const saida = join(dir, "github-output");
  writeFileSync(saida, "");
  const r = spawnSync("bash", [join(dir, "escopo.sh")], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, GITHUB_OUTPUT: saida },
  });
  const out: Record<string, string> = {
    __stdout: `${r.stdout}${r.stderr}`,
    __status: String(r.status),
  };
  for (const l of readFileSync(saida, "utf8").split("\n")) {
    const m = /^([a-z]+)=(.*)$/.exec(l);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function comCommitDe(dir: string, arquivo: string, base: string): string {
  mkdirSync(join(dir, ...arquivo.split("/").slice(0, -1)), { recursive: true });
  writeFileSync(join(dir, arquivo), "x\n");
  spawnSync("git", ["-C", dir, "add", "-A"], { encoding: "utf8" });
  spawnSync("git", ["-C", dir, "commit", "-qm", "mudanca"], { encoding: "utf8" });
  return (
    spawnSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim() || base
  );
}

describe("WP-R8 — polaridade fail-closed das condições de tier", () => {
  it("A1: nenhuma condição de gate usa `== 'true'` (output vazio pularia o tier)", () => {
    const gates = [...YAML.matchAll(/if: steps\.scope\.outputs\.(\w+) == 'true'/g)];
    expect(gates.map((m) => m[1])).toEqual([]);
  });

  it("A1: os tiers de banco usam `!= 'false'` e o aviso de pulo usa `== 'false'`", () => {
    expect([...YAML.matchAll(/if: steps\.scope\.outputs\.db != 'false'/g)].length).toBe(2);
    expect([...YAML.matchAll(/if: steps\.scope\.outputs\.db == 'false'/g)].length).toBe(1);
  });

  it("A2b: o `if` shell dos browsers só cai em chromium com `false` explícito", () => {
    const sh = scriptDoStep("browsers");
    expect(sh).toContain('= "false" ]');
    expect(sh).not.toContain('= "true" ]');
    // a polaridade importa: o ramo do `if` tem de ser o chromium-only
    const ramoIf = sh.slice(sh.indexOf('= "false" ]'), sh.indexOf("else"));
    expect(ramoIf).toContain("lista=chromium");
    expect(sh.slice(sh.indexOf("else"))).toContain("chromium firefox webkit");
  });
});

describe("WP-R8 — o script de escopo real, executado", () => {
  it("push com diff comum: db=false e crossbrowser=false (explícitos, não vazios)", () => {
    const { dir, base } = repoDeTeste();
    const head = comCommitDe(dir, "src/test/qualquer.test.ts", base);
    const out = rodarEscopo({ dir, base, evento: "push", before: base, head });
    expect(out.__status).toBe("0");
    expect(out.__stdout).toContain("arquivos alterados:");
    expect(out.db).toBe("false");
    expect(out.crossbrowser).toBe("false");
  });

  it("push com diff de banco: db=true", () => {
    const { dir, base } = repoDeTeste();
    const head = comCommitDe(dir, "drizzle/9999_x.sql", base);
    const out = rodarEscopo({ dir, base, evento: "push", before: base, head });
    expect(out.db).toBe("true");
  });

  it("A2: base desconhecida (force-push / primeira push) roda TODOS os tiers — inclusive cross-browser", () => {
    const { dir, base } = repoDeTeste();
    const out = rodarEscopo({
      dir,
      base,
      evento: "push",
      before: "0000000000000000000000000000000000000000",
    });
    expect(out.db).toBe("true");
    expect(out.crossbrowser).toBe("true");
    expect(out.motivo).toBe("base-desconhecida");
  });

  it("A2: `workflow_dispatch` roda TODOS os tiers — inclusive cross-browser", () => {
    const { dir, base } = repoDeTeste();
    const out = rodarEscopo({ dir, base, evento: "workflow_dispatch", before: "" });
    expect(out.db).toBe("true");
    expect(out.crossbrowser).toBe("true");
  });

  it("pull_request usa a base do PR e roda cross-browser", () => {
    const { dir, base } = repoDeTeste();
    const head = comCommitDe(dir, "src/lib/x.ts", base);
    const out = rodarEscopo({ dir, base, evento: "pull_request", before: "", head });
    expect(out.db).toBe("false");
    expect(out.crossbrowser).toBe("true");
  });

  it("falha de classificação NÃO é silenciosa: git sem repo ⇒ exit ≠ 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-tier-nogit-"));
    temporarios.push(dir);
    const fonte = scriptDoStep("scope")
      .replace(/\$\{\{\s*github\.event_name\s*\}\}/g, "push")
      .replace(/\$\{\{\s*github\.event\.before\s*\}\}/g, "abc1234")
      .replace(/\$\{\{\s*github\.sha\s*\}\}/g, "abc1234");
    writeFileSync(join(dir, "escopo.sh"), fonte);
    writeFileSync(join(dir, "github-output"), "");
    const r = spawnSync("bash", [join(dir, "escopo.sh")], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GITHUB_OUTPUT: join(dir, "github-output") },
    });
    // sem repositório, `git cat-file` falha -> cai no ramo fail-closed (roda tudo), nunca em "pula"
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, "github-output"), "utf8")).toContain("crossbrowser=true");
  });
});

describe("WP-R8 — concurrency não cancela a fronteira de produção", () => {
  it("A3: o cancelamento é condicional a não ser a ref de `main`", () => {
    expect(YAML).toContain("cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}");
  });
});
