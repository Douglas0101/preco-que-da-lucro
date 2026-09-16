/**
 * §43/§15.2/§15.4 — persistência da memória (degrau D2).
 *
 * Implementa `MemoryRepositoryPort` com `Executor = context.transaction` por
 * padrão, no mesmo formato de `outbox.repository.ts`: a memória entra na
 * transação corrente, então um rollback do efeito de domínio não deixa memória
 * órfã (e vice-versa). A decisão B do STEWARD vale aqui — o append **não**
 * escreve evento no outbox: hoje não há consumidor de eventos de memória.
 *
 * Toda leitura e escrita carrega o predicado explícito de `tenant_id` **e** o
 * `user_id` do contexto; a RLS `tenant_isolation` é a segunda barreira
 * (fail-closed), não a primeira (§15.8). Nenhum SQL é montado por concatenação
 * (INV-003): o filtro textual é um `position(...)` parametrizado, e a
 * representação lexical (FTS/GIN) é D5.
 *
 * A proveniência é 1:N em `ai_memory_sources` (decisão C): o append grava uma
 * linha por origem declarada e o read model reconstrói a `MemoryProvenance` da
 * fonte mais antiga. Quando o produtor não gravou o rótulo opaco (`source_ref`
 * nulo), o `sourceId` derivado é o id da própria linha de fonte — identificador
 * durável e verificável, em vez de string sintética.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { aiMemories, aiMemorySources } from "@/db/schema";
import { ApplicationError } from "@/lib/api-error";
import type { RequestContext } from "@/lib/request-context";
import type { Executor } from "@/server/contracts/event.contracts";
import type {
  MemoryProvenance,
  MemoryRecord,
  MemoryRecordInput,
  MemoryRepositoryPort,
  MemoryScope,
  MemorySearchQuery,
  MemorySourceKind,
  MemoryStatus,
} from "@/server/contracts/memory.contracts";

/** Teto de retrieval do D2. O teto **efetivo** é `policy.maxResults`
 * (`resolveMemoryResultLimit`); este é o limite quando o chamador não pede um. */
const DEFAULT_SEARCH_LIMIT = 20;
/** Guarda de sanidade do port: `query.limit` não pode virar varredura sem fim. */
const MAX_SEARCH_LIMIT = 100;

type MemoryRow = typeof aiMemories.$inferSelect;
type MemorySourceRow = typeof aiMemorySources.$inferSelect;

const SCOPE_BY_VALUE: Record<string, MemoryScope | undefined> = {
  tenant: "tenant",
  user: "user",
  conversation: "conversation",
};
const SOURCE_KIND_BY_VALUE: Record<string, MemorySourceKind | undefined> = {
  user: "user",
  tool: "tool",
  model: "model",
  import: "import",
};
const STATUS_BY_VALUE: Record<string, MemoryStatus | undefined> = {
  active: "active",
  superseded: "superseded",
};

/** O `text` das tabelas é aberto no banco (o CHECK é a fronteira real); estes
 * conversores só traduzem o valor verificado para o tipo do contrato. */
function asScope(value: string): MemoryScope {
  const scope = SCOPE_BY_VALUE[value];
  if (scope === undefined)
    throw new ApplicationError("DATABASE_ERROR", {
      message: `scope inválido persistido em ai_memories: ${value}`,
    });
  return scope;
}

function asStatus(value: string): MemoryStatus {
  const status = STATUS_BY_VALUE[value];
  if (status === undefined)
    throw new ApplicationError("DATABASE_ERROR", {
      message: `status inválido persistido em ai_memories: ${value}`,
    });
  return status;
}

function asSourceKind(value: string): MemorySourceKind {
  const kind = SOURCE_KIND_BY_VALUE[value];
  if (kind === undefined) {
    throw new ApplicationError("DATABASE_ERROR", {
      message: `source_kind inválido persistido em ai_memory_sources: ${value}`,
    });
  }
  return kind;
}

function toProvenance(source: MemorySourceRow): MemoryProvenance {
  return {
    sourceKind: asSourceKind(source.sourceKind),
    sourceId: source.sourceRef ?? source.id,
    conversationId: source.conversationId ?? undefined,
    capturedAt: source.capturedAt,
    inferred: source.inferred,
    confidence: source.confidence,
  };
}

