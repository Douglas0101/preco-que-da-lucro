import { afterEach, describe, expect, it, vi } from "vitest";
import type { Attributes, ObservableResult } from "@opentelemetry/api";
import { instrumentPoolRoundTrips } from "@/db/client.server";
import {
  aggregatePoolSnapshots,
  applicationMetrics,
  registerPoolSnapshotSource,
  reportPoolConnectionObservations,
  reportPoolInFlightObservations,
  type DatabasePoolSnapshot,
} from "@/instrumentation/telemetry";

interface FakeQueryClient {
  query: (...args: unknown[]) => Promise<unknown>;
}

interface FakePoolOptions {
  driver?: string;
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
  max?: number;
  failOn?: string;
}

const unregisters: Array<() => void> = [];

async function instrumentFakePool(options: FakePoolOptions = {}) {
  const events: Record<string, unknown>[] = [];
  vi.spyOn(console, "info").mockImplementation((record: unknown) => {
    events.push(JSON.parse(String(record)) as Record<string, unknown>);
  });
  const queries: unknown[][] = [];
  const client: FakeQueryClient = {
    query: vi.fn(async (...args: unknown[]) => {
      queries.push(args);
      const statement = args[0];
      const text =
        typeof statement === "string"
          ? statement
          : ((statement as { text?: unknown } | undefined)?.text ?? "");
      if (options.failOn && typeof text === "string" && text.includes(options.failOn)) {
        throw new Error("syntax error");
      }
      return { rows: [] };
    }),
  };
  const pool = {
    totalCount: options.totalCount ?? 0,
    idleCount: options.idleCount ?? 0,
    waitingCount: options.waitingCount ?? 0,
    options: { max: options.max ?? 10 },
    connect: async () => client,
  };
  const handle = instrumentPoolRoundTrips(pool, options.driver ?? "node-postgres");
  if (handle) unregisters.push(handle.unregister);
  const instrumented = await (pool.connect as () => Promise<FakeQueryClient>)();
  const contextTxEvents = () => events.filter((record) => record.event === "app.context_tx");
  return { instrumented, queries, contextTxEvents, pool, handle };
}

function collectRecordedMetrics() {
  const records: Array<{ value: number; attributes: Record<string, unknown> }> = [];
  vi.spyOn(applicationMetrics.dbQueryDuration, "record").mockImplementation(
    (value: number, attributes?: Attributes) => {
      records.push({ value, attributes: (attributes ?? {}) as Record<string, unknown> });
    },
  );
  return {
    queryRecords: () => records.filter((record) => "db.operation.name" in record.attributes),
    waitRecords: () => records.filter((record) => "driver" in record.attributes),
  };
}

function recordingObservable() {
  const observations: Array<{ value: number; attributes?: Record<string, unknown> }> = [];
  const result = {
    observe(value: number, attributes?: Record<string, unknown>) {
      observations.push({ value, attributes });
    },
  } as unknown as ObservableResult;
  return { result, observations };
}

afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister();
  vi.restoreAllMocks();
});

describe("T1 perf-waves: instrumentação de round trips por transação (app.context_tx)", () => {
  it("emite round_trips acumulados de begin a commit e reinicia a contagem na próxima transação", async () => {
    const { instrumented, contextTxEvents } = await instrumentFakePool();

    await instrumented.query("begin");
    await instrumented.query("select set_config('app.current_user_id', $1, true)", ["user-1"]);
    await instrumented.query("select set_config('app.current_tenant_id', $1, true)", ["tenant-1"]);
    await instrumented.query("select 1");
    await instrumented.query("commit");
    await instrumented.query("select 2");
    await instrumented.query("begin");
    await instrumented.query("commit");

    const events = contextTxEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ round_trips: 5, outcome: "commit" });
    expect(events[1]).toMatchObject({ round_trips: 2, outcome: "commit" });
  });

  it("emite round_trips em rollback", async () => {
    const { instrumented, contextTxEvents } = await instrumentFakePool();

    await instrumented.query("begin");
    await instrumented.query("select 1");
    await instrumented.query("rollback");

    const events = contextTxEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ round_trips: 3, outcome: "rollback" });
  });

  it("instrumenta clientes com formato de query em objeto (text/values) e preserva o encaminhamento", async () => {
    const { instrumented, queries, contextTxEvents } = await instrumentFakePool();

    await instrumented.query({ text: "begin" });
    await instrumented.query({ text: "select $1::text", values: ["ok"] });
    await instrumented.query({ text: "commit" });

    const events = contextTxEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ round_trips: 3, outcome: "commit" });
    expect(queries).toHaveLength(3);
    expect(queries[0][0]).toEqual({ text: "begin" });
    expect(queries[1][0]).toEqual({ text: "select $1::text", values: ["ok"] });
  });

  it("ignora pools sem connect e não reinstrumenta o mesmo cliente", async () => {
    expect(() => instrumentPoolRoundTrips({})).not.toThrow();
    expect(() => instrumentPoolRoundTrips(null)).not.toThrow();

    const connectSpy = vi.fn(async () => ({ query: async () => ({ rows: [] }) }));
    const pool = { connect: connectSpy };
    instrumentPoolRoundTrips(pool);
    instrumentPoolRoundTrips(pool);
    const instrumented = (await (
      pool.connect as () => Promise<FakeQueryClient>
    )()) as FakeQueryClient;
    await instrumented.query("begin");
    await instrumented.query("commit");
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });
});

