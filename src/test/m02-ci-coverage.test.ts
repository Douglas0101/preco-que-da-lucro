import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditCoverage,
  auditDeclaredCoverage,
  parseCoverageTable,
  parseTriggerLists,
} from "../../scripts/lib/m02-ci-coverage";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const agentsPath = resolve(root, "AGENTS.md");
const heavyPath = resolve(root, ".github/workflows/ui-stack.yml");
const lightPath = resolve(root, ".github/workflows/ci-light.yml");
const heavyReal = readFileSync(heavyPath, "utf8");
const lightReal = readFileSync(lightPath, "utf8");
const agentsReal = readFileSync(agentsPath, "utf8");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const checkChainReal = pkg.scripts
  .check!.split("&&")
  .map((s: string) => s.trim())
  .filter(Boolean);

/**
 * DBT-19, condição de fechamento que faltava: a tabela de cobertura do
 * `AGENTS.md` é afirmação; a cadeia `check` e os dois YAMLs são o fato.
 * Antes disto um gate podia sair do encadeamento — ou entrar nele sem ser
 * documentado — e a suíte continuava verde.
 */

describe("cobertura de CI dos dois pipelines", () => {
  it("os workflows reais satisfazem o invariante (light.paths == heavy.paths-ignore)", () => {
    expect(auditCoverage(heavyReal, lightReal)).toEqual([]);
  });

  it("o parser extrai as listas de push e o PR irrestrito da heavy", () => {
    const heavy = parseTriggerLists(heavyReal);
    expect(heavy.pushPathsIgnore).toEqual(["docs/evidence/**"]);
    expect(heavy.pullRequestAny).toBe(true);
    const light = parseTriggerLists(lightReal);
    expect(light.pushPaths).toEqual(["docs/evidence/**"]);
    expect(light.pullRequestPaths).toEqual(["docs/evidence/**"]);
  });

  it("filtros divergentes entre os dois workflows reprovam", () => {
    const light = lightReal.replaceAll('"docs/evidence/**"', '"docs/**"');
    const findings = auditCoverage(heavyReal, light);
    expect(findings.join("\n")).toContain("light.push.paths");
  });

  it("heavy com pull_request filtrado reprova (PR docs-only escaparia dos dois)", () => {
    const heavy = heavyReal.replace(
      "  pull_request:\n",
      '  pull_request:\n    paths:\n      - "src/**"\n',
    );
    const findings = auditCoverage(heavy, lightReal);
    expect(findings.join("\n")).toContain("pull_request irrestrito");
  });

  it("heavy com pull_request filtrado por paths-ignore reprova", () => {
    const heavy = heavyReal.replace(
      "  pull_request:\n",
      '  pull_request:\n    paths-ignore:\n      - "src/**"\n',
    );
    expect(auditCoverage(heavy, lightReal).join("\n")).toContain("pull_request irrestrito");
  });

  it("guards só em comentário reprovam (o passo real tem de existir)", () => {
    const heavyComentado = heavyReal.replace(
      "      - run: npm run m02:debts-guard",
      "      # - run: npm run m02:debts-guard",
    );
    expect(auditCoverage(heavyComentado, lightReal).join("\n")).toContain("m02:debts-guard");
    const lightComentado = lightReal.replace(
      "        run: node scripts/m02-debts-guard.mjs",
      "        # run: node scripts/m02-debts-guard.mjs",
    );
    expect(auditCoverage(heavyReal, lightComentado).join("\n")).toContain("m02-debts-guard");
  });

  it("light sem lockfile guard, secrets audit ou prettier reprova", () => {
    const semLockfile = lightReal.replace(
      "        run: node scripts/m02-lockfile-guard.mjs",
      "        # run: node scripts/m02-lockfile-guard.mjs",
    );
    expect(auditCoverage(heavyReal, semLockfile).join("\n")).toContain("m02-lockfile-guard");
    const semSecrets = lightReal.replace(
      "        run: node scripts/m02-secrets-audit.ts",
      "        # run: node scripts/m02-secrets-audit.ts",
    );
    expect(auditCoverage(heavyReal, semSecrets).join("\n")).toContain("m02-secrets-audit");
    const semPrettier = lightReal.replace(
      'npx --yes "prettier@${version}" --check "${files[@]}"',
      "echo skip",
    );
    expect(auditCoverage(heavyReal, semPrettier).join("\n")).toContain("prettier");
  });

  it("guards ausentes em qualquer um dos lados reprovam", () => {
    const lightSemDebts = lightReal.replace(/.*m02-debts-guard.*\n/, "");
    expect(auditCoverage(heavyReal, lightSemDebts).join("\n")).toContain("m02-debts-guard");
    const heavySemWp = heavyReal.replace("      - run: npm run m02:work-package-guard\n", "");
    expect(auditCoverage(heavySemWp, lightReal).join("\n")).toContain("m02:work-package-guard");
  });

  it("light sem push.paths reprova (docs-only ficaria sem pipeline)", () => {
    const lightSemPaths = lightReal.replace(
      '  push:\n    paths:\n      - "docs/evidence/**"\n',
      "  push:\n",
    );
    expect(auditCoverage(heavyReal, lightSemPaths).join("\n")).toContain("light sem push.paths");
  });
});

