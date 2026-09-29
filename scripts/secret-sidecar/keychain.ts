/**
 * A fronteira do cofre.
 *
 * O núcleo do sidecar **não conhece D-Bus**: ele fala com esta interface. Isso não é
 * elegância — é o que torna o `fail-closed` um caso de teste em vez de uma promessa. Se o
 * núcleo chamasse o Secret Service diretamente, "a falha do cofre aborta a operação" só
 * seria verificável com um cofre quebrado de verdade, e o CI não tem barramento de sessão.
 *
 * Os valores que atravessam esta interface são bytes crus e **nunca** aparecem em log,
 * stdout, audit ou mensagem de erro. A interface não tem um método "descreva o segredo"
 * de propósito: o que não é exposto não vaza.
 */

export type KeychainFailure = "missing" | "locked" | "unavailable" | "denied" | "failure";

/**
 * Falha do cofre, já classificada. A mensagem é genérica por construção: `missing` é o
 * único caso em que o chamador aprende algo sobre *existência*, e isso é necessário para
 * distinguir "restaure o segredo" de "o cofre está fora do ar".
 */
export class KeychainError extends Error {
  readonly reason: KeychainFailure;

  constructor(reason: KeychainFailure, message: string) {
    super(message);
    this.name = "KeychainError";
    this.reason = reason;
  }
}

export interface Keychain {
  /** Identifica a implementação para o audit log e para `--healthcheck`. Nunca um valor de segredo. */
  readonly kind: string;
  put(ref: string, secret: Uint8Array): Promise<void>;
  get(ref: string): Promise<Uint8Array>;
  delete(ref: string): Promise<void>;
  list(): Promise<string[]>;
  /**
   * Libera recursos externos — no Secret Service, o socket do barramento de sessão. Opcional
   * de propósito: um cofre em memória não tem o que fechar, e torná-lo obrigatório obrigaria
   * a bancada a fingir um recurso que ela não usa. Sem esta chamada a CLI imprime o
   * resultado e **não termina**: o socket aberto mantém o event loop vivo (medido: exit 124
   * sob `timeout 10`).
   */
  close?(): void;
}

/**
 * Cofre em memória. Existe por dois motivos declarados: (1) os testes do núcleo, que
 * precisam rodar no CI — onde não há barramento de sessão nem Secret Service; (2) o modo
 * `--selftest --backend=memoria`, que prova o mecanismo do sidecar numa máquina sem
 * gnome-keyring. Ele **não** é o cofre de produção, e o audit log registra qual backend
 * foi usado em cada operação, para que ninguém confunda os dois numa leitura futura.
 */
export class MemoryKeychain implements Keychain {
  readonly kind = "memoria";
  private readonly items = new Map<string, Uint8Array>();

  async put(ref: string, secret: Uint8Array): Promise<void> {
    this.items.set(ref, Uint8Array.from(secret));
  }

  async get(ref: string): Promise<Uint8Array> {
    const found = this.items.get(ref);
    if (!found) throw new KeychainError("missing", `segredo ausente no cofre: ${ref}`);
    return Uint8Array.from(found);
  }

  async delete(ref: string): Promise<void> {
    this.items.delete(ref);
  }

  async list(): Promise<string[]> {
    return [...this.items.keys()].sort();
  }
}

/**
 * Cofre que falha sob comando. É o instrumento do caso de teste "fail-closed": em vez de
 * afirmar que uma falha de cofre aborta a operação, o teste **produz** a falha e mede o
 * aborto. Vive aqui, e não no arquivo de teste, porque o `--selftest` também o usa — e
 * porque um injetor escondido no teste não é reutilizável pelo artefato que ele audita.
 */
export class FaultInjectingKeychain implements Keychain {
  readonly kind: string;
  private readonly inner: Keychain;
  private readonly failing: Set<"put" | "get" | "delete" | "list">;

  constructor(inner: Keychain, failing: Array<"put" | "get" | "delete" | "list">) {
    this.inner = inner;
    this.failing = new Set(failing);
    this.kind = `falha-injetada:${inner.kind}`;
  }

  private guard(op: "put" | "get" | "delete" | "list"): void {
    if (this.failing.has(op)) {
      throw new KeychainError("unavailable", `cofre indisponível (falha simulada em ${op})`);
    }
  }

  async put(ref: string, secret: Uint8Array): Promise<void> {
    this.guard("put");
    return this.inner.put(ref, secret);
  }

  async get(ref: string): Promise<Uint8Array> {
    this.guard("get");
    return this.inner.get(ref);
  }

  async delete(ref: string): Promise<void> {
    this.guard("delete");
    return this.inner.delete(ref);
  }

  async list(): Promise<string[]> {
    this.guard("list");
    return this.inner.list();
  }
}
