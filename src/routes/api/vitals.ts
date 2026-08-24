import { createFileRoute } from "@tanstack/react-router";
import { logJson } from "@/lib/structured-logger";
import { WEB_VITALS_MAX_PAYLOAD_BYTES, safeParseVitalMetric } from "@/lib/web-vitals-payload";

const NO_STORE = { headers: { "cache-control": "no-store" } };

function rejected(reason: string): Response {
  logJson("warn", "rum.web_vitals_rejected", { reason });
  return new Response(null, { status: reason === "payload_too_large" ? 413 : 400, ...NO_STORE });
}

async function handleVitalsPost({ request }: { request: Request }): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > WEB_VITALS_MAX_PAYLOAD_BYTES) {
    return rejected("payload_too_large");
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > WEB_VITALS_MAX_PAYLOAD_BYTES) {
    return rejected("payload_too_large");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return rejected("invalid_json");
  }

  const metric = safeParseVitalMetric(payload);
  if (!metric) return rejected("invalid_payload");

  logJson("info", "rum.web_vitals", {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
  });
  return new Response(null, { status: 204, ...NO_STORE });
}

export const Route = createFileRoute("/api/vitals")({
  server: {
    handlers: {
      POST: handleVitalsPost,
    },
  },
});
