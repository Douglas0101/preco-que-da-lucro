#!/usr/bin/env node
// Selo de work package: manifesto, nao-vacuidade e vinculos verificaveis.
//
// Substitui o `selo.sh` ad-hoc de cada WP por uma ferramenta compartilhada e
// falsificavel: descobre o conjunto do selo por filesystem (nao por lista),
// exige SPEC.md/README.md, reprova descoberta vazia (0 = 0), cardinalidade
// `checked === discovered`, hash divergente e entrada de manifesto sem arquivo.
// Opcionalmente re-executa declaracoes de ancestralidade (`merge-base`) e
// confere um run citado (`gh run view`) exigindo >= 1 check aplicavel — run
// no-op so e citavel como delegacao ao heavy do mesmo commit.
//
// Node built-ins apenas; `gh`/`git` sao chamados so quando as flags pedem.
// Uso:
//   node scripts/m02-seal.mjs --dir docs/evidence/<slug> [--write]
//   node scripts/m02-seal.mjs --dir <slug> --ancestry <arquivo.md>
//   node scripts/m02-seal.mjs --dir <slug> --run <id>@<sha>

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REQUIRED_FILES = ["SPEC.md", "README.md"];
const MANIFEST = "MANIFEST.sha256";

export function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function parseArgs(argv) {
  const args = { dir: undefined, write: false, ancestry: undefined, run: undefined };
  const comValor = (flag, i) => {
    const value = argv[i];
    if (!value || value.startsWith("--")) return { error: `${flag} exige um valor` };
    return { value };
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      const lido = comValor("--dir", ++i);
      if (lido.error) return lido;
      args.dir = lido.value;
    } else if (arg === "--write") args.write = true;
    else if (arg === "--ancestry") {
      const lido = comValor("--ancestry", ++i);
      if (lido.error) return lido;
      args.ancestry = lido.value;
    } else if (arg === "--run") {
      const lido = comValor("--run", ++i);
      if (lido.error) return lido;
      args.run = lido.value;
    } else return { error: `argumento desconhecido: ${arg}` };
  }
  if (!args.dir) return { error: "--dir exige um caminho" };
  return args;
}

export function scanSelo(dir) {
  const files = [];
  const problemas = [];
  const manifestRaiz = join(dir, MANIFEST);
  const visit = (atual) => {
    for (const entry of readdirSync(atual, { withFileTypes: true })) {
      const caminho = join(atual, entry.name);
      const rel = relative(process.cwd(), caminho).split(sep).join("/");
      if (entry.isSymbolicLink()) {
        problemas.push(`symlink no selo: ${rel}`);
        continue;
      }
      if (entry.isDirectory()) {
        visit(caminho);
        continue;
      }
      if (entry.name === MANIFEST && caminho !== manifestRaiz) {
        problemas.push(`MANIFEST aninhado: ${rel}`);
      }
      if (entry.isFile()) files.push(rel);
    }
  };
  visit(dir);
  return { files: files.sort(), problemas };
}

export function discoverFiles(dir) {
  return scanSelo(dir).files;
}

export function parseManifest(text) {
  const entries = new Map();
  const falhas = [];
  for (const linha of (text ?? "").split("\n")) {
    if (!linha.trim()) continue;
    const m = /^([0-9a-f]{64})\s{2}(.+)$/.exec(linha);
    if (!m) {
      falhas.push(`linha de manifesto invalida: "${linha}"`);
      continue;
    }
    if (entries.has(m[2])) falhas.push(`path duplicado no MANIFEST: ${m[2]}`);
    entries.set(m[2], m[1]);
  }
  return { entries, falhas };
}

export function auditManifest({ discovered, hashes, manifestText, required = REQUIRED_FILES }) {
  const falhas = [];
  if (discovered.length === 0) falhas.push("descoberta vazia: 0 = 0 reprova");
  for (const req of required) {
    if (!discovered.includes(req) && !discovered.some((file) => file.endsWith(`/${req}`))) {
      falhas.push(`selo sem ${req}`);
    }
  }
  const { entries, falhas: malformed } = parseManifest(manifestText);
  falhas.push(...malformed);
  if (entries.size === 0) falhas.push("MANIFEST vazio");
  if (entries.size !== discovered.length) {
    falhas.push(
      `MANIFEST tem ${entries.size} entradas; descobertos ${discovered.length} (checked === discovered)`,
    );
  }
  for (const file of discovered) {
    const esperado = entries.get(file);
    if (esperado === undefined) {
      falhas.push(`descoberto fora do MANIFEST: ${file}`);
      continue;
    }
    if (esperado !== hashes.get(file)) falhas.push(`hash diverge: ${file}`);
  }
  for (const file of entries.keys()) {
    if (!discovered.includes(file)) falhas.push(`MANIFEST cita arquivo ausente: ${file}`);
  }
  return falhas;
}

