// m02-sums.mjs — SUMS mecânico dos bundles de evidência (rodada PENDENTES-CLOSE
// retomada, Q1 do roteiro L32–48).
//
// Contrato:
//   npm run m02:sums [--] [--verify] [--release-gsec] [--root <dir>]
//   - Regenera TODOS os SHA256SUMS dos bundles de evidência (dirs sob a raiz
//     de bundles que contêm um SHA256SUMS) com paths root-relative e verifica
//     a partir da raiz — in-process (node:crypto), mesma semântica de
//     `sha256sum -c` da raiz, sem spawn (imune ao EPERM observado em coletor
//     com sandbox restrito).
//   - Saída por bundle: status verde/vermelho + nomes dos falhos; exit 0 só
//     se todos verdes OU vermelhos esperados rotulados.
//   - Rótulo de exceção ÚNICO e DATADO (roteiro L40–42): bundle gsec =
//     "vermelho-esperado até assinatura do memo (V0)", com os 2 caminhos
//     nomeados pinados aos hashes selados originais. Escopo: SOMENTE o bundle
//     gsec — nos demais bundles os mesmos arquivos regeneram com hash atual.
//     Pós-V0 (passo H1 da fila humana): `--release-gsec` grava o marcador
//     `.gsec-exception-released` e derruba os pinos; daí em diante qualquer
//     vermelho é hard fail (exit 2).
//   - Conjunto de entradas = paths do SUMS existente ∪ arquivos atuais do
//     bundle (recursivo; ocultos e o próprio SHA256SUMS fora). Caminho selado
//     ausente no disco = fail-closed (nada é reescrito).
//   - Ordenação obrigatória (roteiro L37–39): assinatura/appends → m02:sums →
//     -c verde → staging. Nunca staging com SUMS vermelho.
//   - Idempotente byte-a-byte: rodar 2× produz os mesmos bytes (ordem
//     lexicográfica, LF, `<hash>␣␣<path>` — compatível `sha256sum -c`).
// Exit codes: 0 verde-ou-rotulado · 1 vermelho não-rotulado · 2 fail-closed
// (caminho selado ausente, SUMS malformado, erro interno, vermelho pós-V0).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(fileURLToPath(import.meta.url), "..", "..");
const SUMS_NAME = "SHA256SUMS";

// Rótulo de exceção único e datado (roteiro L40–42). Pinado aos hashes selados
// originais do gsec; liberado somente pelo passo H1 pós-V0 (--release-gsec).
const GSEC_EXCEPTION = {
  bundle: "gsec-2026-09-06",
  label: "vermelho-esperado até assinatura do memo (V0)",
  marker: ".gsec-exception-released",
  pins: {
    "scripts/env-guard.mjs":
      "7f3247f2ba8bbdc16f9ff47fb152a579f5961ae3c8b3209e61d17073d7d9c062",
    "docs/specs/M-02/emenda-2026-09-07-env-guard.md":
      "efc0d47ada34fbf990ea3896c22445592f59e09082ca5dab4d834d6af1003acf",
  },
};

function usage() {
  return [
    "uso: npm run m02:sums -- [--verify] [--release-gsec] [--root <dir>]",
    "Regra de ordenação (roteiro L37–39): assinatura/appends → m02:sums → -c verde → staging.",
    "Rótulo gsec único e datado até V0; após --release-gsec qualquer vermelho é hard fail (exit 2).",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { verify: false, releaseGsec: false, root: "docs/evidence" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const take = (name) => {
      if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
      if (arg === `--${name}`) {
        index += 1;
        return argv[index];
      }
      return undefined;
    };
    if (arg === "--verify") {
      parsed.verify = true;
      continue;
    }
    if (arg === "--release-gsec") {
      parsed.releaseGsec = true;
      continue;
    }
    const root = take("root");
    if (root !== undefined) {
      parsed.root = root;
      continue;
    }
    return { error: `argumento não reconhecido: ${arg}` };
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(parsed.root)) return { error: "--root exige caminho simples" };
  return parsed;
}

function sha256OfFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function discoverBundles(bundleRoot) {
  return readdirSync(bundleRoot, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("."))
    .map((dirent) => join(bundleRoot, dirent.name))
    .filter((dir) => existsSync(join(dir, SUMS_NAME)))
    .sort()
    .map((dir) => ({ name: basename(dir), dir, sumsPath: join(dir, SUMS_NAME) }));
}

function parseSums(text) {
  const entries = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) return { error: `linha malformada no SUMS: ${line.slice(0, 72)}` };
    entries.push({ hash: match[1], path: match[2] });
  }
  return { entries };
}

function collectBundleFiles(rootDir, bundleDir) {
  const found = [];
  const walk = (current) => {
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      if (dirent.name.startsWith(".")) continue;
      const full = join(current, dirent.name);
      if (dirent.isDirectory()) walk(full);
      else if (dirent.isFile() && dirent.name !== SUMS_NAME) found.push(relative(rootDir, full));
    }
  };
  walk(bundleDir);
  return found.sort();
}

function buildSumsContent(entries) {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return `${sorted.map((entry) => `${entry.hash}  ${entry.path}`).join("\n")}\n`;
}

