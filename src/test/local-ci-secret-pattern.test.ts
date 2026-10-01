import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ciclo 22 / F4.3 — a familia de token do Sonar (`sqa_`/`squ_`) tem de estar no **filtro** que
 * seleciona candidatos do `range-secret-scan`, nao apenas no classificador.
 *
 * Por que este teste existe, e por que ele mede o `PATTERN` e nao o classificador:
 * o `scripts/local-ci-secret-scan.mjs` recebe linhas **ja filtradas** por um `git grep -E` cujo
 * padrao vive em `scripts/local-ci.sh`. Uma linha que o filtro nao seleciona **nunca chega** ao
 * classificador — entao marcar o prefixo so no classificador e inerte. O primeiro teste que escrevi
 * para isto passava **com o defeito presente** (o classificador marca qualquer linha nao permitida),
 * e foi o controle negativo que revelou o vacuoso.
 *
 * O repositorio ja tem a regra certa para isso: o `PATTERN` carrega um **teste de vivacidade** que
 * quebra a rodada quando uma familia deixa de casar. Este teste cobre a mesma fronteira de fora,
 * de forma reproduzivel por clone.
 */

const ROOT = process.cwd();
const LOCAL_CI = join(ROOT, "scripts/local-ci.sh");

/** Extrai o `PATTERN='...'` do `local-ci.sh` — a fonte da verdade e o script, nao uma copia. */
function patternFromScript(): string {
  const source = readFileSync(LOCAL_CI, "utf8");
  const line = source.split("\n").find((l) => l.startsWith("PATTERN='"));
  if (!line) throw new Error("precondicao: `PATTERN='` ausente em scripts/local-ci.sh");
  const match = /^PATTERN='(?<pattern>.*)'\s*$/.exec(line);
  if (!match?.groups?.pattern) throw new Error("precondicao: PATTERN malformado");
  return match.groups.pattern;
}

/** Roda o MESMO motor do pipeline (`grep -E` POSIX) sobre uma amostra. */
function filterMatches(sample: string): boolean {
  const result = spawnSync("grep", ["-qE", patternFromScript()], {
    input: sample,
    encoding: "utf8",
  });
  // 0 = casou · 1 = nao casou · 2 = precondicao (padrao invalido) — e precondicao NAO e "nao casou".
  if (result.status === 2) throw new Error(`precondicao: PATTERN invalido para grep -E`);
  return result.status === 0;
}

// Literais montados em runtime: o fonte nao pode conter o padrao por extenso, senao o proprio scan
// (e o `m02:secrets-audit`) reprova este arquivo. Mesma convencao do `local-ci.sh`.
const pad = (n: number) => "A".repeat(n);
const sonarUser = `sq${"u_"}${pad(40)}`;
const sonarAnalysis = `sq${"a_"}${pad(40)}`;
const githubPat = `ghp${"_"}${pad(40)}`;

describe("Ciclo 22 F4.3 · familia de token do Sonar no filtro do range-secret-scan", () => {
  it("POS — `sqa_` e `squ_` são selecionados pelo filtro", () => {
    expect(filterMatches(`const token = "${sonarAnalysis}";`)).toBe(true);
    expect(filterMatches(`const token = "${sonarUser}";`)).toBe(true);
  });

  it("regressão — as famílias que já existiam continuam selecionadas", () => {
    expect(filterMatches(`const k = "${githubPat}";`)).toBe(true);
    expect(filterMatches(`key = "AKIA${"Q".repeat(16)}"`)).toBe(true);
  });

  it("NEG — linha benigna não é selecionada (o filtro não é um 'casa tudo')", () => {
    expect(filterMatches("const total = soma(a, b); // comentario sem segredo")).toBe(false);
    expect(filterMatches(`const quase = "sqa_curto";`)).toBe(false);
  });
});
