#!/usr/bin/env node
// Guarda do runtime dos servidores MCP.
//
// POR QUE EXISTE
// Um servidor MCP stdio lancado por um package runner sem pin (tipicamente
// `npx -y <pkg>@latest`) e SEM `cwd` resolve o "projeto" subindo a arvore a
// partir do diretorio corrente. Se esse diretorio corrente esta dentro de um
// checkout, o runner instala na arvore DESTE checkout e reescreve
// `package.json` / `package-lock.json` — foi assim que `drizzle-kit` (pin
// `critical` em `scripts/dependency-policy.json`) virou 0.18.1 em 2026-09-28/29
// (DBT-32, quatro ocorrencias).
//
// A correcao do ciclo 13 alcancou UM arquivo de configuracao. Medido em
// 2026-09-29: o arquivo que o cliente realmente carrega continuava com tres
// linhas `npx ...@latest` sem `cwd`, e nenhuma guarda olhava para isso. Uma
// prevencao de sitio unico nao e prevencao: o defeito e um PADRAO de linha, e
// sitio novo tem de falhar por default.
//
// DOIS ESCOPOS, DE PROPOSITO
//   (padrao)      so os arquivos de config do PROPRIO repositorio.
//                 E o que entra em `npm run check`: deterministico, verificavel
//                 por clone, e nao muda de veredito com o $HOME de quem roda.
//   --home        tambem os arquivos globais da maquina.
//                 E o que o runbook `docs/runbooks/mcp-relaunch.md` chama. Nao
//                 entra em gate nenhum: um gate de repositorio que depende do
//                 $HOME reprova o CI por causa da maquina de quem contribui.
//
// Uso: tsx scripts/mcp-runtime-guard.ts [--home] [--json] [--cwd <dir>]
// Exit: 0 = limpo · 1 = violacao · 2 = precondicao (alvo ilegivel/ausente)

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

export interface SiteSpec {
  path: string;
  format: "json" | "yaml-text";
  role: string;
  why?: string;
}

export interface AuditedSite extends SiteSpec {
  full: string;
  bytes: number;
}

export interface MissingSite extends SiteSpec {
  full: string;
}

export interface AuditResult {
  findings: string[];
  preconditions: string[];
  audited: AuditedSite[];
  missing: MissingSite[];
}

export interface RowAudit {
  findings: string[];
  preconditions: string[];
}

// ── catalogo de sitios ──────────────────────────────────────────────────────
// O catalogo e explicito porque "descoberta vazia" e "nada a checar" nao podem
// ser o mesmo estado. Um arquivo de config NOVO que apareca no clone conta como
// achado proprio, nao como silencio: e o requisito de descoberta multi-sitio.
const HOME = homedir();

/** Sitios de escopo-repositorio. Relativos a raiz passada em `cwd`. */
export const REPO_CATALOG: SiteSpec[] = [
  { path: ".mcp.json", format: "json", role: "projeto-padrao" },
  { path: join(".pi", "mcp-adapter.json"), format: "json", role: "projeto-adapter" },
];

/** Sitios de escopo-maquina. `role: primario` e o arquivo de precedencia 1. */
export function homeCatalog(): SiteSpec[] {
  return [
    {
      path: join(HOME, ".config", "mcp", "mcp.json"),
      format: "json",
      role: "primario",
      why: "GENERIC_GLOBAL_CONFIG_PATH do pi-mcp-adapter (config.ts:16); precedencia 1 do README",
    },
    { path: join(HOME, ".agents", "mcp.json"), format: "json", role: "compatibilidade" },
    { path: join(HOME, ".agents", "mcp", "mcp.json"), format: "json", role: "compatibilidade" },
    {
      path: join(HOME, ".dsh", "bundles", "kimi-mcp", "cordis.patch.yml"),
      format: "yaml-text",
      role: "outro-cliente",
      why: "lancador do harness dsh; NAO e lido pelo pi, mas e onde o ciclo 13 aplicou a correcao",
    },
  ];
}

