import { APIError } from "better-auth/api";
import { missingEmailCredentials } from "@/server/email/email-adapter.server";

export const EMAIL_NOT_CONFIGURED_CODE = "EMAIL_NOT_CONFIGURED";
export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Cadastro por e-mail indisponível: o envio de verificação não está configurado.";

/**
 * Falha o cadastro por e-mail antes da criação do usuário quando
 * `RESEND_API_KEY`/`AUTH_EMAIL_FROM` estão ausentes ou vazias.
 *
 * Sem este guarda, o Better Auth cria a conta e o envio de verificação falha
 * em background: `requireEmailVerification` bloqueia o login, mas o cliente
 * recebe 200 e a conta fica inutilizável sem nenhum sinal do motivo.
 */
export function assertEmailSignUpReady(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (missingEmailCredentials(environment).length === 0) return;
  throw new APIError("SERVICE_UNAVAILABLE", {
    code: EMAIL_NOT_CONFIGURED_CODE,
    message: EMAIL_NOT_CONFIGURED_MESSAGE,
  });
}
