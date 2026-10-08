import { ApplicationError, type ApiErrorCode } from "@/lib/api-error";

/**
 * Client-side guard for TanStack Start server-function results (DBT-86).
 *
 * `apiErrorResponse` answers failures with a raw JSON body
 * `{ ok: false, error: ApiError }` and no `x-tss-serialized` header; in that
 * shape the framework fetcher resolves the body instead of throwing
 * (`start-client-core/serverFnFetcher.ts` only re-throws errors that went
 * through its own serialization protocol). Without this guard every
 * 401/403/400/409/429/5xx from any server function reaches React Query as
 * *success data* — the cached-envelope dashboard crash of ciclo-28.
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

function isFailureEnvelope(value: unknown): value is FailureEnvelope {
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
  if (isFailureEnvelope(result)) throw new ServerFnEnvelopeError(result.error);
  return result as T;
}

/** Promise-flavored wrapper so call sites keep their inferred types. */
export function unwrapServerFn<T>(promise: Promise<T>): Promise<T> {
  return promise.then((value: T) => unwrapServerFnResult<T>(value));
}

export function isAuthenticationError(error: unknown): error is ServerFnEnvelopeError {
  return error instanceof ServerFnEnvelopeError && error.code === "AUTHENTICATION_ERROR";
}
