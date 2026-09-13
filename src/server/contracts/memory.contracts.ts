/**
 * PLANNED — alvo M-05 (memória persistente).
 *
 * Contratos mínimos somente-tipo derivados da ordem do plano §15: o modelo
 * propõe candidato e o backend decide (policy) antes de persistir. Sem runtime:
 * nenhum valor, nenhum import de `@/db` ou `drizzle-orm`. A implementação segue
 * gated em M-05 (matriz M-02 mantém `MemoryService`/`MemoryRepository` como
 * `contract-only`).
 */
import type { RequestContext } from "@/lib/request-context";
import type { Executor } from "./event.contracts";

export type MemoryScope = "tenant" | "user" | "conversation";

export type MemorySourceKind = "user" | "tool" | "model" | "import";

/** Proveniência §15.4: quem disse, onde, quando, se foi inferida e com que
 * confiança. */
export interface MemoryProvenance {
  sourceKind: MemorySourceKind;
  sourceId: string;
  conversationId?: string;
  capturedAt: Date;
  inferred: boolean;
  confidence: number;
}

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  content: string;
  provenance: MemoryProvenance;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Política §15.3: limites decididos pelo backend antes de qualquer persistência
 * ou retrieval (ranking §15.7 exige tenant, scope, recência, importância e
 * confiança). */
export interface MemoryPolicy {
  allowedScopes: readonly MemoryScope[];
  minConfidence: number;
  requireProvenance: boolean;
  maxContentLength: number;
  maxResults: number;
}

export interface MemoryRecordInput {
  scope: MemoryScope;
  content: string;
  provenance: MemoryProvenance;
  importance?: number;
}

export interface MemorySearchQuery {
  text: string;
  scopes?: readonly MemoryScope[];
  limit?: number;
}

export interface MemoryRepositoryPort {
  append(
    context: RequestContext,
    input: MemoryRecordInput,
    executor?: Executor,
  ): Promise<MemoryRecord>;
  search(
    context: RequestContext,
    query: MemorySearchQuery,
    executor?: Executor,
  ): Promise<readonly MemoryRecord[]>;
  delete(context: RequestContext, id: string, executor?: Executor): Promise<boolean>;
}
