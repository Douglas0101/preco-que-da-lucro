import { randomUUID, createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  writeSync,
  fsyncSync,
  lstatSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { mkdir, writeFile, rename, rm } from "node:fs/promises";
import { resolve, join, isAbsolute, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, type PoolClient } from "pg";
import { awsCli } from "./independent-backup.ts";
import {
  object,
  privateJson,
  metadata,
  recoveryConfig,
  bucketPreflight,
  fingerprint,
  sealDump,
  sealInventory,
  uploadEncrypted,
  verifyVersion,
  type RecoveryConfig,
  type BackupMetadata,
  type UploadReceipt,
  type AwsCall,
} from "../lib/independent-backup.ts";

export const INTERVAL_MS = 300000;
const CHECKS = [
  "inventory",
  "authLogin",
  "journal",
  "ownership",
  "grants",
  "rls",
  "exclusionLedger",
  "independentKey",
  "revision",
];
export interface SourceIdentity {
  projectId: string;
  branchId: string;
  endpointId: string;
  database: string;
  role: string;
  revision: string;
  keyId: string;
  requiredSchemas: string[];
  exclusionLedger: string;
}
export interface CycleConfig {
  schema: "backup-cycle-config/1";
  recovery: RecoveryConfig;
  source: SourceIdentity;
  keyFile: string;
  qualificationFile: string;
  stateDirectory: string;
  codeDirectory: string;
  nodeExecutable: string;
  environmentFile: string;
}
const token = (v: unknown, re: RegExp) => typeof v === "string" && re.test(v);
function absolute(v: unknown): string {
  if (!token(v, /^\/[a-zA-Z0-9_./-]+$/) || !isAbsolute(v as string) || resolve(v as string) !== v)
    throw new Error("explicit normalized absolute path required");
  return v as string;
}
export function cycleConfig(value: unknown): CycleConfig {
  const v = object(value),
    s = object(v.source);
  const requiredSchemas = s.requiredSchemas;
  if (
    v.schema !== "backup-cycle-config/1" ||
    !token(s.projectId, /^[a-z][a-z0-9-]{3,80}$/) ||
    !token(s.branchId, /^br-[a-z0-9-]{4,80}$/) ||
    !token(s.endpointId, /^ep-[a-z0-9-]{4,80}$/) ||
    !token(s.database, /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/) ||
    !token(s.role, /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/) ||
    ["app_runtime", "neondb_owner", "postgres"].includes(String(s.role)) ||
    !token(s.revision, /^[a-f0-9]{40}$/) ||
    /^0+$/.test(String(s.revision)) ||
    !token(s.keyId, /^[a-zA-Z0-9_-]{1,64}$/) ||
    !Array.isArray(requiredSchemas) ||
    requiredSchemas.length < 3 ||
    new Set(requiredSchemas).size !== requiredSchemas.length ||
    requiredSchemas.some((x) => !token(x, /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/)) ||
    ["public", "drizzle", "neon_auth"].some((x) => !requiredSchemas.includes(x)) ||
    !token(s.exclusionLedger, /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/)
  )
    throw new Error("complete nominal source/backup role/schema/ledger required");
  const source: SourceIdentity = {
    projectId: s.projectId as string,
    branchId: s.branchId as string,
    endpointId: s.endpointId as string,
    database: s.database as string,
    role: s.role as string,
    revision: s.revision as string,
    keyId: s.keyId as string,
    requiredSchemas: [...requiredSchemas].sort() as string[],
    exclusionLedger: s.exclusionLedger as string,
  };
  return {
    schema: "backup-cycle-config/1",
    recovery: recoveryConfig(v.recovery),
    source,
    keyFile: absolute(v.keyFile),
    qualificationFile: absolute(v.qualificationFile),
    stateDirectory: absolute(v.stateDirectory),
    codeDirectory: absolute(v.codeDirectory),
    nodeExecutable: absolute(v.nodeExecutable),
    environmentFile: absolute(v.environmentFile),
  };
}
function iso(value: unknown): number {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("precise UTC timestamp required");
  return Date.parse(value);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function qualified(value: unknown, c: CycleConfig, now: Date) {
  const q = object(value),
    completed = iso(q.completedAt);
  if (
    q.schema !== "backup-qualification/1" ||
    q.phase !== "EXTERNAL-RESTORE-VERIFIED" ||
    !same(c.source, cycleConfig({ ...c, source: q.source }).source) ||
    !same(recoveryConfig(q.recovery), c.recovery) ||
    completed > now.getTime() ||
    now.getTime() - completed > 30 * 86400000 ||
    typeof q.cycleSeconds !== "number" ||
    !Number.isFinite(q.cycleSeconds) ||
    q.cycleSeconds <= 0 ||
    q.cycleSeconds >= 300 ||
    !token(q.evidenceSha256, /^[a-f0-9]{64}$/) ||
    /^0+$/.test(String(q.evidenceSha256))
  )
    throw new Error("current external qualification required");
  const scenarios = object(q.scenarios);
  for (const name of ["providerLoss", "mainAccountLoss"]) {
    const scenario = object(scenarios[name]),
      checks = object(scenario.checks);
    if (
      typeof scenario.rpoSeconds !== "number" ||
      !Number.isFinite(scenario.rpoSeconds) ||
      scenario.rpoSeconds < 0 ||
      scenario.rpoSeconds > 900 ||
      typeof scenario.rtoSeconds !== "number" ||
      !Number.isFinite(scenario.rtoSeconds) ||
      scenario.rtoSeconds <= 0 ||
      scenario.rtoSeconds > 14400 ||
      !token(
        scenario.restoreTarget,
        new RegExp(
          `^arn:aws:ec2:${c.recovery.region}:${c.recovery.recoveryAccountId}:instance/i-(?:[a-f0-9]{8}|[a-f0-9]{17})$`,
        ),
      ) ||
      CHECKS.some((k) => checks[k] !== "PASS")
    )
      throw new Error("both isolated AWS recovery scenarios must satisfy all checks and RPO/RTO");
  }
  const versions = pair(q.versions, c);
  if (iso(versions[0].meta.snapshotAt) > completed)
    throw new Error("qualification snapshot follows completion");
  return versions;
}
function pair(value: unknown, c: CycleConfig): [UploadReceipt, UploadReceipt] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new Error("two verified ciphertext versions required");
  const [dump, inv] = value.map((v) => object(v) as unknown as UploadReceipt);
  for (const r of [dump, inv]) {
    const m = metadata(r.meta);
    if (
      r.schema !== "independent-upload/1" ||
      r.phase !== "LOCKED-CIPHERTEXT-VERIFIED" ||
      m.sourceRevision !== c.source.revision ||
      m.keyId !== c.source.keyId ||
      r.bucket !== c.recovery.bucket ||
      r.region !== c.recovery.region ||
      r.account !== c.recovery.recoveryAccountId ||
      !r.key?.startsWith(c.recovery.prefix + "/") ||
      !token(r.versionId, /^[\x21-\x7e]{1,1024}$/) ||
      r.versionId === "null" ||
      !token(r.sha256, /^[a-f0-9]{64}$/) ||
      !Number.isSafeInteger(r.bytes) ||
      r.bytes <= 0 ||
      iso(r.retainUntil) < iso(m.snapshotAt) + 35 * 86400000
    )
      throw new Error("durable version identity/retention mismatch");
  }
  if (!same(dump.meta, inv.meta) || dump.key === inv.key || dump.sha256 === inv.sha256)
    throw new Error("dump/inventory pair identity mismatch");
  return [dump, inv];
}
export interface DurableReceipt {
  schema: "backup-cycle/1";
  phase: "DURABLE";
  meta: BackupMetadata;
  completedAt: string;
  durationMs: number;
  dailyAnchor: boolean;
  qualificationSha256: string;
  versions: [UploadReceipt, UploadReceipt];
}
export function durable(value: unknown, c: CycleConfig): DurableReceipt {
  const r = object(value),
    versions = pair(r.versions, c),
    m = metadata(r.meta);
  if (
    r.schema !== "backup-cycle/1" ||
    r.phase !== "DURABLE" ||
    !same(m, versions[0].meta) ||
    iso(r.completedAt) < iso(m.snapshotAt) ||
    typeof r.durationMs !== "number" ||
    !Number.isFinite(r.durationMs) ||
    r.durationMs < 0 ||
    r.durationMs >= INTERVAL_MS ||
    typeof r.dailyAnchor !== "boolean" ||
    !token(r.qualificationSha256, /^[a-f0-9]{64}$/)
  )
    throw new Error("complete durable snapshot receipt required");
  return r as unknown as DurableReceipt;
}
export function snapshotAge(value: unknown, c: CycleConfig, now: Date) {
  try {
    const r = durable(value, c),
      ageSeconds = (now.getTime() - iso(r.meta.snapshotAt)) / 1000;
    if (ageSeconds < 0 || iso(r.completedAt) > now.getTime()) throw new Error("clock rollback");
    return {
      state: ageSeconds > 900 ? "INCIDENT" : ageSeconds >= 600 ? "WARN" : "HEALTHY",
      ageSeconds,
      snapshotAt: r.meta.snapshotAt,
    };
  } catch {
    return { state: "UNKNOWN", ageSeconds: null, snapshotAt: null };
  }
}
function privateDirectory(path: string) {
  const stat = lstatSync(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o077) !== 0 ||
    realpathSync(path) !== resolve(path) ||
    (process.getuid && stat.uid !== process.getuid())
  )
    throw new Error("owned private directory required");
}
function syncDirectory(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function append(path: string, value: unknown) {
  const fd = openSync(
    path,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const st = fstatSync(fd);
    if (
      !st.isFile() ||
      st.nlink !== 1 ||
      (st.mode & 0o077) !== 0 ||
      (process.getuid && st.uid !== process.getuid())
    )
      throw new Error("private append-only receipt required");
    const bytes = Buffer.from(JSON.stringify(value) + "\n");
    let at = 0;
    while (at < bytes.length) {
      const wrote = writeSync(fd, bytes, at, bytes.length - at);
      if (wrote <= 0) throw new Error("receipt write incomplete");
      at += wrote;
    }
    fsyncSync(fd);
    syncDirectory(dirname(path));
  } finally {
    closeSync(fd);
  }
}
export function cycleDeadline(clock = () => performance.now()) {
  const started = clock();
  return () => {
    const elapsed = clock() - started;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= INTERVAL_MS)
      throw new Error("absolute cycle deadline exceeded");
    return Math.floor(INTERVAL_MS - elapsed);
  };
}
export interface SnapshotResult {
  snapshotAt: string;
  inventory: Record<string, unknown>;
}
export async function runCycle(
  c: CycleConfig,
  deps: {
    aws: AwsCall;
    snapshot: (output: string, remaining: () => number) => Promise<SnapshotResult>;
    now?: () => Date;
    clock?: () => number;
  },
) {
  privateDirectory(c.stateDirectory);
  const lock = join(c.stateDirectory, "cycle.lock"),
    fd = openSync(lock, "wx", 0o600);
  try {
    writeSync(fd, JSON.stringify({ phase: "INTENT", pid: process.pid }) + "\n");
    fsyncSync(fd);
    syncDirectory(c.stateDirectory);
  } finally {
    closeSync(fd);
  } // Never steal a stale lock: operator reconciles uncertain receipts.
  const now = deps.now ?? (() => new Date()),
    remaining = cycleDeadline(deps.clock);
  const meta = metadata({
    schema: "independent-backup/1",
    backupId: randomUUID(),
    sourceRevision: c.source.revision,
    snapshotAt: now().toISOString(),
    keyId: c.source.keyId,
  });
  const attempts = join(c.stateDirectory, "attempts");
  const root = join(attempts, meta.backupId),
    latest = join(c.stateDirectory, "latest.json");
  const record = (r: unknown) => append(join(root, "receipts.jsonl"), r);
  try {
    await mkdir(attempts, { recursive: true, mode: 0o700 });
    privateDirectory(attempts);
    await mkdir(root, { mode: 0o700 });
    record({ schema: "backup-cycle-intent/1", meta, phase: "INTENT" });
    const versions = qualified(privateJson(c.qualificationFile), c, now());
    const qhash = (await fingerprint(c.qualificationFile)).sha256;
    const aws: AwsCall = async (...args) => {
      remaining();
      const result = await deps.aws(...args);
      remaining();
      return result;
    };
    await bucketPreflight(c.recovery, aws);
    for (const v of versions) await verifyVersion(c.recovery, v, aws);
    const previous = existsSync(latest) ? durable(privateJson(latest), c) : undefined;
    if (previous && snapshotAge(previous, c, now()).state === "UNKNOWN")
      throw new Error("previous durable receipt or clock invalid");
    const dumpPath = join(root, "snapshot.pgc");
    const snapshot = await deps.snapshot(dumpPath, remaining);
    remaining();
    iso(snapshot.snapshotAt);
    if (
      iso(snapshot.snapshotAt) > now().getTime() ||
      now().getTime() - iso(snapshot.snapshotAt) >= INTERVAL_MS ||
      (previous && iso(snapshot.snapshotAt) <= iso(previous.meta.snapshotAt))
    )
      throw new Error("snapshot time stale/regressive");
    meta.snapshotAt = snapshot.snapshotAt;
    if (lstatSync(dumpPath).size > 4 * 1024 ** 3 - 8192)
      throw new Error("archive exceeds encrypted single PUT size budget");
    const plain = await fingerprint(dumpPath);
    if (plain.bytes > 4 * 1024 ** 3)
      throw new Error("archive exceeds qualified 4GiB single PUT limit");
    const sealed = await sealDump(dumpPath, c.keyFile, meta, join(root, "sealed-dump"));
    remaining();
    const recordUpload = async (receipt: UploadReceipt) => {
      record(receipt);
    };
    const dump = await uploadEncrypted(sealed.file, c.recovery, aws, recordUpload, now());
    const manifest = join(root, "inventory.json");
    await writeFile(
      manifest,
      JSON.stringify({
        schema: "independent-inventory/1",
        meta,
        dumpSha256: plain.sha256,
        inventory: { ...snapshot.inventory, dumpVersion: dump },
      }),
      { mode: 0o600, flag: "wx" },
    );
    const encryptedInventory = await sealInventory(
      manifest,
      c.keyFile,
      meta,
      join(root, "sealed-inventory"),
    );
    remaining();
    const inv = await uploadEncrypted(
      encryptedInventory.file,
      c.recovery,
      aws,
      recordUpload,
      now(),
    );
    const receipt = durable(
      {
        schema: "backup-cycle/1",
        phase: "DURABLE",
        meta,
        completedAt: now().toISOString(),
        durationMs: INTERVAL_MS - remaining(),
        dailyAnchor:
          !previous || previous.meta.snapshotAt.slice(0, 10) !== meta.snapshotAt.slice(0, 10),
        qualificationSha256: qhash,
        versions: [dump, inv],
      },
      c,
    );
    record(receipt);
    const temp = join(root, "latest-new.json");
    append(temp, receipt);
    await rename(temp, latest);
    syncDirectory(c.stateDirectory);
    for (const file of [dumpPath, manifest, sealed.file, encryptedInventory.file]) await rm(file);
    await rm(lock);
    syncDirectory(c.stateDirectory);
    return receipt;
  } catch {
    if (existsSync(root))
      record({
        schema: "backup-cycle-failure/1",
        phase: "RECONCILE",
        backupId: meta.backupId,
        observedAt: now().toISOString(),
        reason: "precondition/verification failed; raw provider data withheld",
      });
    throw new Error("backup cycle blocked; preserve lock/receipts and reconcile before retry");
  }
}
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
export async function postgresSnapshot(
  client: Pick<PoolClient, "query">,
  source: SourceIdentity,
  output: string,
  dump: (snapshotId: string, output: string, remaining: () => number) => Promise<void>,
  remaining: () => number,
): Promise<SnapshotResult> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL row_security = off");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const info = (
      await client.query(`select current_setting('server_version_num') as version, current_database() as database, current_user as role,
      current_setting('neon.project_id',true) as project_id, current_setting('neon.branch_id',true) as branch_id,
      current_setting('neon.endpoint_id',true) as endpoint_id, current_setting('transaction_read_only') as read_only`)
    ).rows[0];
    const role = (
      await client.query(
        "select rolsuper,rolcreaterole,rolcreatedb,rolreplication from pg_roles where rolname=current_user",
      )
    ).rows[0];
    if (
      !info ||
      !String(info.version).startsWith("17") ||
      info.database !== source.database ||
      info.role !== source.role ||
      info.project_id !== source.projectId ||
      info.branch_id !== source.branchId ||
      info.endpoint_id !== source.endpointId ||
      info.read_only !== "on" ||
      !role ||
      Object.values(role).some((v) => v !== false)
    )
      throw new Error("read-only server identity/backup role mismatch");
    const writes = (
      await client.query(
        "select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname !~ '^pg_' and n.nspname<>'information_schema' and has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')) as table_write,exists(select 1 from pg_namespace n where n.nspname !~ '^pg_' and n.nspname<>'information_schema' and has_schema_privilege(current_user,n.oid,'CREATE')) as schema_write",
      )
    ).rows[0];
    if (!writes || writes.table_write !== false || writes.schema_write !== false)
      throw new Error("backup role must lack writes/schema creation");
    const snapshot = (
      await client.query("select pg_export_snapshot() as id, clock_timestamp() as at")
    ).rows[0];
    if (!snapshot || !token(snapshot.id, /^[a-fA-F0-9-]+$/))
      throw new Error("exported snapshot unavailable");
    const snapshotAt = new Date(snapshot.at).toISOString();
    const schemas = (
      await client.query(
        "select nspname as name,pg_get_userbyid(nspowner) as owner,nspacl::text as acl from pg_namespace where nspname !~ '^pg_' and nspname <> 'information_schema' order by 1",
      )
    ).rows;
    if (source.requiredSchemas.some((name) => !schemas.some((s) => s.name === name)))
      throw new Error("required schema absent");
    const unsupported = (
      await client.query(
        "select (select count(*) from pg_foreign_table) as foreign_tables,(select count(*) from pg_largeobject_metadata) as large_objects",
      )
    ).rows[0];
    if (
      !unsupported ||
      ![0, "0"].includes(unsupported.foreign_tables) ||
      ![0, "0"].includes(unsupported.large_objects)
    )
      throw new Error("foreign tables/large objects require separate qualified inventory");
    const names = (
      await client.query(
        "select n.nspname as schema,c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','m') and n.nspname !~ '^pg_' and n.nspname<>'information_schema' order by 1,2",
      )
    ).rows;
    if (
      !names.length ||
      !names.some((t) => t.schema + "." + t.name === source.exclusionLedger) ||
      !names.some((t) => t.schema === "drizzle" && t.name === "__drizzle_migrations")
    )
      throw new Error("required ledger/journal/tables absent");
    const tables: Record<string, unknown> = {};
    for (const table of names) {
      remaining();
      const cursor = "inventory_rows";
      await client.query(
        `DECLARE ${cursor} NO SCROLL CURSOR FOR select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as hash from ${quote(table.schema)}.${quote(table.name)} t order by 1`,
      );
      const hash = createHash("sha256");
      let count = 0;
      try {
        for (;;) {
          remaining();
          const rows = (await client.query(`FETCH 4096 FROM ${cursor}`)).rows;
          if (!rows.length) break;
          for (const row of rows) {
            if (!token(row.hash, /^[a-f0-9]{64}$/)) throw new Error("row hash absent");
            hash.update(row.hash + "\n");
            count++;
          }
          if (!Number.isSafeInteger(count)) throw new Error("inventory count overflow");
        }
      } finally {
        await client.query(`CLOSE ${cursor}`);
      }
      tables[table.schema + "." + table.name] = { count, checksum: hash.digest("hex") };
    }
    const journal = (
      await client.query(
        "select hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id",
      )
    ).rows;
    if (!journal.length || journal.some((j) => !token(j.hash, /^[a-f0-9]{64}$/)))
      throw new Error("journal missing/invalid");
    const catalog = (
      await client.query(`select 'table' as kind,schemaname as schema,tablename as name,jsonb_build_object('owner',tableowner,'rls',rowsecurity) as definition from pg_tables where schemaname !~ '^pg_' and schemaname<>'information_schema'
      union all select 'policy',schemaname,tablename || '.' || policyname,to_jsonb(p) from pg_policies p where schemaname !~ '^pg_' and schemaname<>'information_schema'
      union all select 'constraint',n.nspname,c.relname || '.' || x.conname,jsonb_build_object('sql',pg_get_constraintdef(x.oid)) from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'index',schemaname,indexname,jsonb_build_object('sql',indexdef) from pg_indexes where schemaname !~ '^pg_' and schemaname<>'information_schema'
      union all select 'grant',table_schema,table_name || '.' || grantee || '.' || privilege_type,to_jsonb(g) from information_schema.role_table_grants g where table_schema !~ '^pg_' and table_schema<>'information_schema'
      union all select 'column',table_schema,table_name || '.' || column_name,to_jsonb(a) from information_schema.columns a where table_schema !~ '^pg_' and table_schema<>'information_schema'
      union all select 'sequence',schemaname,sequencename,to_jsonb(s)-'last_value' from pg_sequences s where schemaname !~ '^pg_' and schemaname<>'information_schema'
      union all select 'function',n.nspname,p.oid::regprocedure::text,jsonb_build_object('sql',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in ('f','p') and n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'relation',n.nspname,c.relname,jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid) else null end) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p','S','v','m') and n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'column-acl',n.nspname,c.relname || '.' || a.attname,jsonb_build_object('acl',a.attacl::text) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and not a.attisdropped and n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'trigger',n.nspname,c.relname || '.' || t.tgname,jsonb_build_object('sql',pg_get_triggerdef(t.oid),'enabled',t.tgenabled) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'type',n.nspname,t.typname,jsonb_build_object('kind',t.typtype,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'base',case when t.typtype='d' then format_type(t.typbasetype,t.typtypmod) else null end,'notnull',t.typnotnull,'default',t.typdefault,'enum',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid),'constraints',array(select pg_get_constraintdef(x.oid) from pg_constraint x where x.contypid=t.oid order by x.conname)) from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype in ('d','e','c') and n.nspname !~ '^pg_' and n.nspname<>'information_schema'
      union all select 'database','',datname,jsonb_build_object('owner',pg_get_userbyid(datdba),'acl',datacl::text,'encoding',pg_encoding_to_char(encoding),'collate',datcollate,'ctype',datctype) from pg_database where datname=current_database()
      union all select 'extension','',extname,jsonb_build_object('version',extversion,'schema',n.nspname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by 1,2,3`)
    ).rows;
    const roles = (
      await client.query(
        "select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolconfig from pg_roles where rolname !~ '^pg_' order by rolname",
      )
    ).rows;
    const memberships = (
      await client.query(
        "select r.rolname as role,m.rolname as member,g.rolname as grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by 1,2,3",
      )
    ).rows;
    remaining();
    await dump(snapshot.id, output, remaining);
    remaining();
    const again = (
      await client.query(
        "select current_setting('neon.branch_id',true) as branch_id,current_setting('transaction_read_only') as read_only",
      )
    ).rows[0];
    if (again?.branch_id !== source.branchId || again?.read_only !== "on")
      throw new Error("source identity drift");
    return {
      snapshotAt,
      inventory: {
        schema: "postgres-inventory/1",
        identity: info,
        schemas,
        tables,
        journal,
        catalog,
        roles,
        memberships,
        limits:
          "All discovered non-system table hashes/catalog and password-free roles. Sequence values reside in the archive; foreign tables/large objects refused. Runtime/login and independent key custody require external qualification.",
      },
    };
  } finally {
    await client.query("ROLLBACK");
  }
}
export function timerUnits(c: CycleConfig, configPath: string) {
  absolute(configPath);
  for (const path of [
    configPath,
    c.keyFile,
    c.qualificationFile,
    c.stateDirectory,
    c.codeDirectory,
    c.nodeExecutable,
    c.environmentFile,
  ]) {
    absolute(path);
    if (/^\/(home|root|tmp|var\/tmp|run\/user)(\/|$)/.test(path))
      throw new Error("unit paths must remain accessible under ProtectHome/PrivateTmp");
  }
  const command = `${c.nodeExecutable} ${c.codeDirectory}/scripts/ci/backup-cycle.ts`;
  return {
    service: `[Unit]\nDescription=Qualified independent PostgreSQL snapshot\nWants=network-online.target\nAfter=network-online.target\n\n[Service]\nType=oneshot\nUser=pqdl-backup\nEnvironmentFile=${c.environmentFile}\nExecStart=${command} run --config ${configPath}\nTimeoutStartSec=300\nKillMode=control-group\nUMask=0077\nNoNewPrivileges=yes\nPrivateTmp=yes\nPrivateDevices=yes\nProtectSystem=strict\nProtectHome=true\nProtectKernelTunables=yes\nProtectKernelModules=yes\nProtectControlGroups=yes\nProtectClock=yes\nRestrictSUIDSGID=yes\nLockPersonality=yes\nReadWritePaths=${c.stateDirectory}\n`,
    timer: `[Unit]\nDescription=Independent snapshot every five minutes\n\n[Timer]\nOnCalendar=*-*-* *:0/5:00\nAccuracySec=1s\nRandomizedDelaySec=0\nPersistent=false\nUnit=pqdl-backup.service\n\n[Install]\nWantedBy=timers.target\n`,
  };
}
async function nativeSnapshot(c: CycleConfig, output: string, remaining: () => number) {
  const e = process.env;
  if (
    !e.PGHOST ||
    !e.PGHOST.endsWith(".neon.tech") ||
    e.PGHOST.includes("-pooler") ||
    !e.PGHOST.startsWith(c.source.endpointId + ".") ||
    e.PGUSER !== c.source.role ||
    e.PGDATABASE !== c.source.database ||
    !e.PGPASSFILE ||
    e.PGPASSWORD ||
    (e.PGPORT && e.PGPORT !== "5432")
  )
    throw new Error("direct nominal PG identity and protected passfile required");
  await fingerprint(e.PGPASSFILE); // Ownership/privacy only; its hash is never emitted.
  const env: NodeJS.ProcessEnv = {
    PATH: e.PATH,
    LANG: "C",
    PGHOST: e.PGHOST,
    PGUSER: e.PGUSER,
    PGDATABASE: e.PGDATABASE,
    PGPORT: "5432",
    PGPASSFILE: e.PGPASSFILE,
    PGSSLMODE: "verify-full",
    PGCONNECT_TIMEOUT: "15",
  };
  if (
    !/^pg_dump \(PostgreSQL\) 17\./.test(
      execFileSync("pg_dump", ["--version"], { env, encoding: "utf8", timeout: remaining() }),
    )
  )
    throw new Error("PostgreSQL17 client required");
  const client = new Client({
    host: e.PGHOST,
    port: 5432,
    user: e.PGUSER,
    database: e.PGDATABASE,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: Math.min(15000, remaining()),
    statement_timeout: Math.min(60000, remaining()),
    query_timeout: Math.min(65000, remaining()),
  });
  try {
    await client.connect();
    return await postgresSnapshot(
      client,
      c.source,
      output,
      async (id, file, left) => {
        await writeFile(file, "", { mode: 0o600, flag: "wx" });
        await promisify(execFile)(
          "pg_dump",
          [
            "--no-password",
            "--format=custom",
            `--snapshot=${id}`,
            `--file=${file}`,
            "--lock-wait-timeout=15000",
          ],
          { env, timeout: left(), maxBuffer: 65536, encoding: "utf8" },
        );
      },
      remaining,
    );
  } finally {
    await client.end();
  }
}
async function main() {
  const [operation, flag, path, extra] = process.argv.slice(2);
  if (flag !== "--config" || !path || extra || !["run", "status", "units"].includes(operation))
    throw new Error("usage: run|status|units --config <private-file>");
  const c = cycleConfig(privateJson(path));
  if (operation === "status") {
    privateDirectory(c.stateDirectory);
    const latest = join(c.stateDirectory, "latest.json");
    const age = snapshotAge(existsSync(latest) ? privateJson(latest) : null, c, new Date());
    if (age.state !== "HEALTHY")
      append(join(c.stateDirectory, "incidents.jsonl"), {
        schema: "backup-age-alert/1",
        observedAt: new Date().toISOString(),
        ...age,
      });
    console.log(
      JSON.stringify({
        schema: "backup-age/1",
        ...age,
        scope: "durable receipt age; external monitor/incident disposition required",
      }),
    );
    process.exitCode = age.state === "HEALTHY" ? 0 : age.state === "WARN" ? 1 : 2;
  } else if (operation === "units") {
    const versions = qualified(privateJson(c.qualificationFile), c, new Date()),
      aws = awsCli(c.recovery.region);
    await bucketPreflight(c.recovery, aws);
    for (const v of versions) await verifyVersion(c.recovery, v, aws);
    const target = join(c.stateDirectory, "units");
    privateDirectory(c.stateDirectory);
    await mkdir(target, { mode: 0o700 });
    const units = timerUnits(c, resolve(path));
    await writeFile(join(target, "pqdl-backup.service"), units.service, {
      mode: 0o600,
      flag: "wx",
    });
    await writeFile(join(target, "pqdl-backup.timer"), units.timer, { mode: 0o600, flag: "wx" });
    console.log("UNITS-PREPARED; timer not installed or enabled; independent monitor required");
  } else {
    let remaining = () => INTERVAL_MS;
    const deadline = cycleDeadline();
    remaining = deadline;
    const aws = awsCli(c.recovery.region, remaining);
    const receipt = await runCycle(c, {
      aws,
      snapshot: (output, left) => nativeSnapshot(c, output, left),
    });
    console.log(
      JSON.stringify({
        schema: receipt.schema,
        phase: receipt.phase,
        snapshotAt: receipt.meta.snapshotAt,
        durationMs: receipt.durationMs,
        dailyAnchor: receipt.dailyAnchor,
        scope: "paired ciphertext custody; no production approval",
      }),
    );
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch {
    console.error(
      "backup cycle precondition/verification failed; raw data withheld; reconcile lock and receipts",
    );
    process.exitCode = 2;
  }
}
