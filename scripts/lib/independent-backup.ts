import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  constants,
  closeSync,
  fstatSync,
  openSync,
  readSync,
  readFileSync,
} from "node:fs";
import { appendFile, link, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("PQDLENC1");
const DAY = 86400000;
export interface BackupMetadata {
  schema: "independent-backup/1";
  backupId: string;
  sourceRevision: string;
  snapshotAt: string;
  keyId: string;
}
export function metadata(value: unknown): BackupMetadata {
  const v = object(value);
  if (
    v.schema !== "independent-backup/1" ||
    typeof v.backupId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.backupId) ||
    typeof v.sourceRevision !== "string" ||
    !/^[a-f0-9]{40}$/.test(v.sourceRevision) ||
    /^0+$/.test(v.sourceRevision) ||
    typeof v.keyId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(v.keyId) ||
    typeof v.snapshotAt !== "string" ||
    !Number.isFinite(Date.parse(v.snapshotAt)) ||
    new Date(v.snapshotAt).toISOString() !== v.snapshotAt ||
    Object.keys(v).sort().join() !==
      ["backupId", "keyId", "schema", "snapshotAt", "sourceRevision"].sort().join()
  )
    throw new Error("backup metadata is incomplete or invalid");
  return v as unknown as BackupMetadata;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("expected object");
  return value as Record<string, unknown>;
}
function privateFd(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const stat = fstatSync(fd);
  if (
    !stat.isFile() ||
    (stat.mode & 0o077) !== 0 ||
    stat.nlink !== 1 ||
    (process.getuid && stat.uid !== process.getuid())
  ) {
    closeSync(fd);
    throw new Error("private regular file required");
  }
  return fd;
}
function key(path: string) {
  const fd = privateFd(path);
  try {
    if (fstatSync(fd).size !== 32) throw new Error("key must contain exactly 32 random bytes");
    const bytes = readFileSync(fd);
    if (new Set(bytes).size < 2) {
      bytes.fill(0);
      throw new Error("degenerate recovery key refused");
    }
    return bytes;
  } finally {
    closeSync(fd);
  }
}
function readAt(fd: number, length: number, at: number) {
  const out = Buffer.alloc(length);
  if (readSync(fd, out, 0, length, at) !== length) throw new Error("truncated backup envelope");
  return out;
}
function header(fd: number) {
  if (!readAt(fd, 8, 0).equals(MAGIC)) throw new Error("unsupported backup envelope");
  const length = readAt(fd, 4, 8).readUInt32BE();
  if (length < 2 || length > 4096) throw new Error("invalid envelope header length");
  const aad = readAt(fd, length, 12);
  const meta = metadata(JSON.parse(aad.toString("utf8")));
  const iv = readAt(fd, 12, 12 + length);
  const size = fstatSync(fd).size;
  const start = 24 + length,
    end = size - 17;
  if (end - start < 4) throw new Error("empty/truncated encrypted dump");
  return { meta, aad, iv, start, end, tag: readAt(fd, 16, size - 16) };
}
export async function fingerprint(path: string) {
  const fd = privateFd(path);
  try {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(path, { fd, autoClose: false }))
      digest.update(chunk);
    return { sha256: digest.digest("hex"), bytes: fstatSync(fd).size };
  } finally {
    closeSync(fd);
  }
}
export function inspectEnvelope(path: string) {
  const fd = privateFd(path);
  try {
    return header(fd).meta;
  } finally {
    closeSync(fd);
  }
}
export async function sealDump(
  input: string,
  keyPath: string,
  meta: BackupMetadata,
  directory: string,
) {
  metadata(meta);
  let fd: number | undefined, secret: Buffer | undefined;
  try {
    fd = privateFd(input);
    secret = key(keyPath);
    if (!readAt(fd, 5, 0).equals(Buffer.from("PGDMP")))
      throw new Error("custom PostgreSQL archive required");
    await mkdir(directory, { mode: 0o700 }); // New custody directory; existing output is a precondition failure.
    const output = join(directory, "backup.pqdl"),
      aad = Buffer.from(JSON.stringify(meta));
    const length = Buffer.alloc(4);
    length.writeUInt32BE(aad.length);
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", secret, iv);
    cipher.setAAD(aad);
    await appendFile(output, Buffer.concat([MAGIC, length, aad, iv]), { mode: 0o600, flag: "wx" });
    try {
      await pipeline(
        createReadStream(input, { fd, autoClose: false }),
        cipher,
        createWriteStream(output, { flags: "a", mode: 0o600 }),
      );
      await appendFile(output, cipher.getAuthTag());
      return {
        meta,
        ...(await fingerprint(output)),
        file: output,
        scope: "encrypted local archive; snapshot validity, key custody and restore are not proved",
      };
    } catch (error) {
      await rm(output, { force: true });
      throw error;
    }
  } finally {
    secret?.fill(0);
    if (fd !== undefined) closeSync(fd);
  }
}
export async function openDump(input: string, keyPath: string, directory: string) {
  let fd: number | undefined, secret: Buffer | undefined;
  let partial: string | undefined;
  try {
    fd = privateFd(input);
    secret = key(keyPath);
    const h = header(fd);
    await mkdir(directory, { mode: 0o700 });
    partial = join(directory, "unauthenticated.partial");
    const decipher = createDecipheriv("aes-256-gcm", secret, h.iv);
    decipher.setAAD(h.aad);
    decipher.setAuthTag(h.tag);
    // The temporary plaintext is private and never passed to SQL. Publication follows GCM final().
    await pipeline(
      createReadStream(input, { fd, start: h.start, end: h.end, autoClose: false }),
      decipher,
      createWriteStream(partial, { flags: "wx", mode: 0o600 }),
    );
    const checkFd = privateFd(partial);
    try {
      if (!readAt(checkFd, 5, 0).equals(Buffer.from("PGDMP")))
        throw new Error("authenticated payload is not a custom archive");
    } finally {
      closeSync(checkFd);
    }
    const output = join(directory, "verified.pgc");
    await link(partial, output); // Atomic no-overwrite publication after authentication.
    await rm(partial);
    partial = undefined;
    return {
      meta: h.meta,
      file: output,
      scope: "authenticated archive only; isolated database restore not proved",
    };
  } finally {
    try {
      if (partial) await rm(partial, { force: true });
    } finally {
      secret?.fill(0);
      if (fd !== undefined) closeSync(fd);
    }
  }
}

