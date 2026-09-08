import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, release, type as osType } from "node:os";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";

const repositoryRoot = resolve(import.meta.dirname, "..");

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
  const outDir = resolve(values.out);
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
  writeFileSync(resolve(outDir, "env-var-names.txt"), envVarNames.join("\n") + "\n");

  const includes: IncludeEntry[] = [];
  const requested: string[] = values.include ?? [];
  for (let i = 0; i < requested.length; i++) {
    const source = resolve(requested[i]!);
    if (!existsSync(source) || !statSync(source).isFile()) {
      fail(`--include não é arquivo regular: ${requested[i]}`);
    }
    const storedAs = i === 0 ? basename(source) : `${i}-${basename(source)}`;
    const dest = resolve(outDir, storedAs);
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

  const manifestPath = resolve(outDir, "manifest.json");
  const tmpPath = resolve(outDir, ".manifest.json.tmp");
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(tmpPath, manifestPath);

  const sums = [
    ...includes.map((inc) => `${inc.sha256}  ${inc.stored_as}`),
    `${sha256(readFileSync(manifestPath))}  manifest.json`,
  ];
  writeFileSync(resolve(outDir, "SHA256SUMS"), sums.join("\n") + "\n");

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
