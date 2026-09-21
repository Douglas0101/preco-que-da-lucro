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

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return LOOPBACK_HOSTS.has(host);
  } catch {
    return false;
  }
}

export type DbPrecondition = { enabled: true } | { enabled: false; motivo: string };

/**
 * Decide se os testes de banco rodam. Lança quando o ambiente **declara** banco mas a
 * declaração é inválida — o ponto exato onde a versão anterior pulava em silêncio.
 */
export function dbPrecondition(env: NodeJS.ProcessEnv = process.env): DbPrecondition {
  const presentes = DB_ENV_KEYS.filter((chave) => Boolean(env[chave]));
  if (presentes.length === 0) {
    return {
      enabled: false,
      motivo: `N/A-sem-DB: nenhuma das ${DB_ENV_KEYS.length} URLs definida (modo local sem banco)`,
    };
  }
  const faltando = DB_REQUIRED_KEYS.filter((chave) => !env[chave]);
  const naoLoopback = DB_ENV_KEYS.filter((chave) => env[chave] && !isLoopbackUrl(env[chave]));
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
