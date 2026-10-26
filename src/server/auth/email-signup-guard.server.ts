import { APIError } from "better-auth/api";
import { emailCredentialProblems } from "@/server/email/email-adapter.server";

export const EMAIL_NOT_CONFIGURED_CODE = "EMAIL_NOT_CONFIGURED";
export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Cadastro por e-mail indisponível: o envio de verificação não está configurado.";
/**
 * Mesmo código, mensagem do caminho genérico (usado quando o cadastro vem de
 * um provider OAuth): "cadastro por e-mail" seria enganoso ali, porque o
 * cadastro **não** foi por e-mail — foi por provider, e a verificação que
 * faltava era a de e-mail.
 */
export const EMAIL_VERIFICATION_NOT_CONFIGURED_MESSAGE =
  "Cadastro indisponível: o envio de verificação de e-mail não está configurado.";

/**
 * Falha o cadastro por e-mail antes da criação do usuário quando
 * `RESEND_API_KEY`/`AUTH_EMAIL_FROM` estão ausentes, vazias ou inutilizáveis.
 *
 * Sem este guarda, o Better Auth cria a conta e o envio de verificação falha
 * em background: `requireEmailVerification` bloqueia o login, mas o cliente
 * recebe 200 e a conta fica inutilizável sem nenhum sinal do motivo.
 */
export function assertEmailSignUpReady(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (emailCredentialProblems(environment).length === 0) return;
  throw new APIError("SERVICE_UNAVAILABLE", {
    code: EMAIL_NOT_CONFIGURED_CODE,
    message: EMAIL_NOT_CONFIGURED_MESSAGE,
  });
}

/**
 * Falha a **persistência** de um usuário cujo e-mail não está verificado
 * quando a verificação de e-mail não tem como ser entregue.
 *
 * É o mesmo invariante de `assertEmailSignUpReady`, mas no ponto em que ele
 * vale para todos os caminhos de criação de usuário — inclusive o OAuth, que
 * cria o usuário **antes** de qualquer checagem de verificação
 * (`node_modules/better-auth/dist/oauth2/link-account.mjs:220-235`) e só
 * depois decide sobre a sessão (`:258-268`).
 *
 * Sem este guarda, um callback OAuth com `emailVerified: false` deixava um
 * usuário persistido que ninguém conseguiria verificar quando o serviço de
 * e-mail não está configurado: a falha de envio é engolida
 * (`link-account.mjs:300-302`) e a conta virava órfã sem sinal.
 *
 * `emailVerified !== true` (e não `=== false`) é a condição: a ausência da
 * afirmação do provider também é "não verificável", e o default é falhar
 * fechado.
 */
export function assertVerifiableUserCanBePersisted(
  emailVerified: boolean | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (emailVerified === true) return;
  if (emailCredentialProblems(environment).length === 0) return;
  throw new APIError("SERVICE_UNAVAILABLE", {
    code: EMAIL_NOT_CONFIGURED_CODE,
    message: EMAIL_VERIFICATION_NOT_CONFIGURED_MESSAGE,
  });
}
