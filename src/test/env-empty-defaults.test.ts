import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDatabase, instrumentPoolRoundTrips, setDatabaseForTests } from "@/db/client.server";
import { getEmailAdapter, setEmailAdapterForTests } from "@/server/email/email-adapter.server";
import { resolveOtelSdkConfig } from "@/instrumentation/telemetry";

/**
 * DBT-97 — par por sítio: valor `""` reprova (ou cai no default documentado) e
 * valor ausente passa. Cada caso abaixo fixa um sítio que antes coalescia
 * `process.env` direto para o default, onde "definida e vazia" vencia o default.
 *
 * Os pools são capturados por `vi.mock` justamente porque `Number("") === 0`
 * sobrevive dentro do construtor real: `pg.Pool` reescreve
 * `options.max = max || poolSize || 10`, então um `max: 0` chegaria a
 * `pool.options.max === 10` e a asserção passaria com o defeito presente. O que
 * se observa aqui é o argumento ENTREGUE ao construtor.
 */

type CapturedEntry = {
  branch: "neon-serverless" | "node-postgres";
  options: Record<string, unknown>;
  pool: object;
};

const sinks = vi.hoisted(() => ({
  neon: [] as CapturedEntry[],
  node: [] as CapturedEntry[],
}));

/** Fábrica de pool de captura: um construtor por branch, com a assinatura de um
 * único argumento — a mesma que o módulo real recebe de `client.server.ts`. */
function recordingPool(branch: "neon-serverless" | "node-postgres") {
  const sink = branch === "node-postgres" ? sinks.node : sinks.neon;
  return class RecordingPool {
    constructor(public readonly options: Record<string, unknown>) {
      sink.push({ branch, options, pool: this });
    }
    connect(): never {
      throw new Error("pool de captura não conecta");
    }
    on(): this {
      return this;
    }
    end(): Promise<void> {
      return Promise.resolve();
    }
  };
}

vi.mock("@neondatabase/serverless", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@neondatabase/serverless")>();
  return { ...actual, Pool: recordingPool("neon-serverless") } as unknown as typeof actual;
});

vi.mock("pg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pg")>();
  const RecordingPool = recordingPool("node-postgres");
  return {
    ...actual,
    Pool: RecordingPool,
    default: { ...actual.default, Pool: RecordingPool },
  } as unknown as typeof actual;
});

const CONNECTION = "postgresql://usuario:senha@127.0.0.1:5432/banco";
const POOL_MAX_ENV = "DATABASE_POOL_MAX";

const MANAGED_ENV = [
  "DATABASE_URL",
  "DATABASE_DRIVER",
  POOL_MAX_ENV,
  "OTEL_SERVICE_NAME",
  "OTEL_METRIC_EXPORT_INTERVAL_MS",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "RESEND_API_KEY",
  "AUTH_EMAIL_FROM",
];

beforeEach(() => {
  for (const name of MANAGED_ENV) vi.stubEnv(name, undefined);
  setDatabaseForTests(undefined);
  setEmailAdapterForTests(undefined);
  sinks.neon.length = 0;
  sinks.node.length = 0;
});

afterEach(() => {
  // `instrumentPoolRoundTrips` registra a fonte de snapshot no set global da
  // telemetria; sem isto, cada pool de captura ficaria registrado para o resto
  // do arquivo e poluiria `collectPoolSnapshots()` de quem o chamasse.
  for (const entry of [...sinks.neon, ...sinks.node]) {
    instrumentPoolRoundTrips(entry.pool)?.unregister();
  }
  setDatabaseForTests(undefined);
  setEmailAdapterForTests(undefined);
  vi.unstubAllEnvs();
});

describe("DATABASE_POOL_MAX — o teto do pool nunca recebe 0/NaN", () => {
  function neonPoolMax(): unknown {
    getDatabase();
    return sinks.neon[0]?.options.max;
  }

  it("devolve o default 10 quando a variável está ausente", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    expect(neonPoolMax()).toBe(10);
  });

  it.each([
    { estado: "definida e vazia", valor: "" },
    { estado: "só espaços", valor: "   " },
    { estado: "texto não numérico", valor: "dez" },
    { estado: "zero", valor: "0" },
    { estado: "negativo", valor: "-4" },
    { estado: "fração", valor: "10.5" },
    { estado: "acima dos 901 max_connections medidos", valor: "5000" },
  ])("cai no default 10 quando o valor é $estado ($valor)", ({ valor }) => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv(POOL_MAX_ENV, valor);
    expect(neonPoolMax()).toBe(10);
  });

  it("mantém um valor válido dentro da faixa medida", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv(POOL_MAX_ENV, "901");
    expect(neonPoolMax()).toBe(901);
  });

  it("aplica o mesmo à segunda leitura, no branch node-postgres", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "node-postgres");
    vi.stubEnv(POOL_MAX_ENV, "");
    getDatabase();
    expect(sinks.node).toHaveLength(1);
    expect(sinks.neon).toHaveLength(0);
    expect(sinks.node[0]?.options.max).toBe(10);
    expect(sinks.node[0]?.options.connectionString).toBe(CONNECTION);
  });
});

