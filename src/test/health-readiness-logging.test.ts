import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ failure: undefined as unknown }));

vi.mock("@/db/client.server", () => ({
  getDatabase: () => ({
    execute: async () => {
      throw state.failure;
    },
  }),
}));

const { handleHealthReady } = await import("@/routes/api/health/ready");
const { requestCorrelationId } = await import("@/lib/deployment-identity.server");

/**
 * Contrato da rota de readiness depois do incidente de 2026-10-08: a linha
 * `health.readiness_failed` precisa ser **discriminante** (código + categoria +
 * etapa) e **não-vazante** (sem host, porta, usuário, senha, connection string ou
 * query), e a resposta pública precisa continuar genérica e fail-closed.
 */

const DATABASE_URL_WITH_SECRET =
  "postgresql://secretuser:s3cr3t-p4ssw0rd@ep-dead-endpoint-abc123.neon.tech:5432/neondb?sslmode=require";

const NEVER_IN_LOG = [
  DATABASE_URL_WITH_SECRET,
  "s3cr3t-p4ssw0rd",
  "secretuser",
  "ep-dead-endpoint-abc123.neon.tech",
  ":5432",
  "password authentication failed",
  "Failed query",
  "select 1 as ready",
];

function driverError(): unknown {
  return new Error("Failed query: select 1 as ready\nparams: ", {
    cause: Object.assign(new Error("password authentication failed for user 'secretuser'"), {
      code: "28P01",
      host: "ep-dead-endpoint-abc123.neon.tech",
      port: 5432,
      user: "secretuser",
      password: "s3cr3t-p4ssw0rd",
      connectionString: DATABASE_URL_WITH_SECRET,
    }),
  });
}

async function captureReadyFailure(failure: unknown): Promise<{
  record: Record<string, unknown>;
  response: Response;
}> {
  state.failure = failure;
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const response = await handleHealthReady({
      request: new Request("https://app.test/api/health/ready"),
    });
    const call = errorSpy.mock.calls.at(-1);
    return {
      record: call ? (JSON.parse(String(call[0])) as Record<string, unknown>) : {},
      response,
    };
  } finally {
    errorSpy.mockRestore();
    state.failure = undefined;
  }
}

describe("health.readiness_failed — linha discriminante e não-vazante", () => {
  it("emite categoria, etapa e código aprovado do SQLSTATE", async () => {
    const { record } = await captureReadyFailure(driverError());
    expect(record).toMatchObject({
      level: "error",
      event: "health.readiness_failed",
      component: "postgres",
      category: "authentication",
      step: "auth",
      code: "28P01",
      transient: false,
    });
  });

  it("carrega correlação, timestamp e identidade do deployment", async () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_6h2LTZX57soGiPP2oTurws7NsgVd";
    process.env.VERCEL_GIT_COMMIT_SHA = "fa45632391ad9ffe1d20d3bad5264a53b565638e";
    try {
      const { record } = await captureReadyFailure(driverError());
      expect(record.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.deploymentId).toBe("dpl_6h2LTZX57soGiPP2oTurws7NsgVd");
      expect(record.commitSha).toBe("fa45632391ad9ffe1d20d3bad5264a53b565638e");
    } finally {
      delete process.env.VERCEL_DEPLOYMENT_ID;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    }
  });

  it("não serializa Error, cause, mensagem do driver, host, porta, usuário, senha nem banco", async () => {
    const { record } = await captureReadyFailure(driverError());
    const serialized = JSON.stringify(record);
    for (const forbidden of NEVER_IN_LOG) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("erro sem código aprovado classifica como unknown em vez de omitir a linha", async () => {
    const { record } = await captureReadyFailure(new Error("sem codigo algum"));
    expect(record).toMatchObject({
      event: "health.readiness_failed",
      category: "unknown",
      step: "unknown",
      code: null,
      transient: false,
    });
  });

  it("resposta pública continua genérica, 503 e fail-closed", async () => {
    const { response } = await captureReadyFailure(driverError());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.clone().json();
    expect(body).toEqual({ status: "not_ready", dependencies: { postgres: "unavailable" } });
    const text = await response.text();
    for (const forbidden of [...NEVER_IN_LOG, "28P01", "authentication"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("correlação da requisição de readiness", () => {
  it("aceita UUID válido do chamador para ligar ao 500 da aplicação", () => {
    const supplied = "a8499878-1217-424e-ab28-8bbf7430aa62";
    expect(
      requestCorrelationId(
        new Request("https://app.test/api/health/ready", {
          headers: { "x-correlation-id": supplied },
        }),
      ),
    ).toBe(supplied);
  });

  it("cabeçalho inválido não é propagado; gera UUID novo", () => {
    const generated = requestCorrelationId(
      new Request("https://app.test/api/health/ready", {
        headers: { "x-correlation-id": "nao-e-uuid" },
      }),
    );
    expect(generated).not.toBe("nao-e-uuid");
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
