import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyTransactionSite,
  isEntrypoint,
  transactionSites,
} from "../../scripts/lib/m02-transaction-sites";
import type { TransactionSiteSource } from "../../scripts/lib/m02-transaction-sites";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const REPOSITORY_PATH = "src/server/repositories/inventory.repository.ts";
const AUTH_PATH = "src/server/auth/membership.service.ts";
const FACADE_PATH = "src/lib/ai/tool-runner.ts";
const CONTRACT_PATH = "src/server/contracts/transaction.contracts.ts";

function scan(path: string, source: string) {
  return transactionSites([{ path, source }]);
}

function lines(source: readonly string[]): string {
  return source.join("\n");
}

describe("scanner M-02 de transaction sites", () => {
  it("conta uma entrada por referência de valor ao alias, não uma por declaração", () => {
    const sites = scan(
      REPOSITORY_PATH,
      lines([
        'import type { DatabaseTransaction } from "@/db/client.server";',
        "export async function save(context: RequestContext) {",
        "  const tx = context.transaction as DatabaseTransaction;",
        '  await tx.insert(inventory).values({ sku: "a" });',
        '  await tx.update(inventory).set({ sku: "b" });',
        "  const rows = await tx.select().from(inventory);",
        "  return rows;",
        "}",
      ]),
    );

    expect(sites).toHaveLength(3);
    expect(sites.map((site) => site.line)).toEqual([4, 5, 6]);
    expect(sites.map((site) => site.path)).toEqual([
      REPOSITORY_PATH,
      REPOSITORY_PATH,
      REPOSITORY_PATH,
    ]);
    expect(new Set(sites.map((site) => site.expression))).toEqual(new Set(["context.transaction"]));
  });

  it("conta zero quando o alias não é referenciado e ignora sombreamento por parâmetro", () => {
    const sites = scan(
      REPOSITORY_PATH,
      lines([
        "export async function save(context: RequestContext) {",
        "  const tx = context.transaction as DatabaseTransaction;",
        "  const shadow = (tx: Other) => tx.run();",
        "  return tx.select();",
        "}",
        "export function unused(context: RequestContext) {",
        "  const dead = context.transaction as DatabaseTransaction;",
        "  return 0;",
        "}",
      ]),
    );

    expect(sites).toHaveLength(1);
    expect(sites[0].line).toBe(4);
  });

  it("não conta comentários, nem em arquivo só-tipo", () => {
    const sites = scan(
      CONTRACT_PATH,
      lines([
        "/**",
        " * `RequestContext.transaction` é declarado por este tipo, então o grafo",
        " * (`context.transaction as DatabaseTransaction`) é asserção verificada.",
        " */",
        "// request.transaction jamais nasce aqui.",
        "export interface TransactionExecutor {",
        "  readonly execute: (...query: never[]) => unknown;",
        "}",
      ]),
    );

    expect(sites).toEqual([]);
  });

  it("não conta literais de string que mencionam o handle", () => {
    const sites = scan(
      REPOSITORY_PATH,
      lines([
        'const probe = "context.transaction";',
        "const sql = `select note from t where note = 'request.transaction'`;",
        "export const keep = probe.length + sql.length;",
      ]),
    );

    expect(sites).toEqual([]);
  });

  it("não conta handle em posição de tipo", () => {
    const sites = scan(
      CONTRACT_PATH,
      lines([
        'import type { RequestContext } from "@/lib/request-context";',
        "export type TransactionHandle = typeof context.transaction;",
        "export interface TransactionExecutor {",
        "  readonly execute: (...query: never[]) => unknown;",
        "}",
      ]),
    );

    expect(sites).toEqual([]);
  });

  it("não varre src/test/**, que é código de teste", () => {
    const sites = scan(
      "src/test/event-service.test.ts",
      lines([
        'it("appenda no executor do contexto", async () => {',
        "  expect(repository.appends[0]?.executor).toBe(context.transaction);",
        "});",
      ]),
    );

    expect(sites).toEqual([]);
  });

  it("conta o uso direto do handle, sem alias", () => {
    const sites = scan(
      REPOSITORY_PATH,
      lines([
        "export async function count(context: RequestContext) {",
        "  return (context.transaction as DatabaseTransaction).execute(sql`select 1`);",
        "}",
      ]),
    );

    expect(sites).toHaveLength(1);
    expect(sites[0].line).toBe(2);
  });

  it("é determinístico: duas execuções e a ordem de entrada não mudam os bytes", () => {
    const sources: TransactionSiteSource[] = [
      {
        path: REPOSITORY_PATH,
        source: lines(["const tx = context.transaction as T;", "tx.run();"]),
      },
      {
        path: AUTH_PATH,
        source: lines(["const tx = context.transaction as T;", "await tx.run();"]),
      },
      { path: FACADE_PATH, source: lines(["await request.transaction.run();"]) },
    ];

    const first = JSON.stringify(transactionSites(sources));
    const second = JSON.stringify(transactionSites(sources));
    const reversed = JSON.stringify(transactionSites([...sources].reverse()));

    expect(second).toBe(first);
    expect(reversed).toBe(first);
    expect(JSON.parse(first)).toHaveLength(3);
  });
});

