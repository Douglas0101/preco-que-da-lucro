import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type ts from "typescript";
import { describeMatrixDrift } from "./lib/m02-matrix-drift";
import { isEntrypoint, transactionSites } from "./lib/m02-transaction-sites";
import { isDatabaseModule } from "./lib/m02-database-module";

type Overlay = {
  schemaVersion: number;
  status: string;
  format?: string;
  authority?: string;
  catalog?: {
    services: Record<string, Record<string, unknown>>;
    repositories: Record<string, Record<string, unknown>>;
  };
  exceptions: Array<{ id: string; pathPrefix: string; reason: string }>;
  entryPolicies: Record<string, Record<string, unknown>>;
  operationPolicies?: Record<string, Record<string, Record<string, unknown>>>;
  transactionPolicies: Record<string, TransactionPolicy>;
};

type TransactionUnit = {
  id: string;
  boundary: string;
  evidence: string;
  idempotencyKey?: string;
};

type TransactionPolicy = {
  atomicity: string;
  targetPhase?: string;
  units?: TransactionUnit[];
};

type SourceEntry = {
  path: string;
  kind: "server-function" | "route";
  operations: Array<{
    name: string;
    line: number;
    declaration: "createServerFn" | "alias" | "factory";
    service?: unknown;
    repository?: unknown;
    atomicity?: unknown;
  }>;
  imports: string[];
  reachesDatabase: boolean;
  databasePaths: string[];
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "src");
const specRoot = resolve(repositoryRoot, "docs/specs/M-02");
const overlayPath = resolve(specRoot, "matrix.overlay.yaml");
const generatedPath = resolve(specRoot, "matrix.generated.yaml");
const matrixPath = resolve(specRoot, "matrix.yaml");

const requireFromHere = createRequire(import.meta.url);
let typescriptModule: typeof import("typescript") | undefined;

/**
 * The TypeScript compiler is loaded on first use: importing this module (the
 * entrypoint-guard test imports it under v8 coverage) must stay cheap — the
 * compiler's instrumentation alone can push the import past the test timeout.
 */
function compiler(): typeof import("typescript") {
  typescriptModule ??= requireFromHere("typescript") as typeof import("typescript");
  return typescriptModule;
}

/** Test-visible state: whether the lazy compiler has been loaded. */
export function compilerLoaded(): boolean {
  return typescriptModule !== undefined;
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name.startsWith(".") ||
      ["node_modules", "dist", ".output", "coverage"].includes(entry.name)
    ) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

const files = sourceFiles(sourceRoot);
const fileSet = new Set(files);
const normalizedPath = (path: string) => relative(repositoryRoot, path).replaceAll("\\", "/");

function resolveModule(fromFile: string, moduleName: string): string | null {
  if (!moduleName.startsWith(".") && !moduleName.startsWith("@/")) return null;
  const base = moduleName.startsWith("@/")
    ? resolve(sourceRoot, moduleName.slice(2))
    : resolve(dirname(fromFile), moduleName);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function parseFile(path: string): ts.SourceFile {
  return compiler().createSourceFile(
    path,
    readFileSync(path, "utf8"),
    compiler().ScriptTarget.Latest,
    true,
  );
}

let parsedFilesCache: Map<string, ts.SourceFile> | undefined;

/**
 * Parsing every source file is deferred to first use: the entrypoint-guard
 * test imports this module under v8 coverage, and an eager module-level parse
 * (through the instrumented compiler) can exceed the test timeout. Generation
 * and `--check` still parse the full tree on their first access.
 */
function parsedFiles(): Map<string, ts.SourceFile> {
  parsedFilesCache ??= new Map(files.map((path) => [path, parseFile(path)]));
  return parsedFilesCache;
}

function importsOf(path: string): string[] {
  const source = parsedFiles().get(path);
  if (!source) return [];
  const imports = new Set<string>();
  const visit = (node: ts.Node) => {
    if (compiler().isImportDeclaration(node) && compiler().isStringLiteral(node.moduleSpecifier)) {
      imports.add(node.moduleSpecifier.text);
    }
    if (
      compiler().isExportDeclaration(node) &&
      node.moduleSpecifier &&
      compiler().isStringLiteral(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text);
    }
    if (
      compiler().isCallExpression(node) &&
      node.expression.kind === compiler().SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument && compiler().isStringLiteral(argument)) imports.add(argument.text);
    }
    compiler().forEachChild(node, visit);
  };
  visit(source);
  return [...imports].sort((a, b) => a.localeCompare(b));
}

