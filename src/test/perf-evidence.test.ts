import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const evidenceRoot = join(root, "docs", "evidence");
const templatePath = join(evidenceRoot, "_templates", "performance-evidence.md");

const REQUIRED_LABELS = [
  "hypothesis",
  "metric",
  "before",
  "change",
  "after",
  "result",
  "decision",
] as const;

type RequiredLabel = (typeof REQUIRED_LABELS)[number];

const LABEL_PATTERNS = REQUIRED_LABELS.map((label) => ({
  label,
  pattern: new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}\\s*:\\*\\*`, "im"),
}));

/**
 * Allowlist de legado — REDUZIDA de 3 para 2 entradas em WP-A1 (`35`).
 *
 * Por que estas duas ficam: `perf-baseline-2026-08-29.md` e
 * `perf-after-2026-08-29.md` são artefatos de regime `dev-evidence` publicados
 * ANTES deste gate (commit `53f09e4`), com raw NÃO versionado
 * (`/tmp/opencode/vite-dev.log`, hoje inexistente). Preencher os 7 rótulos
 * exigiria inventar `before`/`after`/`metric` — reescrever evidência histórica
 * com números não re-deriváveis. Ficam isentos, mas a isenção é ancorada em
 * CONTEÚDO: o arquivo precisa declarar o regime de legado no próprio corpo
 * (ver `auditPerfEvidence`); nome sozinho não isenta.
 *
 * Por que a 3ª entrada foi REMOVIDA: `explain-critical-queries-2026-08-21.md`
 * não casa nenhum dos predicados de caminho (§ abaixo) e nunca era descoberto —
 * a entrada era morta e dava a impressão falsa de que a allowlist cobria um caso.
 *
 * Nenhuma entrada nova pode ser acrescentada: artefato novo sem os 7 rótulos
 * REPROVA (é o propósito do gate).
 */
const LEGACY_ALLOWLIST: Readonly<Record<string, string>> = {
  "perf-baseline-2026-08-29.md": "dev-evidence",
  "perf-after-2026-08-29.md": "dev-evidence",
};

const EMPTY_DISCOVERY_FAILURE =
  "docs/evidence/**: descoberta vazia — nenhum artefato de evidência de performance encontrado; o gate §35 é fail-closed e REPROVA conjunto vazio (contrato em docs/evidence/_templates/performance-evidence.md)";

const SKIPPED_DIRS: Readonly<Record<string, true>> = { _templates: true, "agent-state": true };

/**
 * Contrato de §35 é de CAMINHO, não de basename: é artefato de evidência de
 * performance todo `.md` sob `docs/evidence/**` que (a) esteja dentro de um
 * diretório cujo nome começa com `perf-` (bundle de captura) ou (b) seja ele
 * mesmo `perf-*.md` / `*-perf-*.md`. O basename sozinho deixava escapar
 * `docs/evidence/perf-controlled-2026-09-13/report.md` (V2-CD, item `35`).
 *
 * Não varridos (`SKIPPED_DIRS`): `_templates` (esqueleto copiado) e
 * `agent-state/**` — árvore de fluxo de trabalho do programa SDD (SPEC-CARDS,
 * CLAIMS-INBOX, PROGRESS). Sem a segunda exclusão, nomes de fluxo mandatórios
 * como `35-perf-gate.md` (card e claim do item `35`) casariam a convenção
 * `*-perf-*` e reprovariam o gate por não carregarem os 7 rótulos, que são de
 * evidência de performance, não de fluxo.
 */
function isPerfEvidencePath(relativePath: string): boolean {
  const segments = relativePath.split("/");
  const name = segments.at(-1) ?? relativePath;
  if (!name.endsWith(".md")) return false;
  return segments.some((segment) => segment.startsWith("perf-")) || name.includes("-perf-");
}

function discoverPerfEvidence(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS[entry.name] === true) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = relative(dir, full).split(sep).join("/");
      if (isPerfEvidencePath(relativePath)) found.push(relativePath);
    }
  };
  walk(dir);
  return found.sort();
}

