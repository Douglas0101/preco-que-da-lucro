/**
 * Referência de atendimento exibida nos cards de erro financeiro.
 *
 * A referência precisa ser resolvível no log do servidor: quando o erro traz o
 * `correlationId` (envelope, `Response` cru ou `ApiError` interno), os 8
 * primeiros caracteres hex vão para o sufixo — o mesmo id que aparece em
 * `request.completed`/`request.failed`. Sem correlação (payload inválido,
 * erro de rede), mantém o token aleatório anterior como fallback.
 */
function correlationIdOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    correlationId?: unknown;
    headers?: { get?: (name: string) => string | null };
  };
  if (typeof candidate.correlationId === "string" && candidate.correlationId !== "UNKNOWN") {
    return candidate.correlationId;
  }
  const header = candidate.headers?.get?.("x-correlation-id");
  if (typeof header === "string" && header.length > 0) return header;
  return null;
}

function randomToken(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36);
}

export function createErrorReference(prefix: string, error?: unknown): string {
  const correlation = correlationIdOf(error);
  const normalized = correlation?.replace(/[^a-f0-9]/gi, "") ?? "";
  const token = normalized.length >= 8 ? normalized.slice(0, 8) : randomToken();
  return `${prefix}-${token}`.toUpperCase();
}
