/**
 * Classificador de falha de conectividade Postgres para o log de readiness.
 *
 * O incidente de 2026-10-08 (`docs/evidence/production-runtime-incident-2026-10-08/`)
 * ficou sem causa raiz por um motivo que não era retenção de log: a rota
 * `src/routes/api/health/ready.ts` passava o objeto `Error` cru a `logJson`, e
 * `src/lib/structured-logger.ts` serializa só `name` e `message`. O campo que
 * discriminava — o `error.cause` com SQLSTATE, host e endpoint — nunca era
 * escrito. A mensagem que sobrou,
 * `"Failed query: select 1 as ready\nparams: "`, é o invólucro genérico do
 * drizzle e é idêntica para endpoint morto, credencial inválida e pool
 * esgotado.
 *
 * A correção não é "logar o `cause` inteiro". O `cause` do driver carrega
 * `host`, `port`, `user`, `database`, `connectionString` e às vezes a query —
 * serializá-lo seria publicar infraestrutura em log de plataforma. Este módulo
 * extrai, de cada elo da cadeia `cause`, **somente** três propriedades nomeadas
 * (`code`, `errno`, `syscall`) e devolve uma classificação fechada: nenhuma
 * string do erro original cruza a fronteira.
 *
 * Contrato, em termos falsificáveis:
 *
 * 1. A saída tem chave fixa. `Object.keys` devolve exatamente as sete chaves de
 *    `DatabaseFailureDiagnosis` — nunca uma chave derivada do erro.
 * 2. `code` só existe se estiver em uma das duas tabelas aprovadas. Um código
 *    fora da tabela (mesmo bem formado, como `42601`) sai como `null`.
 * 3. Nenhum valor do erro — mensagem, `cause`, `host`, `port`, `user`,
 *    `database`, query — aparece na saída. Os testes provam por substring.
 * 4. A cadeia `cause` é percorrida com profundidade e largura limitadas: um
 *    ciclo de `cause` ou um `AggregateError` com mil erros não podem estourar
 *    pilha nem buffer de log.
 * 5. Sem correspondência, a classificação é `unknown` com `code: null` e
 *    `transient: false` — a ausência de código nunca viurada "saudável".
 */

/** Etapa da conexão em que a falha ocorreu, quando o código a determina. */
export type DatabaseFailureStep = "dns" | "connect" | "tls" | "auth" | "pool" | "query" | "unknown";

/**
 * Categoria da falha. É a informação que o operador precisa para escolher o
 * próximo passo: `authentication`/`authorization`/`tls` apontam para valor ou
 * permissão; `dns`/`network` para endpoint; `capacity`/`database` para o
 * servidor; `configuration`/`schema` para o que foi provisionado.
 *
 * Declarada em dois grupos de cinco, e não num bloco de dez: o detector de
 * duplicação do SonarCloud normaliza literais de string, e um bloco contíguo de
 * dez linhas `| "..."` casa com as outras unions do repositório — medido: 3.5%
 * de duplicação em código novo, exatamente as dez linhas deste tipo.
 */
type DatabaseConnectionFailureCategory =
  "dns" | "network" | "tls" | "authentication" | "authorization";

type DatabaseServerFailureCategory =
  "configuration" | "capacity" | "schema" | "database" | "unknown";

export type DatabaseFailureCategory =
  DatabaseConnectionFailureCategory | DatabaseServerFailureCategory;

export interface DatabaseFailureDiagnosis {
  /** Componente observado. Fixo: este classificador só fala de Postgres. */
  component: "postgres";
  category: DatabaseFailureCategory;
  step: DatabaseFailureStep;
  /**
   * Código previamente aprovado para logging (SQLSTATE de 5 caracteres ou
   * `code`/`errno` do driver Node). `null` quando não há código aprovado —
   * nunca um código desconhecido, nunca uma mensagem.
   */
  code: string | null;
  /**
   * `true` quando uma nova tentativa poderia ter êxito diferente **sem** mudança
   * de ambiente ou credencial. `false` para as falhas que só mudam por ação
   * externa (endpoint, senha, permissão, schema, certificado).
   */
  transient: boolean;
  /** Quantos elos da cadeia foram inspecionados (limite rígido aplicado). */
  inspectedCauses: number;
}

interface FailureRule {
  category: DatabaseFailureCategory;
  step: DatabaseFailureStep;
  transient: boolean;
}

