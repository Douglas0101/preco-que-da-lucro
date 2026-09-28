// Invariante de cobertura dos dois pipelines de CI (node built-ins only).
//
// A garantia contratada no AGENTS.md ("Coverage guarantee") vive em dois YAMLs:
// a light dispara para `docs/evidence/**` e a heavy ignora exatamente esses
// caminhos (o resto vai para o verify). Se alguém editar um filtro sem o outro,
// abre-se um buraco silencioso de cobertura — este modulo transforma o contrato
// em asserção: as listas tem de ser iguais, o PR da heavy tem de ser irrestrito
// e os guards de contrato tem de estar presentes nos dois caminhos.

export interface TriggerLists {
  pushPaths: string[];
  pushPathsIgnore: string[];
  pullRequestPaths: string[];
  pullRequestAny: boolean;
}

export function parseTriggerLists(yaml: string): TriggerLists {
  const result: TriggerLists = {
    pushPaths: [],
    pushPathsIgnore: [],
    pullRequestPaths: [],
    pullRequestAny: false,
  };
  let inOn = false;
  let event: "push" | "pull_request" | null = null;
  let key: "paths" | "paths-ignore" | null = null;

  for (const raw of yaml.split("\n")) {
    if (/^on:\s*$/.test(raw)) {
      inOn = true;
      event = null;
      key = null;
      continue;
    }
    if (!inOn) continue;
    if (/^\S/.test(raw)) {
      inOn = false;
      event = null;
      key = null;
      continue;
    }
    const indent = (/^ */.exec(raw) ?? [""])[0].length;
    const trimmed = raw.trim();
    if (indent === 2) {
      if (/^push:/.test(trimmed)) {
        event = "push";
      } else if (/^pull_request:/.test(trimmed)) {
        event = "pull_request";
        result.pullRequestAny = true;
      } else {
        event = null;
      }
      key = null;
      continue;
    }
    if (indent === 4 && event) {
      if (/^paths:/.test(trimmed)) {
        key = "paths";
        if (event === "pull_request") result.pullRequestAny = false;
      } else if (/^paths-ignore:/.test(trimmed)) {
        key = "paths-ignore";
        if (event === "pull_request") result.pullRequestAny = false;
      } else {
        key = null;
      }
      continue;
    }
    if (indent >= 6 && event && key) {
      const item = /^-\s*"?([^"]+)"?\s*$/.exec(trimmed);
      if (!item) continue;
      const value = item[1];
      if (event === "push" && key === "paths") result.pushPaths.push(value);
      if (event === "push" && key === "paths-ignore") result.pushPathsIgnore.push(value);
      if (event === "pull_request" && key === "paths") result.pullRequestPaths.push(value);
    }
  }
  return result;
}

export function auditCoverage(heavyYaml: string, lightYaml: string): string[] {
  const findings: string[] = [];
  const heavy = parseTriggerLists(heavyYaml);
  const light = parseTriggerLists(lightYaml);

  const heavyIgnore = [...heavy.pushPathsIgnore].sort().join(",");
  const lightPaths = [...light.pushPaths].sort().join(",");
  if (lightPaths.length === 0) {
    findings.push("light sem push.paths: docs-only ficaria sem pipeline");
  } else if (lightPaths !== heavyIgnore) {
    findings.push(
      `light.push.paths (${lightPaths}) != heavy.push.paths-ignore (${heavyIgnore}): a uniao dos filtros deixaria de cobrir todo push`,
    );
  }
  if (!heavy.pullRequestAny) {
    findings.push(
      "heavy sem pull_request irrestrito: PR docs-only poderia escapar dos dois pipelines",
    );
  }

  const checks: Array<[string, string, RegExp, string]> = [
    ["light", lightYaml, /^\s*run:\s*node scripts\/m02-lockfile-guard\.mjs/m, "m02-lockfile-guard"],
    [
      "light",
      lightYaml,
      /^\s*run:\s*node scripts\/m02-work-package-guard\.mjs/m,
      "m02-work-package-guard",
    ],
    ["light", lightYaml, /^\s*run:\s*node scripts\/m02-debts-guard\.mjs/m, "m02-debts-guard"],
    ["light", lightYaml, /^\s*run:\s*node scripts\/m02-secrets-audit\.ts/m, "m02-secrets-audit"],
    ["light", lightYaml, /npx --yes "prettier@/, "prettier"],
    ["heavy", heavyYaml, /^\s*- run:\s*npm run m02:work-package-guard/m, "m02:work-package-guard"],
    ["heavy", heavyYaml, /^\s*- run:\s*npm run m02:debts-guard/m, "m02:debts-guard"],
  ];
  for (const [lado, texto, padrao, nome] of checks) {
    if (!padrao.test(texto)) findings.push(`${lado} sem o check ${nome}`);
  }
  return findings;
}

/**
 * Tabela de cobertura declarada no `AGENTS.md` (uma linha por grupo de gates,
 * com `✔`/`✘` por pipeline). Ela é a *afirmação* do contrato; a cadeia
 * `check` do `package.json` e os dois YAMLs são o *fato*. DBT-19 exige que
 * as duas coisas casem por asserção — sem isto, um gate sai do encadeamento
 * (ou entra nele sem ser documentado) e tudo continua verde.
 */

export interface DeclaredCoverage {
  gates: string[];
  check: boolean;
  heavy: boolean;
  light: boolean;
}

const TABLE_HEADER = "gate / guarda";

function markOf(cell: string): boolean | null {
  if (cell.includes("✔")) return true;
  if (cell.includes("✘")) return false;
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extrai a tabela de cobertura. Linha sem marca reconhecível, sem gates ou com
 * menos de quatro células vira `null`: o chamador reprova, em vez de assumir
 * `true` silencioso (fail-closed).
 */
export function parseCoverageTable(markdown: string): Array<DeclaredCoverage | null> {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.includes(TABLE_HEADER) && l.trimStart().startsWith("|"));
  if (start < 0) return [];
  const rows: Array<DeclaredCoverage | null> = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trimStart().startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) {
      rows.push(null);
      continue;
    }
    const gates = [...cells[0]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
    const marks = [markOf(cells[1]!), markOf(cells[2]!), markOf(cells[3]!)];
    if (gates.length === 0 || marks.some((m) => m === null)) {
      rows.push(null);
      continue;
    }
    rows.push({ gates, check: marks[0]!, heavy: marks[1]!, light: marks[2]! });
  }
  return rows;
}