describe("tabela de cobertura do AGENTS.md × cadeia `check` × dois YAMLs", () => {
  const audit = (markdown: string, checkChain: string[], heavy = heavyReal, light = lightReal) =>
    auditDeclaredCoverage({
      markdown,
      checkChain,
      heavyYaml: heavy,
      lightYaml: light,
      scripts: pkg.scripts,
    });

  it("a tabela real bate com os fatos nas três colunas e em todas as direções", () => {
    expect(audit(agentsReal, checkChainReal)).toEqual([]);
  });

  it("a cadeia `check` real tem os 16 gates que a tabela declara", () => {
    expect(checkChainReal).toHaveLength(16);
    expect(parseCoverageTable(agentsReal).flatMap((r) => r?.gates ?? [])).toHaveLength(
      new Set(parseCoverageTable(agentsReal).flatMap((r) => r?.gates ?? [])).size,
    );
  });

  it("gate acrescentado ao `check` e ausente da tabela reprova (a outra direção)", () => {
    const findings = audit(agentsReal, [...checkChainReal, "npm run m02:gate-inexistente"]);
    expect(findings.join("\n")).toContain("passo da cadeia `check` sem cobertura declarada");
  });

  it("gate declarado na tabela e ausente de `package.json` reprova", () => {
    const withGhost = agentsReal.replace(
      "| `m02:state:check` |",
      "| `m02:state:check`, `m02:fantasma` |",
    );
    expect(audit(withGhost, checkChainReal).join("\n")).toContain("m02:fantasma");
  });

  it("guard removido da heavy sem mudar a tabela reprova", () => {
    const semGuard = heavyReal.replace("      - run: npm run m02:boundaries\n", "");
    const findings = audit(agentsReal, checkChainReal, semGuard).join("\n");
    expect(findings).toContain("m02:boundaries (heavy)");
  });

  it("guard removido da light sem mudar a tabela reprova", () => {
    const semGuard = lightReal.replace(/.*run: node scripts\/m02-secrets-audit\.ts.*\n/, "");
    const findings = audit(agentsReal, checkChainReal, heavyReal, semGuard).join("\n");
    expect(findings).toContain("m02:secrets-audit (light)");
  });

  it("gate removido do `check` sem mudar a tabela reprova", () => {
    const semGate = checkChainReal.filter((s) => s !== "npm run m02:seal-dts:check");
    const findings = audit(agentsReal, semGate).join("\n");
    expect(findings).toContain("m02:seal-dts:check (check)");
  });

  it("✔ virado ✘ numa linha real da tabela reprova (afirmação desatualizada)", () => {
    const desatualizada = agentsReal.replace(
      "| `m02:lockfile-guard` | ✔ |",
      "| `m02:lockfile-guard` | ✘ |",
    );
    expect(audit(desatualizada, checkChainReal).join("\n")).toContain("m02:lockfile-guard (check)");
  });

  it("guard comentado na heavy conta como ausente, não como presente", () => {
    const comentado = heavyReal.replace(
      "      - run: npm run m02:matrix:check",
      "      # - run: npm run m02:matrix:check",
    );
    expect(audit(agentsReal, checkChainReal, comentado).join("\n")).toContain(
      "m02:matrix:check (heavy)",
    );
  });

  it("marca ilegível reprova em vez de virar `true` silencioso", () => {
    const semMarca = agentsReal.replace("| `m02:boundaries` | ✔ |", "| `m02:boundaries` | ? |");
    const findings = audit(semMarca, checkChainReal).join("\n");
    expect(findings).toContain("ilegível");
    expect(findings).toContain(
      'passo da cadeia `check` sem cobertura declarada: "npm run m02:boundaries"',
    );
  });

  it("tabela ausente reprova (fail-closed, não é um passe)", () => {
    const findings = audit("sem tabela nenhuma", checkChainReal).join("\n");
    expect(findings).toContain("tabela de cobertura ausente");
  });

  it("o teste é vivo: o audit reprova um mundo em que o gate sumiu", () => {
    const semBoundaries = agentsReal.replace(/`m02:boundaries` \| ✔ \| ✔ \(passo direto\) \|/, "|");
    const findings = audit(semBoundaries, checkChainReal).join("\n");
    expect(findings.length).toBeGreaterThan(0);
  });
});
