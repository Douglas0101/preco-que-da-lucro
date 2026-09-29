/**
 * Secret Service (`org.freedesktop.secrets`) sobre o transporte D-Bus.
 *
 * O protocolo é pequeno e bem definido, e o que ele exige está todo aqui: uma sessão
 * (`OpenSession` com algoritmo `plain` — o canal já é um socket Unix do próprio usuário,
 * então cifrar por cima dele não adiciona fronteira), a coleção `default` (criada se não
 * existir), e itens identificados por **atributos** `application` + `ref`.
 *
 * A regra que governa este arquivo: **nada aqui pode vazar um segredo para uma mensagem de
 * erro.** As falhas do D-Bus chegam com nome e texto; o texto é descartado e o nome é
 * classificado num punhado de razões. Um erro que ecoasse o payload do item transformaria
 * o próprio cofre no vetor de vazamento.
 *
 * Quando o cofre exige interação — coleção trancada, prompt de desbloqueio — a resposta é
 * `KeychainError("locked")`, nunca uma tentativa de abrir a interface gráfica. O agente não
 * digita senha de cofre: ele para e escala (§6.2/§7 do brief do Ciclo 14).
 */

import { DBusClient, DBusError, DBusPreconditionError, variant } from "./dbus.ts";
import type { DBusValue } from "./dbus.ts";
import { KeychainError } from "./keychain.ts";
import type { Keychain } from "./keychain.ts";

const SERVICE_NAME = "org.freedesktop.secrets";
const SERVICE_PATH = "/org/freedesktop/secrets";
const IFACE_SERVICE = "org.freedesktop.Secret.Service";
const IFACE_COLLECTION = "org.freedesktop.Secret.Collection";
const IFACE_ITEM = "org.freedesktop.Secret.Item";
const IFACE_SESSION = "org.freedesktop.Secret.Session";

/** Atributo que separa os itens deste sidecar dos de qualquer outro cliente do cofre. */
export const APPLICATION_ATTRIBUTE = "application";
export const APPLICATION_VALUE = "preco-que-da-lucro-sidecar";

/** O caminho "/" significa "nenhum" no protocolo — não é um objeto válido. */
const NO_PROMPT = "/";

export const ITEM_LABEL_PREFIX = "sidecar:";

/**
 * Traduz uma falha do barramento numa razão fechada. O texto original **não** é propagado:
 * ele vem de fora do processo e não há garantia de que não carregue o valor do item.
 */
function classify(error: unknown): KeychainError {
  if (error instanceof KeychainError) return error;
  if (error instanceof DBusPreconditionError) {
    // Tipada no transporte, nao inferida por mensagem: "o barramento nao esta la" nao e
    // "o protocolo quebrou", e o codigo de saida depende de saber qual dos dois foi.
    return new KeychainError("unavailable", "barramento de sessao indisponivel");
  }
  if (error instanceof DBusError) {
    const name = error.dbusName;
    if (/IsLocked|Locked/i.test(name)) {
      return new KeychainError("locked", "cofre trancado: exige desbloqueio manual");
    }
    if (/AccessDenied|NotAuthorized|AuthFailed/i.test(name)) {
      return new KeychainError("denied", "acesso negado ao cofre");
    }
    if (/ServiceUnknown|NameHasNoOwner|NoReply|Disconnected|UnknownMethod/i.test(name)) {
      return new KeychainError("unavailable", "servico de segredos indisponivel neste barramento");
    }
    return new KeychainError("failure", "falha do servico de segredos");
  }
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ENOENT" || code === "ECONNREFUSED") {
    return new KeychainError("unavailable", "barramento de sessao inacessivel");
  }
  return new KeychainError("failure", "falha do cofre");
}

export class SecretServiceKeychain implements Keychain {
  readonly kind = "secret-service";

  private client: DBusClient | null = null;
  private sessionPath = "";
  private collectionPath = "";

  /** Abre sessão e coleção. Idempotente: chamadas seguintes não repetem o handshake. */
  async open(): Promise<void> {
    if (this.client) return;
    const client = new DBusClient();
    try {
      await client.connect();
      const session = await client.call({
        destination: SERVICE_NAME,
        path: SERVICE_PATH,
        interface: IFACE_SERVICE,
        member: "OpenSession",
        signature: "sv",
        body: ["plain", variant("s", "")],
      });
      const sessionPath = String(session.body[1] ?? NO_PROMPT);
      if (sessionPath === NO_PROMPT) {
        throw new KeychainError("failure", "sessao de segredo nao foi aberta");
      }

      const alias = await client.call({
        destination: SERVICE_NAME,
        path: SERVICE_PATH,
        interface: IFACE_SERVICE,
        member: "ReadAlias",
        signature: "s",
        body: ["default"],
      });
      let collection = String(alias.body[0] ?? NO_PROMPT);
      if (collection === NO_PROMPT) {
        const created = await client.call({
          destination: SERVICE_NAME,
          path: SERVICE_PATH,
          interface: IFACE_SERVICE,
          member: "CreateCollection",
          signature: "a{sv}s",
          body: [
            [
              [
                "org.freedesktop.Secret.Collection.Label",
                variant("s", "preco-que-da-lucro sidecar"),
              ],
            ],
            "default",
          ],
        });
        collection = String(created.body[0] ?? NO_PROMPT);
        if (String(created.body[1] ?? NO_PROMPT) !== NO_PROMPT) {
          throw new KeychainError("locked", "criar a colecao exige interacao do usuario");
        }
      }

      const unlocked = await client.call({
        destination: SERVICE_NAME,
        path: SERVICE_PATH,
        interface: IFACE_SERVICE,
        member: "Unlock",
        signature: "ao",
        body: [[collection]],
      });
      if (String(unlocked.body[1] ?? NO_PROMPT) !== NO_PROMPT) {
        throw new KeychainError("locked", "colecao trancada exige desbloqueio manual");
      }

      this.sessionPath = sessionPath;
      this.collectionPath = collection;
      this.client = client;
    } catch (error) {
      client.close();
      throw classify(error);
    }
  }

