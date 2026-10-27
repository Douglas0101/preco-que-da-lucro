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
function emailCredentialState(
  name: string,
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const raw = environment[name];
  const presence = authEnvPresence(raw);
  if (presence === "present") return undefined;
  return `${name} (${presence === "absent" ? "ausente" : "definida e vazia"})`;
}

/**
 * Nomes e estado das credenciais de e-mail que faltam, sem expor valores.
 *
 * Exportado para que o cadastro por e-mail possa falhar antes de criar o
 * usuário quando a verificação não tem como ser entregue; `getEmailAdapter`
 * continua sendo o guarda de última instância para os demais fluxos.
 */
export function missingEmailCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  return [
    emailCredentialState("RESEND_API_KEY", environment),
    emailCredentialState("AUTH_EMAIL_FROM", environment),
  ].filter((entry): entry is string => entry !== undefined);
}

/**
 * Endereço de remetente utilizável pela Resend.
 *
 * A Resend exige um remetente no formato `endereço` ou `Nome <endereço>`; essa
 * exigência é **determinística** (não depende de rede, de conta, de domínio
 * verificado nem de chave válida). As duas formas são aceitas aqui, e só elas:
 * qualquer outra coisa é recusada localmente, sem called externo — inventar
 * validação de rede no request path seria fabricar um veredito.
 */
const SENDER_ADDRESS = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/** O endereço do remetente, na forma `endereço` ou `Nome <endereço>`. */
function senderAddress(value: string): string {
  const between = value.match(/<([^<>]+)>/);
  return (between?.[1] ?? value).trim();
}

/**
 * Credenciais **presentes mas inutilizáveis** — a fronteira que "ausente ou
 * vazia" não alcança.
 *
 * Um `AUTH_EMAIL_FROM` sem endereço utilizável é recusado pela Resend em toda
 * entrega: o e-mail de verificação nunca chega, e o usuário já persistido
 * (quando existe) fica sem possibilidade de verificação. A detecção é local e
 * determinística; o que **não** é detectável aqui é a credencial presente e
 * inválida no servidor (chave revogada, domínio não verificado, falha de
 * rede) — isso continua sendo fronteira aberta, e está declarado na dívida
 * DBT-116.
 *
 * Ausente ou vazia **não** aparece aqui: `missingEmailCredentials` já é a
 * fonte única desse estado, e as duas listas não podem se sobrepor.
 */
export function unusableEmailCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  const from = environment.AUTH_EMAIL_FROM;
  if (authEnvPresence(from) !== "present") return [];
  if (SENDER_ADDRESS.test(senderAddress(from as string))) return [];
  return ["AUTH_EMAIL_FROM (remetente inválido)"];
}

/**
 * Tudo que impede a entrega da verificação: credencial ausente, vazia ou
 * inutilizável. A união das duas listas é o que os guards consultam; cada
 * guarda decide o que fazer com ela.
 */
export function emailCredentialProblems(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string[] {
  return [...missingEmailCredentials(environment), ...unusableEmailCredentials(environment)];
}

/** Par de credenciais de e-mail, ou o erro que nomeia o estado de cada uma. */
function requireEmailCredentials(): { apiKey: string; from: string } {
  const apiKey = readEnv("RESEND_API_KEY");
  const from = readEnv("AUTH_EMAIL_FROM");
  const problems = emailCredentialProblems();
  // `readEnv` e `authEnvPresence` classificam o MESMO valor com a MESMA regra
  // (ausente ou sem conteúdo ⇒ não configurada), então `problems` tem exatamente
  // um item por variável não utilizável e a mensagem nunca fica com a lista
  // de estados vazia. `problems.length > 0` é a pergunta "o e-mail pode ser
  // entregue?" — ausente, vazio ou remetente inutilizável são a mesma
  // resposta: não.
  if (apiKey === undefined || from === undefined || problems.length > 0) {
    throw new Error(
      `Configuração de e-mail incompleta: ${problems.join(", ")}. RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias para e-mails de autenticação.`,
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