let importGraphCache: Map<string, string[]> | undefined;

/** Deferred like `parsedFiles()`: importing the module must not parse sources. */
function importGraph(): Map<string, string[]> {
  importGraphCache ??= new Map(
    files.map((path) => [
      path,
      importsOf(path)
        .map((moduleName) => resolveModule(path, moduleName))
        .filter((value): value is string => value !== null),
    ]),
  );
  return importGraphCache;
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  return (
    clause?.isTypeOnly === true ||
    (clause?.namedBindings !== undefined &&
      compiler().isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.length > 0 &&
      clause.namedBindings.elements.every((element) => element.isTypeOnly))
  );
}

function hasDatabaseImport(path: string): boolean {
  if (path.startsWith(`${sourceRoot}/db/`)) return true;
  const source = parsedFiles().get(path);
  if (!source) return false;
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (compiler().isImportDeclaration(node) && compiler().isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node) && isDatabaseModule(node.moduleSpecifier.text)) found = true;
    }
    if (
      compiler().isExportDeclaration(node) &&
      node.moduleSpecifier &&
      compiler().isStringLiteral(node.moduleSpecifier)
    ) {
      if (isDatabaseModule(node.moduleSpecifier.text)) found = true;
    }
    if (
      compiler().isCallExpression(node) &&
      node.expression.kind === compiler().SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument && compiler().isStringLiteral(argument) && isDatabaseModule(argument.text))
        found = true;
    }
    compiler().forEachChild(node, visit);
  };
  visit(source);
  return found;
}

let databaseFilesCache: Set<string> | undefined;

/** Deferred like `parsedFiles()`: importing the module must not parse sources. */
function databaseFiles(): Set<string> {
  databaseFilesCache ??= new Set(files.filter(hasDatabaseImport));
  return databaseFilesCache;
}

function reachableDatabasePaths(entry: string): string[] {
  const visited = new Set<string>();
  const found = new Set<string>();
  const visit = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    if (databaseFiles().has(path)) found.add(normalizedPath(path));
    for (const imported of importGraph().get(path) ?? []) visit(imported);
  };
  visit(entry);
  return [...found].sort((a, b) => a.localeCompare(b));
}

function lineAt(source: ts.SourceFile, position: number): number {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function isExported(node: ts.VariableStatement): boolean {
  return (
    node.modifiers?.some((modifier) => modifier.kind === compiler().SyntaxKind.ExportKeyword) ??
    false
  );
}

function classifyServerFunction(text: string): "createServerFn" | "alias" | null {
  if (text.includes("createServerFn")) return "createServerFn";
  if (text.includes("deleteChild") || text.includes("archiveProduct")) return "alias";
  return null;
}

function collectOperation(
  source: ts.SourceFile,
  declaration: ts.VariableDeclaration,
  operations: SourceEntry["operations"],
): void {
  if (!compiler().isIdentifier(declaration.name) || !declaration.initializer) return;
  const kind = classifyServerFunction(declaration.initializer.getText(source));
  if (kind) {
    operations.push({
      name: declaration.name.text,
      line: lineAt(source, declaration.initializer.getStart(source)),
      declaration: kind,
    });
  }
}

function serverFunctionOperations(path: string): SourceEntry["operations"] {
  const source = parsedFiles().get(path);
  if (!source) return [];
  const operations: SourceEntry["operations"] = [];
  const visit = (node: ts.Node) => {
    if (compiler().isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        collectOperation(source, declaration, operations);
      }
    }
    compiler().forEachChild(node, visit);
  };
  visit(source);
  return operations;
}

function serverFunctionEntry(path: string): SourceEntry {
  const operations = serverFunctionOperations(path);
  const databasePaths = reachableDatabasePaths(path);
  return {
    path: normalizedPath(path),
    kind: "server-function",
    operations,
    imports: importsOf(path),
    reachesDatabase: databasePaths.length > 0,
    databasePaths,
  };
}