describe("DATABASE_URL — definida e vazia não chega ao pool", () => {
  /**
   * LIMITE DECLARADO sobre o par: `""` JÁ reprovava pelo truthiness do guard
   * (`!""` é `true`), então o caso "definida e vazia" aqui é PINO de regressão,
   * não detector do defeito. O caso que o `readEnv` corrige de fato é o de
   * "só espaços" — truthy, passava pelo guard e chegava ao pool.
   */
  function expectRefused(): Error {
    let captured: unknown;
    try {
      getDatabase();
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("DATABASE_URL não configurada");
    // Nenhuma tentativa de conexão: os dois branches ficam intactos.
    expect(sinks.neon).toHaveLength(0);
    expect(sinks.node).toHaveLength(0);
    return captured as Error;
  }

  it("recusa com o erro explícito quando está definida e vazia", () => {
    vi.stubEnv("DATABASE_URL", "");
    expectRefused();
  });

  it("recusa com o MESMO erro quando só tem espaços", () => {
    vi.stubEnv("DATABASE_URL", "   ");
    expectRefused();
  });

  it("recusa com o MESMO erro quando está ausente", () => {
    expectRefused();
  });

  it("constrói o pool quando há connection string", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    getDatabase();
    expect(sinks.neon).toHaveLength(1);
    expect(sinks.neon[0]?.options.connectionString).toBe(CONNECTION);
  });
});

describe("DATABASE_DRIVER — definida e vazia cai no driver padrão", () => {
  it("cai em neon-serverless quando está definida e vazia", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "");
    expect(() => getDatabase()).not.toThrow();
    expect(sinks.neon).toHaveLength(1);
    expect(sinks.node).toHaveLength(0);
  });

  it("cai em neon-serverless quando só tem espaços", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", " \t ");
    expect(() => getDatabase()).not.toThrow();
    expect(sinks.neon).toHaveLength(1);
  });

  it("cai em neon-serverless quando está ausente", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    expect(() => getDatabase()).not.toThrow();
    expect(sinks.neon).toHaveLength(1);
  });

  it("não transforma vazio no erro 'deve ser neon-serverless ou node-postgres'", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "");
    expect(() => getDatabase()).not.toThrow(/DATABASE_DRIVER deve ser/);
  });

  it("continua recusando um driver fora da taxonomia", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "postgres");
    expect(() => getDatabase()).toThrow(
      "DATABASE_DRIVER deve ser neon-serverless ou node-postgres",
    );
    expect(sinks.neon).toHaveLength(0);
    expect(sinks.node).toHaveLength(0);
  });

  it("continua aceitando node-postgres explícito", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "node-postgres");
    getDatabase();
    expect(sinks.node).toHaveLength(1);
    expect(sinks.neon).toHaveLength(0);
  });
});

describe("resolvePoolDriver — a segunda leitura de DATABASE_DRIVER", () => {
  /**
   * LIMITE DECLARADO: esta segunda leitura (`client.server.ts:362`) compara
   * contra o literal `"node-postgres"`, e `readEnv` NÃO apara o valor devolvido
   * — então `""`, `"   "` e ausente davam `neon-serverless` também antes da
   * correção. Não há defeito observável aqui para reprovar: o que o par abaixo
   * fixa é a REGRA ÚNICA de leitura, para que as duas leituras do mesmo nome
   * não possam divergir quando uma delas mudar. Não leia estes casos como
   * prova do defeito original.
   */
  function driverLabelFor(driver: string | undefined): string | undefined {
    if (driver === undefined) vi.stubEnv("DATABASE_DRIVER", undefined);
    else vi.stubEnv("DATABASE_DRIVER", driver);
    const pool = new (recordingPool("neon-serverless"))({});
    return instrumentPoolRoundTrips(pool)?.read().driver;
  }

  it.each([
    { estado: "definida e vazia", driver: "", esperado: "neon-serverless" },
    { estado: "só espaços", driver: "   ", esperado: "neon-serverless" },
    { estado: "ausente", driver: undefined, esperado: "neon-serverless" },
    { estado: "fora da taxonomia", driver: "mysql", esperado: "neon-serverless" },
    { estado: "explícito", driver: "node-postgres", esperado: "node-postgres" },
  ])("resolve $estado para $esperado", ({ driver, esperado }) => {
    expect(driverLabelFor(driver)).toBe(esperado);
  });

  it("o rótulo do snapshot concorda com o branch realmente construído", () => {
    vi.stubEnv("DATABASE_URL", CONNECTION);
    vi.stubEnv("DATABASE_DRIVER", "node-postgres");
    getDatabase();
    expect(sinks.node).toHaveLength(1);
    expect(driverLabelFor("node-postgres")).toBe("node-postgres");

    setDatabaseForTests(undefined);
    vi.stubEnv("DATABASE_DRIVER", "");
    getDatabase();
    expect(
      sinks.neon.filter((entry) => entry.options.connectionString === CONNECTION),
    ).toHaveLength(1);
    expect(driverLabelFor("")).toBe("neon-serverless");
  });
});

