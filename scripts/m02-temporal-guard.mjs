#!/usr/bin/env node
// Guarda temporal das âncoras em prosa (análise de 2026-09-21 §6.2).
//
// PROBLEMA: o programa escreve SHAs e prazos em prosa (journal, ledger, fila humana). Os dois
// envelhecem em silêncio — o WP-R5 achou um prazo de watcher 5 dias desatualizado no `REGISTRO-H.md`
// e o WP-R3 achou um `run@sha` que apontava para o commit ANTERIOR ao WP que ele dizia cobrir. Nos
// dois casos nada reprovava: a prosa não é executada por gate nenhum.
//
// SOLUÇÃO: uma superfície VIVA declarada e descoberta por parsing (não uma lista de afirmações), com
// duas invariantes falsificáveis:
//   T1 PRAZO   — toda menção a prazo (`caduca|expira|vence|deadline|prazo`) a ≤100 caracteres de uma
//                data `YYYY-MM-DD[THH:MM[:SS][Z]]` tem de estar no FUTURO em relação a `--as-of`.
//   T2 ÂNCORA  — todo token hexadecimal entre crases, de 7 a 40 dígitos, na superfície viva tem de
//                RESOLVER como objeto do git. Prefixo truncado com `…` é aceito como prefixo único.
//
// O journal append-only fica FORA por construção: linha histórica com prazo vencido é registro do que
// era verdade então, não afirmação viva. A superfície viva é o §1 do `PROGRESS.md`, o último bloco do
// ledger e a tabela aberta do `REGISTRO-H.md`.
//
// Exit: 0 tudo confere · 1 violação (nomeada) · 2 precondição (sem git, superfície ausente).
// Node built-ins apenas.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const SUPERFICIE = [
  { arquivo: "docs/evidence/agent-state/PROGRESS.md", recorte: "secao-1" },
  { arquivo: "EXECUTION-STATE-PROGRAM.md", recorte: "ultimo-bloco" },
  {
    arquivo: "docs/evidence/agent-state/DECISIONS-PENDING/REGISTRO-H.md",
    recorte: "tabela-aberta",
  },
];

const PRAZO = /(caduca|caducidade|expira|vence|deadline|prazo)/i;
const DATA = /(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?Z?)?/g;
const ANCORA = /`([0-9a-f]{7,40})(…)?`/g;

/**
 * @param {string} texto
 * @param {"secao-1" | "ultimo-bloco" | "tabela-aberta"} recorte
 * @returns {string}
 */
