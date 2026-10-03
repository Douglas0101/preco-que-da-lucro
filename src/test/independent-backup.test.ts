import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bucketPreflight,
  fingerprint,
  metadata,
  openDump,
  recoveryConfig,
  sealDump,
  uploadEncrypted,
  type AwsCall,
  type BackupMetadata,
  type UploadReceipt,
} from "../../scripts/lib/independent-backup";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "pqdl-backup-test-"));
  roots.push(root);
  const input = join(root, "input.pgc"),
    key = join(root, "key");
  const bytes = Buffer.concat([Buffer.from("PGDMP"), randomBytes(16384)]);
  writeFileSync(input, bytes, { mode: 0o600 });
  writeFileSync(key, randomBytes(32), { mode: 0o600 });
  const meta: BackupMetadata = {
    schema: "independent-backup/1",
    backupId: randomUUID(),
    sourceRevision: "ccef6e55eb44e6db7bb09682526d00d2fb2f55d2",
    snapshotAt: "2026-10-03T00:00:00.000Z",
    keyId: "offline-recovery-test",
  };
  return { root, input, key, bytes, meta };
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const config = {
  bucket: "pqdl-recovery-test",
  region: "us-east-1",
  primaryAccountId: "502839471052",
  recoveryAccountId: "602839471062",
  prefix: "backups/pg17",
};
function provider(overrides: Record<string, unknown> = {}) {
  const calls: { service: string; operation: string; args: string[] }[] = [];
  let checksum = "",
    bytes = 0;
  const aws: AwsCall = async (service, operation, args) => {
    calls.push({ service, operation, args });
    if (Object.hasOwn(overrides, operation)) return overrides[operation];
    switch (operation) {
      case "get-caller-identity":
        return { Account: config.recoveryAccountId };
      case "get-bucket-versioning":
        return { Status: "Enabled" };
      case "get-object-lock-configuration":
        return {
          ObjectLockConfiguration: {
            ObjectLockEnabled: "Enabled",
            Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 35 } },
          },
        };
      case "get-bucket-location":
        return { LocationConstraint: null };
      case "get-bucket-encryption":
        return {
          ServerSideEncryptionConfiguration: {
            Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
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
      case "put-object":
        checksum = args[args.indexOf("--checksum-sha256") + 1];
        bytes = statSync(args[args.indexOf("--body") + 1]).size;
        return { VersionId: "immutable-test-version" };
      case "head-object":
        return {
          VersionId: "immutable-test-version",
          ContentLength: bytes,
          ChecksumSHA256: checksum,
          ServerSideEncryption: "AES256",
        };
      case "get-object-retention":
        return { Retention: { Mode: "COMPLIANCE", RetainUntilDate: "2026-12-01T00:00:00.000Z" } };
      default:
        throw new Error("unexpected provider operation");
    }
  };
  return { aws, calls };
}
describe("independent encrypted archive custody", () => {
  it("authenticates real streaming bytes and only then publishes the private archive", async () => {
    const f = fixture(),
      sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed"));
    const opened = await openDump(sealed.file, f.key, join(f.root, "opened"));
    expect(readFileSync(opened.file)).toEqual(f.bytes);
    expect(opened.meta).toEqual(f.meta);
    expect(readFileSync(sealed.file).includes(f.bytes)).toBe(false);
    expect(statSync(opened.file).mode & 0o077).toBe(0);
    expect(statSync(join(f.root, "opened")).mode & 0o077).toBe(0);
    expect(sealed.sha256).toBe((await fingerprint(sealed.file)).sha256);
  });
  it.each(["wrong-key", "ciphertext", "metadata", "tag", "truncated"])(
    "refuses %s without publishing plaintext",
    async (mode) => {
      const f = fixture(),
        sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed"));
      let bytes = readFileSync(sealed.file);
      if (mode === "wrong-key") writeFileSync(f.key, randomBytes(32));
      if (mode === "ciphertext") bytes[bytes.length - 20] ^= 1;
      if (mode === "metadata") {
        const i = bytes.indexOf(Buffer.from("offline-recovery-test"));
        bytes[i] = "n".charCodeAt(0);
      }
      if (mode === "tag") bytes[bytes.length - 1] ^= 1;
      if (mode === "truncated") bytes = bytes.subarray(0, bytes.length - 30);
      writeFileSync(sealed.file, bytes);
      const directory = join(f.root, "bad-open");
      await expect(openDump(sealed.file, f.key, directory)).rejects.toThrow();
      expect(existsSync(join(directory, "verified.pgc"))).toBe(false);
      if (existsSync(directory)) expect(readdirSync(directory)).toEqual([]);
    },
  );
  it("refuses public key file, symlink input and non-custom dump", async () => {
    const f = fixture();
    chmodSync(f.key, 0o644);
    await expect(sealDump(f.input, f.key, f.meta, join(f.root, "a"))).rejects.toThrow("private");
    chmodSync(f.key, 0o600);
    symlinkSync(f.input, join(f.root, "link"));
    await expect(
      sealDump(join(f.root, "link"), f.key, f.meta, join(f.root, "b")),
    ).rejects.toThrow();
    writeFileSync(f.input, "not an archive");
    await expect(sealDump(f.input, f.key, f.meta, join(f.root, "c"))).rejects.toThrow("custom");
  });
  it("never overwrites an existing custody directory", async () => {
    const f = fixture();
    await sealDump(f.input, f.key, f.meta, join(f.root, "sealed"));
    const digest = await fingerprint(join(f.root, "sealed", "backup.pqdl"));
    await expect(sealDump(f.input, f.key, f.meta, join(f.root, "sealed"))).rejects.toThrow();
    expect(await fingerprint(join(f.root, "sealed", "backup.pqdl"))).toEqual(digest);
  });
  it("uses a fresh random nonce for the same dump/key and refuses a degenerate key", async () => {
    const f = fixture();
    const a = await sealDump(f.input, f.key, f.meta, join(f.root, "a"));
    const b = await sealDump(f.input, f.key, f.meta, join(f.root, "b"));
    expect(a.sha256).not.toBe(b.sha256);
    writeFileSync(f.key, Buffer.alloc(32));
    await expect(sealDump(f.input, f.key, f.meta, join(f.root, "c"))).rejects.toThrow("degenerate");
  });
  it("rejects missing/degenerate metadata and account identity", () => {
    const f = fixture();
    expect(() => metadata({ ...f.meta, keyId: undefined })).toThrow();
    expect(() => metadata({ ...f.meta, sourceRevision: "0".repeat(40) })).toThrow();
    expect(() =>
      recoveryConfig({ ...config, recoveryAccountId: config.primaryAccountId }),
    ).toThrow();
    expect(() => recoveryConfig({ ...config, bucket: "127.0.0.1" })).toThrow();
    expect(() => recoveryConfig({ ...config, recoveryAccountId: "0".repeat(12) })).toThrow();
  });
});
describe("immutable S3 custody", () => {
  it("checks expected owner on every S3 read, including independent version retention", async () => {
    const f = fixture(),
      sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed")),
      p = provider();
    const receipts: UploadReceipt[] = [];
    const result = await uploadEncrypted(
      sealed.file,
      config,
      p.aws,
      async (r) => {
        receipts.push(r);
      },
      new Date("2026-10-03T00:00:00Z"),
    );
    expect(receipts.map((r) => r.phase)).toEqual([
      "INTENT",
      "UPLOADED-UNVERIFIED",
      "LOCKED-CIPHERTEXT-VERIFIED",
    ]);
    expect(result.versionId).toBe("immutable-test-version");
    expect(result.retainUntil).toBe("2026-11-07T00:01:00.000Z");
    for (const call of p.calls.filter((c) => c.service === "s3api"))
      expect(call.args).toContain(config.recoveryAccountId);
    const put = p.calls.find((c) => c.operation === "put-object")!;
    expect(put.args).toContain("--if-none-match");
    expect(put.args).toContain("COMPLIANCE");
    for (const c of p.calls.filter((c) =>
      ["head-object", "get-object-retention"].includes(c.operation),
    ))
      expect(
        c.args.slice(c.args.indexOf("--version-id"), c.args.indexOf("--version-id") + 2),
      ).toEqual(["--version-id", "immutable-test-version"]);
    expect(p.calls.some((c) => /delete|put-bucket|put-object-retention/.test(c.operation))).toBe(
      false,
    );
  });
  it.each([
    ["get-caller-identity", { Account: config.primaryAccountId }],
    ["get-bucket-versioning", { Status: "Suspended" }],
    [
      "get-object-lock-configuration",
      {
        ObjectLockConfiguration: {
          ObjectLockEnabled: "Enabled",
          Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 35 } },
        },
      },
    ],
    [
      "get-object-lock-configuration",
      {
        ObjectLockConfiguration: {
          ObjectLockEnabled: "Enabled",
          Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 34 } },
        },
      },
    ],
    ["get-bucket-location", { LocationConstraint: "eu-west-1" }],
    ["get-bucket-encryption", { ServerSideEncryptionConfiguration: { Rules: [] } }],
    ["get-public-access-block", { PublicAccessBlockConfiguration: {} }],
    ["get-bucket-ownership-controls", { OwnershipControls: { Rules: [] } }],
  ])("refuses invalid %s before any upload", async (operation, value) => {
    const p = provider({ [String(operation)]: value });
    await expect(bucketPreflight(config, p.aws)).rejects.toThrow();
    expect(p.calls.some((c) => c.operation === "put-object")).toBe(false);
  });
  it("keeps the uploaded version receipt when remote checksum verification fails", async () => {
    const f = fixture(),
      sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed"));
    const p = provider({ "head-object": { VersionId: "other-version" } }),
      receipts: UploadReceipt[] = [];
    await expect(
      uploadEncrypted(sealed.file, config, p.aws, async (r) => {
        receipts.push(r);
      }),
    ).rejects.toThrow("mismatch");
    expect(receipts.at(-1)?.phase).toBe("UPLOADED-UNVERIFIED");
    expect(receipts.at(-1)?.versionId).toBe("immutable-test-version");
    expect(p.calls.filter((c) => c.operation === "put-object")).toHaveLength(1);
  });
  it("preserves intent if AWS refuses upload; no blind retry", async () => {
    const f = fixture(),
      sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed")),
      p = provider();
    const receipts: UploadReceipt[] = [];
    const aws: AwsCall = async (s, o, a) => {
      if (o === "put-object") throw new Error("fixture provider failure");
      return p.aws(s, o, a);
    };
    await expect(
      uploadEncrypted(sealed.file, config, aws, async (r) => {
        receipts.push(r);
      }),
    ).rejects.toThrow();
    expect(receipts.map((r) => r.phase)).toEqual(["INTENT"]);
  });
  it.each(["bytes", "checksum", "encryption", "retention-mode", "retention-date"])(
    "refuses post-upload %s and preserves unverified custody",
    async (defect) => {
      const f = fixture(),
        sealed = await sealDump(f.input, f.key, f.meta, join(f.root, "sealed")),
        p = provider();
      const receipts: UploadReceipt[] = [];
      const aws: AwsCall = async (s, o, a) => {
        const result = (await p.aws(s, o, a)) as Record<string, unknown>;
        if (o === "head-object" && defect === "bytes")
          return { ...result, ContentLength: sealed.bytes + 1 };
        if (o === "head-object" && defect === "checksum")
          return { ...result, ChecksumSHA256: "invalid" };
        if (o === "head-object" && defect === "encryption")
          return { ...result, ServerSideEncryption: "aws:kms" };
        if (o === "get-object-retention" && defect === "retention-mode")
          return { Retention: { Mode: "GOVERNANCE", RetainUntilDate: "2026-12-01T00:00:00Z" } };
        if (o === "get-object-retention" && defect === "retention-date")
          return { Retention: { Mode: "COMPLIANCE", RetainUntilDate: "2026-10-03T00:00:00Z" } };
        return result;
      };
      await expect(
        uploadEncrypted(
          sealed.file,
          config,
          aws,
          async (r) => {
            receipts.push(r);
          },
          new Date("2026-10-03T00:00:00Z"),
        ),
      ).rejects.toThrow();
      expect(receipts.at(-1)?.phase).toBe("UPLOADED-UNVERIFIED");
    },
  );
  it("native CLI fails closed without input and does not expose a raw exception", () => {
    let output = "";
    try {
      execFileSync(process.execPath, ["scripts/ci/independent-backup.ts", "upload"], {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (e) {
      const error = e as { status: number; stderr: Buffer };
      expect(error.status).toBe(2);
      output = String(error.stderr);
    }
    expect(output).toContain("no raw secret/error exposed");
    expect(output).not.toContain(" at ");
  });
});
