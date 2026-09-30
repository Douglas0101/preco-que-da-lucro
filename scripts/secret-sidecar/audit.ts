/**
 * Audit log do sidecar: append-only, e **nunca** um valor de segredo.
 *
 * O que este arquivo pode registrar sobre um segredo é um derivado que não permite
 * reconstruí-lo: o `sha256`. É o mesmo princípio do §2.4 do brief do Ciclo 14 (o trace
 * referencia hash, não a imagem) aplicado ao cofre — o registro aponta para o valor sem
 * carregá-lo, e é isso que permite auditar uma rotação sem transformar o log em segredo.
 *
 * Formato de cada linha (JSONL, uma por operação):
 *
 * ```json
 * {"ts":"…","op":"generate","ref":"vercel_token","sha256":"…","outcome":"ok","audit_id":"…"}
 * ```
 *
 * **Extensões declaradas** ao formato do brief: `backend` (qual cofre atendeu) e `detail`
 * (escalares por operação, como `http_status` e `latency_ms`). O brief lista seis campos;
 * estes dois são acréscimos e estão nomeados aqui para que a diferença seja lida como
 * decisão, não como descuido. `detail` é restrito a escalares `string | number` de
 * propósito: não há caminho por onde um blob entre nele.
 */

import { createHash, randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export const AUDIT_OPS = [
  "generate",
  "capture",
  "copy_out",
  "inject_env",
  "test_endpoint",
  "denylist",
  "restore",
  "delete",
  "list",
  "health",
  "selftest",
] as const;

export type AuditOp = (typeof AUDIT_OPS)[number];

/**
 * `precondicao` é distinto de `fail` pela mesma razão que o exit `2` é distinto do `1` nas
 * guardas do repositório: "o ambiente não permite medir" não é "a operação deu errado", e
 * confundir os dois faz um relatório culpado pelo clima.
 *
 * `recusado` é uma terceira coisa ainda: a operação **poderia** ter sido feita e foi
 * barrada por política — host fora da allowlist, confirmação ausente. Somar isso a `fail`
 * esconderia a única categoria que se sabe ter sido recusa deliberada, e é justamente a
 * que se quer poder contar.
 */
export type AuditOutcome = "ok" | "fail" | "precondicao" | "recusado";

export interface AuditRecord {
  readonly ts: string;
  readonly op: AuditOp;
  readonly ref: string;
  readonly sha256: string;
  readonly outcome: AuditOutcome;
  readonly audit_id: string;
  readonly backend?: string;
  readonly detail?: Record<string, string | number>;
}

/** Identificador de correlação. Aleatório, nunca derivado do segredo. */
export function auditIdentifier(): string {
  return randomBytes(8).toString("hex");
}

/**
 * O único derivado do valor que pode sair do sidecar. Também é o critério do teste de
 * contenção: o teste escreve um segredo fictício e procura por ele — e por este hash — no
 * audit; o valor não pode aparecer, o hash pode e deve.
 */
export function hashOf(secret: Uint8Array): string {
  return createHash("sha256").update(secret).digest("hex");
}

export interface AuditRead {
  readonly records: AuditRecord[];
  readonly linhas: number;
  readonly malformadas: number;
}

export class AuditLog {
  readonly file: string;

  constructor(file: string) {
    this.file = file;
  }

  /** Acrescenta uma linha. Nunca trunca: a única operação de escrita é o append. */
  async append(record: AuditRecord): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    await appendFile(this.file, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  /**
   * Lê o log inteiro. Linha malformada **não** é engolida em silêncio: ela é contada, e o
   * comando `verify` a trata como defeito. Um audit que "lê tudo" escondendo o que não
   * entendeu não serve para auditar.
   */
  async read(): Promise<AuditRead> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { records: [], linhas: 0, malformadas: 0 };
      }
      throw error;
    }
    const records: AuditRecord[] = [];
    let malformadas = 0;
    const linhas = raw.split("\n").filter((line) => line.trim() !== "");
    for (const line of linhas) {
      try {
        const parsed = JSON.parse(line) as AuditRecord;
        if (typeof parsed.op !== "string" || typeof parsed.audit_id !== "string") {
          malformadas += 1;
          continue;
        }
        records.push(parsed);
      } catch {
        malformadas += 1;
      }
    }
    return { records, linhas: linhas.length, malformadas };
  }
}

/**
 * Monta o registro com os seis campos do formato do brief, mais as extensões declaradas.
 * Centralizar a construção aqui é o que impede um chamador de inventar um campo — e um
 * campo inventado é exatamente por onde um valor entraria.
 */
export function auditRecord(input: {
  op: AuditOp;
  ref: string;
  sha256?: string;
  outcome: AuditOutcome;
  backend?: string;
  detail?: Record<string, string | number>;
}): AuditRecord {
  const record: AuditRecord = {
    ts: new Date().toISOString(),
    op: input.op,
    ref: input.ref,
    sha256: input.sha256 ?? SEM_VALOR,
    outcome: input.outcome,
    audit_id: auditIdentifier(),
  };
  return {
    ...record,
    ...(input.backend === undefined ? {} : { backend: input.backend }),
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };
}

/** Marca de operação que não tocou valor nenhum — não é hash, e não finge ser. */
export const SEM_VALOR = "sem-valor";
