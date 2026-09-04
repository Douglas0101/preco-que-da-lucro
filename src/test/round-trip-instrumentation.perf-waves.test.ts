import { afterEach, describe, expect, it, vi } from "vitest";
import { instrumentPoolRoundTrips } from "@/db/client.server";

interface FakeQueryClient {
  query: (...args: unknown[]) => Promise<unknown>;
}

async function instrumentFakePool() {
  const events: Record<string, unknown>[] = [];
  vi.spyOn(console, "info").mockImplementation((record: unknown) => {
    events.push(JSON.parse(String(record)) as Record<string, unknown>);
  });
  const queries: unknown[][] = [];
  const client: FakeQueryClient = {
    query: vi.fn(async (...args: unknown[]) => {
      queries.push(args);
      return { rows: [] };
    }),
  };
  const pool = { connect: async () => client };
  instrumentPoolRoundTrips(pool);
  const instrumented = await (pool.connect as () => Promise<FakeQueryClient>)();
  const contextTxEvents = () => events.filter((record) => record.event === "app.context_tx");
  return { instrumented, queries, contextTxEvents };
}

afterEach(() => {
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
