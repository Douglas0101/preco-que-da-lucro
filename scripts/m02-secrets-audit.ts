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

function isAlphaUnderscore(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

function isValidKeyName(name: string): boolean {
  if (name.length === 0 || !isAlphaUnderscore(name.charCodeAt(0))) return false;
  for (let i = 1; i < name.length; i += 1) {
    const code = name.charCodeAt(i);
    if (!isAlphaUnderscore(code) && !(code >= 48 && code <= 57)) return false;
  }
  return true;
}

function parseEnvKey(line: string): string | null {
  const eq = line.indexOf("=");
  if (eq <= 0) return null;
  const name = line.slice(0, eq);
  return isValidKeyName(name) ? name : null;
}

function envKeysOf(relativePath: string): string[] {
  const absolute = resolve(repositoryRoot, relativePath);
  if (!existsSync(absolute)) return [];
  return readFileSync(absolute, "utf8")
    .split("\n")
    .map(parseEnvKey)
    .filter((key): key is string => key !== null);
}

function rootEnvFiles(): string[] {
  return readdirSync(repositoryRoot)
    .filter((entry) => entry === ".env" || entry.endsWith(".env"))
    .sort((a, b) => a.localeCompare(b));
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
  return {
    secrets: [...secrets].sort((a, b) => a.localeCompare(b)),
    vars: [...vars].sort((a, b) => a.localeCompare(b)),
  };
}

function consumersOf(name: string): string[] {
  // S5883: o nome é validado contra o formato de chave antes de virar argumento.
  if (!isValidKeyName(name)) return [];
  try {
    // S4036: resolve "git" only in fixed, system-owned directories.
    return execFileSync("git", ["grep", "-l", "-F", "-e", name, "--", "."], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: "/usr/local/bin:/usr/bin:/bin" },
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((path) => path !== "package-lock.json")
      // A saída JSON desta ferramenta menciona todos os nomes; excluí-la evita
      // auto-referência que mascararia órfãos reais como "docs-only".
      .filter((path) => !/^docs\/evidence\/.+\/secrets-audit\.json$/.test(path))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function classify(
  consumersCode: string[],
  consumersCi: string[],
  referencesDocs: string[],
): SecretEntry["classification"] {
  if (consumersCode.length + consumersCi.length > 0) return "consumer";
  if (referencesDocs.length > 0) return "docs-only";
  return "orphan";
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
    return {
      name,
      defined_in: sources.sort((a, b) => a.localeCompare(b)),
      consumers_code: consumersCode,
      consumers_ci: consumersCi,
      references_docs: referencesDocs,
      classification: classify(consumersCode, consumersCi, referencesDocs),
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
