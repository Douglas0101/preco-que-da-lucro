import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, release, type as osType } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const repositoryRoot = resolve(import.meta.dirname, "..");
const repositoryRealPath = realpathSync(repositoryRoot);

interface IncludeEntry {
  source_path: string;
  stored_as: string;
  bytes: number;
  sha256: string;
}

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    // Mesmo endurecimento de scripts/m02-state-check.ts: resolve "git" apenas
    // em diretórios fixos de sistema.
    env: { ...process.env, PATH: "/usr/local/bin:/usr/bin:/bin" },
  }).trim();
}

const ENV_NAME_PATTERN =
  /^(DATABASE|BETTER_AUTH|AUTH_|AI_|RESEND|OTEL|NODE_|PORT|HOST|SUPABASE|MIGRATION|E2E_|EXPECTED_|GITHUB_SHA|BUILD_|CSP_|NEON_)/;

function fail(error: string): never {
  console.error(
    JSON.stringify({
      check: "m02:forensic-bundle",
      result: "ERROR",
      error,
    }),
  );
  process.exit(2);
}

function isInside(base: string, candidate: string): boolean {
  const rel = relative(base, candidate);
  return rel !== "" && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function rejectSymlinkEscape(candidate: string, label: string): void {
  let existing = candidate;
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) fail(`${label} não pode ser resolvido dentro do repositório`);
    existing = parent;
  }
  const realExisting = realpathSync(existing);
  if (!isInside(repositoryRealPath, realExisting)) {
    fail(`${label} aponta para fora do repositório; fail-closed`);
  }
}

function resolveRepositoryPath(raw: string, label: string): string {
  const candidate = resolve(repositoryRoot, raw);
  if (!isInside(repositoryRealPath, candidate)) {
    fail(`${label} deve permanecer dentro do repositório; fail-closed`);
  }
  rejectSymlinkEscape(candidate, label);
  return candidate;
}

function resolveOutputPath(base: string, name: string): string {
  const candidate = resolve(base, name);
  if (!isInside(base, candidate)) fail("saída do bundle fora do diretório de destino; fail-closed");
  return candidate;
}

function resolveIncludedFile(raw: string): string {
  const candidate = resolveRepositoryPath(raw, "--include");
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    fail(`--include não é arquivo regular: ${raw}`);
  }
  const realCandidate = realpathSync(candidate);
  if (!isInside(repositoryRealPath, realCandidate)) {
    fail("--include aponta para fora do repositório; fail-closed");
  }
  return realCandidate;
}

function main(): void {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      note: { type: "string" },
      include: { type: "string", multiple: true },
    },
    strict: true,
  });
  if (!values.out)
    fail("--out <dir> é obrigatório (--note e --include <arquivo> são opcionais e repetíveis)");
  const outDir = resolveRepositoryPath(values.out, "--out");
  if (existsSync(outDir)) fail("destino já existe; fail-closed, sem sobrescrita");

  const startedAt = new Date().toISOString();
  mkdirSync(outDir, { recursive: true });

  const head = git("rev-parse", "HEAD");
  const branch = git("branch", "--show-current");
  const statusShort = git("status", "--short", "--untracked-files=all");

  // Somente NOMES de variáveis; valores de ambiente nunca são emitidos.
  const envVarNames = Object.keys(process.env)
    .filter((key) => ENV_NAME_PATTERN.test(key))
    .sort();
  writeFileSync(resolveOutputPath(outDir, "env-var-names.txt"), envVarNames.join("\n") + "\n");

  const includes: IncludeEntry[] = [];
  const requested: string[] = values.include ?? [];
  for (let i = 0; i < requested.length; i++) {
    const source = resolveIncludedFile(requested[i]!);
    const storedAs = i === 0 ? basename(source) : `${i}-${basename(source)}`;
    const dest = resolveOutputPath(outDir, storedAs);
    copyFileSync(source, dest);
    const bytes = readFileSync(dest);
    includes.push({
      source_path: source,
      stored_as: storedAs,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }

  const manifest = {
    check: "m02:forensic-bundle",
    fail_closed: true,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    note: values.note ?? "",
    repository: {
      branch,
      head,
      dirty: statusShort.length > 0,
      status_short: statusShort.split("\n").filter(Boolean).slice(0, 50),
    },
    versions: {
      node: process.versions.node,
      npm: process.versions.npm,
      platform: process.platform,
      os_type: osType(),
      os_release: release(),
      arch: arch(),
    },
    env_var_names: envVarNames,
    limits:
      "Nomes de variáveis apenas; nenhum valor de ambiente ou segredo é emitido. O caller só informa --include com saídas já redigidas.",
    includes,
  };

  const manifestPath = resolveOutputPath(outDir, "manifest.json");
  const tmpPath = resolveOutputPath(outDir, ".manifest.json.tmp");
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(tmpPath, manifestPath);

  const sums = [
    ...includes.map((inc) => `${inc.sha256}  ${inc.stored_as}`),
    `${sha256(readFileSync(manifestPath))}  manifest.json`,
  ];
  writeFileSync(resolveOutputPath(outDir, "SHA256SUMS"), sums.join("\n") + "\n");

  console.log(
    JSON.stringify(
      {
        check: "m02:forensic-bundle",
        result: "PASS",
        out: outDir,
        note: values.note ?? "",
        includes: includes.length,
        env_var_names: envVarNames.length,
        finished_at: manifest.finished_at,
      },
      null,
      2,
    ),
  );
  process.exitCode = 0;
}

try {
  main();
} catch {
  fail("captura do bundle falhou; verifique --out/--include e permissões. Detalhes suprimidos.");
}