export function extractAncestryClaims(text) {
  const claims = [];
  const re = /git merge-base --is-ancestor ([0-9a-f]{7,40}) ([0-9a-f]{7,40})/g;
  let m = re.exec(text ?? "");
  while (m !== null) {
    claims.push({ ancestor: m[1], descendant: m[2] });
    m = re.exec(text);
  }
  return claims;
}

export function auditAncestry(text, { runAncestor }) {
  const claims = extractAncestryClaims(text);
  if (claims.length === 0) {
    return ["nenhuma declaracao de ancestralidade encontrada (0 = 0 reprova)"];
  }
  const falhas = [];
  for (const { ancestor, descendant } of claims) {
    if (runAncestor(ancestor, descendant) !== 0) {
      falhas.push(`ancestralidade falsa: ${ancestor} nao e ancestral de ${descendant}`);
    }
  }
  return falhas;
}

const INFRA_STEP =
  /^(Set up job|Initialize containers|Complete job|Post |Run actions\/|Run npm (ci|install)\b|Scope guard|Configure |Wait for |Start |Stop |Upload |Download |Cache )/;

export function countApplicableSteps(run) {
  return (run.jobs ?? [])
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.conclusion === "success" && !INFRA_STEP.test(step.name ?? "")).length;
}

export function auditRun(run, { commit, isAncestor }) {
  if (!run) return ["gh run view nao devolveu JSON"];
  const falhas = [];
  if (run.conclusion !== "success") {
    falhas.push(`run ${run.databaseId ?? "?"} conclusion=${run.conclusion}`);
  }
  const head = run.headSha ?? "";
  if (head !== commit && !isAncestor(commit, head)) {
    falhas.push(`headSha ${head} nao e igual nem descendente de ${commit}`);
  }
  const applicable = countApplicableSteps(run);
  if (applicable === 0) {
    falhas.push("run sem check aplicavel (no-op): cite como delegacao ao heavy do mesmo commit");
  }
  return falhas;
}

function gitAncestor(a, b) {
  return spawnSync("git", ["merge-base", "--is-ancestor", a, b]).status ?? 1;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`m02-seal: ${parsed.error}`);
    process.exitCode = 2;
    return;
  }
  const dir = resolve(process.cwd(), parsed.dir);
  let scan;
  try {
    scan = scanSelo(dir);
  } catch (error) {
    console.error(`m02-seal: diretorio ilegivel em ${parsed.dir}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const discovered = scan.files;

  const hashes = new Map();
  for (const file of discovered) {
    if (file.endsWith(`/${MANIFEST}`)) continue;
    hashes.set(file, sha256(readFileSync(resolve(process.cwd(), file))));
  }
  const manifestPath = join(dir, MANIFEST);

  if (parsed.write) {
    const linhas = [...hashes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, hash]) => `${hash}  ${file}`)
      .join("\n");
    writeFileSync(manifestPath, `${linhas}\n`);
  }

  let manifestText;
  try {
    manifestText = readFileSync(manifestPath, "utf8");
  } catch (error) {
    console.error(`m02-seal: MANIFEST ausente em ${parsed.dir}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const selados = discovered.filter((file) => !file.endsWith(`/${MANIFEST}`));
  const falhas = [
    ...scan.problemas,
    ...auditManifest({ discovered: selados, hashes, manifestText }),
  ];

  if (parsed.ancestry) {
    let texto;
    try {
      texto = readFileSync(resolve(process.cwd(), parsed.ancestry), "utf8");
    } catch (error) {
      console.error(`m02-seal: ancestry ilegivel em ${parsed.ancestry}: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    falhas.push(...auditAncestry(texto, { runAncestor: gitAncestor }));
  }

  if (parsed.run) {
    const [id, commit] = parsed.run.split("@");
    if (!id || !commit) {
      console.error("m02-seal: --run exige <id>@<sha>");
      process.exitCode = 2;
      return;
    }
    const gh = spawnSync(
      "gh",
      ["run", "view", id, "--json", "databaseId,headSha,conclusion,status,jobs"],
      { encoding: "utf8" },
    );
    if (gh.status !== 0) {
      console.error(`m02-seal: gh run view ${id} falhou: ${gh.stderr.trim()}`);
      process.exitCode = 2;
      return;
    }
    falhas.push(
      ...auditRun(JSON.parse(gh.stdout), {
        commit,
        isAncestor: (a, b) => gitAncestor(a, b) === 0,
      }),
    );
  }

  if (falhas.length > 0) {
    for (const falha of falhas) console.error(`m02-seal: ${falha}`);
    console.error(`m02-seal: REPROVADO (${falhas.length} falha(s))`);
    process.exitCode = 1;
    return;
  }
  console.log(`m02-seal: OK (${selados.length} arquivos, checked === discovered) — ${parsed.dir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(`m02-seal: ERRO ${error.message}`);
    process.exitCode = 2;
  }
}

export { MANIFEST, REQUIRED_FILES };
