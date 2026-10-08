/**
 * Núcleo do sidecar secreto-injetor (Ciclo 14, F14-1).
 *
 * A propriedade que este arquivo existe para garantir é uma só, e ela é negativa:
 * **nenhum método devolve o valor de um segredo.** O que sai daqui é `sha256`. A única
 * porta por onde o valor atravessa é `inject_env_console`, que o entrega a um host de uma
 * allowlist, e `copy_to_clipboard`, que o entrega à área de transferência de quem acabou de
 * pedir.
 *
 * Não existe — e não deve passar a existir — um método "me dê o segredo". Uma superfície
 * que não é exposta não vaza, e essa é a diferença entre um cofre e um arquivo.
 *
 * **Extensão declarada ao contrato do brief.** O brief do Ciclo 14 lista seis operações:
 * `generate`, `copy_button_capture`, `inject_env_console`, `test_endpoint`,
 * `denylist_update`, `restore_from_keychain`. Falta ali a direção de volta do caminho
 * cego: `copy_button_capture` leva console → cofre, e nada levava cofre → console para um
 * console **sem API**. Como "preencher credenciais (via sidecar BLIND se necessário)" é
 * justamente o que o F14-6 exige, `copy_to_clipboard` é acrescentado aqui e está nomeado
 * como acréscimo — a alternativa seria um fluxo que não fecha.
 */

import { randomBytes } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Client } from "pg";
import { AuditLog, auditRecord, hashOf, SEM_VALOR } from "./audit.ts";
import type { AuditOp, AuditOutcome } from "./audit.ts";
import type { Clipboard } from "./clipboard.ts";
import { KeychainError, type Keychain } from "./keychain.ts";

export type SidecarFailure = "precondicao" | "falha" | "recusado";

export class SidecarError extends Error {
  readonly reason: SidecarFailure;

  constructor(reason: SidecarFailure, message: string) {
    super(message);
    this.name = "SidecarError";
    this.reason = reason;
  }
}

export interface SidecarTarget {
  readonly ref: string;
  readonly sha256: string;
}

export interface EndpointResult {
  readonly status: number;
  readonly latency_ms: number;
  readonly sha256: string;
}

export const ROTATION_PROVIDERS = [
  "neon",
  "vercel",
  "sonar",
  "context7",
  "deepseek",
  "github",
] as const;
export type RotationProvider = (typeof ROTATION_PROVIDERS)[number];
export interface ProviderProbe extends EndpointResult {
  provider: RotationProvider;
  anonymous_status: number;
  authentication: "authenticated" | "rejected" | "NO-VERDICT";
  identity_match: boolean;
}
const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export function providerEndpoint(provider: RotationProvider, identity: string): string {
  if (!ROTATION_PROVIDERS.includes(provider) || !/^[A-Za-z0-9_.-]{1,128}$/.test(identity))
    throw new SidecarError(
      "precondicao",
      "provedor/identidade invalido (somente metadado, nunca token)",
    );
  switch (provider) {
    case "neon":
      return `https://console.neon.tech/api/v2/projects/${identity}`;
    case "vercel":
      return `https://api.vercel.com/v9/projects/${identity}`;
    case "github":
      return "https://api.github.com/user";
    case "sonar":
      return "https://sonarcloud.io/api/user_tokens/search";
    case "context7":
      return "https://context7.com/api/v2/policies";
    case "deepseek":
      return "https://api.deepseek.com/user/balance";
  }
}

export function classifyProviderProbe(
  provider: RotationProvider,
  identity: string,
  status: number,
  body: unknown,
  anonymousStatus: number,
) {
  // A protected 401 is authentication rejection; 403 can mean insufficient scope.
  if (status === 401 && [401, 403].includes(anonymousStatus))
    return { authentication: "rejected" as const, identity_match: false };
  const data = object(body);
  if (status !== 200 || ![401, 403].includes(anonymousStatus) || !data)
    return { authentication: "NO-VERDICT" as const, identity_match: false };
  let identityMatch = false;
  switch (provider) {
    case "neon":
      identityMatch = object(data.project)?.id === identity || data.id === identity;
      break;
    case "vercel":
      identityMatch = data.id === identity;
      break;
    case "github":
      identityMatch = data.login === identity;
      break;
    case "sonar":
      identityMatch =
        Array.isArray(data.userTokens) &&
        data.userTokens.some((token) => object(token)?.name === identity);
      break;
    // These protected replies do not expose a verified account/key identity in the
    // documented shape. Keep identity closure pending, never infer it from 200.
    case "context7":
      break;
    case "deepseek":
      break;
  }
  return {
    authentication: identityMatch ? ("authenticated" as const) : ("NO-VERDICT" as const),
    identity_match: identityMatch,
  };
}