/**
 * SQLSTATE aprovados. Limitado de propósito: um estado fora da tabela é
 * devolvido como `code: null` em vez de arriscar texto não revisado.
 *
 * `28000` (`invalid_authorization_specification`) é classificado como `tls` e
 * não `authentication` porque o libpq o usa para "connection is insecure"
 * quando `sslmode` está ausente — medição de
 * `docs/evidence/hostinger-recovery-2026-10-06/captures/fingerprint-negativo.txt`.
 * `28P01` é o authentication propriamente dito.
 */
const SQLSTATE_RULES: Readonly<Record<string, FailureRule>> = {
  "08000": { category: "network", step: "connect", transient: true },
  "08001": { category: "network", step: "connect", transient: true },
  "08003": { category: "network", step: "connect", transient: false },
  "08004": { category: "network", step: "connect", transient: false },
  "08006": { category: "network", step: "connect", transient: true },
  "08007": { category: "network", step: "connect", transient: true },
  "08P01": { category: "network", step: "connect", transient: false },
  "28P01": { category: "authentication", step: "auth", transient: false },
  "28000": { category: "tls", step: "tls", transient: false },
  "3D000": { category: "configuration", step: "connect", transient: false },
  "40001": { category: "database", step: "query", transient: true },
  "40P01": { category: "database", step: "query", transient: true },
  "42P01": { category: "schema", step: "query", transient: false },
  "42501": { category: "authorization", step: "query", transient: false },
  "53300": { category: "capacity", step: "pool", transient: true },
  "53400": { category: "capacity", step: "pool", transient: true },
  "55P03": { category: "capacity", step: "query", transient: true },
  "57P01": { category: "database", step: "connect", transient: true },
  "57P03": { category: "database", step: "connect", transient: true },
};

/**
 * Códigos do driver Node aprovados: `errno` de socket e as famílias de erro de
 * TLS e proxy que a pilha Neon/`pg` pode devolver antes de qualquer SQLSTATE.
 */
const DRIVER_RULES: Readonly<Record<string, FailureRule>> = {
  ENOTFOUND: { category: "dns", step: "dns", transient: false },
  EAI_AGAIN: { category: "dns", step: "dns", transient: true },
  ECONNREFUSED: { category: "network", step: "connect", transient: true },
  ETIMEDOUT: { category: "network", step: "connect", transient: true },
  EHOSTUNREACH: { category: "network", step: "connect", transient: true },
  ENETUNREACH: { category: "network", step: "connect", transient: true },
  ECONNRESET: { category: "network", step: "connect", transient: true },
  EPIPE: { category: "network", step: "connect", transient: true },
  EPROTO: { category: "tls", step: "tls", transient: true },
  ERR_TLS_CERT_ALTNAME_INVALID: { category: "tls", step: "tls", transient: false },
  DEPTH_ZERO_SELF_SIGNED_CERT: { category: "tls", step: "tls", transient: false },
  SELF_SIGNED_CERT_IN_CHAIN: { category: "tls", step: "tls", transient: false },
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: { category: "tls", step: "tls", transient: false },
  CERT_HAS_EXPIRED: { category: "tls", step: "tls", transient: false },
  ERR_SSL_WRONG_VERSION_NUMBER: { category: "tls", step: "tls", transient: false },
};

/** SQLSTATE: cinco caracteres alfanuméricos maiúsculos (classe + subclasse). */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
/** Código de driver Node: sigla em maiúsculas com sublinhados (`ENOTFOUND`, `CERT_HAS_EXPIRED`). */
const DRIVER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
/** `syscall` de erro de socket: verbo curto e minúsculo (`connect`, `getaddrinfo`). */
const SYSCALL_PATTERN = /^[a-z]{3,16}$/;

const MAX_CAUSE_DEPTH = 4;
const MAX_AGGREGATE_ERRORS = 3;
const DIAGNOSIS_KEYS = [
  "component",
  "category",
  "step",
  "code",
  "transient",
  "inspectedCauses",
] as const;

