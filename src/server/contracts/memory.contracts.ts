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
  /** Proveniência primária (§15.4). Opcional porque o `MemoryRecordInput` a tem
   * opcional: quando a policy não exige proveniência, o registro é gravado sem
   * fonte e não há o que devolver. A decisão C do STEWARD materializa a
   * proveniência 1:N em `ai_memory_sources`; o read model expõe a fonte mais
   * antiga e o `sourceId` deixa de ser o identificador da origem. */
  provenance?: MemoryProvenance;
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

/** Sinal de duplicidade do append (§15.6/D3, SD-C3-7 — mesma forma de
 * `AppendEventResult.duplicate`): `duplicated: true` significa que a chave de
 * dedup já identificava uma memória **ativa** do tenant e **nada** foi gravado
 * (nem memória, nem fonte, nem versão). */
export interface MemoryAppendResult {
  record: MemoryRecord;
  duplicated: boolean;
}

/** Entrada de revisão (§15.6/D3, SD-C3-4): `scope`, tenant e autoria são do
 * registro revisado — a revisão só altera conteúdo/importância/proveniência e
 * arquiva o estado substituído. */
export interface MemoryRevisionInput {
  content: string;
  importance?: number;
  provenance?: MemoryProvenance;
}

/** Versão arquivada (§15.6/D3, SD-C3-3): o estado que a revisão substituiu.
 * `superseded` é **derivado** (não existe coluna nem UPDATE): o head
 * (`ai_memories`) é a versão corrente da memória, então uma versão arquivada
 * sempre tem sucessor — a marcação é do head, não da linha. */
export interface MemoryVersionRecord {
  id: string;
  memoryId: string;
  /** Índice do estado arquivado na memória (1, 2, …). */
  version: number;
  content: string;
  dedupKey: string;
  createdAt: Date;
  superseded: boolean;
}

/** Ciclo de vida do conflito (§15.6/D3, SD-C3-6); quem resolve é o serviço
 * (D4+), nunca o repositório. */
export type MemoryConflictStatus = "open" | "dismissed" | "resolved";

/** Conflito registrado (§15.6/D3, SD-C3-5): o candidato contraditório do mesmo
 * escopo. O registro **não** toca a memória ativa. */
export interface MemoryConflictRecord {
  id: string;
  memoryId: string;
  candidateContent: string;
  candidateDedupKey: string;
  status: MemoryConflictStatus;
  detectedAt: Date;
  resolvedAt?: Date | null;
}

export interface MemoryConflictFilter {
  status?: MemoryConflictStatus;
  memoryId?: string;
}

/** Expurgo (§15.6/D3, SD-C3-9): sem `purgeHistory`, o `delete` do D2 **recusa**
 * (devolve `false`, sem erro) memória com histórico ou conflito registrado; a
 * eliminação completa é este caminho explícito. */
export interface MemoryDeleteOptions {
  purgeHistory: boolean;
}

export interface MemoryRepositoryPort {
  append(
    context: RequestContext,
    input: MemoryRecordInput,
    executor?: Executor,
  ): Promise<MemoryAppendResult>;
  /** Revisão do head (§15.6/D3): arquiva a versão substituída e atualiza a
   * memória no lugar. Não julga contradição semântica (SD-C3-5). */
  revise(
    context: RequestContext,
    memoryId: string,
    revision: MemoryRevisionInput,
    executor?: Executor,
  ): Promise<MemoryRecord>;
  search(
    context: RequestContext,
    query: MemorySearchQuery,
    executor?: Executor,
  ): Promise<readonly MemoryRecord[]>;
  listVersions(
    context: RequestContext,
    memoryId: string,
    executor?: Executor,
  ): Promise<readonly MemoryVersionRecord[]>;
  recordConflict(
    context: RequestContext,
    memoryId: string,
    candidate: MemoryCandidate,
    executor?: Executor,
  ): Promise<MemoryConflictRecord>;
  listConflicts(
    context: RequestContext,
    filter?: MemoryConflictFilter,
    executor?: Executor,
  ): Promise<readonly MemoryConflictRecord[]>;
  delete(
    context: RequestContext,
    id: string,
    options?: MemoryDeleteOptions,
    executor?: Executor,
  ): Promise<boolean>;
}
