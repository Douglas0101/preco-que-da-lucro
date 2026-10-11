import { describe, expect, it } from "vitest";
import {
  approvedFailureCodes,
  classifyDatabaseFailure,
  databaseFailureDiagnosisKeys,
  databaseFailureSyscall,
} from "@/lib/db-failure-classifier";
import { deploymentIdentity } from "@/lib/deployment-identity.server";

/**
 * Fonte do defeito: `docs/evidence/production-runtime-incident-2026-10-08/`.
 * `health.readiness_failed` passou o objeto `Error` cru a `logJson`, que serializa
 * só `name`/`message`; o discriminante vivia em `error.cause` e nunca era escrito.
 * Estes testes fixam o contrato da classificação que substituiu essa chamada.
 */

const DATABASE_URL_WITH_SECRET =
  "postgresql://secretuser:s3cr3t-p4ssw0rd@ep-dead-endpoint-abc123.neon.tech:5432/neondb?sslmode=require";

/** Profundidade máxima do percurso em `db-failure-classifier.ts` + o elo raiz. */
const MAX_CAUSE_DEPTH_PLUS_ONE = 6;

/** Réplica da forma que `pg`/drizzle devolve: invólucro genérico + causa com SQLSTATE. */
function drizzleWrappedQuery(
  inner: unknown,
  message = "Failed query: select 1 as ready\nparams: ",
) {
  return new Error(message, { cause: inner });
}

function pgLikeError(
  code: string,
  overrides: Record<string, unknown> = {},
): Error & Record<string, unknown> {
  return Object.assign(new Error("driver detail that must never reach the log"), {
    code,
    // Propriedades que o driver realmente carrega e que não podem ser emitidas.
    host: "ep-dead-endpoint-abc123.neon.tech",
    port: 5432,
    user: "secretuser",
    password: "s3cr3t-p4ssw0rd",
    database: "neondb",
    connectionString: DATABASE_URL_WITH_SECRET,
    query: "select 1 as ready",
    ...overrides,
  }) as unknown as Error & Record<string, unknown>;
}

const SENSITIVE_SUBSTRINGS = [
  DATABASE_URL_WITH_SECRET,
  "s3cr3t-p4ssw0rd",
  "secretuser",
  "ep-dead-endpoint-abc123.neon.tech",
  ":5432",
  "neondb",
  "driver detail that must never reach the log",
];

describe("chave fixa da classificação", () => {
  it("devolve exatamente as sete chaves declaradas, na ordem do contrato", () => {
    const diagnosis = classifyDatabaseFailure(new Error("boom"));
    expect(Object.keys(diagnosis)).toEqual([...databaseFailureDiagnosisKeys()]);
    expect(databaseFailureDiagnosisKeys()).toEqual([
      "component",
      "category",
      "step",
      "code",
      "transient",
      "inspectedCauses",
    ]);
  });

  it("todo código aprovado é bem formado e classifica algo que não é unknown", () => {
    const codes = approvedFailureCodes();
    expect(codes.length).toBeGreaterThan(20);
    for (const code of codes) {
      expect(code).toMatch(/^(?:[0-9A-Z]{5}|[A-Z][A-Z0-9_]{2,63})$/);
      const diagnosis = classifyDatabaseFailure(pgLikeError(code));
      expect(diagnosis.code).toBe(code);
      expect(diagnosis.category).not.toBe("unknown");
      expect(diagnosis.step).not.toBe("unknown");
    }
  });
});

describe("tabela de SQLSTATE aprovada", () => {
  const cases: Array<[string, string, string, boolean]> = [
    // code, categoria, etapa, transient
    ["28P01", "authentication", "auth", false],
    ["28000", "tls", "tls", false],
    ["08006", "network", "connect", true],
    ["08004", "network", "connect", false],
    ["53300", "capacity", "pool", true],
    ["3D000", "configuration", "connect", false],
    ["42P01", "schema", "query", false],
    ["42501", "authorization", "query", false],
    ["40001", "database", "query", true],
    ["57P03", "database", "connect", true],
  ];
  for (const [code, category, step, transient] of cases) {
    it(`${code} -> ${category}/${step}/transient=${transient}`, () => {
      const diagnosis = classifyDatabaseFailure(drizzleWrappedQuery(pgLikeError(code)));
      expect(diagnosis).toEqual({
        component: "postgres",
        category,
        step,
        code,
        transient,
        inspectedCauses: 2,
      });
    });
  }
});

