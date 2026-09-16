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
  /** Ciclo de vida (§15.6/D3): só `active` entra em retrieval; versão substituída
   * permanece no histórico imutável. */
  status: MemoryStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Derivado de `MemoryPolicy.retention` na gravação; `null` = sem expiração. */
  expiresAt?: Date | null;
}

/** Ciclo de vida de uma memória (§15.6/D3). */
export type MemoryStatus = "active" | "superseded";

/** Retenção §23.2: TTL por camada, decidido pela policy. */
export interface MemoryRetention {
  /** Segundos até a expiração; `null` = retenção indefinida. */
  readonly ttlSeconds: number | null;
}

/** Pesos do ranking §15.7 (recência/importância/confiança). Vivem na policy:
 * o chamador nunca escolhe peso nem amplia limite. */
export interface MemoryRankingWeights {
  readonly recency: number;
  readonly importance: number;
  readonly confidence: number;
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
  /** Ampliação D1 (aditiva) — consumida pelo write path (D2/D3) e pelo ranking (D6). */
  retention: MemoryRetention;
  ranking: MemoryRankingWeights;
}

/** Candidato proposto (pelo modelo, por tool ou pelo usuário) antes da decisão da
 * policy: a proveniência é opcional no candidato porque `requireProvenance` é
 * quem a exige. */
export interface MemoryCandidate {
  scope: MemoryScope;
  content: string;
  provenance?: MemoryProvenance;
  importance?: number;
}

/** Port de persistência: mesmo formato do candidato aprovado (§5-C do gap report —
 * `sourceId` deixa de ser polimórfico e a proveniência passa a 1:N na tabela). */
export type MemoryRecordInput = MemoryCandidate;

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
