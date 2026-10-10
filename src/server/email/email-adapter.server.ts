import { Resend } from "resend";
import { readEnv } from "@/lib/env.server";
import { authEnvPresence } from "@/server/auth/auth-policy";

export interface AuthEmailMessage {
  to: string;
  url: string;
}

export interface TransactionalEmailAdapter {
  sendEmailVerification(message: AuthEmailMessage): Promise<void>;
  sendPasswordReset(message: AuthEmailMessage): Promise<void>;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  );
}

export class ResendEmailAdapter implements TransactionalEmailAdapter {
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  private async send(input: AuthEmailMessage & { subject: string; intro: string }): Promise<void> {
    const safeUrl = escapeHtml(input.url);
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: `${input.intro}\n\n${input.url}\n\nSe você não solicitou esta ação, ignore este e-mail.`,
      html: `<p>${escapeHtml(input.intro)}</p><p><a href="${safeUrl}">Continuar com segurança</a></p><p>Se você não solicitou esta ação, ignore este e-mail.</p>`,
    });
    if (error) {
      throw new Error("Falha ao entregar e-mail transacional");
    }
  }

  async sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    await this.send({
      ...message,
      subject: "Confirme seu e-mail — Preço que Dá Lucro",
      intro: "Confirme seu e-mail para ativar sua conta.",
    });
  }

  async sendPasswordReset(message: AuthEmailMessage): Promise<void> {
    await this.send({
      ...message,
      subject: "Recupere sua senha — Preço que Dá Lucro",
      intro: "Use o link abaixo para definir uma nova senha.",
    });
  }
}

let emailAdapter: TransactionalEmailAdapter | undefined;

/**
 * Nomeia a variável E o estado, para a mensagem não confundir "par ausente"
 * com "par definido e vazio". Um par `""` é o formato que `.env.example`
 * documenta (`RESEND_API_KEY=""`) e que um registro de env criado e nunca
 * preenchido produz: sem a distinção, o operador procura uma variável que
 * existe e está vazia. A taxonomia de presença é a de `authEnvPresence` — não
 * há detector paralelo.
 */
function emailCredentialState(name: string): string | undefined {
  const raw = process.env[name];
  const presence = authEnvPresence(raw);
  if (presence === "present") return undefined;
  return `${name} (${presence === "absent" ? "ausente" : "definida e vazia"})`;
}

/** Par de credenciais de e-mail, ou o erro que nomeia o estado de cada uma. */
function requireEmailCredentials(): { apiKey: string; from: string } {
  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("AUTH_EMAIL_FROM");
  const missing = [
    emailCredentialState("RESEND_API_KEY"),
    emailCredentialState("AUTH_EMAIL_FROM"),
  ].filter((entry): entry is string => entry !== undefined);
  // `readEnv` e `authEnvPresence` classificam o MESMO valor com a MESMA regra
  // (ausente ou sem conteúdo ⇒ não configurada), então `missing` tem exatamente
  // um item por variável não utilizável e a mensagem nunca fica com a lista
  // de estados vazia.
  if (apiKey === undefined || from === undefined) {
    throw new Error(
      `Configuração de e-mail incompleta: ${missing.join(", ")}. RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias para e-mails de autenticação.`,
    );
  }
  return { apiKey, from };
}

export function getEmailAdapter(): TransactionalEmailAdapter {
  if (emailAdapter) return emailAdapter;
  const { apiKey, from } = requireEmailCredentials();
  emailAdapter = new ResendEmailAdapter(apiKey, from);
  return emailAdapter;
}

export function setEmailAdapterForTests(adapter: TransactionalEmailAdapter | undefined): void {
  emailAdapter = adapter;
}
