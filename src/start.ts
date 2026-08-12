import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { applicationMetrics, ensureTelemetryStarted, withSpan } from "./instrumentation/telemetry";
import { apiErrorResponse, errorCodeFromUnknown } from "./lib/api-error";
import { logJson } from "./lib/structured-logger";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function securityHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
  ].join("; ");
  const headers: Record<string, string> = {
    "content-security-policy-report-only": csp,
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
  };
  if (process.env.CSP_ENFORCE === "true") {
    delete headers["content-security-policy-report-only"];
    headers["content-security-policy"] = csp;
  }
  if (process.env.NODE_ENV === "production") {
    headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

const requestPolicyMiddleware = createMiddleware().server(
  async ({ handlerType, next, request }) => {
    ensureTelemetryStarted();
    const suppliedCorrelationId = request.headers.get("x-correlation-id");
    const correlationId =
      suppliedCorrelationId && uuidPattern.test(suppliedCorrelationId)
        ? suppliedCorrelationId
        : crypto.randomUUID();
    const startedAt = performance.now();

    try {
      const result = await withSpan(
        "http.request",
        {
          "http.request.method": request.method,
          "url.path": new URL(request.url).pathname,
          "app.correlation_id": correlationId,
        },
        async () => next({ context: { correlationId } }),
      );
      const response = new Response(result.response.body, result.response);
      response.headers.set("x-correlation-id", correlationId);
      for (const [name, value] of Object.entries(securityHeaders())) {
        response.headers.set(name, value);
      }
      if (handlerType === "serverFn") {
        response.headers.set("cache-control", "private, no-store");
        response.headers.append("vary", "Cookie");
      }
      logJson("info", "request.completed", {
        correlationId,
        method: request.method,
        pathname: new URL(request.url).pathname,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      applicationMetrics.requestDuration.record(performance.now() - startedAt, {
        method: request.method,
        status: response.status,
      });
      return { ...result, response };
    } catch (error) {
      if (error instanceof Response) {
        error.headers.set("x-correlation-id", correlationId);
        for (const [name, value] of Object.entries(securityHeaders())) {
          error.headers.set(name, value);
        }
        if (handlerType === "serverFn") {
          error.headers.set("cache-control", "private, no-store");
          error.headers.append("vary", "Cookie");
        }
        applicationMetrics.requestDuration.record(performance.now() - startedAt, {
          method: request.method,
          status: error.status,
        });
        throw error;
      }
      if (error != null && typeof error === "object" && "statusCode" in error) throw error;
      const code = errorCodeFromUnknown(error);
      applicationMetrics.errors.add(1, { code });
      logJson("error", "request.failed", {
        correlationId,
        code,
        method: request.method,
        pathname: new URL(request.url).pathname,
        durationMs: Math.round(performance.now() - startedAt),
        error,
      });
      if (handlerType === "serverFn") return apiErrorResponse(code, correlationId);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-correlation-id": correlationId,
          ...securityHeaders(),
        },
      });
    }
  },
);

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [],
  requestMiddleware: [requestPolicyMiddleware, csrfMiddleware],
}));
