import { sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { classifyDatabaseFailure } from "@/lib/db-failure-classifier";
import { deploymentIdentity, requestCorrelationId } from "@/lib/deployment-identity.server";
import { getDatabase } from "@/db/client.server";
import { logJson } from "@/lib/structured-logger";

export async function handleHealthReady({ request }: { request: Request }): Promise<Response> {
  try {
    await getDatabase().execute(sql`select 1 as ready`);
    return Response.json(
      { status: "ready", dependencies: { postgres: "ok" } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // Classificação fechada (componente, categoria, etapa, código aprovado,
    // transient, elos inspecionados) e identidade do artefato — nunca o `Error`
    // cru: a mensagem do drizzle é genérica e o `cause` do driver carrega host,
    // porta, usuário e connection string. Classificado aqui,
    // `docs/evidence/production-runtime-incident-2026-10-08/` deixa de ter um
    // artefato não-discriminante por defeito da chamada de log.
    logJson("error", "health.readiness_failed", {
      correlationId: requestCorrelationId(request),
      ...deploymentIdentity(),
      ...classifyDatabaseFailure(error),
    });
    // Resposta pública genérica e fail-closed: o detalhe é do servidor.
    return Response.json(
      { status: "not_ready", dependencies: { postgres: "unavailable" } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export const Route = createFileRoute("/api/health/ready")({
  server: { handlers: { GET: handleHealthReady } },
});