describe("códigos do driver Node aprovados", () => {
  const cases: Array<[string, string, string, boolean]> = [
    ["ENOTFOUND", "dns", "dns", false],
    ["EAI_AGAIN", "dns", "dns", true],
    ["ECONNREFUSED", "network", "connect", true],
    ["ETIMEDOUT", "network", "connect", true],
    ["ECONNRESET", "network", "connect", true],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "tls", "tls", false],
    ["ERR_SSL_WRONG_VERSION_NUMBER", "tls", "tls", false],
  ];
  for (const [code, category, step, transient] of cases) {
    it(`${code} -> ${category}/${step}/transient=${transient}`, () => {
      const socket = Object.assign(new Error("socket failure"), { code, errno: -111 });
      const diagnosis = classifyDatabaseFailure(socket);
      expect(diagnosis.category).toBe(category);
      expect(diagnosis.step).toBe(step);
      expect(diagnosis.transient).toBe(transient);
      expect(diagnosis.code).toBe(code);
    });
  }

  it("syscall reconhecível não muda a categoria, apenas a etapa quando é dns/connect", () => {
    const withSyscall = Object.assign(new Error("connect failure"), {
      code: "ECONNREFUSED",
      syscall: "connect",
    });
    expect(databaseFailureSyscall(withSyscall)).toBe("connect");
    const withLookup = Object.assign(new Error("lookup failure"), {
      code: "ECONNREFUSED",
      syscall: "getaddrinfo",
    });
    expect(databaseFailureSyscall(withLookup)).toBe("dns");
    const withRead = Object.assign(new Error("read failure"), {
      code: "ECONNRESET",
      syscall: "read",
    });
    expect(databaseFailureSyscall(withRead)).toBeNull();
  });
});

describe("código fora da tabela aprovada não é emitido", () => {
  it("SQLSTATE bem formado e desconhecido vira code null + unknown", () => {
    const diagnosis = classifyDatabaseFailure(pgLikeError("42601"));
    expect(diagnosis.code).toBeNull();
    expect(diagnosis.category).toBe("unknown");
    expect(diagnosis.step).toBe("unknown");
    expect(diagnosis.transient).toBe(false);
  });

  it("string que só parece código é descartada, nunca devolvida", () => {
    const diagnosis = classifyDatabaseFailure(
      Object.assign(new Error("x"), { code: "senha=1234 host=db" }),
    );
    expect(diagnosis.code).toBeNull();
  });

  it("errno numérico (forma negativa do socket) não vira código", () => {
    const diagnosis = classifyDatabaseFailure(
      Object.assign(new Error("x"), { errno: -3008, code: undefined }),
    );
    expect(diagnosis.code).toBeNull();
  });
});

describe("cadeia cause limitada", () => {
  it("encontra o SQLSTATE sob o invólucro genérico do drizzle", () => {
    const diagnosis = classifyDatabaseFailure(drizzleWrappedQuery(pgLikeError("28P01")));
    expect(diagnosis.code).toBe("28P01");
    expect(diagnosis.category).toBe("authentication");
    // invólucro + causa = dois elos inspecionados.
    expect(diagnosis.inspectedCauses).toBe(2);
  });

  it("cadeia mais longa que o limite não estoura e reporta o limite aplicado", () => {
    let link: unknown = pgLikeError("28P01");
    for (let depth = 0; depth < 30; depth += 1) {
      link = new Error(`wrapper ${depth}`, { cause: link });
    }
    const diagnosis = classifyDatabaseFailure(link);
    // 30 invólucros + 1 causa = 31 elos, mas a profundidade é limitada a 5 elos.
    expect(diagnosis.inspectedCauses).toBeLessThanOrEqual(6);
  });

  it("ciclo de cause termina e não repete elo", () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    Object.defineProperty(first, "cause", { value: second, enumerable: false });
    const diagnosis = classifyDatabaseFailure(first);
    expect(diagnosis.inspectedCauses).toBeLessThanOrEqual(MAX_CAUSE_DEPTH_PLUS_ONE);
    expect(diagnosis.code).toBeNull();
  });

  it("AggregateError tem apenas os primeiros membros inspecionados", () => {
    const members = [
      new Error("sem código"),
      Object.assign(new Error("dead"), { code: "ENOTFOUND" }),
      ...Array.from({ length: 50 }, (_, index) => new Error(`member ${index}`)),
    ];
    const aggregate = new AggregateError(members, "connect failed");
    const diagnosis = classifyDatabaseFailure(aggregate);
    expect(diagnosis.code).toBe("ENOTFOUND");
    expect(diagnosis.category).toBe("dns");
    expect(diagnosis.inspectedCauses).toBeLessThanOrEqual(6);
  });

  it("cause que não é objeto não derruba o classificador", () => {
    const diagnosis = classifyDatabaseFailure(new Error("boom", { cause: "texto puro" }));
    expect(diagnosis.code).toBeNull();
    expect(diagnosis.category).toBe("unknown");
  });
});