// ── regras puras ────────────────────────────────────────────────────────────
const RUNNERS = new Set(["npx", "pnpx", "bunx"]);

/**
 * Devolve o especificador de pacote quando a linha e um package runner, senao
 * `null`. `null` significa "nao e runner" — que e diferente de "runner sem
 * especificador" (esse devolve string vazia).
 */
export function runnerSpecifier(command: unknown, args: unknown[] = []): string | null {
  if (typeof command !== "string") return null;
  const first = (values: unknown[]): string =>
    values.find((a): a is string => typeof a === "string" && !a.startsWith("-")) ?? "";
  if (RUNNERS.has(command)) return first(args);
  if (command === "npm" && args[0] === "exec") return first(args.slice(1));
  if ((command === "pnpm" || command === "yarn") && (args[0] === "dlx" || args[0] === "exec")) {
    return first(args.slice(1));
  }
  if (command === "bun" && args[0] === "x") return first(args.slice(1));
  return null;
}

/** Um especificador com versao exata (`pkg@1.2.3`, `@scope/pkg@1.2.3`). */
export function isPinned(spec: string | null): boolean {
  if (typeof spec !== "string" || spec.length === 0) return false;
  const at = spec.lastIndexOf("@");
  if (at <= 0) return false; // "pkg" ou "@scope/pkg"
  const version = spec.slice(at + 1);
  return /^\d/.test(version) && !version.includes("*");
}

/** `true` quando `dir` esta dentro de uma arvore de trabalho git. */
export function insideWorkTree(dir: string): boolean {
  let d = resolve(dir);
  for (;;) {
    if (existsSync(join(d, ".git"))) return true;
    const parent = dirname(d);
    if (parent === d) return false;
    d = parent;
  }
}

/**
 * Heuristica de valor literal de segredo. Deliberadamente conservadora: entre
 * nao acusar e acusar, acusa — porque o custo de um falso positivo aqui e uma
 * linha de configuracao para reescrever, e o custo de um falso negativo e uma
 * credencial em texto claro que ninguem procura.
 */