export function gateInCheckChain(gate: string, checkChain: string[]): boolean {
  return checkChain.includes(`npm run ${gate}`);
}

/** Passo real da heavy: item de lista `- run:`, nunca comentado. */
export function gateInHeavy(gate: string, yaml: string): boolean {
  return new RegExp(`^\\s*-\\s*run:\\s*npm run ${escapeRegExp(gate)}\\s*$`, "m").test(yaml);
}

/** A light invoca os guards por `node scripts/<kebab>.<ext>`. */
export function gateInLight(gate: string, yaml: string): boolean {
  if (new RegExp(`^\\s*run:\\s*npm run ${escapeRegExp(gate)}\\s*$`, "m").test(yaml)) return true;
  const kebab = escapeRegExp(kebabDeGate(gate));
  return new RegExp(`^\\s*run:\\s*node scripts/${kebab}\\.(mjs|ts|mts)\\s*$`, "m").test(yaml);
}

/**
 * `m02:state:check` → `m02-state-check`, **todos** os dois-pontos.
 *
 * `String.prototype.replace` com padrão de **string** troca só a primeira
 * ocorrência, então `gate.replace(":", "-")` devolvia `m02-state:check` para um
 * gate de nome com dois dois-pontos — e a guarda passava a procurar
 * `scripts/m02-state:check.ts`, que não existe. O efeito era o pior possível para
 * um auditor: ele **não** encontrava o passo real e acusava a tabela de mentir
 * (`a tabela declara ✔ e o gate não roda ali`), apontando para o documento quando
 * o defeito estava aqui. Todos os gates anteriores tinham um dois-pontos só, e por
 * isso o ramo nunca havia sido exercitado.
 *
 * Corrigido nos **dois** sítios (`gateInLight` e `stepInvokesGate`), porque a
 * mesma expressão aparecia nas duas e consertar uma só deixaria a outra cega.
 */
function kebabDeGate(gate: string): string {
  return gate.replaceAll(":", "-");
}

function stepInvokesGate(step: string, gate: string): boolean {
  if (step === `npm run ${gate}`) return true;
  return step.includes(`scripts/${kebabDeGate(gate)}.`);
}

export interface DeclaredCoverageInput {
  markdown: string;
  checkChain: string[];
  heavyYaml: string;
  lightYaml: string;
  scripts: Record<string, string>;
}

/**
 * Fail-closed nas duas direções: a tabela que discorda dos fatos reprova, e
 * também a ausência da tabela, a marca ilegível, o gate declarado que não
 * existe em `package.json` e o passo da cadeia `check` que a tabela não
 * declara.
 */
export function auditDeclaredCoverage(input: DeclaredCoverageInput): string[] {
  const findings: string[] = [];
  const rows = parseCoverageTable(input.markdown);
  if (rows.length === 0) {
    findings.push("tabela de cobertura ausente ou vazia no AGENTS.md");
    return findings;
  }

  const declared = new Set<string>();
  rows.forEach((row, index) => {
    if (row === null) {
      findings.push(`linha ${index + 1} da tabela: marca ou lista de gates ilegível`);
      return;
    }
    for (const gate of row.gates) {
      declared.add(gate);
      if (!Object.hasOwn(input.scripts, gate)) {
        findings.push(`${gate}: declarado na tabela e ausente de package.json scripts`);
        continue;
      }
      const sides: Array<[string, boolean, boolean]> = [
        ["check", row.check, gateInCheckChain(gate, input.checkChain)],
        ["heavy", row.heavy, gateInHeavy(gate, input.heavyYaml)],
        ["light", row.light, gateInLight(gate, input.lightYaml)],
      ];
      for (const [side, marked, present] of sides) {
        if (marked !== present) {
          const drift = marked
            ? "a tabela declara ✔ e o gate não roda ali"
            : "a tabela declara ✘ e o gate roda ali";
          findings.push(`${gate} (${side}): ${drift}`);
        }
      }
    }
  });

  for (const step of input.checkChain) {
    if (![...declared].some((gate) => stepInvokesGate(step, gate))) {
      findings.push(`passo da cadeia \`check\` sem cobertura declarada: "${step}"`);
    }
  }
  return findings;
}
