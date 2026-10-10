import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * DBT-97, condição de fechamento da descoberta: o catálogo do registry é
 * `grep -rn "process\.env\.[A-Z0-9_]* *??" src/`. Este teste reproduz a VARREDURA
 * inteira sobre o conteúdo real dos arquivos (sem shell, para rodar em qualquer
 * SO do CI) e reprova qualquer sítio que não esteja no allowlist —
 * `checked === discovered` nas duas direções.
 *
 * Por que comentário entra na varredura: a derrota óbvia deste guarda é
 * comentar a linha para retirá-la do catálogo. A varredura é fiel ao grep e
 * classifica cada achado; a proibição vale para `code` SEM EXCEÇÃO, e uma
 * menção de documentação precisa estar no allowlist declarado abaixo. Não há
 * exclusão de diretório: `src/test/` também é varrido.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** O padrão literal do registry: `process.env.` + MAIÚSCULAS + espaços + o operador. */
const CATALOG_PATTERN = /process\.env\.[A-Z0-9_]* *\?\?/g;

/** Única ocorrência tolerada: a docstring do próprio helper documenta o perigo.
 * Qualquer outra menção em prosa precisa entrar aqui com motivo nomeado. */
const DOCUMENTATION_ALLOWLIST = new Set(["src/lib/env.server.ts:5"]);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

/**
 * Sítios sintéticos dos controles negativos. Montados por concatenação de
 * propósito: se o padrão literal aparecesse neste arquivo, o guarda denunciaria
 * o próprio teste e a varredura real deixaria de ser limpa.
 */
const SYNTHETIC_SITE = ["const max = process.env.POOL_MAX", ' ?? "10";'].join("");
const SYNTHETIC_COMMENT = `// ${SYNTHETIC_SITE}`;

interface CatalogEntry {
  path: string;
  line: number;
  kind: "code" | "doc";
  text: string;
}

/** Linha de comentário puro: o guarda não pode ser derrotado comentando a linha. */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      found.push(...walk(full));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(extname(entry.name))) found.push(full);
  }
  return found;
}

/** A varredura pura: recebe o conteúdo e devolve os achados classificados. */
function findCoalescingSites(
  files: ReadonlyArray<{ path: string; content: string }>,
): CatalogEntry[] {
  const found: CatalogEntry[] = [];
  for (const file of files) {
    const lines = file.content.split("\n");
    for (const [index, line] of lines.entries()) {
      CATALOG_PATTERN.lastIndex = 0;
      if (!CATALOG_PATTERN.test(line)) continue;
      found.push({
        path: file.path,
        line: index + 1,
        kind: isCommentLine(line.trim()) ? "doc" : "code",
        text: line.trim(),
      });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

function realFiles(): Array<{ path: string; content: string }> {
  return walk(join(root, "src")).map((absolute) => ({
    path: relative(root, absolute).replaceAll("\\", "/"),
    content: readFileSync(absolute, "utf8"),
  }));
}

function key(entry: CatalogEntry): string {
  return `${entry.path}:${entry.line}`;
}

describe("DBT-97 — catálogo de coalescência sobre process.env", () => {
  const files = realFiles();

  it("a varredura não é vazia: o catálogo realmente lê src/", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(findCoalescingSites(files).length).toBeGreaterThan(0);
  });

  it("nenhum sítio de código coalesce process.env para um default", () => {
    const codeSites = findCoalescingSites(files).filter((entry) => entry.kind === "code");
    expect(codeSites.map((entry) => `${key(entry)} → ${entry.text}`)).toEqual([]);
  });

  it("toda menção em documentação está no allowlist declarado", () => {
    const documented = findCoalescingSites(files).filter((entry) => entry.kind === "doc");
    expect(documented.map(key).sort()).toEqual([...DOCUMENTATION_ALLOWLIST].sort());
    expect(documented[0]?.path).toBe("src/lib/env.server.ts");
  });

  it("checked === discovered: nada fora do allowlist e nenhum allowlist obsoleto", () => {
    const discoveries = findCoalescingSites(files);
    const unexpected = discoveries.filter((entry) => !DOCUMENTATION_ALLOWLIST.has(key(entry)));
    expect(unexpected.map((entry) => `${key(entry)} (${entry.kind})`)).toEqual([]);

    const discovered = new Set(discoveries.map(key));
    expect([...DOCUMENTATION_ALLOWLIST].filter((allowed) => !discovered.has(allowed))).toEqual([]);
  });

  it("um sítio novo de código reprova por default", () => {
    const target = files.find((file) => file.path === "src/db/client.server.ts");
    expect(target).toBeDefined();
    const appended = `${target!.content}\n${SYNTHETIC_SITE}\n`;
    const lineNumber = target!.content.split("\n").length + 1;
    const findings = findCoalescingSites([...files, { path: target!.path, content: appended }]);
    expect(findings.filter((entry) => entry.kind === "code").map(key)).toEqual([
      `src/db/client.server.ts:${lineNumber}`,
    ]);
  });

  it("um sítio novo de código em arquivo novo também reprova", () => {
    const findings = findCoalescingSites([
      ...files,
      { path: "src/lib/novo-modulo.ts", content: `export const x = ${SYNTHETIC_SITE};` },
    ]);
    expect(findings.filter((entry) => entry.kind === "code").map(key)).toEqual([
      "src/lib/novo-modulo.ts:1",
    ]);
  });

  it("comentar a linha não retira o sítio do catálogo", () => {
    const target = files.find((file) => file.path === "src/db/client.server.ts");
    expect(target).toBeDefined();
    const commented = `${target!.content}\n${SYNTHETIC_COMMENT}\n`;
    const findings = findCoalescingSites([...files, { path: target!.path, content: commented }]);
    expect(findings.some((entry) => entry.text === SYNTHETIC_COMMENT && entry.kind === "doc")).toBe(
      true,
    );
    // ...mas comentar não basta: a linha nova não está no allowlist declarado,
    // então a mesma asserção de descoberta a reprovaria.
    const novoComentado = findings.find((entry) => entry.text === SYNTHETIC_COMMENT);
    expect(DOCUMENTATION_ALLOWLIST.has(key(novoComentado!))).toBe(false);
  });

  it("um allowlist obsoleto reprova (a direção inversa da asserção)", () => {
    const discovered = new Set(findCoalescingSites(files).map(key));
    const obsoleto = new Set([...DOCUMENTATION_ALLOWLIST, "src/lib/inexistente.ts:1"]);
    expect([...obsoleto].filter((allowed) => !discovered.has(allowed))).toEqual([
      "src/lib/inexistente.ts:1",
    ]);
  });

  it("a varredura lê o disco, não uma cópia em memória do teste", () => {
    const serverEnv = files.find((file) => file.path === "src/lib/env.server.ts");
    expect(serverEnv?.content).toBe(readFileSync(resolve(root, "src/lib/env.server.ts"), "utf8"));
    expect(statSync(resolve(root, "src/lib/env.server.ts")).isFile()).toBe(true);
  });
});