export function looksLikeLiteralSecret(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (/^(ghp_|github_pat_|gho_|ghs_|sk-|nak_|nsk_|nt_live_|nt_prod_|eyJ)/.test(value)) return true;
  if (value.length < 24) return false;
  if (/\s/.test(value)) return false;
  if (/^https?:\/\//.test(value)) return false;
  if (/^\$\{?[A-Za-z0-9_]+\}?$/.test(value)) return false;
  if (!/^[A-Za-z0-9_\-./+=]+$/.test(value)) return false;
  return [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(value)).length >= 3;
}

/** `sha256:abc123…` — o unico jeito de citar um valor sem cita-lo. */
export function fingerprint(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Audita as linhas de um config JSON `mcpServers`. Nunca devolve valor de env —
 * so o NOME da variavel, o tamanho e um fingerprint.
 */
export function auditJsonConfig({
  label,
  raw,
  cwdGuard = true,
}: {
  label: string;
  raw: string;
  cwdGuard?: boolean;
}): RowAudit {
  const findings: string[] = [];
  const preconditions: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    preconditions.push(`${label}: JSON ilegivel (${(error as Error).message})`);
    return { findings, preconditions };
  }
  const servers = asRecord(asRecord(parsed)?.["mcpServers"]);
  if (!servers) {
    preconditions.push(`${label}: sem o mapa \`mcpServers\``);
    return { findings, preconditions };
  }
  const names = Object.keys(servers);
  if (names.length === 0) {
    preconditions.push(`${label}: \`mcpServers\` vazio — nada a auditar, e isso nao e um veredito`);
    return { findings, preconditions };
  }

  for (const name of names) {
    const row = asRecord(servers[name]);
    if (!row) {
      findings.push(`${label}: linha \`${name}\` nao e um objeto`);
      continue;
    }
    // Linhas http/oauth (context7, linear, neon) nao executam processo local:
    // nao ha runner, nao ha resolucao de projeto, nao ha o que pinar.
    if (typeof row["url"] === "string" && row["command"] === undefined) continue;

    const command = row["command"];
    const args = Array.isArray(row["args"]) ? row["args"] : [];
    const spec = runnerSpecifier(command, args);

    if (spec !== null && !isPinned(spec)) {
      findings.push(
        `${label}: linha \`${name}\` lanca \`${String(command)}\` sem pin (${
          spec === "" ? "sem especificador" : spec
        }) — um runner sem versao exata resolve o que existir mais novo no registro`,
      );
    }
    if (spec !== null && cwdGuard) {
      const cwd = row["cwd"];
      if (typeof cwd !== "string" || cwd.length === 0) {
        findings.push(
          `${label}: linha \`${name}\` lanca \`${String(command)}\` sem \`cwd\` — o runner sobe a arvore a ` +
            `partir do diretorio corrente e pode instalar na arvore de um checkout (mecanismo do DBT-32)`,
        );
      } else if (insideWorkTree(cwd)) {
        findings.push(
          `${label}: linha \`${name}\` aponta \`cwd\` para dentro de uma arvore de trabalho git (${cwd}) — ` +
            `o runtime tem de ficar fora de qualquer checkout`,
        );
      }
    }
    if (typeof command === "string" && command.includes("/") && !command.startsWith("/")) {
      findings.push(`${label}: linha \`${name}\` usa caminho relativo como comando (${command})`);
    }

    const env = asRecord(row["env"]);
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        if (looksLikeLiteralSecret(value)) {
          findings.push(
            `${label}: linha \`${name}\` carrega valor literal na variavel \`${key}\` ` +
              `(${(value as string).length} bytes, ${fingerprint(value as string)}) — ` +
              `segredo em texto claro no arquivo de configuracao`,
          );
        }
      }
    }
  }
  return { findings, preconditions };
}

/**
 * Auditoria textual de um lancador YAML. Sem dependencia de parser de YAML o
 * recorte e por linha, e o limite e declarado: a regra pergunta se o arquivo
 * usa runner sem pin e se o arquivo declara `cwd` — nao tenta casar cada linha
 * de `command:` com o seu `cwd`.
 */
export function auditYamlText({ label, raw }: { label: string; raw: string }): RowAudit {
  const findings: string[] = [];
  const lines = raw.split("\n");
  const hasCwd = lines.some((l) => /^\s*cwd:\s*\S/.test(l));
  for (const [index, line] of lines.entries()) {
    if (!/^\s*command:\s*(npx|pnpx|bunx|npm|pnpm|yarn|bun)\s*$/.test(line)) continue;
    if (/@latest/.test(raw)) {
      findings.push(
        `${label}:${index + 1}: \`command:\` e package runner e o arquivo usa \`@latest\` — ` +
          `runner sem versao exata`,
      );
    }
    if (!hasCwd) {
      findings.push(
        `${label}:${index + 1}: \`command:\` e package runner e o arquivo nao declara \`cwd\` em lugar ` +
          `nenhum — o runner resolve o projeto a partir do diretorio corrente`,
      );
    }
  }
  return { findings, preconditions: [] };
}