function toRecord(row: MemoryRow, source: MemorySourceRow | undefined): MemoryRecord {
  return {
    id: row.id,
    scope: asScope(row.scope),
    content: row.content,
    provenance: source ? toProvenance(source) : undefined,
    importance: row.importance,
    status: asStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Limite efetivo do lote: pedido inválido não vira `limit` implícito nem
 * varredura — falha alto, como o contrato (`resolveMemoryResultLimit`). */
function resolveLimit(requested: number | undefined): number {
  if (requested === undefined) return DEFAULT_SEARCH_LIMIT;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new ApplicationError("VALIDATION_ERROR", {
      message: `limite de busca inválido: ${requested}`,
    });
  }
  return Math.min(requested, MAX_SEARCH_LIMIT);
}

export class DrizzleMemoryRepository implements MemoryRepositoryPort {
  /**
   * Grava a memória e suas fontes no executor recebido. Os dois INSERTs usam a
   * MESMA transação: a memória nunca fica commitada sem as fontes que a
   * justificam, e o tenant do GUC da transação é o único aceito pela policy
   * (`WITH CHECK`).
   */
  async append(
    context: RequestContext,
    input: MemoryRecordInput,
    executor: Executor = context.transaction,
  ): Promise<MemoryRecord> {
    const inserted = await executor
      .insert(aiMemories)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        scope: input.scope,
        content: input.content,
        importance: input.importance ?? 0,
        confidence: input.provenance?.confidence ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) throw new ApplicationError("DATABASE_ERROR");

    const provenance = input.provenance;
    if (!provenance) return toRecord(row, undefined);

    const sources = await executor
      .insert(aiMemorySources)
      .values({
        tenantId: context.tenantId,
        memoryId: row.id,
        sourceKind: provenance.sourceKind,
        sourceRef: provenance.sourceId,
        conversationId: provenance.conversationId ?? null,
        userId: context.userId,
        inferred: provenance.inferred,
        confidence: provenance.confidence,
        capturedAt: provenance.capturedAt,
      })
      .returning();
    const source = sources[0];
    if (!source) throw new ApplicationError("DATABASE_ERROR");

    return toRecord(row, source);
  }

  /**
   * Retrieval do tenant corrente: só `active`, com o filtro textual aplicado por
   * substring parametrizada (`position(lower($n) in lower(content))`), sem
   * wildcard interpretável e sem concatenação de SQL. Ordenação determinística
   * por (`created_at` desc, `id`) — a composição de score §15.7 é D6.
   */
  async search(
    context: RequestContext,
    query: MemorySearchQuery,
    executor: Executor = context.transaction,
  ): Promise<readonly MemoryRecord[]> {
    const limit = resolveLimit(query.limit);
    const text = query.text.normalize("NFC").trim();
    const scopes = query.scopes ?? [];

    const rows = await executor
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.tenantId, context.tenantId),
          eq(aiMemories.status, "active"),
          scopes.length > 0 ? inArray(aiMemories.scope, [...scopes]) : undefined,
          text === ""
            ? undefined
            : sql`position(lower(${text}) in lower(${aiMemories.content})) > 0`,
        ),
      )
      .orderBy(desc(aiMemories.createdAt), asc(aiMemories.id))
      .limit(limit);
    if (rows.length === 0) return [];

    const sources = await executor
      .select()
      .from(aiMemorySources)
      .where(
        and(
          eq(aiMemorySources.tenantId, context.tenantId),
          inArray(
            aiMemorySources.memoryId,
            rows.map((row) => row.id),
          ),
        ),
      )
      .orderBy(asc(aiMemorySources.capturedAt), asc(aiMemorySources.id));

    const primary = new Map<string, MemorySourceRow>();
    for (const source of sources) {
      if (!primary.has(source.memoryId)) primary.set(source.memoryId, source);
    }

    return rows.map((row) => toRecord(row, primary.get(row.id)));
  }

  /**
   * §43 — delete: apaga a memória do tenant corrente e devolve `true` só quando
   * uma linha foi removida. Id inexistente (ou de outro tenant, invisível por
   * RLS) devolve `false` sem erro, como o contrato manda. As fontes caem por
   * `ON DELETE cascade`, na mesma transação.
   */
  async delete(
    context: RequestContext,
    id: string,
    executor: Executor = context.transaction,
  ): Promise<boolean> {
    const deleted = await executor
      .delete(aiMemories)
      .where(and(eq(aiMemories.tenantId, context.tenantId), eq(aiMemories.id, id)))
      .returning({ id: aiMemories.id });
    return deleted.length === 1;
  }
}

/** Instância de aplicação: D3/D4 consomem esta porta. */
export const memoryRepository = new DrizzleMemoryRepository();
