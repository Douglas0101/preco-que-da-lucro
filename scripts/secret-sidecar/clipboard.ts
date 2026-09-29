/**
 * Área de transferência: a **entrada** do caminho cego.
 *
 * O botão "copiar" de um console é o único lugar do fluxo em que um segredo toca o
 * ambiente do operador. Este módulo é a fronteira dessa entrada, e o desenho tem três
 * consequências deliberadas:
 *
 * 1. **`read()` nunca é especulativo.** Quem lê a área de transferência o faz porque um
 *    botão de copiar acabou de ser clicado — não para inspecionar o que o operador tem ali.
 *    A única exceção é o `--selftest`, que **preserva e restaura** (ver abaixo).
 * 2. **`wipe()` verifica.** Limpar sem conferir é uma promessa; conferir é uma medição. A
 *    conferência conta **bytes**, e o número de bytes pode aparecer numa mensagem de erro —
 *    o conteúdo, nunca. É o mesmo corte do resto do sidecar: comprimento é diagnóstico,
 *    valor é segredo.
 * 3. **A leitura é limitada no tempo.** Área de transferência que não responde **não** é
 *    área de transferência vazia. Tratar as duas como a mesma coisa faria a verificação da
 *    limpeza passar exatamente quando ela não conseguiu medir nada.
 *
 * **Preservação no autoteste.** `wl-copy --clear` e o equivalente X11 apagam o que o
 * operador tinha copiado. O `--selftest` por isso guarda o conteúdo atual **em memória**,
 * roda o ciclo escrever → ler → limpar → conferir, e **restaura** no `finally`. Nada é
 * persistido, nada é auditado, nada é impresso — mas o teste deixa a área de transferência
 * como a encontrou, que é a diferença entre testar e atrapalhar.
 */

import { execFile } from "node:child_process";

export type ClipboardFailure = "unavailable" | "failure" | "not-empty";

export class ClipboardError extends Error {
  readonly reason: ClipboardFailure;

  constructor(reason: ClipboardFailure, message: string) {
    super(message);
    this.name = "ClipboardError";
    this.reason = reason;
  }
}

export interface Clipboard {
  readonly kind: string;
  /** Lê o conteúdo. Vazio significa "nada ofertado", nunca "não consegui medir". */
  read(): Promise<Uint8Array>;
  write(bytes: Uint8Array): Promise<void>;
  /** Tipos MIME ofertados. Corrobora a limpeza sem transferir conteúdo. */
  types(): Promise<string[]>;
  /** Limpa **e confere**. Lança `not-empty` se ainda houver bytes. */
  wipe(): Promise<void>;
}

interface ToolRun {
  code: number;
  stdout: Buffer;
}

/** Orçamento de tempo de uma ferramenta de área de transferência. */
const TOOL_TIMEOUT_MS = 5_000;

function runTool(bin: string, args: string[], input?: Uint8Array): Promise<ToolRun> {
  return new Promise<ToolRun>((resolve, reject) => {
    execFile(
      bin,
      args,
      { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, timeout: TOOL_TIMEOUT_MS },
      (error, stdout) => {
        const errno = error as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        if (errno && errno.code === "ENOENT") {
          reject(
            new ClipboardError(
              "unavailable",
              `ferramenta de area de transferencia ausente: ${bin}`,
            ),
          );
          return;
        }
        if (errno && errno.killed) {
          reject(
            new ClipboardError(
              "failure",
              `${bin} nao respondeu em ${TOOL_TIMEOUT_MS}ms; area de transferencia nao medida`,
            ),
          );
          return;
        }
        const code = errno ? (typeof errno.code === "number" ? errno.code : 1) : 0;
        const bytes = Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout ?? ""), "utf8");
        resolve({ code, stdout: bytes });
      },
    ).stdin?.end(input === undefined ? undefined : Buffer.from(input));
  });
}

type Command = readonly [bin: string, args: string[]];

export class CommandClipboard implements Clipboard {
  readonly kind: string;
  private readonly readCommand: Command;
  private readonly writeCommand: Command;
  private readonly clearCommand: Command;
  private readonly listCommand: Command;

  constructor(
    kind: string,
    commands: {
      read: Command;
      write: Command;
      clear: Command;
      list: Command;
    },
  ) {
    this.kind = kind;
    this.readCommand = commands.read;
    this.writeCommand = commands.write;
    this.clearCommand = commands.clear;
    this.listCommand = commands.list;
  }

  /**
   * Saída vazia significa "nada ofertado" — as duas ferramentas sinalizam a seleção vazia
   * saindo com código != 0 e nada em stdout, e é por isso que o código de saída não é
   * promovido a erro aqui. Um travamento é outra coisa e já virou `failure` no `runTool`.
   */
  async read(): Promise<Uint8Array> {
    const result = await runTool(...this.readCommand);
    return new Uint8Array(result.stdout);
  }

  async write(bytes: Uint8Array): Promise<void> {
    await runTool(...this.writeCommand, bytes);
  }

  /** Lista de tipos ofertados. Não transfere conteúdo — é a sonda barata de "tem dono?". */
  async types(): Promise<string[]> {
    const result = await runTool(...this.listCommand);
    if (result.code !== 0) return [];
    return result.stdout
      .toString("utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  async wipe(): Promise<void> {
    await runTool(...this.clearCommand);
    const restante = await this.read();
    if (restante.length > 0) {
      throw new ClipboardError(
        "not-empty",
        `a area de transferencia ainda devolve ${restante.length} bytes apos a limpeza`,
      );
    }
  }
}

async function exists(bin: string, versionArgs: string[]): Promise<boolean> {
  try {
    await runTool(bin, versionArgs);
    return true;
  } catch (error) {
    if (error instanceof ClipboardError && error.reason === "unavailable") return false;
    // A ferramenta existe e recusou os argumentos: isso ainda é existir.
    return true;
  }
}

/**
 * Escolhe a ferramenta pela sessão, não por preferência: Wayland quando há
 * `WAYLAND_DISPLAY` e as ferramentas do wl-clipboard; X11 quando há `DISPLAY` e `xclip`.
 * Sem nenhuma das duas, o sidecar não adivinha — diz que não tem área de transferência.
 */
export async function detectClipboard(env: NodeJS.ProcessEnv = process.env): Promise<Clipboard> {
  if (env.WAYLAND_DISPLAY !== undefined && env.WAYLAND_DISPLAY !== "") {
    const [paste, copy] = [
      await exists("wl-paste", ["--version"]),
      await exists("wl-copy", ["--version"]),
    ];
    if (paste && copy) {
      return new CommandClipboard("wayland", {
        read: ["wl-paste", ["--no-newline"]],
        write: ["wl-copy", []],
        clear: ["wl-copy", ["--clear"]],
        list: ["wl-paste", ["--list-types"]],
      });
    }
  }
  if (env.DISPLAY !== undefined && env.DISPLAY !== "") {
    if (await exists("xclip", ["-version"])) {
      return new CommandClipboard("x11", {
        read: ["xclip", ["-selection", "clipboard", "-o"]],
        write: ["xclip", ["-selection", "clipboard", "-i"]],
        clear: ["xclip", ["-selection", "clipboard", "-i"]],
        list: ["xclip", ["-selection", "clipboard", "-o", "-t", "TARGETS"]],
      });
    }
  }
  throw new ClipboardError("unavailable", "nenhuma area de transferencia disponivel nesta sessao");
}