describe("OTEL — serviceName e intervalo de exportação", () => {
  it("cai no nome padrão quando OTEL_SERVICE_NAME está definida e vazia", () => {
    vi.stubEnv("OTEL_SERVICE_NAME", "");
    expect(resolveOtelSdkConfig().serviceName).toBe("preco-que-da-lucro");
  });

  it("cai no nome padrão quando OTEL_SERVICE_NAME só tem espaços", () => {
    vi.stubEnv("OTEL_SERVICE_NAME", "   ");
    expect(resolveOtelSdkConfig().serviceName).toBe("preco-que-da-lucro");
  });

  it("cai no nome padrão quando OTEL_SERVICE_NAME está ausente", () => {
    expect(resolveOtelSdkConfig().serviceName).toBe("preco-que-da-lucro");
  });

  it("mantém um nome configurado", () => {
    vi.stubEnv("OTEL_SERVICE_NAME", "servico-homolog");
    expect(resolveOtelSdkConfig().serviceName).toBe("servico-homolog");
  });

  /**
   * LIMITE DECLARADO: `OTEL_METRIC_EXPORT_INTERVAL_MS` NÃO tinha defeito
   * observável para "definida e vazia" — a valização de `Number.isFinite &&
   * >= 1_000` logo abaixo já convertia `Number("") = 0` no default 15_000. Os
   * casos abaixo fixam a defesa que já existia; o ÚNICO comportamento novo é
   * o teto de 1 h (acima disso, o valor passava direto ao reader).
   */
  it.each([
    { estado: "definida e vazia", valor: "" },
    { estado: "só espaços", valor: " " },
    { estado: "zero", valor: "0" },
    { estado: "não numérico", valor: "quinze mil" },
    { estado: "abaixo do piso de 1s", valor: "999" },
    { estado: "acima do teto de 1h", valor: "3600001" },
  ])("cai no intervalo padrão quando é $estado ($valor)", ({ valor }) => {
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", valor);
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(15_000);
  });

  it("cai no intervalo padrão quando ausente", () => {
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(15_000);
  });

  it.each([1_000, 15_000, 60_000, 3_600_000])("mantém um intervalo válido (%d)", (valor) => {
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", String(valor));
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(valor);
  });
});

describe("e-mail transacional — estado nomeado, sempre fail-closed", () => {
  it("recusa nomeando RESEND_API_KEY como definida e vazia", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.com>");
    expect(() => getEmailAdapter()).toThrowError(
      "RESEND_API_KEY (definida e vazia). RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias",
    );
  });

  it("recusa nomeando AUTH_EMAIL_FROM como definida e vazia", () => {
    vi.stubEnv("RESEND_API_KEY", "re_chave_real");
    vi.stubEnv("AUTH_EMAIL_FROM", "");
    expect(() => getEmailAdapter()).toThrowError(
      "AUTH_EMAIL_FROM (definida e vazia). RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias",
    );
  });

  it("recusa nomeando RESEND_API_KEY como ausente", () => {
    vi.stubEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.com>");
    expect(() => getEmailAdapter()).toThrowError(
      "RESEND_API_KEY (ausente). RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias",
    );
  });

  it("recusa nomeando AUTH_EMAIL_FROM como ausente", () => {
    vi.stubEnv("RESEND_API_KEY", "re_chave_real");
    expect(() => getEmailAdapter()).toThrowError(
      "AUTH_EMAIL_FROM (ausente). RESEND_API_KEY e AUTH_EMAIL_FROM são obrigatórias",
    );
  });

  it("recusa credencial só com espaços, que antes passava pelo truthiness", () => {
    vi.stubEnv("RESEND_API_KEY", "   ");
    vi.stubEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.com>");
    expect(() => getEmailAdapter()).toThrowError("RESEND_API_KEY (definida e vazia)");
  });

  it("nomeia as duas variáveis quando o par inteiro está vazio", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_EMAIL_FROM", "   ");
    expect(() => getEmailAdapter()).toThrowError(
      "Configuração de e-mail incompleta: RESEND_API_KEY (definida e vazia), AUTH_EMAIL_FROM (definida e vazia)",
    );
  });

  it("constrói o adapter quando o par está completo", () => {
    vi.stubEnv("RESEND_API_KEY", "re_chave_real");
    vi.stubEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.com>");
    expect(() => getEmailAdapter()).not.toThrow();
    expect(getEmailAdapter()).toBe(getEmailAdapter());
  });
});
