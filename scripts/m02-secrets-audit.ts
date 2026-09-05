import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface SecretEntry {
  name: string;
  defined_in: string[];
  consumers_code: string[];
  consumers_ci: string[];
  references_docs: string[];
  classification: "consumer" | "docs-only" | "orphan";
}

const repositoryRoot = resolve(import.meta.dirname, "..");

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    // S4036: resolve "git" only in fixed, system-owned directories.
    env: { ...process.env, PATH: "/usr/local/bin:/usr/bin:/bin" },
  }).trim();
}

const KEY_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)=/;

function envKeysOf(relativePath: string): string[] {
  const absolute = resolve(repositoryRoot, relativePath);
  if (!existsSync(absolute)) return [];
  return readFileSync(absolute, "utf8")
    .split("\n")
    .map((line) => KEY_PATTERN.exec(line)?.[1])
    .filter((key): key is string => Boolean(key));
}

function rootEnvFiles(): string[] {
  return readdirSync(repositoryRoot)
    .filter((entry) => entry === ".env" || entry.endsWith(".env"))
    .sort();
}

function workflowReferences(): { secrets: string[]; vars: string[] } {
  const secrets = new Set<string>();
  const vars = new Set<string>();
  const workflowsDir = resolve(repositoryRoot, ".github/workflows");
  for (const file of readdirSync(workflowsDir)) {
    if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
    const content = readFileSync(resolve(workflowsDir, file), "utf8");
    for (const match of content.matchAll(/secrets\.([A-Z0-9_]+)/g)) secrets.add(match[1]!);
    for (const match of content.matchAll(/vars\.([A-Z0-9_]+)/g)) vars.add(match[1]!);
  }
  return { secrets: [...secrets].sort(), vars: [...vars].sort() };
}

function consumersOf(name: string): string[] {
  try {
    return git("grep", "-l", "-F", name, "--", ".")
      .split("\n")
      .filter(Boolean)
      .filter((path) => path !== "package-lock.json")
      .sort();
  } catch {
    return [];
  }
}

function main(): void {
  const startedAt = new Date().toISOString();

  const definitions = new Map<string, string[]>();
  const define = (name: string, source: string): void => {
    const sources = definitions.get(name) ?? [];
    definitions.set(name, [...sources, source]);
  };

  for (const envFile of rootEnvFiles()) {
    // Somente nomes de chaves são lidos; valores nunca entram na saída.
    for (const key of envKeysOf(envFile)) define(key, envFile);
  }
  const ci = workflowReferences();
  for (const name of ci.secrets) define(name, "github-secrets (referenciado em workflow)");
  for (const name of ci.vars) define(name, "github-vars (referenciado em workflow)");

  const entries: SecretEntry[] = [...definitions.entries()].map(([name, sources]) => {
    const paths = consumersOf(name).filter((path) => !sources.includes(path));
    const consumersCode = paths.filter(
      (path) => /^(src|scripts|e2e)\//.test(path) || /^docker-compose\.yml$/.test(path),
    );
    const consumersCi = paths.filter((path) => path.startsWith(".github/"));
    const referencesDocs = paths.filter(
      (path) => !consumersCode.includes(path) && !consumersCi.includes(path),
    );
    const classification: SecretEntry["classification"] =
      consumersCode.length + consumersCi.length > 0
        ? "consumer"
        : referencesDocs.length > 0
          ? "docs-only"
          : "orphan";
    return {
      name,
      defined_in: sources.sort(),
      consumers_code: consumersCode,
      consumers_ci: consumersCi,
      references_docs: referencesDocs,
      classification,
    };
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));
  const orphans = entries.filter((entry) => entry.classification === "orphan");

  console.log(
    JSON.stringify(
      {
        check: "m02:secrets-audit",
        read_only: true,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        summary: {
          defined: entries.length,
          consumer: entries.filter((entry) => entry.classification === "consumer").length,
          docs_only: entries.filter((entry) => entry.classification === "docs-only").length,
          orphan: orphans.length,
        },
        review_required: orphans.map((entry) => entry.name),
        entries,
      },
      null,
      2,
    ),
  );
}

main();
