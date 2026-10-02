import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface KitIdentity {
  lockSha256: string;
  imageOS: string;
  imageVersion: string;
  architecture: string;
  playwrightVersion: string;
}
export interface DebIdentity {
  name: string;
  version: string;
  architecture: string;
}
export interface BrowserKit {
  schema: "playwright-kit/2";
  identity: KitIdentity;
  browsers: string[];
  changedPackages: Record<string, string>;
  debPackages: Record<string, DebIdentity>;
  files: Record<string, string>;
}
export interface RunIdentity {
  sourceSha: string;
  runId: string;
  runAttempt: string;
}
export interface KitAttestation extends RunIdentity {
  schema: "playwright-kit-run/1";
  manifestSha256: string;
}
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const requiredBrowsers = ["chromium", "firefox", "webkit"];
const identityKeys: (keyof KitIdentity)[] = [
  "lockSha256",
  "imageOS",
  "imageVersion",
  "architecture",
  "playwrightVersion",
];

function samePackage(name: string, version: string, deb: DebIdentity) {
  const [base, architecture] = name.split(":");
  return (
    base === deb.name &&
    version === deb.version &&
    (!architecture || architecture === deb.architecture || deb.architecture === "all")
  );
}
export function validateKit(kit: BrowserKit, expected: KitIdentity, files: Record<string, string>) {
  if (kit.schema !== "playwright-kit/2") throw new Error("unknown kit schema");
  if (
    !/^[a-f0-9]{64}$/.test(expected.lockSha256) ||
    expected.imageOS !== "ubuntu24" ||
    expected.architecture !== "x64"
  )
    throw new Error("supported runner/lock identity is absent");
  for (const key of identityKeys) {
    if (!expected[key]?.trim() || kit.identity?.[key] !== expected[key])
      throw new Error(`kit identity mismatch: ${key}`);
  }
  if (JSON.stringify(kit.browsers) !== JSON.stringify(requiredBrowsers))
    throw new Error("all three browsers are required");
  const names = Object.keys(files).sort();
  if (
    !names.includes("browsers.tar.gz") ||
    JSON.stringify(names) !== JSON.stringify(Object.keys(kit.files).sort())
  )
    throw new Error("kit discovery is incomplete");
  for (const name of names) {
    if (name !== "browsers.tar.gz" && !/^debs\/[A-Za-z0-9_.+%:~-]+\.deb$/.test(name))
      throw new Error("unexpected kit path");
    if (!/^[a-f0-9]{64}$/.test(files[name]) || kit.files[name] !== files[name])
      throw new Error(`kit hash mismatch: ${name}`);
  }
  if (
    !kit.changedPackages ||
    Array.isArray(kit.changedPackages) ||
    !kit.debPackages ||
    Array.isArray(kit.debPackages)
  )
    throw new Error("missing package inventory");
  const packages = Object.entries(kit.changedPackages);
  if (
    packages.some(([name, version]) => !/^[a-z0-9][a-z0-9+.:~-]*$/.test(name) || !version?.trim())
  )
    throw new Error("invalid system package identity");
  if (
    JSON.stringify(names.filter((name) => name.endsWith(".deb"))) !==
    JSON.stringify(Object.keys(kit.debPackages).sort())
  )
    throw new Error("offline package discovery is incomplete");
  for (const deb of Object.values(kit.debPackages)) {
    if (
      !/^[a-z0-9][a-z0-9+.-]*$/.test(deb.name) ||
      !deb.version?.trim() ||
      !["amd64", "all"].includes(deb.architecture) ||
      !packages.some(([name, version]) => samePackage(name, version, deb))
    )
      throw new Error("offline package identity differs from the prepared packages");
  }
  for (const [name, version] of packages) {
    if (!Object.values(kit.debPackages).some((deb) => samePackage(name, version, deb)))
      throw new Error(`changed system package has no exact offline payload: ${name}`);
  }
}

