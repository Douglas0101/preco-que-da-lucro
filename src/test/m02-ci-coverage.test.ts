import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditCoverage,
  auditDeclaredCoverage,
  auditSonarPipeline,
  auditWorkflowDiscovery,
  gateInLight,
  parseCoverageTable,
  parseTriggerLists,
  sonarStepRun,
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

describe("detecção de gate na light — nomes com mais de um dois-pontos", () => {
  it("REGRESSÃO: `m02:state:check` é detectado no YAML real", () => {
    // O helper fazia `gate.replace(":", "-")`, que com padrão de STRING troca só a
    // primeira ocorrência: `m02:state:check` virava `m02-state:check`, e o passo
    // real (`node scripts/m02-state-check.ts`) não era encontrado. O auditor então
    // acusava o AGENTS.md de mentir — apontando para o documento quando o defeito
    // estava no auditor. Todos os gates anteriores tinham um dois-pontos só, e por
    // isso o ramo nunca tinha sido exercitado.
    expect(gateInLight("m02:state:check", lightReal)).toBe(true);
  });

  it("a conversão é de TODOS os dois-pontos, e um gate ausente segue ausente", () => {
    // Forma real dos passos da light: `run:` em linha própria, sob um `- name:`.
    // (O `- run:` inline é a forma da heavy, e `gateInLight` não a promete.)
    const comDoisPontos = "        run: node scripts/m02-state-check.ts\n";
    expect(gateInLight("m02:state:check", comDoisPontos)).toBe(true);
    expect(gateInLight("m02:nao-existe-gate", comDoisPontos)).toBe(false);
    // Um gate de um dois-pontos continua funcionando: a correção não pode
    // consertar um caso quebrando o anterior.
    expect(gateInLight("m02:debts-guard", lightReal)).toBe(true);
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

  it("a cadeia `check` involve exatamente os gates que a tabela marca ✔ em `check`", () => {
    // Identidade, não cardinalidade: um número fixo aqui envelheceria sozinho e
    // passaria a mentir assim que um gate novo entrasse na cadeia.
    const declarados = parseCoverageTable(agentsReal)
      .filter((row) => row?.check)
      .flatMap((row) => row?.gates ?? [])
      .sort();
    const invocados = checkChainReal
      .map((step) => /^npm run ([^\s&|]+)$/.exec(step)?.[1] ?? null)
      .filter((name): name is string => name !== null)
      .sort();
    expect(invocados).toEqual(declarados);
    expect(invocados.length).toBeGreaterThan(0);
  });

  it("a cadeia `check` não repete passo", () => {
    expect(new Set(checkChainReal).size).toBe(checkChainReal.length);
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

/**
 * `DBT-62` — **`checked === discovered`**.
 *
 * O contrato acima cobre dois pipelines, e o `sonar.yml` era **invisível**: nem
 * a tabela nem `auditCoverage` o conheciam, então um pipeline inteiro escapava
 * com o gate verde. A invariante que faltava é de descoberta.
 */

const workflowsDir = resolve(root, ".github/workflows");
const descobertos = readdirSync(workflowsDir)
  .filter((f) => f.endsWith(".yml"))
  .sort();
const sonarReal = readFileSync(resolve(workflowsDir, "sonar.yml"), "utf8");

/** Cobertos por asserção: os dois filtros de push/PR e o pipeline de análise. */
const COBERTOS = ["ci-light.yml", "sonar.yml", "ui-stack.yml"];

/** Fora do contrato **com motivo nomeado** — o contrato é sobre filtro de push/PR. */
const FORA_DO_CONTRATO: Record<string, string> = {
  "neon-drill-ops.yml": "exercício de drill de banco, disparo manual; não filtra push/PR",
  "neon-pr-branch.yml": "branch efêmera de PR do Neon; o próprio workflow é a superfície de guarda",
  "neon-preview.yml": "preview do Neon; guarda própria de credencial",
  "neon-readiness.yml": "prontidão do Neon; disparo manual",
};

describe("DBT-62 · o contrato enxerga TODO workflow descoberto", () => {
  it("os workflows reais estão todos declarados (checked === discovered)", () => {
    expect(
      auditWorkflowDiscovery({
        discovered: descobertos,
        covered: COBERTOS,
        outOfContract: FORA_DO_CONTRATO,
      }),
    ).toEqual([]);
  });

  it("NEG — workflow novo, sem declaração, reprova (era a lacuna do DBT-62)", () => {
    const findings = auditWorkflowDiscovery({
      discovered: [...descobertos, "pipeline-novo.yml"],
      covered: COBERTOS,
      outOfContract: FORA_DO_CONTRATO,
    });
    expect(findings.join("\n")).toContain("pipeline-novo.yml");
  });

  it("NEG — workflow declarado e ausente do disco reprova (prosa que ninguém confere)", () => {
    const findings = auditWorkflowDiscovery({
      discovered: descobertos.filter((f) => f !== "sonar.yml"),
      covered: COBERTOS,
      outOfContract: FORA_DO_CONTRATO,
    });
    expect(findings.join("\n")).toContain("sonar.yml");
  });

  it("NEG — fora do contrato sem motivo reprova", () => {
    const findings = auditWorkflowDiscovery({
      discovered: descobertos,
      covered: COBERTOS,
      outOfContract: { ...FORA_DO_CONTRATO, "outro.yml": "   " },
    });
    expect(findings.join("\n")).toContain("sem motivo");
  });
});

describe("DBT-62 · claims do pipeline Sonar", () => {
  it("o sonar.yml real satisfaz todas as claims", () => {
    expect(auditSonarPipeline(sonarReal)).toEqual([]);
  });

  it("recusa o defeito original: baseline incondicional antes de scanner em main", () => {
    const mutant = sonarReal.replace("        if: github.event_name == 'pull_request'\n", "");
    expect(mutant).not.toBe(sonarReal);
    expect(auditSonarPipeline(mutant).join("\n")).toContain("exclusiva de PR");
  });
  it("recusa main sem leitura posterior do CE ou sem identidade do provider", () => {
    for (const text of [
      "Medir main somente após a análise do push",
      "EXPECTED_PR:",
      "sonar.scm.revision=$(git rev-parse HEAD)",
    ]) {
      const mutant = sonarReal.replace(text, "removed");
      expect(mutant).not.toBe(sonarReal);
      expect(auditSonarPipeline(mutant)).not.toEqual([]);
    }
  });

  it("NEG — uma remoção por guarda, preservando as outras guardas", () => {
    const mutacoes: Array<[string, string]> = [
      ["roda a suíte com cobertura", "npm run test:coverage"],
      [
        "recusa lcov ausente ou vazio",
        'if [ ! -s coverage/lcov.info ]; then\n            echo "::error::coverage/lcov.info ausente ou vazio — o analyze mediria 0% de novo"\n            exit 1\n          fi',
      ],
      ["espera o Quality Gate", "-Dsonar.qualitygate.wait=true"],
      ["envia o relatório ao scanner", "-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info"],
      ["observa que o sensor rodou", "Sensor JavaScript/TypeScript Coverage"],
      ["atribui a análise a PR", "-Dsonar.pullrequest.key="],
    ];
    for (const [claim, trecho] of mutacoes) {
      const mutado = sonarReal.replaceAll(trecho, "");
      // A mutação tem de ter alterado o arquivo — senão o teste passaria por não ter mutado nada,
      // que é o modo vacuoso que o Ciclo 22 pegou duas vezes.
      expect(mutado, `${claim}: a mutação não alterou o arquivo`).not.toBe(sonarReal);
      expect(auditSonarPipeline(mutado).join("\n"), `${claim}: a mutação não reprovou`).not.toBe(
        "",
      );
    }
  });
});

describe("DBT-66 · a recusa é executável, não uma menção ao path", () => {
  const guard = sonarStepRun(sonarReal, "Conferir o relatório antes de enviar");

  it.each(["ausente", "vazio", "válido"] as const)(
    "fixture LCOV %s decide pelo arquivo",
    (state) => {
      expect(guard).not.toBeNull();
      const directory = mkdtempSync(resolve(tmpdir(), "sonar-lcov-"));
      try {
        if (state !== "ausente") {
          mkdirSync(resolve(directory, "coverage"));
          writeFileSync(
            resolve(directory, "coverage/lcov.info"),
            state === "vazio" ? "" : "TN:\nSF:src/fixture.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n",
          );
        }
        const result = spawnSync("bash", ["-c", guard!], { cwd: directory, encoding: "utf8" });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(state === "válido" ? 0 : 1);
        expect(result.stdout).toContain(state === "válido" ? "bytes" : "ausente ou vazio");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("remove só o bloco condicional; flag e upload preservados não mascaram ausência", () => {
    const conditional = / {10}if \[ ! -s coverage\/lcov\.info \]; then\n[\s\S]*? {10}fi\n/;
    const removed = sonarReal.match(conditional)?.[0];
    expect(removed).toBeDefined();
    const mutant = sonarReal.replace(conditional, "");
    expect(mutant).not.toBe(sonarReal);
    expect(mutant).toContain("sonar.javascript.lcov.reportPaths=coverage/lcov.info");
    expect(mutant).toMatch(/path: \|\s+coverage\/lcov\.info/);
    expect(auditSonarPipeline(mutant)).toContain(
      "sonar.yml sem a claim: recusa lcov ausente ou vazio",
    );
  });
});