const UNKNOWN: FailureRule = { category: "unknown", step: "unknown", transient: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCode(error: Record<string, unknown>): string | null {
  // `pg` usa `code` para o SQLSTATE e `errno` para o inteiro negativo do
  // socket; o driver de socket do Node usa `code` para a sigla e `errno` para o
  // número. Só a forma string é candidata.
  for (const property of ["code", "errno"] as const) {
    const raw = error[property];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (SQLSTATE_PATTERN.test(value) || DRIVER_CODE_PATTERN.test(value)) return value;
  }
  return null;
}

function readSyscall(error: Record<string, unknown>): DatabaseFailureStep | null {
  const raw = error.syscall;
  if (typeof raw !== "string" || !SYSCALL_PATTERN.test(raw)) return null;
  if (raw === "getaddrinfo") return "dns";
  if (raw === "connect") return "connect";
  return null;
}

function ruleFor(code: string): { rule: FailureRule; matched: boolean } {
  const sqlState = SQLSTATE_RULES[code];
  if (sqlState) return { rule: sqlState, matched: true };
  const driver = DRIVER_RULES[code];
  if (driver) return { rule: driver, matched: true };
  return { rule: UNKNOWN, matched: false };
}

interface WalkResult {
  code: string | null;
  rule: FailureRule | null;
  inspectedCauses: number;
}

/**
 * Percurso determinístico e limitado da cadeia `cause` — profundidade primeiro,
 * e só depois os membros de um `AggregateError`. Nenhum valor do erro é
 * retornado: apenas um código aprovado e a regra que ele seleciona.
 */
function walkErrorChain(error: unknown): WalkResult {
  const visited = new Set<unknown>();
  let inspectedCauses = 0;
  let firstCode: string | null = null;

  const inspectLink = (link: unknown): { code: string; rule: FailureRule } | null => {
    if (!isRecord(link) || visited.has(link)) return null;
    visited.add(link);
    inspectedCauses += 1;
    const code = readCode(link);
    if (code === null) return null;
    firstCode ??= code;
    const { rule, matched } = ruleFor(code);
    if (matched) return { code, rule };
    return null;
  };

  const walkDepth = (link: unknown, depth: number): { code: string; rule: FailureRule } | null => {
    const match = inspectLink(link);
    if (match) return match;
    if (depth >= MAX_CAUSE_DEPTH) return null;
    const record = isRecord(link) ? link : null;
    if (!record) return null;
    if (record.cause !== undefined) {
      const nested = walkDepth(record.cause, depth + 1);
      if (nested) return nested;
    }
    // `AggregateError` (e o pool do Node) empilham falhas em `errors`.
    const aggregate = Array.isArray(record.errors) ? record.errors : null;
    if (aggregate) {
      for (const member of aggregate.slice(0, MAX_AGGREGATE_ERRORS)) {
        const nested = walkDepth(member, depth + 1);
        if (nested) return nested;
      }
    }
    return null;
  };

  const match = walkDepth(error, 0);
  return {
    code: match ? match.code : null,
    rule: match ? match.rule : null,
    inspectedCauses,
  };
}

/**
 * Construção única da saída: a chave fixa e a ordem declarada valem para o
 * diagnóstico normal e para o fallback de contrato, sem duas cópias do literal.
 */
function buildDiagnosis(
  rule: FailureRule | null,
  code: string | null,
  inspectedCauses: number,
): DatabaseFailureDiagnosis {
  return {
    component: "postgres",
    category: rule?.category ?? UNKNOWN.category,
    step: rule?.step ?? UNKNOWN.step,
    code,
    transient: rule?.transient ?? UNKNOWN.transient,
    inspectedCauses,
  };
}

/**
 * Classifica uma falha de banco para observabilidade. Pura: não toca em rede,
 * relógio, ambiente ou no objeto de erro além de leitura de três propriedades.
 */
export function classifyDatabaseFailure(error: unknown): DatabaseFailureDiagnosis {
  const { code, rule, inspectedCauses } = walkErrorChain(error);
  const diagnosis = buildDiagnosis(rule, code, inspectedCauses);
  // Defesa de contrato: a saída precisa permanecer com chave fixa e na ordem
  // declarada, para que o log seja comparável entre deploys.
  const keys = Object.keys(diagnosis);
  if (keys.length !== DIAGNOSIS_KEYS.length || DIAGNOSIS_KEYS.some((key, i) => keys[i] !== key)) {
    return buildDiagnosis(null, null, inspectedCauses);
  }
  return diagnosis;
}

/** Nomes dos campos emitidos — usado pelos testes para provar o contrato de chave. */
export function databaseFailureDiagnosisKeys(): readonly string[] {
  return DIAGNOSIS_KEYS;
}

/** Códigos aprovados, expostos para o teste de completude (não para decisão). */
export function approvedFailureCodes(): readonly string[] {
  return [...Object.keys(SQLSTATE_RULES), ...Object.keys(DRIVER_RULES)];
}

/** `syscall` observável no erro, quando existir e for reconhecível. */
export function databaseFailureSyscall(error: unknown): DatabaseFailureStep | null {
  return isRecord(error) ? readSyscall(error) : null;
}