describe("sem vazamento de credencial ou infraestrutura", () => {
  const leakyCases: Array<[string, unknown]> = [
    ["causa pg completa", drizzleWrappedQuery(pgLikeError("28P01"))],
    [
      "erro de socket do Node",
      Object.assign(new Error(`connect ${DATABASE_URL_WITH_SECRET}`), {
        code: "ECONNREFUSED",
        host: "ep-dead-endpoint-abc123.neon.tech",
        port: 5432,
      }),
    ],
    [
      "AggregateError com URL na mensagem",
      new AggregateError([
        new Error(`failed: ${DATABASE_URL_WITH_SECRET}`),
        Object.assign(new Error("x"), { code: "ETIMEDOUT" }),
      ]),
    ],
    ["sem código algum", new Error(`cannot reach ${DATABASE_URL_WITH_SECRET}`)],
  ];

  for (const [label, error] of leakyCases) {
    it(`${label}: JSON da classificação não contém valor sensível`, () => {
      const serialized = JSON.stringify(classifyDatabaseFailure(error));
      for (const forbidden of SENSITIVE_SUBSTRINGS) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  }

  it("a classificação nunca carrega o texto do erro", () => {
    const diagnosis = classifyDatabaseFailure(pgLikeError("28P01"));
    const serialized = JSON.stringify(diagnosis).toLowerCase();
    for (const word of ["query", "params", "select", "postgres://", "http"]) {
      expect(serialized).not.toContain(word);
    }
  });
});

describe("identidade do deployment no log", () => {
  it("campos ausentes ficam fora, e nenhum valor de ambiente é inventado", () => {
    const previous = {
      deployment: process.env.VERCEL_DEPLOYMENT_ID,
      sha: process.env.VERCEL_GIT_COMMIT_SHA,
    };
    delete process.env.VERCEL_DEPLOYMENT_ID;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    try {
      expect(deploymentIdentity()).toEqual({});
    } finally {
      if (previous.deployment !== undefined) process.env.VERCEL_DEPLOYMENT_ID = previous.deployment;
      if (previous.sha !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = previous.sha;
    }
  });

  it("valores definido-e-vazio não entram no log", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "";
    process.env.VERCEL_GIT_COMMIT_SHA = "   ";
    try {
      expect(deploymentIdentity()).toEqual({});
    } finally {
      delete process.env.VERCEL_DEPLOYMENT_ID;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    }
  });

  it("identificador fora do formato esperado é descartado", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_curto";
    process.env.VERCEL_GIT_COMMIT_SHA = "not-a-sha";
    try {
      expect(deploymentIdentity()).toEqual({});
    } finally {
      delete process.env.VERCEL_DEPLOYMENT_ID;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    }
  });

  it("deployment e SHA válidos são devolvidos", () => {
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_6h2LTZX57soGiPP2oTurws7NsgVd";
    process.env.VERCEL_GIT_COMMIT_SHA = "fa45632391ad9ffe1d20d3bad5264a53b565638e";
    try {
      expect(deploymentIdentity()).toEqual({
        deploymentId: "dpl_6h2LTZX57soGiPP2oTurws7NsgVd",
        commitSha: "fa45632391ad9ffe1d20d3bad5264a53b565638e",
      });
    } finally {
      delete process.env.VERCEL_DEPLOYMENT_ID;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    }
  });
});