describe("§19.3: span e métrica por query", () => {
  it("registra app.db.query.duration por operação (sem texto) e pula begin/commit/rollback", async () => {
    const metrics = collectRecordedMetrics();
    const { instrumented } = await instrumentFakePool();

    await instrumented.query("begin");
    await instrumented.query({
      text: "select * from users where email = 'joao@example.com'",
      values: ["joao@example.com"],
    });
    await instrumented.query("commit");

    const records = metrics.queryRecords();
    expect(records).toHaveLength(1);
    expect(records[0].value).toBeGreaterThanOrEqual(0);
    expect(records[0].attributes).toEqual({
      "db.operation.name": "SELECT",
      "db.system.name": "postgresql",
    });
    expect(JSON.stringify(records[0].attributes)).not.toContain("joao@example.com");
  });

  it("propaga erro de query, finaliza a transação e mantém o wrapper íntegro", async () => {
    const { instrumented, contextTxEvents } = await instrumentFakePool({ failOn: "boom" });

    await instrumented.query("begin");
    await expect(instrumented.query("select boom")).rejects.toThrow("syntax error");
    await instrumented.query("rollback");

    expect(contextTxEvents()).toHaveLength(1);
    expect(contextTxEvents()[0]).toMatchObject({ outcome: "rollback" });
  });
});

describe("§16.7: pool saturation", () => {
  it("expõe snapshot used/idle/waiting/max e transações em voo do pool fake", async () => {
    const { instrumented, handle } = await instrumentFakePool({
      driver: "node-postgres",
      totalCount: 4,
      idleCount: 2,
      waitingCount: 1,
      max: 10,
    });
    expect(handle).toBeDefined();

    expect(handle!.read()).toEqual({
      driver: "node-postgres",
      used: 2,
      idle: 2,
      waiting: 1,
      max: 10,
      inFlightTransactions: 0,
    });

    await instrumented.query("begin");
    expect(handle!.read().inFlightTransactions).toBe(1);
    await instrumented.query("select 1");
    await instrumented.query("commit");
    expect(handle!.read().inFlightTransactions).toBe(0);
  });

  it("mede o wait time real do checkout com label driver", async () => {
    const metrics = collectRecordedMetrics();
    const { instrumented } = await instrumentFakePool({ driver: "neon-serverless" });

    await instrumented.query("select 1");

    const waits = metrics.waitRecords();
    expect(waits).toHaveLength(1);
    expect(waits[0].value).toBeGreaterThanOrEqual(0);
    expect(waits[0].attributes).toEqual({ driver: "neon-serverless" });
  });

  it("não reinstrumenta o mesmo pool (um único connect/handle)", async () => {
    const connectSpy = vi.fn(async () => ({ query: async () => ({ rows: [] }) }));
    const pool = {
      connect: connectSpy,
      totalCount: 1,
      idleCount: 1,
      waitingCount: 0,
      options: { max: 5 },
    };
    const first = instrumentPoolRoundTrips(pool, "node-postgres");
    const second = instrumentPoolRoundTrips(pool, "node-postgres");
    if (first) unregisters.push(first.unregister);
    expect(second).toBe(first);
    await (pool.connect as () => Promise<FakeQueryClient>)();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });
});

describe("§16.7: observables defensivos", () => {
  it("agrega snapshots por driver (soma used/idle/waiting/max/in-flight)", () => {
    const snapshots: DatabasePoolSnapshot[] = [
      { driver: "node-postgres", used: 1, idle: 2, waiting: 0, max: 10, inFlightTransactions: 1 },
      { driver: "node-postgres", used: 3, idle: 1, waiting: 2, max: 20, inFlightTransactions: 2 },
      {
        driver: "neon-serverless",
        used: 0,
        idle: 5,
        waiting: 0,
        max: 5,
        inFlightTransactions: 0,
      },
    ];
    expect(aggregatePoolSnapshots(snapshots)).toEqual([
      { driver: "node-postgres", used: 4, idle: 3, waiting: 2, max: 30, inFlightTransactions: 3 },
      { driver: "neon-serverless", used: 0, idle: 5, waiting: 0, max: 5, inFlightTransactions: 0 },
    ]);
  });

  it("emite used/idle/waiting/max e in-flight com label driver", () => {
    const unregister = registerPoolSnapshotSource(() => ({
      driver: "test-driver",
      used: 3,
      idle: 1,
      waiting: 2,
      max: 10,
      inFlightTransactions: 4,
    }));
    try {
      const connections = recordingObservable();
      reportPoolConnectionObservations(connections.result);
      const own = connections.observations.filter(
        (observation) => observation.attributes?.driver === "test-driver",
      );
      expect(own).toEqual([
        { value: 3, attributes: { driver: "test-driver", state: "used" } },
        { value: 1, attributes: { driver: "test-driver", state: "idle" } },
        { value: 2, attributes: { driver: "test-driver", state: "waiting" } },
        { value: 10, attributes: { driver: "test-driver", state: "max" } },
      ]);

      const inFlight = recordingObservable();
      reportPoolInFlightObservations(inFlight.result);
      expect(
        inFlight.observations.filter(
          (observation) => observation.attributes?.driver === "test-driver",
        ),
      ).toEqual([{ value: 4, attributes: { driver: "test-driver" } }]);
    } finally {
      unregister();
    }
  });

  it("não lança quando a fonte ou o exporter lançam", () => {
    const throwingSource = registerPoolSnapshotSource(() => {
      throw new Error("pool destroyed");
    });
    try {
      expect(() =>
        reportPoolConnectionObservations({
          observe: () => {
            throw new Error("exporter down");
          },
        } as unknown as ObservableResult),
      ).not.toThrow();
      expect(() =>
        reportPoolInFlightObservations({
          observe: () => {
            throw new Error("exporter down");
          },
        } as unknown as ObservableResult),
      ).not.toThrow();
    } finally {
      throwingSource();
    }
  });
});
