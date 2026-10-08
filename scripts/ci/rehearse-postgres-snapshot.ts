import { execFile } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  chmodSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { postgresSnapshot, cycleDeadline, type SourceIdentity } from "./backup-cycle.ts";

// A real archive exercise of the exported collector. Fixture GUCs deliberately
// emulate its identity contract; they provide no evidence about a Neon resource.
const IMAGE = "sha256:d4bb0a8c1b7bb2e29f976d099e7bfb9a5d8858cffe9e46b35cd302cd1f1f8168";
const ROLES = `CREATE ROLE fixture_owner NOLOGIN;
CREATE ROLE app_runtime NOLOGIN;
CREATE ROLE fixture_member NOLOGIN;
CREATE ROLE backup_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
GRANT app_runtime TO fixture_member;
GRANT pg_read_all_data TO backup_reader;`;
const FIXTURE = `SET ROLE fixture_owner;
CREATE SCHEMA drizzle; CREATE SCHEMA neon_auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TYPE public.product_state AS ENUM ('draft','ready');
CREATE TABLE public.tenants(id uuid PRIMARY KEY, label text NOT NULL);
INSERT INTO public.tenants VALUES ('01000000-0000-4000-8000-000000000001','tenant A'),('02000000-0000-4000-8000-000000000002','tenant B');
CREATE TABLE public.products(id serial PRIMARY KEY, tenant_id uuid REFERENCES public.tenants(id), amount numeric(12,2), state public.product_state DEFAULT 'draft');
INSERT INTO public.products(tenant_id,amount) VALUES ('01000000-0000-4000-8000-000000000001',12.34),('02000000-0000-4000-8000-000000000002',56.78),('02000000-0000-4000-8000-000000000002',90.12);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_policy ON public.products TO app_runtime USING (tenant_id=current_setting('app.tenant_id',true)::uuid);
GRANT SELECT ON public.products TO app_runtime;
CREATE TABLE public.exclusion_ledger(id serial PRIMARY KEY, entity_id uuid NOT NULL);
INSERT INTO public.exclusion_ledger(entity_id) VALUES ('03000000-0000-4000-8000-000000000003');
CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint NOT NULL);
INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES(repeat('a',64),1790000000000);
CREATE TABLE neon_auth.accounts(id uuid PRIMARY KEY,label text);
INSERT INTO neon_auth.accounts VALUES ('04000000-0000-4000-8000-000000000004','synthetic account');
CREATE TABLE neon_auth.sessions(id uuid PRIMARY KEY,account_id uuid REFERENCES neon_auth.accounts(id));
INSERT INTO neon_auth.sessions VALUES ('05000000-0000-4000-8000-000000000005','04000000-0000-4000-8000-000000000004');
CREATE FUNCTION public.product_count() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.products';
CREATE VIEW public.product_amounts AS SELECT id,amount FROM public.products;
CREATE FUNCTION public.keep_amount() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END';
CREATE TRIGGER keep_amount BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.keep_amount();`;