function missingLabels(content: string): RequiredLabel[] {
  return LABEL_PATTERNS.filter(({ pattern }) => !pattern.test(content)).map(({ label }) => label);
}

interface PerfEvidenceAudit {
  discovered: string[];
  checked: string[];
  allowlisted: string[];
  failures: string[];
}

function auditPerfEvidence(dir: string): PerfEvidenceAudit {
  const discovered = discoverPerfEvidence(dir);
  if (discovered.length === 0) {
    return { discovered, checked: [], allowlisted: [], failures: [EMPTY_DISCOVERY_FAILURE] };
  }
  const checked: string[] = [];
  const allowlisted: string[] = [];
  const failures: string[] = [];
  for (const relativePath of discovered) {
    const content = readFileSync(join(dir, relativePath), "utf8");
    const legacyRegime = Object.hasOwn(LEGACY_ALLOWLIST, relativePath)
      ? LEGACY_ALLOWLIST[relativePath]
      : undefined;
    if (legacyRegime !== undefined) {
      allowlisted.push(relativePath);
      if (!content.includes(legacyRegime)) {
        failures.push(
          `docs/evidence/${relativePath}: isento como legado (\`${legacyRegime}\`) mas não declara esse regime — a allowlist de legado não isenta por nome`,
        );
      }
      continue;
    }
    checked.push(relativePath);
    const missing = missingLabels(content);
    if (missing.length > 0) {
      failures.push(`docs/evidence/${relativePath}: rótulo(s) ausente(s): ${missing.join(", ")}`);
    }
  }
  return { discovered, checked, allowlisted, failures };
}

const fixtureRoots: string[] = [];

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "perf-evidence-"));
  fixtureRoots.push(dir);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return dir;
}

afterAll(() => {
  for (const dir of fixtureRoots) rmSync(dir, { recursive: true, force: true });
});

/** Artefato contratado mínimo, com os 7 rótulos (§35). */
const CONTRACT_ARTIFACT = [
  "# Evidência de performance — fixture",
  "",
  "- **hypothesis:** fixture",
  "- **metric:** fixture",
  "- **before:** fixture",
  "- **change:** fixture",
  "- **after:** fixture",
  "- **result:** fixture",
  "- **decision:** fixture",
  "",
].join("\n");

function withoutLabel(content: string, label: RequiredLabel): string {
  return content
    .split("\n")
    .filter((line) => !line.startsWith(`- **${label}:**`))
    .join("\n");
}