export function validateAttestation(
  attestation: KitAttestation,
  expected: RunIdentity,
  manifestSha256: string,
) {
  if (attestation.schema !== "playwright-kit-run/1")
    throw new Error("unknown run attestation schema");
  if (
    !/^[a-f0-9]{40}$/.test(expected.sourceSha) ||
    !/^[1-9][0-9]*$/.test(expected.runId) ||
    !/^[1-9][0-9]*$/.test(expected.runAttempt)
  )
    throw new Error("source/run identity is absent");
  for (const key of ["sourceSha", "runId", "runAttempt"] as const)
    if (attestation[key] !== expected[key]) throw new Error(`run attestation mismatch: ${key}`);
  if (!/^[a-f0-9]{64}$/.test(manifestSha256) || attestation.manifestSha256 !== manifestSha256)
    throw new Error("run attestation manifest mismatch");
}
export function parsePackages(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of source.trim().split("\n")) {
    const parts = line.split("\t");
    if (parts.length !== 2 || !parts[0] || !parts[1] || result[parts[0]])
      throw new Error("empty, duplicated or malformed dpkg snapshot");
    result[parts[0]] = parts[1];
  }
  return result;
}
export function changedPackages(before: Record<string, string>, after: Record<string, string>) {
  if (Object.keys(before).length === 0 || Object.keys(after).length === 0)
    throw new Error("empty system package snapshot");
  for (const name of Object.keys(before))
    if (!after[name]) throw new Error("preparation removed a package");
  return Object.fromEntries(
    Object.entries(after).filter(([name, version]) => before[name] !== version),
  );
}
export function assertInstalled(changed: Record<string, string>, actual: Record<string, string>) {
  for (const [name, version] of Object.entries(changed))
    if (actual[name] !== version) throw new Error(`system package mismatch: ${name}`);
}
function identity(): KitIdentity {
  if (
    !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !==
      process.env.GITHUB_SHA
  )
    throw new Error("checkout SHA differs from the run revision");
  return {
    lockSha256: hash(readFileSync("package-lock.json")),
    imageOS: process.env.ImageOS ?? "",
    imageVersion: process.env.ImageVersion ?? "",
    architecture: process.arch,
    playwrightVersion: JSON.parse(readFileSync("node_modules/playwright-core/package.json", "utf8"))
      .version,
  };
}
function runIdentity(): RunIdentity {
  return {
    sourceSha: process.env.GITHUB_SHA ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  };
}
function discover(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("symlink kit payload");
    if (name === "manifest.json") {
      if (!stat.isFile() || stat.size === 0) throw new Error("empty/non-file manifest");
      continue;
    }
    if (name === "debs" && stat.isDirectory()) {
      for (const leaf of readdirSync(path)) {
        const file = join(path, leaf);
        if (!lstatSync(file).isFile() || lstatSync(file).size === 0)
          throw new Error("empty/non-file kit payload");
        files[`debs/${leaf}`] = hash(readFileSync(file));
      }
    } else {
      if (!stat.isFile() || stat.size === 0) throw new Error("empty/non-file kit payload");
      files[name] = hash(readFileSync(path));
    }
  }
  return files;
}
export function readDeb(file: string): DebIdentity {
  const control = execFileSync("dpkg-deb", ["--field", file], { encoding: "utf8" });
  return {
    name: /^Package: (.+)$/m.exec(control)?.[1] ?? "",
    version: /^Version: (.+)$/m.exec(control)?.[1] ?? "",
    architecture: /^Architecture: (.+)$/m.exec(control)?.[1] ?? "",
  };
}
function debInventory(dir: string): Record<string, DebIdentity> {
  const result: Record<string, DebIdentity> = {};
  if (existsSync(join(dir, "debs")))
    for (const name of readdirSync(join(dir, "debs")))
      result[`debs/${name}`] = readDeb(join(dir, "debs", name));
  return result;
}
function installed(kit: BrowserKit) {
  assertInstalled(
    kit.changedPackages,
    parsePackages(
      execFileSync("dpkg-query", ["-W", "-f=${binary:Package}\t${Version}\n"], {
        encoding: "utf8",
      }),
    ),
  );
  const browserRoot = join(process.env.HOME ?? "", ".cache/ms-playwright");
  const revisions = JSON.parse(
    readFileSync("node_modules/playwright-core/browsers.json", "utf8"),
  ).browsers;
  for (const name of requiredBrowsers) {
    const browser = revisions.find((item: { name: string }) => item.name === name);
    if (
      !browser ||
      !existsSync(
        join(
          browserRoot,
          `${name}-${browser.revisionOverrides?.["ubuntu24.04-x64"] ?? browser.revision}`,
        ),
      )
    )
      throw new Error(`browser revision absent: ${name}`);
  }
}
function run(command: string, dir: string, before?: string, after?: string) {
  const expected = identity();
  if (command === "key") {
    // Changing the verifier changes the cache namespace, even if the lockfile is unchanged.
    if (
      !process.env.GITHUB_OUTPUT ||
      expected.imageOS !== "ubuntu24" ||
      expected.architecture !== "x64" ||
      !expected.imageVersion
    )
      throw new Error("cache output or supported runner is absent");
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `key=playwright-kit-v2-${hash(JSON.stringify(expected))}-${hash(readFileSync("scripts/ci/playwright-kit.ts"))}\n`,
      { flag: "a" },
    );
    return;
  }
  const resource = join(dir, "resource");
  const manifestPath = join(resource, "manifest.json");
  let kit: BrowserKit;
  if (command === "capture") {
    if (!before || !after) throw new Error("before/after package snapshots are required");
    const changed = changedPackages(
      parsePackages(readFileSync(before, "utf8")),
      parsePackages(readFileSync(after, "utf8")),
    );
    mkdirSync(join(resource, "debs"), { recursive: true });
    for (const name of readdirSync("/var/cache/apt/archives").filter((name) =>
      name.endsWith(".deb"),
    )) {
      const file = join("/var/cache/apt/archives", name);
      const deb = readDeb(file);
      if (Object.entries(changed).some(([pkg, version]) => samePackage(pkg, version, deb)))
        copyFileSync(file, join(resource, "debs", name));
    }
    kit = {
      schema: "playwright-kit/2",
      identity: expected,
      browsers: [...requiredBrowsers],
      changedPackages: changed,
      debPackages: debInventory(resource),
      files: discover(resource),
    };
    validateKit(kit, expected, kit.files);
    writeFileSync(manifestPath, JSON.stringify(kit, null, 2) + "\n");
  } else {
    kit = JSON.parse(readFileSync(manifestPath, "utf8"));
    validateKit(kit, expected, discover(resource));
    const actualDebs = debInventory(resource);
    for (const [name, deb] of Object.entries(kit.debPackages)) {
      const actual = actualDebs[name];
      if (
        !actual ||
        actual.name !== deb.name ||
        actual.version !== deb.version ||
        actual.architecture !== deb.architecture
      )
        throw new Error("offline archive control metadata mismatch");
    }
    if (command === "installed" || command === "attest") installed(kit);
    if (command === "attest") {
      const attestation: KitAttestation = {
        schema: "playwright-kit-run/1",
        ...runIdentity(),
        manifestSha256: hash(readFileSync(manifestPath)),
      };
      validateAttestation(attestation, runIdentity(), hash(readFileSync(manifestPath)));
      writeFileSync(join(dir, "attestation.json"), JSON.stringify(attestation, null, 2) + "\n");
    } else if (command === "verify") {
      if (
        JSON.stringify(readdirSync(dir).sort()) !== JSON.stringify(["attestation.json", "resource"])
      )
        throw new Error("unexpected run artifact payload");
      validateAttestation(
        JSON.parse(readFileSync(join(dir, "attestation.json"), "utf8")),
        runIdentity(),
        hash(readFileSync(manifestPath)),
      );
    } else if (!["verify-resource", "installed"].includes(command))
      throw new Error("unknown kit command");
  }
  console.log(
    JSON.stringify({
      schema: kit.schema,
      identity: expected,
      files: Object.keys(kit.files),
      changedPackages: Object.keys(kit.changedPackages),
      command,
      result: "PASS",
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    run(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
  } catch (error) {
    console.error(
      `precondition: ${error instanceof Error ? error.message : "invalid browser kit"}`,
    );
    process.exitCode = 2;
  }
}