/** Roda o catalogo. Nunca lanca: precondicao e veredito, nao excecao. */
export function auditSites({ cwd, sites }: { cwd: string; sites: SiteSpec[] }): AuditResult {
  const findings: string[] = [];
  const preconditions: string[] = [];
  const audited: AuditedSite[] = [];
  const missing: MissingSite[] = [];
  for (const site of sites) {
    const full = resolve(cwd, site.path);
    if (!existsSync(full)) {
      missing.push({ ...site, full });
      continue;
    }
    let raw: string;
    try {
      raw = readFileSync(full, "utf8");
    } catch (error) {
      preconditions.push(`${site.path}: ilegivel (${(error as Error).message})`);
      continue;
    }
    if (site.format === "json") {
      const out = auditJsonConfig({ label: site.path, raw });
      findings.push(...out.findings);
      preconditions.push(...out.preconditions);
    } else {
      findings.push(...auditYamlText({ label: site.path, raw }).findings);
    }
    audited.push({ ...site, full, bytes: statSync(full).size });
  }
  return { findings, preconditions, audited, missing };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
interface Options {
  home: boolean;
  json: boolean;
  cwd: string;
  help: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { home: false, json: false, cwd: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--home") opts.home = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--cwd") {
      const value = argv[i + 1];
      if (!value) throw new Error("--cwd exige um diretorio");
      opts.cwd = resolve(value);
      i += 1;
    } else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`argumento desconhecido: ${arg}`);
  }
  return opts;
}

function main(): void {
  let opts: Options;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`mcp runtime guard: ${(error as Error).message}`);
    process.exit(2);
  }
  if (opts.help) {
    console.log("uso: tsx scripts/mcp-runtime-guard.ts [--home] [--json] [--cwd <dir>]");
    console.log("  (padrao) escopo-repositorio · --home inclui os configs globais da maquina");
    process.exit(0);
  }

  const sites = opts.home ? [...REPO_CATALOG, ...homeCatalog()] : REPO_CATALOG;
  const result = auditSites({ cwd: opts.cwd, sites });
  const scope = opts.home ? "repositorio+maquina" : "repositorio";
  // Superficie vazia e precondicao no escopo-maquina (sem o primario nao ha o que
  // auditar) e LIMITE DECLARADO no escopo-repositorio (o repositorio nao
  // versiona config MCP; a superficie viva e a da maquina). Precondicao nao pode
  // virar "limpo" por vacuidade — entao ela nao vira: vira nota visivel.
  const requireSites = opts.home;

  if (opts.json) {
    console.log(JSON.stringify({ scope, ...result }, null, 2));
  } else {
    console.log(`mcp runtime guard: escopo=${scope} · sitios auditados=${result.audited.length}`);
    for (const site of result.audited) {
      console.log(`  auditado: ${site.path} (${site.role}, ${site.bytes} bytes)`);
    }
    for (const site of result.missing) {
      console.log(`  ausente : ${site.path} (${site.role})`);
    }
    for (const note of result.preconditions)
      console.error(`mcp runtime guard [precondicao]: ${note}`);
    for (const finding of result.findings)
      console.error(`mcp runtime guard [violacao]: ${finding}`);
    if (result.audited.length === 0 && !requireSites) {
      console.log(
        "  limite  : o repositorio nao versiona config MCP, entao nada aqui e auditavel; " +
          "a superficie viva e a da maquina (rode com --home)",
      );
    }
  }

  // Uma violacao e uma violacao: precondicao nao pode mascarar achado real, e
  // ausencia de sitio nao pode virar "limpo" por vacuidade.
  if (result.findings.length > 0) {
    if (!opts.json)
      console.error(`mcp runtime guard: REPROVADO (${result.findings.length} violacao(oes))`);
    process.exit(1);
  }
  if (requireSites && result.audited.length === 0) {
    if (!opts.json)
      console.error(
        "mcp runtime guard: PRECONDICAO — nenhum sitio auditado no escopo-maquina (catalogo vazio em disco)",
      );
    process.exit(2);
  }
  if (result.preconditions.length > 0) {
    if (!opts.json)
      console.error(`mcp runtime guard: PRECONDICAO (${result.preconditions.length} nota(s))`);
    process.exit(2);
  }
  if (!opts.json)
    console.log("mcp runtime guard: OK (nenhum runner sem pin, nenhum segredo literal)");
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