  private async ready(): Promise<DBusClient> {
    await this.open();
    const client = this.client;
    if (!client) throw new KeychainError("unavailable", "cofre nao abriu");
    return client;
  }

  /** Caminhos dos itens deste sidecar com o `ref` pedido. Item trancado aborta a busca. */
  private async search(ref: string): Promise<string[]> {
    const client = await this.ready();
    try {
      const reply = await client.call({
        destination: SERVICE_NAME,
        path: SERVICE_PATH,
        interface: IFACE_SERVICE,
        member: "SearchItems",
        signature: "a{ss}",
        body: [
          [
            [APPLICATION_ATTRIBUTE, APPLICATION_VALUE],
            ["ref", ref],
          ],
        ],
      });
      const locked = (reply.body[1] ?? []) as DBusValue[];
      if (locked.length > 0) throw new KeychainError("locked", "item trancado no cofre");
      return (reply.body[0] ?? []) as string[];
    } catch (error) {
      throw classify(error);
    }
  }

  async put(ref: string, secret: Uint8Array): Promise<void> {
    const client = await this.ready();
    try {
      const reply = await client.call({
        destination: SERVICE_NAME,
        path: this.collectionPath,
        interface: IFACE_COLLECTION,
        member: "CreateItem",
        signature: "a{sv}(oayays)b",
        body: [
          [
            ["org.freedesktop.Secret.Item.Label", variant("s", `${ITEM_LABEL_PREFIX}${ref}`)],
            [
              "org.freedesktop.Secret.Item.Attributes",
              variant("a{ss}", [
                [APPLICATION_ATTRIBUTE, APPLICATION_VALUE],
                ["ref", ref],
              ]),
            ],
          ],
          [this.sessionPath, new Uint8Array(0), secret, "text/plain"],
          true,
        ],
      });
      if (String(reply.body[1] ?? NO_PROMPT) !== NO_PROMPT) {
        throw new KeychainError("locked", "escrever no cofre exige interacao do usuario");
      }
    } catch (error) {
      throw classify(error);
    }
  }

  async get(ref: string): Promise<Uint8Array> {
    const items = await this.search(ref);
    const item = items[0];
    if (!item) throw new KeychainError("missing", `segredo ausente no cofre: ${ref}`);
    const client = await this.ready();
    try {
      const reply = await client.call({
        destination: SERVICE_NAME,
        path: item,
        interface: IFACE_ITEM,
        member: "GetSecret",
        signature: "o",
        body: [this.sessionPath],
      });
      const struct = reply.body[0];
      const value = Array.isArray(struct) ? struct[2] : undefined;
      if (!(value instanceof Uint8Array)) {
        throw new KeychainError("failure", "resposta de segredo malformada");
      }
      return value;
    } catch (error) {
      throw classify(error);
    }
  }

  async delete(ref: string): Promise<void> {
    const items = await this.search(ref);
    const client = await this.ready();
    for (const item of items) {
      try {
        await client.call({
          destination: SERVICE_NAME,
          path: item,
          interface: IFACE_ITEM,
          member: "Delete",
          signature: "",
          body: [],
        });
      } catch (error) {
        throw classify(error);
      }
    }
  }

  /** Só os `ref`s — o cofre nunca devolve valores numa listagem, e isso é do protocolo. */
  async list(): Promise<string[]> {
    const client = await this.ready();
    try {
      const reply = await client.call({
        destination: SERVICE_NAME,
        path: SERVICE_PATH,
        interface: IFACE_SERVICE,
        member: "SearchItems",
        signature: "a{ss}",
        body: [[[APPLICATION_ATTRIBUTE, APPLICATION_VALUE]]],
      });
      const refs: string[] = [];
      for (const path of (reply.body[0] ?? []) as string[]) {
        const attributes = await client.getProperty(SERVICE_NAME, path, IFACE_ITEM, "Attributes");
        const pairs = attributes.value;
        if (!Array.isArray(pairs)) continue;
        for (const entry of pairs) {
          if (Array.isArray(entry) && entry[0] === "ref" && typeof entry[1] === "string") {
            refs.push(entry[1]);
          }
        }
      }
      return refs.sort();
    } catch (error) {
      throw classify(error);
    }
  }

  /** Precondição de runtime: sessão viva e coleção alcançável, sem ler item nenhum. */
  async health(): Promise<string> {
    await this.open();
    return `colecao default alcancavel, sessao ${this.sessionPath === "" ? "ausente" : "aberta"}`;
  }

  close(): void {
    this.client?.close();
    this.client = null;
    this.sessionPath = "";
    this.collectionPath = "";
  }
}

export { IFACE_SESSION };
