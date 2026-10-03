import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cycleConfig,
  qualified,
  snapshotAge,
  runCycle,
  cycleDeadline,
  timerUnits,
  type CycleConfig,
} from "../../scripts/ci/backup-cycle";
import {
  openInventory,
  privateJson,
  type UploadReceipt,
  type AwsCall,
} from "../../scripts/lib/independent-backup";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});
const at = new Date("2026-10-03T04:20:00.000Z");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "pqdl-cycle-"));
  roots.push(root);
  const state = join(root, "state");
  mkdirSync(state, { mode: 0o700 });
  const c = cycleConfig({
    schema: "backup-cycle-config/1",
    recovery: {
      bucket: "pqdl-test-recovery",
      region: "us-east-1",
      primaryAccountId: "503849581073",
      recoveryAccountId: "603849581083",
      prefix: "independent/pg17",
    },
    source: {
      projectId: "fixture-project-20261003",
      branchId: "br-fixture-source",
      endpointId: "ep-fixture-direct",
      database: "fixture",
      role: "backup_reader",
      revision: "4bd512c6a5ff0e4d2973f7208da26c3d93f800ef",
      keyId: "fixture-key",
      requiredSchemas: ["public", "drizzle", "neon_auth"],
      exclusionLedger: "public.exclusion_ledger",
    },
    keyFile: join(root, "key"),
    qualificationFile: join(root, "qualification.json"),
    stateDirectory: state,
    codeDirectory: "/opt/pqdl-backup/source",
    nodeExecutable: "/usr/bin/node",
    environmentFile: "/etc/pqdl-backup/postgres.env",
  });
  writeFileSync(c.keyFile, randomBytes(32), { mode: 0o600 });
  const meta = {
    schema: "independent-backup/1" as const,
    backupId: randomUUID(),
    sourceRevision: c.source.revision,
    keyId: c.source.keyId,
    snapshotAt: "2026-10-03T04:19:00.000Z",
  };
  const versions: UploadReceipt[] = ["qualified-dump", "qualified-inventory"].map((key, i) => ({
    schema: "independent-upload/1",
    phase: "LOCKED-CIPHERTEXT-VERIFIED",
    bucket: c.recovery.bucket,
    account: c.recovery.recoveryAccountId,
    region: c.recovery.region,
    key: `${c.recovery.prefix}/${key}`,
    sha256: (i ? "b" : "a").repeat(64),
    bytes: 256 + i,
    retainUntil: "2026-11-08T04:19:00.000Z",
    meta,
    versionId: `version-${key}`,
    scope: "fixture only",
  }));
  const checks = Object.fromEntries(
    [
      "inventory",
      "authLogin",
      "journal",
      "ownership",
      "grants",
      "rls",
      "exclusionLedger",
      "independentKey",
      "revision",
    ].map((k) => [k, "PASS"]),
  );
  const q = {
    schema: "backup-qualification/1",
    phase: "EXTERNAL-RESTORE-VERIFIED",
    source: c.source,
    recovery: c.recovery,
    completedAt: "2026-10-03T04:19:55.000Z",
    cycleSeconds: 35,
    evidenceSha256: "c".repeat(64),
    versions,
    scenarios: {
      providerLoss: {
        restoreTarget: "arn:aws:ec2:us-east-1:603849581083:instance/i-0123456789abcdef0",
        rpoSeconds: 300,
        rtoSeconds: 120,
        checks,
      },
      mainAccountLoss: {
        restoreTarget: "arn:aws:ec2:us-east-1:603849581083:instance/i-0123456789abcdef1",
        rpoSeconds: 300,
        rtoSeconds: 120,
        checks: { ...checks },
      },
    },
  };
  writeFileSync(c.qualificationFile, JSON.stringify(q), { mode: 0o600 });
  const objects = new Map<
    string,
    { sha256: string; bytes: number; versionId: string; retainUntil: string; ciphertext?: Buffer }
  >(versions.map((v) => [v.key, { ...v, versionId: v.versionId! }]));
  const calls: string[] = [];
  const aws: AwsCall = async (_service, operation, args) => {
    calls.push(operation);
    const key = args[args.indexOf("--key") + 1];
    switch (operation) {
      case "get-caller-identity":
        return { Account: c.recovery.recoveryAccountId };
      case "get-bucket-versioning":
        return { Status: "Enabled" };
      case "get-object-lock-configuration":
        return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 35 } },
          },
        };
      case "get-public-access-block":
        return {
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        };
      case "get-bucket-ownership-controls":
        return { OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } };
      case "get-bucket-location":
        return { LocationConstraint: null };
      case "get-bucket-encryption":
        return {
          ServerSideEncryptionConfiguration: {
            Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
          },
        };
      case "put-object": {
        const bytes = readFileSync(args[args.indexOf("--body") + 1]),
          versionId = randomUUID();
        objects.set(key, {
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
          versionId,
          retainUntil: args[args.indexOf("--object-lock-retain-until-date") + 1],
          ciphertext: bytes,
        });
        return { VersionId: versionId };
      }
      case "head-object": {
        const v = objects.get(key);
        if (!v) throw new Error("fixture object missing");
        return {
          VersionId: v.versionId,
          ContentLength: v.bytes,
          ChecksumSHA256: Buffer.from(v.sha256, "hex").toString("base64"),
          ServerSideEncryption: "AES256",
        };
      }
      case "get-object-retention":
        return {
          Retention: { Mode: "COMPLIANCE", RetainUntilDate: objects.get(key)?.retainUntil },
        };
      default:
        throw new Error("unrecognized fixture operation");
    }
  };
  const snapshot = async (output: string) => {
    writeFileSync(output, Buffer.concat([Buffer.from("PGDMP"), randomBytes(256)]), {
      mode: 0o600,
      flag: "wx",
    });
    return {
      snapshotAt: at.toISOString(),
      inventory: { sentinel: "fixture-inventory", schemas: ["public", "drizzle", "neon_auth"] },
    };
  };
  return { root, c, q, aws, snapshot, objects, calls };
}
describe("Five-minute independent backup cycle", () => {
  it("publishes a pair only after both immutable versions and preserves remote inventory binding", async () => {
    const f = fixture(),
      r = await runCycle(f.c, { aws: f.aws, snapshot: f.snapshot, now: () => at });
    expect(r.phase).toBe("DURABLE");
    expect(r.dailyAnchor).toBe(true);
    expect(r.versions[0].key).not.toBe(r.versions[1].key);
    expect(existsSync(join(f.c.stateDirectory, "cycle.lock"))).toBe(false);
    const attempt = join(f.c.stateDirectory, "attempts", r.meta.backupId);
    expect(existsSync(join(attempt, "snapshot.pgc"))).toBe(false);
    const events = readFileSync(join(attempt, "receipts.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(
      events.filter((e) => e.phase === "LOCKED-CIPHERTEXT-VERIFIED").map((e) => e.versionId),
    ).toEqual(r.versions.map((v) => v.versionId));
    expect(events.at(-1).phase).toBe("DURABLE");
    expect(privateJson(join(f.c.stateDirectory, "latest.json"))).toEqual(r);
    const encrypted = join(f.root, "downloaded-inventory.pqdl");
    writeFileSync(encrypted, f.objects.get(r.versions[1].key)!.ciphertext!, { mode: 0o600 });
    const opened = await openInventory(encrypted, f.c.keyFile, join(f.root, "opened"));
    expect(privateJson(opened.file)).toMatchObject({
      meta: r.meta,
      inventory: {
        sentinel: "fixture-inventory",
        dumpVersion: {
          key: r.versions[0].key,
          versionId: r.versions[0].versionId,
          sha256: r.versions[0].sha256,
        },
      },
    });
  });
  it("uses snapshotAt rather than recent job completion for WARN and INCIDENT boundaries", async () => {
    const f = fixture(),
      r = await runCycle(f.c, { aws: f.aws, snapshot: f.snapshot, now: () => at });
    expect(snapshotAge(null, f.c, at)).toMatchObject({ state: "UNKNOWN", ageSeconds: null });
    for (const [age, state] of [
      [599, "HEALTHY"],
      [600, "WARN"],
      [900, "WARN"],
      [901, "INCIDENT"],
    ] as const)
      expect(
        snapshotAge(
          { ...r, completedAt: new Date(at.getTime() + age * 1000).toISOString() },
          f.c,
          new Date(at.getTime() + age * 1000),
        ),
      ).toMatchObject({ state, ageSeconds: age });
    expect(snapshotAge(r, f.c, new Date(at.getTime() - 1))).toMatchObject({ state: "UNKNOWN" });
  });
  it("does not rerun an uncertain second upload or overwrite the last durable state", async () => {
    const f = fixture(),
      r = await runCycle(f.c, { aws: f.aws, snapshot: f.snapshot, now: () => at });
    const before = readFileSync(join(f.c.stateDirectory, "latest.json"));
    let puts = 0;
    const uncertain: AwsCall = async (...args) => {
      if (args[1] === "put-object" && ++puts === 2) throw new Error("fixture uncertain upload");
      return f.aws(...args);
    };
    const later = new Date(at.getTime() + 300000);
    const snapshot = async (path: string) => ({
      ...(await f.snapshot(path)),
      snapshotAt: later.toISOString(),
    });
    await expect(runCycle(f.c, { aws: uncertain, snapshot, now: () => later })).rejects.toThrow(
      "preserve lock",
    );
    expect(puts).toBe(2);
    expect(readFileSync(join(f.c.stateDirectory, "latest.json"))).toEqual(before);
    const callsBefore = f.calls.length;
    await expect(runCycle(f.c, { aws: f.aws, snapshot, now: () => later })).rejects.toThrow();
    expect(f.calls.length).toBe(callsBefore);
    expect(r.meta.backupId).toBe(JSON.parse(before.toString()).meta.backupId);
  });
  it("refuses concurrency before database or provider invocation", async () => {
    const f = fixture();
    writeFileSync(join(f.c.stateDirectory, "cycle.lock"), "manual fixture lock", { mode: 0o600 });
    let called = false;
    await expect(
      runCycle(f.c, {
        aws: f.aws,
        snapshot: async () => {
          called = true;
          throw new Error("should not call");
        },
        now: () => at,
      }),
    ).rejects.toThrow();
    expect(f.calls).toEqual([]);
    expect(called).toBe(false);
  });
  it("never credits the dump alone when retention of the inventory is insufficient", async () => {
    const f = fixture();
    let puts = 0;
    const aws: AwsCall = async (...args) => {
      if (args[1] === "put-object") puts++;
      if (puts === 2 && args[1] === "get-object-retention")
        return { Retention: { Mode: "GOVERNANCE", RetainUntilDate: "2026-10-04T00:00:00.000Z" } };
      return f.aws(...args);
    };
    await expect(runCycle(f.c, { aws, snapshot: f.snapshot, now: () => at })).rejects.toThrow(
      "blocked",
    );
    expect(puts).toBe(2);
    expect(existsSync(join(f.c.stateDirectory, "latest.json"))).toBe(false);
    expect(existsSync(join(f.c.stateDirectory, "cycle.lock"))).toBe(true);
  });
  it("retains the lock and refuses credit when the absolute cycle deadline expires", async () => {
    const f = fixture();
    let elapsed = 0;
    const aws: AwsCall = async (...args) => {
      const v = await f.aws(...args);
      if (args[1] === "put-object") elapsed = 300000;
      return v;
    };
    await expect(
      runCycle(f.c, { aws, snapshot: f.snapshot, now: () => at, clock: () => elapsed }),
    ).rejects.toThrow("blocked");
    expect(existsSync(join(f.c.stateDirectory, "latest.json"))).toBe(false);
    expect(f.calls.filter((v) => v === "put-object")).toHaveLength(1);
  });
  it("rejects shared directories and never creates a local lock there", async () => {
    const f = fixture();
    chmodSync(f.c.stateDirectory, 0o755);
    await expect(
      runCycle(f.c, { aws: f.aws, snapshot: f.snapshot, now: () => at }),
    ).rejects.toThrow("private directory");
    expect(readdirSync(f.c.stateDirectory)).toEqual([]);
  });
  it("requires a new qualification after source identity changes", () => {
    const f = fixture();
    expect(() =>
      qualified(f.q, { ...f.c, source: { ...f.c.source, revision: "d".repeat(40) } }, at),
    ).toThrow();
  });
  it.each([null, -1, 901, Number.NaN])("rejects missing/invalid/excess RPO %s", (rpoSeconds) => {
    const f = fixture(),
      q = structuredClone(f.q);
    q.scenarios.providerLoss.rpoSeconds = rpoSeconds as number;
    expect(() => qualified(q, f.c, at)).toThrow();
  });
  it("does not substitute claims from a fixture or restore onto either permanent branch", () => {
    const f = fixture(),
      q = structuredClone(f.q);
    q.phase = "LOCAL-FIXTURE-PASS";
    expect(() => qualified(q, f.c, at)).toThrow();
    q.phase = f.q.phase;
    q.scenarios.mainAccountLoss.restoreTarget = "br-small-hill-aymcu14y";
    expect(() => qualified(q, f.c, at)).toThrow();
  });
  it.each([
    "br-fixture-other-neon-account",
    "arn:aws:ec2:us-east-1:503849581073:instance/i-0123456789abcdef0",
    "arn:aws:ec2:eu-west-1:603849581083:instance/i-0123456789abcdef0",
    "arn:aws:ec2:us-east-1:603849581083:instance/",
  ])("recusa ensaio fora do provedor/conta/região/VM de recuperação: %s", (restoreTarget) => {
    const f = fixture(),
      q = structuredClone(f.q);
    q.scenarios.providerLoss.restoreTarget = restoreTarget;
    expect(() => qualified(q, f.c, at)).toThrow();
  });
  it.each(["inventory", "authLogin", "independentKey", "exclusionLedger", "revision"])(
    "refuses qualification missing %s",
    (name) => {
      const f = fixture(),
        q = structuredClone(f.q);
      q.scenarios.providerLoss.checks[name] = "NOT-STARTED";
      expect(() => qualified(q, f.c, at)).toThrow();
    },
  );
  it("enforces deadline at both sides and rejects clock regression", () => {
    let clock = 0;
    const left = cycleDeadline(() => clock);
    clock = 299999;
    expect(left()).toBe(1);
    clock = 300000;
    expect(left).toThrow();
    let bad = 10;
    const backwards = cycleDeadline(() => bad);
    bad = 9;
    expect(backwards).toThrow();
  });
  it("prepares a non-persistent five-minute oneshot without enabling it or adding a queue", () => {
    const f = fixture();
    const deployed = {
      ...f.c,
      keyFile: "/etc/pqdl-backup/key",
      qualificationFile: "/etc/pqdl-backup/qualification.json",
      stateDirectory: "/var/lib/pqdl-backup",
    };
    const u = timerUnits(deployed, "/etc/pqdl-backup/config.json");
    expect(u.service).toContain("TimeoutStartSec=300");
    expect(u.service).toContain("KillMode=control-group");
    expect(u.service).toContain("Type=oneshot");
    expect(u.timer).toContain("OnCalendar=*-*-* *:0/5:00");
    expect(u.timer).toContain("Persistent=false");
    expect(u.service).not.toContain("Restart=");
    expect(() => timerUnits(f.c, "/etc/pqdl-backup/config%evil.json")).toThrow();
    for (const path of ["/home/operator/key", "/root/key", "/tmp/key", "/var/tmp/key"])
      expect(() =>
        timerUnits({ ...deployed, keyFile: path }, "/etc/pqdl-backup/config.json"),
      ).toThrow();
    const bad = structuredClone(f.q);
    bad.cycleSeconds = Number.NaN;
    expect(() => qualified(bad, f.c, at)).toThrow();
  });
  it("refuses app/admin roles and required schemas or ledger omitted from config", () => {
    const f = fixture();
    for (const role of ["app_runtime", "neondb_owner", "postgres"])
      expect(() => cycleConfig({ ...f.c, source: { ...f.c.source, role } })).toThrow();
    expect(() =>
      cycleConfig({ ...f.c, source: { ...f.c.source, requiredSchemas: ["public", "drizzle"] } }),
    ).toThrow();
    expect(() => cycleConfig({ ...f.c, source: { ...f.c.source, exclusionLedger: "" } })).toThrow();
  });
});