export interface ConsoleInjection {
  readonly status: string;
}

/**
 * Destinos autorizados de `inject_env_console`. É uma lista de **sufixos**, e a checagem
 * é por rótulo de domínio, não por substring: `evil-vercel.com` não passa, `vercel.com` e
 * `api.vercel.com` passam. Loopback entra porque é o destino do autoteste — e só ele, dos
 * destinos fora dos consoles.
 */
export const ALLOWED_INJECT_HOSTS = [
  "vercel.com",
  "neon.tech",
  "github.com",
  "hostinger.com",
  "localhost",
  "127.0.0.1",
] as const;

/** Menor segredo que este sidecar aceita gerar: 128 bits. Abaixo disso não é rotação. */
const MIN_GENERATED_BYTES = 16;
const MAX_GENERATED_BYTES = 128;

export interface SidecarDeps {
  readonly keychain: Keychain;
  /** Preguiçoso: só as operações que tocam a área de transferência podem exigir uma. */
  readonly clipboard: () => Promise<Clipboard>;
  readonly audit: AuditLog;
  readonly denylistFile: string;
  readonly now?: () => number;
}

function hostAllowed(hostname: string): boolean {
  return ALLOWED_INJECT_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

export class SecretSidecar {
  private readonly keychain: Keychain;
  private readonly clipboard: () => Promise<Clipboard>;
  private readonly audit: AuditLog;
  private readonly denylistFile: string;
  private readonly now: () => number;

  constructor(deps: SidecarDeps) {
    this.keychain = deps.keychain;
    this.clipboard = deps.clipboard;
    this.audit = deps.audit;
    this.denylistFile = deps.denylistFile;
    this.now = deps.now ?? (() => Date.now());
  }

  private async record(input: {
    op: AuditOp;
    ref: string;
    sha256?: string;
    outcome: AuditOutcome;
    detail?: Record<string, string | number>;
  }): Promise<string> {
    const record = auditRecord({ ...input, backend: this.keychain.kind });
    await this.audit.append(record);
    return record.audit_id;
  }

  /**
   * Gera um valor novo e guarda no cofre. Devolve o hash, nunca o valor — o valor só sai
   * pelo `copy_to_clipboard` ou pelo `inject_env_console`.
   *
   * `bytes` é entropia, não comprimento: o que vai para o cofre é a codificação base64url
   * desses bytes. A codificação não é decoração — um segredo binário usado como token
   * `Bearer` faz o `fetch` recusar o cabeçalho (não-ASCII), e um segredo que não atravessa
   * o próprio caminho de injeção não serve para rotacionar nada. base64url também evita
   * `+`, `/` e `=` que alguns campos de console tratam como separadores.
   */
  async generate(ref: string, bytes: number): Promise<SidecarTarget> {
    if (!Number.isInteger(bytes) || bytes < MIN_GENERATED_BYTES || bytes > MAX_GENERATED_BYTES) {
      await this.record({ op: "generate", ref, outcome: "precondicao", detail: { bytes } });
      throw new SidecarError(
        "precondicao",
        `bytes deve ser inteiro entre ${MIN_GENERATED_BYTES} e ${MAX_GENERATED_BYTES}`,
      );
    }
    const secret = Buffer.from(randomBytes(bytes).toString("base64url"), "utf8");
    const sha256 = hashOf(secret);
    try {
      await this.keychain.put(ref, secret);
    } catch (error) {
      await this.record({ op: "generate", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    await this.record({ op: "generate", ref, sha256, outcome: "ok", detail: { bytes } });
    return { ref, sha256 };
  }

  /**
   * Captura o que o botão "copiar" do console colocou na área de transferência.
   *
   * A ordem importa e está provada por teste: **guarda primeiro, limpa depois**. Se o cofre
   * falhar, a área de transferência continua com o valor e o operador pode tentar de novo —
   * limpar antes transformaria uma falha de escrita em perda do segredo.
   */
  async copy_button_capture(ref: string): Promise<SidecarTarget> {
    const clipboard = await this.clipboard();
    const secret = await clipboard.read();
    if (secret.length === 0) {
      await this.record({
        op: "capture",
        ref,
        outcome: "precondicao",
        detail: { motivo: "vazio" },
      });
      throw new SidecarError("precondicao", "a area de transferencia esta vazia; nada a capturar");
    }
    const sha256 = hashOf(secret);
    try {
      await this.keychain.put(ref, secret);
    } catch (error) {
      await this.record({
        op: "capture",
        ref,
        sha256,
        outcome: "fail",
        detail: { etapa: "cofre" },
      });
      throw error;
    }
    try {
      await clipboard.wipe();
    } catch (error) {
      // O valor está guardado, mas a limpeza não foi provada. Isto não é um detalhe: é
      // exatamente o achado que o §8 trata como stop-the-line. O erro diz as duas metades.
      await this.record({
        op: "capture",
        ref,
        sha256,
        outcome: "fail",
        detail: { etapa: "limpeza", bytes: secret.length },
      });
      const message = error instanceof Error ? error.message : "falha desconhecida";
      throw new SidecarError(
        "falha",
        `valor guardado, mas a area de transferencia nao foi limpa: ${message}`,
      );
    }
    await this.record({ op: "capture", ref, sha256, outcome: "ok" });
    return { ref, sha256 };
  }

  /**
   * Leva o valor do cofre para a área de transferência, para que o operador cole num campo
   * de console **sem nunca ler o valor** — o caminho cego propriamente dito.
   *
   * A exposição é real e está declarada: enquanto o valor estiver ali, qualquer processo da
   * sessão pode lê-lo. As mitigações são o TTL curto com limpeza automática verificada e a
   * recusa em sobrescrever uma área de transferência que o sidecar não deixou ali.
   */
  async copy_to_clipboard(ref: string, ttlMs = 30_000): Promise<SidecarTarget> {
    const clipboard = await this.clipboard();
    const atual = await clipboard.read();
    if (atual.length > 0) {
      await this.record({
        op: "copy_out",
        ref,
        outcome: "precondicao",
        detail: { motivo: "ocupada", bytes: atual.length },
      });
      throw new SidecarError(
        "precondicao",
        "a area de transferencia ja tem conteudo que o sidecar nao colocou ali; nao sera sobrescrito",
      );
    }
    let secret: Uint8Array;
    try {
      secret = await this.keychain.get(ref);
    } catch (error) {
      await this.record({ op: "copy_out", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    const sha256 = hashOf(secret);
    await clipboard.write(secret);
    await this.record({ op: "copy_out", ref, sha256, outcome: "ok", detail: { ttl_ms: ttlMs } });
    return { ref, sha256, ...(await this.scheduleWipe(clipboard, ref, sha256, ttlMs)) };
  }

  /**
   * Limpeza automática. É `unref`-ada de propósito: um TTL pendente não deve manter o
   * processo vivo, e o CLI que sai antes do TTL deixa o valor na área de transferência —
   * por isso o `clear` do CLI é explícito e o runbook manda usá-lo.
   */
  private scheduleWipe(
    clipboard: Clipboard,
    ref: string,
    sha256: string,
    ttlMs: number,
  ): Promise<Record<string, never>> {
    if (ttlMs <= 0) return Promise.resolve({});
    const timer = setTimeout(() => {
      void clipboard
        .wipe()
        .then(() =>
          this.record({ op: "capture", ref, sha256, outcome: "ok", detail: { etapa: "ttl" } }),
        )
        .catch(() =>
          this.record({ op: "capture", ref, sha256, outcome: "fail", detail: { etapa: "ttl" } }),
        );
    }, ttlMs);
    timer.unref();
    return Promise.resolve({});
  }

  /**
   * Entrega o valor a um console, por HTTP. É a **primitiva de transporte**, não um
   * adaptador por console: cada console tem seu formato de payload e suas credenciais
   * próprias, e é isso que o Ciclo 15 acrescenta.
   *
   * Duas travas, ambas deliberadas: host na allowlist (senão a operação é um primitivo de
   * exfiltração com nome bonito) e `confirm: true` explícito no chamador. O corpo da
   * resposta **nunca** é lido: um console que ecoa o payload devolveria o segredo.
   */
  async inject_env_console(
    ref: string,
    url: string,
    options: { confirm?: boolean } = {},
  ): Promise<ConsoleInjection> {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      await this.record({
        op: "inject_env",
        ref,
        outcome: "precondicao",
        detail: { motivo: "url" },
      });
      throw new SidecarError("precondicao", "url invalida");
    }
    if (options.confirm !== true) {
      await this.record({
        op: "inject_env",
        ref,
        outcome: "precondicao",
        detail: { motivo: "sem-confirmacao", host: target.hostname },
      });
      throw new SidecarError("precondicao", "inject_env_console exige confirm: true explicito");
    }
    if (!hostAllowed(target.hostname)) {
      await this.record({
        op: "inject_env",
        ref,
        outcome: "recusado",
        detail: { motivo: "host-fora-da-allowlist", host: target.hostname },
      });
      throw new SidecarError("recusado", `host fora da allowlist: ${target.hostname}`);
    }
    let secret: Uint8Array;
    try {
      secret = await this.keychain.get(ref);
    } catch (error) {
      await this.record({ op: "inject_env", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    const sha256 = hashOf(secret);
    let status: number;
    try {
      const response = await fetch(target, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: new Uint8Array(secret),
        signal: AbortSignal.timeout(15_000),
      });
      status = response.status;
    } catch {
      // Sem mensagem de erro na auditoria: a exceção do `fetch` pode carregar a URL, e uma
      // URL de console com credencial embutida é segredo.
      await this.record({
        op: "inject_env",
        ref,
        sha256,
        outcome: "fail",
        detail: { etapa: "entrega", host: target.hostname },
      });
      throw new SidecarError("falha", `entrega a ${target.hostname} falhou`);
    }
    const ok = status >= 200 && status < 300;
    await this.record({
      op: "inject_env",
      ref,
      sha256,
      outcome: ok ? "ok" : "fail",
      detail: { host: target.hostname, http_status: status },
    });
    if (!ok) throw new SidecarError("falha", `console respondeu ${status}`);
    return { status: String(status) };
  }

  /** Low-level HTTP/DB status probe. Synthetic selftests use 200/401;
   * provider rotation requires the protected identity probe and provider revocation proof.
   */
  async test_endpoint(ref: string, kind: "http" | "db", target?: string): Promise<EndpointResult> {
    let secret: Uint8Array;
    try {
      secret = await this.keychain.get(ref);
    } catch (error) {
      await this.record({ op: "test_endpoint", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    const sha256 = hashOf(secret);
    if (target === undefined || target === "") {
      await this.record({
        op: "test_endpoint",
        ref,
        sha256,
        outcome: "precondicao",
        detail: { motivo: "sem-alvo", kind },
      });
      throw new SidecarError(
        "precondicao",
        "test_endpoint exige um alvo; o sidecar nao adivinha para onde sondar",
      );
    }
    const started = this.now();
    const status =
      kind === "http" ? await this.probeHttp(secret, target) : await this.probeDb(secret, target);
    const latency_ms = this.now() - started;
    await this.record({
      op: "test_endpoint",
      ref,
      sha256,
      outcome: status === 200 ? "ok" : "fail",
      detail: { kind, status, latency_ms },
    });
    return { status, latency_ms, sha256 };
  }

  async test_provider(
    ref: string,
    provider: RotationProvider,
    identity: string,
  ): Promise<ProviderProbe> {
    const url = providerEndpoint(provider, identity);
    const secret = await this.keychain.get(ref);
    const sha256 = hashOf(secret);
    const started = this.now();
    async function get(auth?: Uint8Array): Promise<{ status: number; body: unknown }> {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...(auth ? { Authorization: `Bearer ${new TextDecoder().decode(auth)}` } : {}),
          },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        // Read only transiently: replies can contain token metadata or billing data.
        // Never persist or return the body, including on parse failures.
        return { status: response.status, body: await response.json().catch(() => null) };
      } catch {
        return { status: 0, body: null };
      }
    }
    const anonymous = await get();
    const authenticated = await get(secret);
    const verdict = classifyProviderProbe(
      provider,
      identity,
      authenticated.status,
      authenticated.body,
      anonymous.status,
    );
    const latency_ms = this.now() - started;
    await this.record({
      op: "test_endpoint",
      ref,
      sha256,
      outcome:
        verdict.authentication === "authenticated"
          ? "ok"
          : verdict.authentication === "rejected"
            ? "fail"
            : "precondicao",
      detail: {
        provider,
        status: authenticated.status,
        anonymous_status: anonymous.status,
        authentication: verdict.authentication,
        identity_match: Number(verdict.identity_match),
        latency_ms,
      },
    });
    return {
      provider,
      status: authenticated.status,
      anonymous_status: anonymous.status,
      ...verdict,
      latency_ms,
      sha256,
    };
  }

  private async probeHttp(secret: Uint8Array, url: string): Promise<number> {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { authorization: `Bearer ${new TextDecoder().decode(secret)}` },
        signal: AbortSignal.timeout(10_000),
      });
      return response.status;
    } catch {
      return 0;
    }
  }

  /**
   * Sonda de banco com autenticação de verdade, via `pg` — que já é dependência do
   * repositório, então isto não acrescenta nenhuma.
   *
   * Só o **código** do erro é classificado; a mensagem é descartada. O `pg` costuma montar
   * mensagens com a string de conexão, e a string de conexão *é* o segredo.
   */
  private async probeDb(secret: Uint8Array, template: string): Promise<number> {
    const connectionString = template.replaceAll("{secret}", new TextDecoder().decode(secret));
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 5_000,
    });
    try {
      await client.connect();
      return 200;
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      if (code === "28P01" || code === "28000") return 401;
      if (code === "3D000") return 404;
      return code === "" ? 0 : 500;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  /**
   * Retira o valor de circulação registrando a troca. Recusa-se a registrar se o
   * `sha256_old` não for o que está no cofre agora: a denylist existe para dizer "este
   * valor foi aposentado", e gravar uma aposentadoria que não aconteceu é pior do que não
   * gravar nada — vira evidência de uma rotação fictícia.
   */
  async denylist_update(ref: string, sha256_old: string, sha256_new: string): Promise<void> {
    if (sha256_old === sha256_new) {
      await this.record({
        op: "denylist",
        ref,
        outcome: "precondicao",
        detail: { motivo: "hashes-iguais" },
      });
      throw new SidecarError("precondicao", "sha256_old e sha256_new sao o mesmo valor");
    }
    let current: Uint8Array;
    try {
      current = await this.keychain.get(ref);
    } catch (error) {
      await this.record({ op: "denylist", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    const currentHash = hashOf(current);
    if (currentHash !== sha256_old) {
      await this.record({
        op: "denylist",
        ref,
        sha256: currentHash,
        outcome: "precondicao",
        detail: { motivo: "sha256_old-divergente" },
      });
      throw new SidecarError(
        "precondicao",
        "sha256_old nao corresponde ao valor que esta no cofre; a denylist nao registra rotacao que nao ocorreu",
      );
    }
    await mkdir(dirname(this.denylistFile), { recursive: true, mode: 0o700 });
    await appendFile(
      this.denylistFile,
      `${JSON.stringify({ ts: new Date().toISOString(), ref, sha256_old, sha256_new })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await this.record({
      op: "denylist",
      ref,
      sha256: sha256_new,
      outcome: "ok",
      detail: { sha256_old },
    });
  }

  /**
   * Prova que o valor é recuperável **sem** o entregar. Devolve só o hash. "Restore" aqui
   * significa restaurar a *capacidade de usar* o segredo, não expô-lo: quem quiser o valor
   * de fato usa `copy_to_clipboard` ou `inject_env_console`.
   */
  async restore_from_keychain(ref: string): Promise<{ sha256: string }> {
    let secret: Uint8Array;
    try {
      secret = await this.keychain.get(ref);
    } catch (error) {
      await this.record({ op: "restore", ref, outcome: "fail", detail: { etapa: "cofre" } });
      throw error;
    }
    const sha256 = hashOf(secret);
    await this.record({ op: "restore", ref, sha256, outcome: "ok" });
    return { sha256 };
  }

  async delete(ref: string): Promise<void> {
    try {
      await this.keychain.delete(ref);
    } catch (error) {
      await this.record({ op: "delete", ref, outcome: "fail" });
      throw error;
    }
    await this.record({ op: "delete", ref, sha256: SEM_VALOR, outcome: "ok" });
  }

  /** Nomes de ref, nunca valores. */
  async list(): Promise<string[]> {
    const refs = await this.keychain.list();
    await this.record({
      op: "list",
      ref: SEM_VALOR,
      outcome: "ok",
      detail: { total: refs.length },
    });
    return refs;
  }

  /**
   * Estado do sidecar, para pré-condição de pipeline. Devolve o que é **medido**, não o que
   * se espera: qual cofre respondeu e quantos refs ele tem.
   */
  async health(): Promise<string> {
    const refs = await this.keychain.list();
    const clinica = await this.clipboard()
      .then((clipboard) => clipboard.kind)
      .catch(() => "indisponivel");
    await this.record({
      op: "health",
      ref: SEM_VALOR,
      outcome: "ok",
      detail: { refs: refs.length },
    });
    return `cofre=${this.keychain.kind} refs=${refs.length} area=${clinica}`;
  }
}

export { KeychainError };