describe("gate §35 — evidência de performance", () => {
  it("T1: descoberta vazia REPROVA (fail-closed)", () => {
    const dir = fixture({
      "_templates/performance-evidence.md": CONTRACT_ARTIFACT,
      "notas/sem-artefato.md": "# nada aqui",
    });
    const audit = auditPerfEvidence(dir);
    expect(audit.discovered).toEqual([]);
    expect(audit.failures.join("\n")).toMatch(/descoberta vazia|nenhum artefato/i);
  });

  it("T1b: diretório `perf-*` sem nenhum `.md` contratado REPROVA", () => {
    const dir = fixture({ "perf-so-raw-2026-01-01/raw.jsonl": "{}" });
    const audit = auditPerfEvidence(dir);
    expect(audit.discovered).toEqual([]);
    expect(audit.failures.length).toBeGreaterThan(0);
  });

  it("T2: falta de QUALQUER um dos 7 rótulos REPROVA (bundle `perf-*/report.md` incluído)", () => {
    for (const label of REQUIRED_LABELS) {
      const dir = fixture({
        "perf-x-2026-01-01/report.md": withoutLabel(CONTRACT_ARTIFACT, label),
      });
      const audit = auditPerfEvidence(dir);
      expect(audit.checked).toEqual(["perf-x-2026-01-01/report.md"]);
      expect(audit.failures.join("\n")).toContain(label);
    }
  });

  it("T3: artefato contratado completo PASSA (e o que está fora do contrato não é inspecionado)", () => {
    const dir = fixture({
      "perf-x-2026-01-01/perf-evidence.md": CONTRACT_ARTIFACT,
      "perf-y-2026-01-01/report.md": CONTRACT_ARTIFACT,
      "outras-notas.md": "# fora do contrato de caminho",
    });
    const audit = auditPerfEvidence(dir);
    expect(audit.failures).toEqual([]);
    expect(audit.checked).toEqual([
      "perf-x-2026-01-01/perf-evidence.md",
      "perf-y-2026-01-01/report.md",
    ]);
  });

  it("T4: a allowlist de legado é explícita, mínima e ancorada em conteúdo", () => {
    // T4a: conjunto exato (reduzido de 3 para 2; `explain-critical-queries-*` era entrada morta).
    expect(LEGACY_ALLOWLIST).toEqual({
      "perf-after-2026-08-29.md": "dev-evidence",
      "perf-baseline-2026-08-29.md": "dev-evidence",
    });
    // T4b: isenção NÃO vale só pelo nome — mesmo caminho de legado sem o regime reprova.
    const rogue = fixture({
      "perf-baseline-2026-08-29.md": withoutLabel(CONTRACT_ARTIFACT, "metric"),
    });
    const rogueAudit = auditPerfEvidence(rogue);
    expect(rogueAudit.failures.join("\n")).toContain("perf-baseline-2026-08-29.md");
    // T4c: o legado real (regime `dev-evidence` declarado no arquivo) segue isento.
    const legit = fixture({
      "perf-baseline-2026-08-29.md": "> **RÓTULO GLOBAL: `dev-evidence`.**\n",
    });
    const legitAudit = auditPerfEvidence(legit);
    expect(legitAudit.allowlisted).toEqual(["perf-baseline-2026-08-29.md"]);
    expect(legitAudit.failures).toEqual([]);
  });

  it("T5: na árvore real o gate inspeciona > 0 artefatos e inclui o baseline controlado", () => {
    const audit = auditPerfEvidence(evidenceRoot);
    console.log(
      `gate §35: ${audit.discovered.length} descoberto(s) por caminho, ${audit.checked.length} checado(s) contra os 7 rótulos, ${audit.allowlisted.length} na allowlist de legado`,
    );
    expect(audit.failures.join("\n")).toBe("");
    expect(audit.discovered.length).toBeGreaterThan(0);
    expect(audit.checked.length).toBeGreaterThan(0);
    // a árvore de fluxo da missão (card/claim `35-perf-gate.md`) não entra na varredura real
    expect(audit.discovered.some((path) => path.startsWith("agent-state/"))).toBe(false);
    expect(audit.checked).toContain("perf-controlled-2026-09-13/perf-evidence.md");
    expect(audit.checked).toContain("perf-controlled-2026-09-13/report.md");
    expect(audit.allowlisted).toEqual(["perf-after-2026-08-29.md", "perf-baseline-2026-08-29.md"]);
  });

  it("T6: artefato de FLUXO da missão sob `agent-state/**` não reprova; artefato real sem rótulo continua reprovando", () => {
    const dir = fixture({
      "agent-state/SPEC-CARDS/35-perf-gate.md": "# card da missão — fluxo, sem os 7 rótulos\n",
      "agent-state/CLAIMS-INBOX/35-perf-gate.md": "# claim da missão — fluxo, sem os 7 rótulos\n",
      "perf-captura-2026-01-01/report.md": withoutLabel(CONTRACT_ARTIFACT, "decision"),
    });
    const audit = auditPerfEvidence(dir);
    // (a) o artefato de fluxo não entra na varredura (nem reprova)…
    expect(audit.discovered).toEqual(["perf-captura-2026-01-01/report.md"]);
    expect(audit.failures.join("\n")).not.toContain("agent-state");
    // (b) …e o artefato real sem um rótulo continua reprovando (fail-closed preservado).
    expect(audit.checked).toEqual(["perf-captura-2026-01-01/report.md"]);
    expect(audit.failures.join("\n")).toContain("decision");
  });

  it("mantém os 7 rótulos no template `_templates/performance-evidence.md`", () => {
    expect(missingLabels(readFileSync(templatePath, "utf8")).join(", ")).toBe("");
  });
});