function routeEntry(path: string): SourceEntry {
  const databasePaths = reachableDatabasePaths(path);
  return {
    path: normalizedPath(path),
    kind: "route",
    operations: [],
    imports: importsOf(path),
    reachesDatabase: databasePaths.length > 0,
    databasePaths,
  };
}

function loadOverlay(): Overlay {
  return JSON.parse(readFileSync(overlayPath, "utf8")) as Overlay;
}

function buildMatrix() {
  const overlay = loadOverlay();
  const functionEntries = files
    .filter((path) => path.startsWith(`${sourceRoot}/lib/`) && path.endsWith(".functions.ts"))
    .map(serverFunctionEntry)
    .map((entry) => {
      const policy = overlay.entryPolicies[entry.path] ?? {};
      const transactionPolicy = overlay.transactionPolicies[entry.path] ?? {};
      const operationPolicies = overlay.operationPolicies?.[entry.path] ?? {};
      return {
        ...entry,
        operations: entry.operations.map((operation) => {
          const operationPolicy = operationPolicies[operation.name] ?? {};
          return {
            ...operation,
            service: operationPolicy.service ?? policy.service ?? null,
            repository: operationPolicy.repository ?? policy.repository ?? null,
            atomicity: operationPolicy.atomicity ?? transactionPolicy.atomicity ?? "per-request",
          };
        }),
      };
    });
  const routeEntries = files
    .filter((path) => path.startsWith(`${sourceRoot}/routes/api/`))
    .map(routeEntry);
  const transactions = transactionSites(
    files.map((path) => ({ path: normalizedPath(path), source: readFileSync(path, "utf8") })),
  );
  const generated = {
    schemaVersion: 1,
    source: {
      root: "src",
      graph: "typescript-compiler-api",
      deterministic: true,
    },
    counts: {
      bffModules: functionEntries.length,
      createServerFnDeclarations: functionEntries.reduce(
        (total, entry) =>
          total +
          entry.operations.filter((operation) => operation.declaration === "createServerFn").length,
        0,
      ),
      concreteOperations: functionEntries.reduce(
        (total, entry) => total + entry.operations.length,
        0,
      ),
      apiRoutes: routeEntries.length,
      transactionSites: transactions.length,
      directDatabaseFiles: databaseFiles().size,
    },
    bffs: functionEntries,
    routes: routeEntries,
    transactionSites: transactions,
    directDatabaseFiles: [...databaseFiles()]
      .map(normalizedPath)
      .sort((a, b) => a.localeCompare(b)),
  };
  return {
    generated,
    matrix: {
      ...generated,
      policy: overlay,
      entryPolicies: overlay.entryPolicies,
      transactionPolicies: overlay.transactionPolicies,
    },
  };
}

function serialized(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeOutputs(outputs: ReturnType<typeof buildMatrix>) {
  mkdirSync(specRoot, { recursive: true });
  writeFileSync(generatedPath, serialized(outputs.generated));
  writeFileSync(matrixPath, serialized(outputs.matrix));
}

function checkOutputs(outputs: ReturnType<typeof buildMatrix>) {
  const expectedGenerated = serialized(outputs.generated);
  const expectedMatrix = serialized(outputs.matrix);
  const actualGenerated = existsSync(generatedPath) ? readFileSync(generatedPath, "utf8") : null;
  const actualMatrix = existsSync(matrixPath) ? readFileSync(matrixPath, "utf8") : null;
  if (actualGenerated !== expectedGenerated || actualMatrix !== expectedMatrix) {
    console.error("M-02 matrix drift: execute npm run m02:matrix:generate and review the result.");
    for (const line of describeMatrixDrift([
      {
        label: normalizedPath(generatedPath),
        fromTree: expectedGenerated,
        onDisk: actualGenerated,
      },
      { label: normalizedPath(matrixPath), fromTree: expectedMatrix, onDisk: actualMatrix },
    ])) {
      console.error(line);
    }
    process.exitCode = 1;
    return;
  }
  console.log("M-02 matrix is deterministic and up to date.");
}

// Guarda de entrypoint: importar este módulo (testes, ferramentas) NÃO pode
// regravar a matriz. Só a execução como script escreve ou valida.
if (isEntrypoint(import.meta.url, process.argv[1])) {
  const outputs = buildMatrix();
  if (process.argv.includes("--check")) checkOutputs(outputs);
  else writeOutputs(outputs);
}
