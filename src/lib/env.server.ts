/**
 * Leitura de variável de ambiente em que "definida e vazia" conta como "não
 * configurada".
 *
 * `process.env.X ?? default` cai no default quando X é `undefined`, mas **não**
 * quando a plataforma define X como string vazia — e é exatamente o que um
 * registro de env criado no import do projeto e nunca preenchido produz.
 * Medido no preview `dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8` (branch `develop`):
 * `AI_GATEWAY_URL=""` fez `new URL("")` lançar e derrubou **todo** turno de
 * chat em `DEPENDENCY_ERROR`, com o texto interno do guard anti-SSRF chegando à
 * conversa do usuário; `RESEND_API_KEY=""`/`AUTH_EMAIL_FROM=""` deixaram o
 * e-mail de verificação sem entrega pelo mesmo motivo de forma.
 *
 * Espaços nas bordas são preservados de propósito: quem valida credencial
 * continua rejeitando `" chave "` em vez de aceitar em silêncio.
 */
export function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return undefined;
  return raw;
}