export function recortar(texto, recorte) {
  const linhas = texto.split("\n");
  if (recorte === "secao-1") {
    const i = linhas.findIndex((l) => /^##\s+1\./.test(l));
    if (i === -1) return "";
    const j = linhas.findIndex((l, k) => k > i && /^##\s/.test(l));
    return linhas.slice(i, j === -1 ? linhas.length : j).join("\n");
  }
  if (recorte === "ultimo-bloco") {
    const inicio = linhas.map((l, k) => (/^###\s/.test(l) ? k : -1)).filter((k) => k !== -1);
    if (inicio.length === 0) return "";
    return linhas.slice(inicio[inicio.length - 1]).join("\n");
  }
  const i = linhas.findIndex((l) => /^##\s+Fechados/.test(l));
  return linhas.slice(0, i === -1 ? linhas.length : i).join("\n");
}

/**
 * @param {string} texto
 * @param {Date} asOf
 * @returns {string[]} falhas nomeadas
 */
export function auditarPrazos(texto, asOf) {
  const falhas = [];
  texto.split("\n").forEach((linha, idx) => {
    const m = PRAZO.exec(linha);
    if (!m) return;
    const janela = linha.slice(m.index, m.index + 100);
    for (const d of janela.matchAll(DATA)) {
      const [, ano, mes, dia, hh = "23", mm = "59", ss = "59"] = d;
      const quando = Date.UTC(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hh),
        Number(mm),
        Number(ss),
      );
      if (quando < asOf.getTime()) {
        falhas.push(
          `T1 prazo vencido em ${ano}-${mes}-${dia}${d[4] ? `T${hh}:${mm}Z` : ""} (linha ${idx + 1}): ${linha.trim().slice(0, 120)}`,
        );
      }
    }
  });
  return falhas;
}

/**
 * @param {string} texto
 * @param {(token: string, prefixo: boolean) => boolean} resolve
 * @returns {string[]}
 */
export function auditarAncoras(texto, resolve) {
  const falhas = [];
  texto.split("\n").forEach((linha, idx) => {
    for (const m of linha.matchAll(ANCORA)) {
      const [, token, truncado] = m;
      if (!resolve(token, Boolean(truncado))) {
        falhas.push(
          `T2 âncora não resolve: \`${token}${truncado ? "…" : ""}\` (linha ${idx + 1}): ${linha.trim().slice(0, 120)}`,
        );
      }
    }
  });
  return falhas;
}

/**
 * @param {string} root
 * @returns {(token: string, prefixo: boolean) => boolean}
 */
export function resolvedorGit(root) {
  const cache = new Map();
  return (token, prefixo) => {
    if (cache.has(token)) return cache.get(token);
    const args = prefixo
      ? ["rev-parse", "--verify", "--quiet", `${token}^{commit}`]
      : ["cat-file", "-e", `${token}^{commit}`];
    const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    let ok = r.status === 0;
    if (!ok && prefixo) {
      // âncora truncada pode apontar para objeto que não é commit (árvore, blob)
      const r2 = spawnSync(
        "git",
        ["-C", root, "rev-parse", "--verify", "--quiet", `${token}^{object}`],
        { encoding: "utf8" },
      );
      ok = r2.status === 0;
    }
    cache.set(token, ok);
    return ok;
  };
}

/**
 * @param {string} root
 * @param {Date} asOf
 * @returns {{ falhas: string[], auditados: number }}
 */
export function auditar(root, asOf) {
  const r = spawnSync("git", ["-C", root, "rev-parse", "--git-dir"], { encoding: "utf8" });
  if (r.status !== 0) {
    const erro = new Error(`precondicao: ${root} nao e um repositorio git`);
    erro.precondicao = true;
    throw erro;
  }
  const resolveGit = resolvedorGit(root);
  const falhas = [];
  let auditados = 0;
  for (const { arquivo, recorte } of SUPERFICIE) {
    const caminho = resolve(root, arquivo);
    if (!existsSync(caminho)) {
      const erro = new Error(`precondicao: superficie viva ausente: ${arquivo}`);
      erro.precondicao = true;
      throw erro;
    }
    const trecho = recortar(readFileSync(caminho, "utf8"), recorte);
    if (!trecho.trim()) {
      const erro = new Error(`precondicao: recorte vazio em ${arquivo} (${recorte})`);
      erro.precondicao = true;
      throw erro;
    }
    auditados += 1;
    const ancoras = [...trecho.matchAll(ANCORA)].length;
    const prazos = [...trecho.split("\n")].filter((l) => PRAZO.test(l)).length;
    console.log(`  ${arquivo} [${recorte}] — ${ancoras} âncora(s), ${prazos} linha(s) com prazo`);
    falhas.push(...auditarPrazos(trecho, asOf), ...auditarAncoras(trecho, resolveGit));
  }
  return { falhas, auditados };
}

const invocadoDiretamente =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invocadoDiretamente) {
  const iAsOf = process.argv.indexOf("--as-of");
  const asOf = iAsOf === -1 ? new Date() : new Date(`${process.argv[iAsOf + 1]}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime())) {
    console.error("m02-temporal-guard: --as-of exige uma data YYYY-MM-DD");
    process.exit(2);
  }
  const iRoot = process.argv.indexOf("--root");
  const root = iRoot === -1 ? process.cwd() : resolve(process.argv[iRoot + 1]);
  try {
    console.log(`m02-temporal-guard: superficie viva, as-of ${asOf.toISOString().slice(0, 10)}`);
    const { falhas, auditados } = auditar(root, asOf);
    if (falhas.length > 0) {
      for (const f of falhas) console.error(`  ${f}`);
      console.error(
        `m02-temporal-guard: ${falhas.length} ancoras/prazos invalidos em ${auditados} superficies`,
      );
      process.exit(1);
    }
    console.log(`m02-temporal-guard: OK (${auditados} superficies vivas, 0 violacao)`);
  } catch (erro) {
    console.error(`m02-temporal-guard: ${erro.message}`);
    process.exit(2);
  }
}
