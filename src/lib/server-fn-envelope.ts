import { ApplicationError, type ApiErrorCode } from "@/lib/api-error";

/**
 * Client-side guard for TanStack Start server-function results (DBT-86).
 *
 * `apiErrorResponse` answers failures with a raw JSON body
 * `{ ok: false, error: ApiError }` and no `x-tss-serialized` header. O fetcher
 * do Start pode devolver ora esse JSON, ora o **`Response` cru** (medido em
 * 2026-10-25 para o 401 de `requireDatabaseAuth`); sem normalizar, o `ok:false`
 * do `Response` era confundido com envelope e virava `INTERNAL_ERROR/500`,
 * escondendo a sessão expirada atrás do card “não foi possível carregar”.
 * Também cobre o envelope JSON direto e impede que 401/403/400/409/429/5xx
 * cheguem ao React Query como *success data* (DBT-86 / ciclo-28).
 *
 * Every client call site of a server function must funnel through
 * `unwrapServerFn`/`unwrapServerFnResult`; success payloads are returned
 * untouched (the application never uses `{ ok: true }` envelopes on the wire).
 */

interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
  retryable?: unknown;
  correlationId?: unknown;
}

interface FailureEnvelope {
  ok: false;
  error: ApiErrorBody;
}

/** Mapa HTTP → código de domínio usado quando o corpo não é um envelope. */
const HTTP_STATUS_ERROR_CODES: Partial<Record<number, ApiErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "AUTHENTICATION_ERROR",
  403: "AUTHORIZATION_ERROR",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMIT",
  503: "DEPENDENCY_ERROR",
};

function isResponse(value: unknown): value is Response {
  return typeof Response !== "undefined" && value instanceof Response;
}

function errorCodeFromStatus(status: number): ApiErrorCode {
  return HTTP_STATUS_ERROR_CODES[status] ?? "INTERNAL_ERROR";
}

function correlationIdFromResponse(response: Response): string {
  return response.headers.get("x-correlation-id") ?? "UNKNOWN";
}

function isFailureEnvelope(value: unknown): value is FailureEnvelope {
  // `Response.ok === false` NÃO é envelope: sem esta exclusão o 401/500 cru do
  // fetcher era lido como `{ ok: false }` sem `error` e virava INTERNAL_ERROR.
  if (isResponse(value)) return false;
  // ok:false is always a failure on the wire — even malformed envelopes
  // (missing/malformed error field) must throw, never pass through as data.
  return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === false;
}

/** Typed error for an `ok:false` envelope, preserving code and correlation id. */
export class ServerFnEnvelopeError extends ApplicationError {
  readonly correlationId: string;

  constructor(error: ApiErrorBody | undefined) {
    const body: ApiErrorBody = typeof error === "object" && error !== null ? error : {};
    const code = typeof body.code === "string" ? body.code : "INTERNAL_ERROR";
    const message = typeof body.message === "string" ? body.message : undefined;
    super(code as ApiErrorCode, { message });
    this.name = "ServerFnEnvelopeError";
    this.correlationId = typeof body.correlationId === "string" ? body.correlationId : "UNKNOWN";
  }
}

export function unwrapServerFnResult<T>(result: unknown): T {
  if (isResponse(result)) {
    // Corpo não é lido aqui: status + `x-correlation-id` são a identidade
    // autoritativa da falha (o mesmo id do log), e 401/403/429/5xx já têm
    // código de domínio definido. Sem `try/catch` de parse o guard não pode
    // engolir erro (INV-013).
    throw new ServerFnEnvelopeError({
      code: errorCodeFromStatus(result.status),
      correlationId: correlationIdFromResponse(result),
    });
  }
  if (isFailureEnvelope(result)) throw new ServerFnEnvelopeError(result.error);
  return result as T;
}

/** Promise-flavored wrapper so call sites keep their inferred types. */
export function unwrapServerFn<T>(promise: Promise<T>): Promise<T> {
  return promise.then((value: T) => unwrapServerFnResult<T>(value));
}

function statusOf(error: unknown): number | undefined {
  if (isResponse(error)) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const value = (error as { status?: unknown }).status;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof ServerFnEnvelopeError) {
    return error.code === "AUTHENTICATION_ERROR" || error.status === 401;
  }
  if (statusOf(error) === 401) return true;
  // O wrapper de middleware do Start, em certas respostas JSON cruas, lança o
  // `ApiError` interno (sem `status`) em vez do Response/ServerFnEnvelopeError.
  // Reconhecer o código explícito mantém o redirect de sessão expirada.
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "AUTHENTICATION_ERROR"
  );
}