function verifyEntries(entries, options) {
  const { rootDir, bundleName, exceptionActive } = options;
  const pinning = exceptionActive && bundleName === GSEC_EXCEPTION.bundle;
  const failed = [];
  const missingPinned = [];
  let ok = 0;
  for (const entry of entries) {
    const absolute = resolve(rootDir, entry.path);
    const isPinned = pinning && GSEC_EXCEPTION.pins[entry.path] === entry.hash;
    if (!existsSync(absolute)) {
      if (isPinned) missingPinned.push(entry.path);
      else failed.push({ path: entry.path, expected: entry.hash, actual: null, labeled: false });
      continue;
    }
    const actual = sha256OfFile(absolute);
    if (actual === entry.hash) {
      ok += 1;
      continue;
    }
    failed.push({ path: entry.path, expected: entry.hash, actual, labeled: isPinned });
  }
  const status =
    failed.length === 0
      ? "GREEN"
      : failed.every((failure) => failure.labeled)
        ? "RED-LABELED"
        : "RED-UNLABELED";
  return { total: entries.length, ok, failed, missingPinned, status };
}

function regenBundle(bundle, options) {
  const { rootDir, exceptionActive } = options;
  const current = parseSums(readFileSync(bundle.sumsPath, "utf8"));
  if (current.error) return { error: `${bundle.name}: ${current.error}` };
  const pathSet = new Set([
    ...current.entries.map((entry) => entry.path),
    ...collectBundleFiles(rootDir, bundle.dir),
  ]);
  const pinning = exceptionActive && bundle.name === GSEC_EXCEPTION.bundle;
  const entries = [];
  for (const path of [...pathSet].sort()) {
    const absolute = resolve(rootDir, path);
    if (!existsSync(absolute)) {
      return { error: `${bundle.name}: caminho selado ausente no disco: ${path}` };
    }
    const pinHash = pinning ? GSEC_EXCEPTION.pins[path] : undefined;
    entries.push({ hash: pinHash ?? sha256OfFile(absolute), path });
  }
  writeFileSync(bundle.sumsPath, buildSumsContent(entries), "utf8");
  return { entries };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`m02-sums: ${parsed.error}\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }
  const bundleRoot = resolve(ROOT_DIR, parsed.root);
  if (!existsSync(bundleRoot)) {
    process.stderr.write(`m02-sums: raiz de bundles inexistente: ${parsed.root}\n`);
    process.exitCode = 2;
    return;
  }
  const bundles = discoverBundles(bundleRoot);
  if (bundles.length === 0) {
    process.stderr.write("m02-sums: nenhum bundle com SHA256SUMS encontrado (fail-closed)\n");
    process.exitCode = 2;
    return;
  }

  const markerPath = join(bundleRoot, GSEC_EXCEPTION.bundle, GSEC_EXCEPTION.marker);
  if (parsed.releaseGsec && !existsSync(markerPath)) {
    writeFileSync(
      markerPath,
      `exceção gsec liberada em ${new Date().toISOString()} (passo H1 pós-V0; roteiro L41–42)\n`,
      "utf8",
    );
    process.stdout.write(
      `${JSON.stringify({ tool: "m02-sums", event: "gsec-exception-released", marker: relative(ROOT_DIR, markerPath), label: GSEC_EXCEPTION.label })}\n`,
    );
  }
  const exceptionActive = !existsSync(markerPath);
  const mode = parsed.verify ? "verify" : "regen";
  let worst = 0;

  for (const bundle of bundles) {
    let entries;
    if (parsed.verify) {
      const current = parseSums(readFileSync(bundle.sumsPath, "utf8"));
      if (current.error) {
        process.stderr.write(`m02-sums: ${bundle.name}: ${current.error}\n`);
        worst = 2;
        break;
      }
      entries = current.entries;
    } else {
      const regen = regenBundle(bundle, { rootDir: ROOT_DIR, exceptionActive });
      if (regen.error) {
        process.stderr.write(`m02-sums: ${regen.error}\n`);
        worst = 2;
        break;
      }
      entries = regen.entries;
    }
    const result = verifyEntries(entries, {
      rootDir: ROOT_DIR,
      bundleName: bundle.name,
      exceptionActive,
    });
    if (result.missingPinned.length > 0) {
      process.stderr.write(
        `m02-sums: ${bundle.name}: caminho pinado ausente no disco (fail-closed): ${result.missingPinned.join(", ")}\n`,
      );
      worst = 2;
      break;
    }
    process.stdout.write(
      `${JSON.stringify({
        bundle: bundle.name,
        total: result.total,
        ok: result.ok,
        failed: result.failed,
        status: result.status,
        regenerated: !parsed.verify,
        gsec_label: bundle.name === GSEC_EXCEPTION.bundle && exceptionActive ? GSEC_EXCEPTION.label : undefined,
      })}\n`,
    );
    if (result.status === "RED-UNLABELED") {
      // Pós-V0 (exceção liberada), vermelho no gsec é hard fail (roteiro L41–42).
      const postV0Gsec = bundle.name === GSEC_EXCEPTION.bundle && !exceptionActive;
      worst = Math.max(worst, postV0Gsec ? 2 : 1);
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      tool: "m02-sums",
      bundles: bundles.length,
      mode,
      gsec_exception: exceptionActive ? "active" : "released",
      result: worst === 0 ? "PASS" : "FAIL",
    })}\n`,
  );
  process.exitCode = worst;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  GSEC_EXCEPTION,
  buildSumsContent,
  discoverBundles,
  main,
  parseArgs,
  parseSums,
  sha256OfFile,
  verifyEntries,
};
