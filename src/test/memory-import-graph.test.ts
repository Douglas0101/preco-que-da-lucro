import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * INV-005: a memória da IA **não** substitui nem alimenta dado financeiro
 * canônico. A asserção é de grafo de import — não de comentário:
 *
 *  1. nenhum módulo de memória importa o Financial Engine (nem `import type`);
 *  2. o fecho de runtime dos módulos de memória não alcança o Financial Engine;
 *  3. o fecho de runtime do Financial Engine (e dos serviços canônicos que o
 *     consomem) não alcança serviço/policy/contrato de memória;
 *  4. os módulos de memória não importam `@/db` nem `drizzle-orm` (o degrau D1
 *     é puramente de domínio, sem persistência).
 */
const ROOT = process.cwd();

const MEMORY_MODULES = [
  "src/server/services/memory.service.ts",
  "src/server/services/memory.policy.ts",
  "src/server/contracts/memory.contracts.ts",
] as const;

/** Raízes do cálculo canônico: o motor puro e os serviços que o consomem. */
const FINANCE_ROOTS = [
  "src/lib/finance.ts",
  "src/lib/financial-values.ts",
  "src/lib/financial.functions.ts",
  "src/server/services/financial.service.ts",
  "src/server/services/simulation.service.ts",
] as const;

/** Módulos sob `src/lib/financ*` (motor puro) e `src/server/services/financial*`. */
const FINANCE_MODULE_PATTERN = /^src\/(?:lib\/financ|server\/services\/financial)/;

interface ImportEdge {
  specifier: string;
  typeOnly: boolean;
}

const edgeCache = new Map<string, readonly ImportEdge[]>();

function edgesOf(relativePath: string): readonly ImportEdge[] {
  const cached = edgeCache.get(relativePath);
  if (cached) return cached;

  const source = ts.createSourceFile(
    relativePath,
    readFileSync(join(ROOT, relativePath), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const edges: ImportEdge[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      edges.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly: statement.importClause?.isTypeOnly ?? false,
      });
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      edges.push({ specifier: statement.moduleSpecifier.text, typeOnly: statement.isTypeOnly });
    }
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      edges.push({ specifier: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  edgeCache.set(relativePath, edges);
  return edges;
}

/** Resolve `@/x` e caminhos relativos para um arquivo do repositório; pacotes
 * externos retornam `null`. */
function resolveSpecifier(fromRelativePath: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(ROOT, dirname(fromRelativePath), specifier);
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate);
  }
  return null;
}

function resolvedTargets(relativePath: string, options: { includeTypeOnly: boolean }): string[] {
  return edgesOf(relativePath)
    .filter((edge) => options.includeTypeOnly || !edge.typeOnly)
    .map((edge) => resolveSpecifier(relativePath, edge.specifier))
    .filter((target): target is string => target !== null);
}

/** Fecho de imports a partir das raízes (BFS, sem repetição). */
function importClosure(roots: readonly string[], options: { includeTypeOnly: boolean }): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const target of resolvedTargets(current, options)) {
      if (seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen];
}

describe("INV-005 — grafo de import da memória", () => {
  it("os módulos analisados existem e resolvem (senão a asserção seria vacua)", () => {
    for (const module of [...MEMORY_MODULES, ...FINANCE_ROOTS]) {
      expect(existsSync(join(ROOT, module)), `${module} não existe`).toBe(true);
    }
    expect(resolveSpecifier("src/server/services/memory.service.ts", "@/lib/api-error")).toBe(
      "src/lib/api-error.ts",
    );
  });

  it("nenhum módulo de memória importa o Financial Engine — nem como tipo", () => {
    for (const module of MEMORY_MODULES) {
      for (const edge of edgesOf(module)) {
        expect(edge.specifier, `${module} → ${edge.specifier}`).not.toMatch(/financ/i);
        const target = resolveSpecifier(module, edge.specifier);
        if (target) expect(FINANCE_MODULE_PATTERN.test(target), `${module} → ${target}`).toBe(false);
      }
    }
  });

  it("o fecho de runtime da memória não alcança o Financial Engine", () => {
    const closure = importClosure(MEMORY_MODULES, { includeTypeOnly: false });

    // Poder discriminante: o percurso realmente andou — do serviço até a policy e
    // da policy até a fronteira de erro.
    expect(closure).toEqual(
      expect.arrayContaining([
        "src/server/services/memory.policy.ts",
        "src/lib/api-error.ts",
      ]),
    );
    expect(closure.filter((path) => FINANCE_MODULE_PATTERN.test(path))).toEqual([]);
  });

  it("o fecho de runtime dos módulos de memória não importa @/db nem drizzle-orm", () => {
    for (const module of MEMORY_MODULES) {
      for (const edge of edgesOf(module)) {
        expect(edge.specifier.startsWith("@/db"), `${module} → ${edge.specifier}`).toBe(false);
        expect(edge.specifier.startsWith("drizzle-orm"), `${module} → ${edge.specifier}`).toBe(false);
      }
    }

    const closure = importClosure(MEMORY_MODULES, { includeTypeOnly: false });
    expect(closure.filter((path) => path.startsWith("src/db/"))).toEqual([]);
  });

  it("nenhuma saída de memória é consumida pelo cálculo canônico", () => {
    for (const root of FINANCE_ROOTS) {
      for (const edge of edgesOf(root)) {
        expect(edge.specifier, `${root} → ${edge.specifier}`).not.toMatch(/memory/i);
      }
    }

    const closure = importClosure(FINANCE_ROOTS, { includeTypeOnly: false });
    expect(closure.filter((path) => (MEMORY_MODULES as readonly string[]).includes(path))).toEqual([]);
  });
});
