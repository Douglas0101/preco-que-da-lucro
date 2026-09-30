/**
 * Precondição de ambiente dos testes que exigem PostgreSQL (§item 17 do checklist).
 *
 * O defeito que este módulo fecha (WP-R6): a expressão antiga `dbEnabled` era um
 * `Boolean(adminUrl) && isLoopbackUrl(...) && ...` repetido em dois arquivos. Com uma
 * configuração **parcial** — por exemplo só `DATABASE_ADMIN_URL` definida e loopback — o
 * `env-guard` libera (o que está definido é local) e a suíte **pula em silêncio**,
 * ficando verde com a prova de banco ausente. Verde com verificação parcial é a classe
 * que o programa combate; aqui ela estava dentro da própria suíte.
 *
 * Regra: tudo ou nada, e falha alta.
 *   - nenhuma das três URLs definidas  -> `N/A-sem-DB`, skip **nomeado e visível**;
 *   - qualquer uma definida            -> as três são exigidas e todas loopback,
 *                                         senão **erro de precondição** (nunca skip).
 */

export const DB_REQUIRED_KEYS = ["DATABASE_ADMIN_URL", "DATABASE_URL"] as const;
/**
 * `DATABASE_URL_UNPOOLED` e **opcional**: existe como kill-switch contra credencial de producao
 * herdada, nao como parte do par que os testes precisam para conectar. Exigi-la quebraria o setup
 * que o `AGENTS.md` documenta para `npm run db:test` (so `DATABASE_URL` + `DATABASE_ADMIN_URL`) —
 * regressao medida e corrigida antes do selo. Definida, porem, e validada como as outras.
 */
export const DB_OPTIONAL_KEYS = ["DATABASE_URL_UNPOOLED"] as const;
export const DB_ENV_KEYS = [...DB_REQUIRED_KEYS, ...DB_OPTIONAL_KEYS] as const;

/**
 * O `hostname` do WHATWG nao normaliza tudo que o libpq aceita: preserva a caixa
 * (`LOCALHOST`), mantem `127.1` sem expandir, deixa o ponto final e converte o
 * IPv4-mapeado para hex (`[::ffff:7f00:1]`). N8 do S6: recusar essas grafias virava
 * erro duro onde antes o bloco pulava — fail-closed, mas impedia rodar a suite com um
 * banco local valido. `0.0.0.0` continua recusado de proposito: e bind-wildcard, nao
 * loopback.
 */
/** Host normalizado, ou `null` quando o valor nao e uma URL de banco utilizavel. */
function hostDe(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function isLoopbackUrl(value: string | undefined): boolean {
  const host = hostDe(value);
  if (host === null) return false;
  if (host === "localhost" || host === "[::1]") return true;
  if (/^127(\.\d{1,3}){0,3}$/.test(host)) return true;
  if (/^\[::ffff:7f[0-9a-f]{2}:/.test(host)) return true;
  return false;
}

/**
 * Quinta copia do prefixo de producao, junto de `env-guard.mjs:50`,
 * `m02-cutover-t0.mjs:36`, `m02-role-membership.mjs:27` e `rls-probe.mjs:45`.
 * Duplicado de proposito: o `env-guard` e pre-hook standalone que roda antes de
 * qualquer import, entao extrair um modulo compartilhado reordenaria o boot. A
 * convencao do repo e a copia comentada; este e o lugar que falta no commentario
 * de cada uma das outras quatro.
 */
const PRODUCTION_ENDPOINT_PREFIX = "ep-long-violet-aye9g0bn";

/** Verdadeiro so para o host de producao. URL invalida nao e producao — e invalida. */
function isProductionUrl(value: string | undefined): boolean {
  const host = hostDe(value);
  return host !== null && host.includes(PRODUCTION_ENDPOINT_PREFIX);
}

export type DbPrecondition = { enabled: true } | { enabled: false; motivo: string };

/**
 * Decide se os testes de banco rodam. Lança quando o ambiente **declara** banco mas a
 * declaração é inválida — o ponto exato onde a versão anterior pulava em silêncio.
 */
export function dbPrecondition(env: NodeJS.ProcessEnv = process.env): DbPrecondition {
  // Presenca por `!== undefined`, nao por `Boolean`: valor definido e vazio e uma
  // configuracao invalida, nao ausencia (N7 do S6).
  const presentes = DB_ENV_KEYS.filter((chave) => env[chave] !== undefined);
  if (presentes.length === 0) {
    return {
      enabled: false,
      motivo: `N/A-sem-DB: nenhuma das ${DB_ENV_KEYS.length} URLs definida (modo local sem banco)`,
    };
  }
  const faltando = DB_REQUIRED_KEYS.filter((chave) => env[chave] === undefined);
  const naoLoopback = DB_ENV_KEYS.filter(
    (chave) => env[chave] !== undefined && !isLoopbackUrl(env[chave]),
  );

  // Escape hatch. O predicado e o mesmo do `env-guard.mjs:166` — motivo nao
  // vazio, nao booleano. O workflow grava uma frase
  // (`neon-pr-branch.yml:305`: "CI Neon PR branch 48 — integracao em branch
  // efemera (§26)"), entao comparar com `"true"` nunca casaria; e um predicado
  // que nao casa e pior que nenhum, porque aparenta estar concedido sem estar.
  //
  // O que o override faz e dispensar a exigencia de **loopback** — o banco
  // remoto e o objeto dele (branch Neon efemera, §26). Ele nao dispensa o par
  // obrigatorio: "tudo ou nada" continua valendo, e uma configuracao pela metade
  // com override setado ainda e erro de precondicao, nao um skip silencioso.
  const motivo = env.ALLOW_REMOTE_DB;
  const override = typeof motivo === "string" && motivo.trim() !== "";
  if (override) {
    const producao = DB_ENV_KEYS.filter((chave) => isProductionUrl(env[chave]));
    if (producao.length > 0) {
      throw new Error(
        `precondicao de banco invalida: ALLOW_REMOTE_DB nao autoriza ${producao.join(", ")} — endpoint de producao e recusado com ou sem override`,
      );
    }
    const invalidas = DB_ENV_KEYS.filter(
      (chave) => env[chave] !== undefined && hostDe(env[chave]) === null,
    );
    const problemas = [
      ...faltando.map((chave) => `${chave} ausente (par obrigatorio)`),
      ...invalidas.map((chave) => `${chave} nao e uma URL de banco valida`),
    ];
    if (problemas.length > 0) {
      throw new Error(
        `precondicao de banco invalida: ALLOW_REMOTE_DB dispensa loopback, nao o par obrigatorio nem uma URL valida — ${problemas.join("; ")}`,
      );
    }
    return { enabled: true };
  }

  const problemas = [
    ...faltando.map((chave) => `${chave} ausente (par obrigatorio)`),
    ...naoLoopback.map((chave) => `${chave} nao aponta para loopback`),
  ];
  if (problemas.length > 0) {
    throw new Error(
      `precondicao de banco invalida: o ambiente declara banco (${presentes.join(", ")}) mas ${problemas.join("; ")} — configure ${DB_REQUIRED_KEYS.join(" + ")} em loopback (e ${DB_OPTIONAL_KEYS.join(", ")} tambem, se definida) ou nenhuma`,
    );
  }
  return { enabled: true };
}

/** Rótulo do skip, impresso para que o pulo seja visível em vez de inferido. */
export function skipLabel(motivo: string): string {
  return `db-precondition: ${motivo}`;
}
