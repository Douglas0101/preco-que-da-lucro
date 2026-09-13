import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

const LABEL_PATTERNS = REQUIRED_LABELS.map((label) => ({
  label,
  pattern: new RegExp(`^\\s*(?:[-*]\\s*)?\\*\\*${label}\\s*:\\*\\*`, "im"),
}));

// Legado publicado antes do gate §35: mantido como está (não reescrever).
// `explain-critical-queries-*` não casa os padrões `perf-*`/`*-perf-*`, mas fica
// na allowlist por contrato explícito de §35.
const LEGACY_ALLOWLIST = new Set([
  "perf-baseline-2026-08-29.md",
  "perf-after-2026-08-29.md",
  "explain-critical-queries-2026-08-21.md",
]);

function isPerfEvidenceName(name: string): boolean {
  return name.endsWith(".md") && (name.startsWith("perf-") || name.includes("-perf-"));
}

function walkEvidence(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_templates") continue;
      found.push(...walkEvidence(fullPath));
    } else if (entry.isFile() && isPerfEvidenceName(entry.name)) {
      found.push(fullPath);
    }
  }
  return found;
}

function missingLabels(content: string): string[] {
  return LABEL_PATTERNS.filter(({ pattern }) => !pattern.test(content)).map(({ label }) => label);
}

const perfFiles = walkEvidence(evidenceRoot).sort();

describe("evidência de performance (§35)", () => {
  it("descobre artefatos perf-*.md versionados (gate não é vacuoso)", () => {
    expect(perfFiles.length).toBeGreaterThan(0);
  });

  it("exige os 7 rótulos em todo perf-*.md/*-perf-*.md fora da allowlist de legado", () => {
    const failures: string[] = [];
    for (const file of perfFiles) {
      const relativePath = relative(evidenceRoot, file).split(sep).join("/");
      if (LEGACY_ALLOWLIST.has(relativePath)) continue;
      const missing = missingLabels(readFileSync(file, "utf8"));
      if (missing.length > 0) {
        failures.push(`docs/evidence/${relativePath}: rótulo(s) ausente(s): ${missing.join(", ")}`);
      }
    }
    expect(failures.join("\n")).toBe("");
  });

  it("mantém os 7 rótulos no template `_templates/performance-evidence.md`", () => {
    expect(missingLabels(readFileSync(templatePath, "utf8")).join(", ")).toBe("");
  });
});