export interface RecoveryConfig {
  bucket: string;
  region: string;
  primaryAccountId: string;
  recoveryAccountId: string;
  prefix: string;
}
export function recoveryConfig(value: unknown): RecoveryConfig {
  const v = object(value);
  if (
    !["bucket", "region", "primaryAccountId", "recoveryAccountId", "prefix"].every(
      (k) => typeof v[k] === "string",
    ) ||
    !/^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(String(v.bucket)) ||
    String(v.bucket).includes("..") ||
    !/^[a-z]{2}-[a-z]+-\d$/.test(String(v.region)) ||
    !/^\d{12}$/.test(String(v.primaryAccountId)) ||
    !/^\d{12}$/.test(String(v.recoveryAccountId)) ||
    /^0+$/.test(String(v.primaryAccountId)) ||
    /^0+$/.test(String(v.recoveryAccountId)) ||
    v.primaryAccountId === v.recoveryAccountId ||
    !/^[a-z0-9][a-z0-9/_-]{0,100}$/.test(String(v.prefix)) ||
    String(v.prefix).includes("//") ||
    String(v.prefix).endsWith("/")
  )
    throw new Error("explicit segregated recovery account/bucket/region/prefix required");
  return {
    bucket: String(v.bucket),
    region: String(v.region),
    primaryAccountId: String(v.primaryAccountId),
    recoveryAccountId: String(v.recoveryAccountId),
    prefix: String(v.prefix),
  };
}
export type AwsCall = (
  service: "s3api" | "sts",
  operation: string,
  args: string[],
) => Promise<unknown>;
const bucketArgs = (c: RecoveryConfig) => [
  "--bucket",
  c.bucket,
  "--expected-bucket-owner",
  c.recoveryAccountId,
];
export async function bucketPreflight(config: RecoveryConfig, aws: AwsCall) {
  const c = recoveryConfig(config),
    args = bucketArgs(c);
  const caller = object(await aws("sts", "get-caller-identity", []));
  if (caller.Account !== c.recoveryAccountId) throw new Error("recovery caller identity mismatch");
  const versioning = object(await aws("s3api", "get-bucket-versioning", args));
  if (versioning.Status !== "Enabled") throw new Error("S3 Versioning is not enabled");
  const lock = object(
    object(await aws("s3api", "get-object-lock-configuration", args)).ObjectLockConfiguration,
  );
  const retention = object(object(lock.Rule).DefaultRetention);
  if (
    lock.ObjectLockEnabled !== "Enabled" ||
    retention.Mode !== "COMPLIANCE" ||
    !Number.isInteger(retention.Days) ||
    Number(retention.Days) < 35
  )
    throw new Error("fixed Compliance retention >=35 days required");
  const location = object(await aws("s3api", "get-bucket-location", args)).LocationConstraint;
  const region = location === null ? "us-east-1" : location === "EU" ? "eu-west-1" : location;
  if (region !== c.region) throw new Error("bucket region mismatch");
  const encryption = object(
    object(await aws("s3api", "get-bucket-encryption", args)).ServerSideEncryptionConfiguration,
  );
  if (
    !Array.isArray(encryption.Rules) ||
    encryption.Rules.length !== 1 ||
    object(object(encryption.Rules[0]).ApplyServerSideEncryptionByDefault).SSEAlgorithm !== "AES256"
  )
    throw new Error("S3 AES256 encryption required in addition to independent GCM key");
  const block = object(
    object(await aws("s3api", "get-public-access-block", args)).PublicAccessBlockConfiguration,
  );
  if (
    !["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"].every(
      (k) => block[k] === true,
    )
  )
    throw new Error("all S3 public access blocks must be enabled");
  const ownership = object(
    await aws("s3api", "get-bucket-ownership-controls", args),
  ).OwnershipControls;
  const rules = object(ownership).Rules;
  if (
    !Array.isArray(rules) ||
    rules.length !== 1 ||
    object(rules[0]).ObjectOwnership !== "BucketOwnerEnforced"
  )
    throw new Error("bucket owner enforcement required");
  return {
    account: c.recoveryAccountId,
    bucket: c.bucket,
    region: c.region,
    scope:
      "provider metadata only; independent key custody/access and recovery still require drill",
  };
}
export interface UploadReceipt {
  schema: "independent-upload/1";
  phase: "INTENT" | "UPLOADED-UNVERIFIED" | "LOCKED-CIPHERTEXT-VERIFIED";
  bucket: string;
  account: string;
  region: string;
  key: string;
  sha256: string;
  bytes: number;
  retainUntil: string;
  meta: BackupMetadata;
  versionId?: string;
  scope: string;
}
export async function verifyVersion(c: RecoveryConfig, receipt: UploadReceipt, aws: AwsCall) {
  if (
    receipt.schema !== "independent-upload/1" ||
    receipt.bucket !== c.bucket ||
    receipt.account !== c.recoveryAccountId ||
    receipt.region !== c.region ||
    !receipt.key.startsWith(c.prefix + "/") ||
    receipt.key.includes("..") ||
    !receipt.versionId ||
    receipt.versionId === "null" ||
    !/^[a-f0-9]{64}$/.test(receipt.sha256) ||
    !Number.isSafeInteger(receipt.bytes) ||
    receipt.bytes < 1 ||
    !Number.isFinite(Date.parse(receipt.retainUntil))
  )
    throw new Error("explicit immutable object receipt required");
  const args = [...bucketArgs(c), "--key", receipt.key, "--version-id", receipt.versionId];
  const head = object(await aws("s3api", "head-object", [...args, "--checksum-mode", "ENABLED"]));
  const hash = Buffer.from(receipt.sha256, "hex").toString("base64");
  if (
    head.VersionId !== receipt.versionId ||
    head.ContentLength !== receipt.bytes ||
    head.ChecksumSHA256 !== hash ||
    head.ServerSideEncryption !== "AES256"
  )
    throw new Error("immutable object identity/bytes/encryption/checksum mismatch");
  const retention = object(object(await aws("s3api", "get-object-retention", args)).Retention);
  if (
    retention.Mode !== "COMPLIANCE" ||
    typeof retention.RetainUntilDate !== "string" ||
    Date.parse(retention.RetainUntilDate) < Date.parse(receipt.retainUntil) ||
    !Number.isFinite(Date.parse(retention.RetainUntilDate))
  )
    throw new Error("immutable object retention mismatch");
}
export async function uploadEncrypted(
  input: string,
  c: RecoveryConfig,
  aws: AwsCall,
  record: (receipt: UploadReceipt) => Promise<void>,
  now = new Date(),
) {
  await bucketPreflight(c, aws);
  const meta = inspectEnvelope(input),
    digest = await fingerprint(input);
  if (digest.bytes > 4 * 1024 ** 3)
    throw new Error("single PUT tool limit is 4GiB; multipart route requires separate validation");
  const receipt: UploadReceipt = {
    schema: "independent-upload/1",
    phase: "INTENT",
    bucket: c.bucket,
    account: c.recoveryAccountId,
    region: c.region,
    key: `${c.prefix}/${now.toISOString().slice(0, 10)}/${meta.sourceRevision}/${randomUUID()}.pqdl`,
    ...digest,
    retainUntil: new Date(now.getTime() + 35 * DAY + 60000).toISOString(),
    meta,
    scope:
      "ciphertext custody only; not snapshot/restore, independent-key, RPO/RTO or production approval",
  };
  await record({ ...receipt });
  const response = object(
    await aws("s3api", "put-object", [
      ...bucketArgs(c),
      "--key",
      receipt.key,
      "--body",
      input,
      "--if-none-match",
      "*",
      "--checksum-algorithm",
      "SHA256",
      "--checksum-sha256",
      Buffer.from(digest.sha256, "hex").toString("base64"),
      "--server-side-encryption",
      "AES256",
      "--object-lock-mode",
      "COMPLIANCE",
      "--object-lock-retain-until-date",
      receipt.retainUntil,
    ]),
  );
  if (
    typeof response.VersionId !== "string" ||
    !response.VersionId ||
    response.VersionId === "null"
  )
    throw new Error("upload version missing; reconcile recorded intent before retry");
  receipt.versionId = response.VersionId;
  receipt.phase = "UPLOADED-UNVERIFIED";
  await record({ ...receipt });
  await verifyVersion(c, receipt, aws);
  if ((await fingerprint(input)).sha256 !== digest.sha256)
    throw new Error("local ciphertext changed during upload");
  receipt.phase = "LOCKED-CIPHERTEXT-VERIFIED";
  await record({ ...receipt });
  return receipt;
}