export async function rehearse(directory: string) {
  const base = resolve(directory);
  mkdirSync(base, { recursive: true, mode: 0o700 });
  chmodSync(base, 0o700);
  const root = mkdtempSync(join(base, "snapshot-")),
    tag = randomUUID();
  const network = `pqdl-c28-${tag}`;
  let networkId: string | null = null;
  const log = join(root, "commands.jsonl"),
    left = cycleDeadline();
  let step = "preconditions";
  const containers: { id: string; port: number }[] = [],
    clients: Client[] = [];
  const cleanup: { id: string; absent: boolean }[] = [];
  let result: Record<string, unknown> = { verdict: "PRECONDITION" };
  const run = (args: string[], input?: string): Promise<Buffer> =>
    new Promise((accept, reject) => {
      const child = execFile(
        "docker",
        args,
        {
          encoding: "buffer",
          timeout: step.startsWith("cleanup:") ? 30000 : Math.min(left(), 30000),
          maxBuffer: 8 * 1024 ** 2,
        },
        (error, stdout, stderr) => {
          appendFileSync(
            log,
            JSON.stringify({
              step,
              command: ["docker", ...args],
              success: !error,
              stderr: stderr.toString(),
            }) + "\n",
            { mode: 0o600 },
          );
          if (error) reject(new Error(`fixture step failed: ${step}`));
          else accept(stdout);
        },
      );
      child.stdin?.end(input);
    });
  const inspect = async (id: string) => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("container identity invalid");
    return JSON.parse((await run(["inspect", id])).toString())[0];
  };
  const owned = async (c: { id: string; port: number }, requirePorts = true) => {
    const x = await inspect(c.id);
    const ports = x.NetworkSettings.Ports?.["5432/tcp"];
    if (
      x.Id !== c.id ||
      x.Image !== IMAGE ||
      x.Config.Labels?.["pqdl.c28.snapshot"] !== tag ||
      x.HostConfig.NetworkMode !== network ||
      (requirePorts &&
        (!Array.isArray(ports) ||
          ports.length !== 1 ||
          ports[0].HostIp !== "127.0.0.1" ||
          Number(ports[0].HostPort) !== c.port ||
          c.port === 5432 ||
          c.port < 1024 ||
          c.port > 65535))
    )
      throw new Error("owned isolated container precondition failed");
  };
  const sql = (c: { id: string }, text: string, db = "fixture") =>
    run(["exec", "-i", c.id, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1"], text);
  const source: SourceIdentity = {
    projectId: "fixture-c28-readonly",
    branchId: "br-fixture-c28-snapshot",
    endpointId: "ep-fixture-c28-snapshot",
    database: "fixture",
    role: "backup_reader",
    revision: await new Promise<string>((accept, reject) =>
      execFile("git", ["rev-parse", "HEAD"], { encoding: "utf8" }, (e, out) =>
        e ? reject(e) : accept(out.trim()),
      ),
    ),
    keyId: "fixture-only",
    requiredSchemas: ["public", "drizzle", "neon_auth"],
    exclusionLedger: "public.exclusion_ledger",
  };
  const connect = async (c: { port: number }, user: string) => {
    const client = new Client({
      host: "127.0.0.1",
      port: c.port,
      user,
      database: "fixture",
      ssl: false,
    });
    clients.push(client);
    await client.connect();
    return client;
  };
  const dump = async (c: { id: string; port: number }, id: string, file: string) => {
    await owned(c);
    await run([
      "exec",
      c.id,
      "pg_dump",
      "-U",
      "backup_reader",
      "-d",
      "fixture",
      "--no-password",
      "--format=custom",
      `--snapshot=${id}`,
      "--file=/tmp/fixture.pgc",
    ]);
    await run(["cp", `${c.id}:/tmp/fixture.pgc`, file]);
    chmodSync(file, 0o600);
  };
  const check = (condition: unknown, name: string) => {
    if (!condition) throw new Error(`fixture assertion failed: ${name}`);
  };
  try {
    const image = JSON.parse((await run(["image", "inspect", IMAGE])).toString())[0];
    check(image.Id === IMAGE, "immutable PG17 image");
    const context = JSON.parse((await run(["context", "inspect"])).toString())[0];
    check(context.Endpoints?.docker?.Host?.startsWith("unix://"), "local Docker context");
    // Docker Desktop runs in another kernel. Its bind-mounted Unix socket
    // cannot serve the host Node process. Use explicit ephemeral loopback TCP
    // and a dedicated bridge, verified before the collector connects. An
    // internal Docker bridge suppresses publishing; it cannot serve this host.
    step = "network:create";
    networkId = (await run(["network", "create", "--label", `pqdl.c28.snapshot=${tag}`, network]))
      .toString()
      .trim();
    check(/^[a-f0-9]{64}$/.test(networkId), "owned network identity");
    const net = JSON.parse((await run(["network", "inspect", networkId])).toString())[0];
    check(
      net.Driver === "bridge" && net.Labels?.["pqdl.c28.snapshot"] === tag,
      "owned dedicated bridge",
    );
    for (const kind of ["source", "restore"]) {
      step = `${kind}:create`;
      const id = (
        await run([
          "run",
          "-d",
          "--label",
          `pqdl.c28.snapshot=${tag}`,
          `--network=${network}`,
          "--publish",
          "127.0.0.1::5432",
          "--env",
          "POSTGRES_HOST_AUTH_METHOD=trust",
          IMAGE,
          "-c",
          `neon.project_id=${source.projectId}`,
          "-c",
          `neon.branch_id=${source.branchId}`,
          "-c",
          `neon.endpoint_id=${source.endpointId}`,
        ])
      )
        .toString()
        .trim();
      const port = Number(
        JSON.parse((await run(["inspect", id])).toString())[0].NetworkSettings.Ports?.[
          "5432/tcp"
        ]?.[0]?.HostPort,
      );
      const c = { id, port };
      containers.push(c);
      await owned(c);
      check(
        !containers.slice(0, -1).some((other) => other.port === port),
        "distinct fixture ports",
      );
      step = `${kind}:readiness`;
      const until = performance.now() + 40000;
      for (;;) {
        // The image also runs a temporary postmaster during initialization.
        // A successful pg_isready against that server is not final readiness.
        try {
          check(
            (await run(["exec", id, "cat", "/proc/1/comm"])).toString().trim() === "postgres",
            "final postmaster PID1",
          );
          await run(["exec", id, "pg_isready", "-U", "postgres"]);
          break;
        } catch {
          if (performance.now() >= until) throw new Error("observable PG17 readiness absent");
        }
      }
      step = `${kind}:roles/database`;
      await sql(c, ROLES, "postgres");
      await run(["exec", id, "createdb", "-U", "postgres", "--owner=fixture_owner", "fixture"]);
    }
    step = "source:fixture";
    await sql(containers[0], FIXTURE);
    const reader = await connect(containers[0], "backup_reader"),
      writer = await connect(containers[0], "postgres");
    const restored = await connect(containers[1], "backup_reader"),
      admin = await connect(containers[1], "postgres");
    step = "source:collector/archive";
    const archive = join(root, "source.pgc");
    const before = await postgresSnapshot(
      reader,
      source,
      archive,
      async (id, file) => {
        await writer.query(
          "INSERT INTO public.products(tenant_id,amount) VALUES ('01000000-0000-4000-8000-000000000001',123.45)",
        );
        await dump(containers[0], id, file);
      },
      left,
    );
    check(readFileSync(archive).subarray(0, 5).toString() === "PGDMP", "real custom archive");
    step = "restore:archive";
    await run(["cp", archive, `${containers[1].id}:/tmp/source.pgc`]);
    await run([
      "exec",
      containers[1].id,
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "fixture",
      "--exit-on-error",
      "/tmp/source.pgc",
    ]);
    step = "restore:collector/parity";
    const after = await postgresSnapshot(
      restored,
      source,
      join(root, "restored.pgc"),
      (id, file) => dump(containers[1], id, file),
      left,
    );
    const surfaces = [
      "identity",
      "schemas",
      "tables",
      "journal",
      "catalog",
      "roles",
      "memberships",
    ].map((surface) => ({
      surface,
      equal: JSON.stringify(before.inventory[surface]) === JSON.stringify(after.inventory[surface]),
    }));
    writeFileSync(join(root, "before.json"), JSON.stringify(before, null, 2) + "\n", {
      mode: 0o600,
    });
    writeFileSync(join(root, "after.json"), JSON.stringify(after, null, 2) + "\n", { mode: 0o600 });
    check(
      surfaces.every((x) => x.equal),
      "full discovered inventory parity",
    );
    check(
      (await writer.query("SELECT count(*)::int AS n FROM public.products")).rows[0].n === 4,
      "concurrent writer committed",
    );
    check(
      (await admin.query("SELECT count(*)::int AS n FROM public.products")).rows[0].n === 3,
      "writer excluded by exported snapshot",
    );
    step = "negative:identity";
    let refusedIdentity = false,
      dumpCalled = false;
    try {
      await postgresSnapshot(
        restored,
        { ...source, branchId: "br-fixture-wrong" },
        join(root, "wrong.pgc"),
        async () => {
          dumpCalled = true;
        },
        left,
      );
    } catch {
      refusedIdentity = true;
    }
    check(refusedIdentity && !dumpCalled, "wrong identity blocked before dump");
    step = "negative:select";
    await admin.query("REVOKE pg_read_all_data FROM backup_reader");
    let refusedRead = false;
    dumpCalled = false;
    try {
      await postgresSnapshot(
        restored,
        source,
        join(root, "denied.pgc"),
        async () => {
          dumpCalled = true;
        },
        left,
      );
    } catch {
      refusedRead = true;
    }
    check(refusedRead && !dumpCalled, "missing read blocked before dump");
    await admin.query("GRANT pg_read_all_data TO backup_reader");
    step = "negative:acl";
    await admin.query("REVOKE SELECT ON public.products FROM app_runtime");
    const altered = await postgresSnapshot(
      restored,
      source,
      join(root, "altered.pgc"),
      (id, file) => dump(containers[1], id, file),
      left,
    );
    check(
      JSON.stringify(before.inventory.catalog) !== JSON.stringify(altered.inventory.catalog),
      "ACL change detected",
    );
    result = {
      verdict: "LOCAL-FIXTURE-PASS",
      image: IMAGE,
      sourceRevision: source.revision,
      surfaces,
      discoveredTables: Object.keys(before.inventory.tables as object),
      concurrentWriter: { sourceProducts: 4, archiveProducts: 3 },
      negatives: { refusedIdentity, refusedRead, aclChangeDetected: true },
      archiveSha256: createHash("sha256").update(readFileSync(archive)).digest("hex"),
      durationMs: 300000 - left(),
      isolation: {
        networkId,
        dedicatedBridge: true,
        loopbackOnly: true,
        ports: containers.map((c) => c.port),
      },
      limits:
        "Synthetic PG17 identity/rows/roles only; no Neon, AWS, login, independent custody or operational RPO/RTO verdict.",
    };
  } catch (error) {
    result = {
      verdict: "PRECONDITION",
      failedStep: step,
      reason: error instanceof Error ? error.message : "fixture precondition failed",
      limits: "No external resource contacted; detailed synthetic stderr retained privately.",
    };
    process.exitCode = 2;
  } finally {
    await Promise.allSettled(clients.map((client) => client.end()));
    step = "cleanup:owned-containers";
    for (const c of containers) {
      await owned(c, false);
      await run(["rm", "-f", c.id]);
      // Query each identity independently; only absence of this exact owned ID
      // is accepted. Other fixture containers can still be alive during cleanup.
      const labelled = (
        await run([
          "ps",
          "-a",
          "--no-trunc",
          "--filter",
          `label=pqdl.c28.snapshot=${tag}`,
          "--format",
          "{{.ID}}",
        ])
      )
        .toString()
        .trim()
        .split("\n");
      const all = (await run(["ps", "-a", "--no-trunc", "--format", "{{.ID}}"]))
        .toString()
        .trim()
        .split("\n");
      const absent = !all.includes(c.id) && !labelled.includes(c.id);
      cleanup.push({ id: c.id, absent });
      check(absent, "owned container absent");
    }
    if (networkId) {
      const net = JSON.parse((await run(["network", "inspect", networkId])).toString())[0];
      check(
        net.Id === networkId &&
          net.Driver === "bridge" &&
          net.Labels?.["pqdl.c28.snapshot"] === tag,
        "cleanup owned network",
      );
      await run(["network", "rm", networkId]);
      const networks = (await run(["network", "ls", "--no-trunc", "--format", "{{.ID}}"]))
        .toString()
        .trim()
        .split("\n");
      check(!networks.includes(networkId), "owned network absent");
    }
    writeFileSync(
      join(root, "result.json"),
      JSON.stringify({ schema: "snapshot-rehearsal/1", ...result, root, cleanup }, null, 2) + "\n",
      { mode: 0o600 },
    );
  }
  console.log(JSON.stringify({ ...result, root, cleanup }));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error("private output directory required");
  await rehearse(process.argv[2]);
}