describe("classificação dos transaction sites", () => {
  const alias = lines(["const tx = context.transaction as T;", "tx.run();"]);

  it("rotula pelo alvo da política, com evidência de runtime", () => {
    expect(scan(AUTH_PATH, alias)[0]?.classification).toBe("auth-allowlist");
    expect(scan(REPOSITORY_PATH, alias)[0]?.classification).toBe("repository-fallback");
    expect(scan(FACADE_PATH, alias)[0]?.classification).toBe("compatibility-facade");
  });

  it("rotula fallback de executor como repository-fallback mesmo fora de src/server/repositories", () => {
    const fallback = scan(
      FACADE_PATH,
      lines([
        "export function append(context: RequestContext, executor: Executor = context.transaction) {",
        "  return executor.insert(audit);",
        "}",
      ]),
    );

    expect(fallback).toHaveLength(1);
    expect(fallback[0].classification).toBe("repository-fallback");
  });

  it("rotula o lado direito de ?? como fallback de executor", () => {
    const fallback = scan(
      "src/server/services/event.service.ts",
      lines([
        "export function append(executor?: Executor) {",
        "  return run(executor ?? context.transaction);",
        "}",
      ]),
    );

    expect(fallback).toHaveLength(1);
    expect(fallback[0].classification).toBe("repository-fallback");
  });

  it("deixa o shape decidir antes do caminho", () => {
    expect(classifyTransactionSite({ path: AUTH_PATH, shape: "executor-fallback" })).toBe(
      "repository-fallback",
    );
    expect(classifyTransactionSite({ path: CONTRACT_PATH, shape: "direct-use" })).toBe(
      "compatibility-facade",
    );
  });
});

describe("guarda de entrypoint de scripts/m02-matrix.ts", () => {
  it("só reconhece o próprio módulo em argv[1]", () => {
    expect(isEntrypoint(import.meta.url, fileURLToPath(import.meta.url))).toBe(true);
    expect(isEntrypoint(import.meta.url, resolve(root, "scripts/m02-matrix.ts"))).toBe(false);
    expect(isEntrypoint(import.meta.url, undefined)).toBe(false);
  });

  it("importar o gerador não regrava a matriz", async () => {
    const matrixFiles = ["matrix.yaml", "matrix.generated.yaml"].map((name) =>
      resolve(root, "docs/specs/M-02", name),
    );
    const before = matrixFiles.map((path) => ({
      bytes: readFileSync(path),
      mtimeMs: statSync(path).mtimeMs,
    }));

    // Import dinâmico deliberado: o teste mede o efeito colateral da carga do
    // módulo e um import estático seria içado para antes do snapshot.
    await import("../../scripts/m02-matrix");

    for (const [index, path] of matrixFiles.entries()) {
      expect(readFileSync(path)).toEqual(before[index].bytes);
      expect(statSync(path).mtimeMs).toBe(before[index].mtimeMs);
    }
  });
});
