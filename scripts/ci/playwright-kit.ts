import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface KitIdentity {
  sourceSha: string;
  lockSha256: string;
  imageOS: string;
  imageVersion: string;
  playwrightVersion: string;
}
export interface BrowserKit {
  schema: "playwright-kit/1";
  identity: KitIdentity;
  browsers: string[];
  changedPackages: Record<string, string>;
  files: Record<string, string>;
}
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const requiredBrowsers = ["chromium", "firefox", "webkit"];

export function validateKit(kit: BrowserKit, expected: KitIdentity, files: Record<string, string>) {
  if (kit.schema !== "playwright-kit/1") throw new Error("unknown kit schema");
  if (!/^[a-f0-9]{40}$/.test(expected.sourceSha) || !/^[a-f0-9]{64}$/.test(expected.lockSha256))
    throw new Error("source/lock identity is absent");
  for (const key of Object.keys(expected) as (keyof KitIdentity)[]) {
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
  if (!kit.changedPackages || Array.isArray(kit.changedPackages))
    throw new Error("missing package inventory");
  const packages = Object.entries(kit.changedPackages);
  if (
    packages.some(([name, version]) => !/^[a-z0-9][a-z0-9+.:~-]*$/.test(name) || !version?.trim())
  )
    throw new Error("invalid system package identity");
  if (packages.length > 0 && !names.some((name) => name.endsWith(".deb")))
    throw new Error("changed system packages have no offline payload");
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
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !==
    process.env.GITHUB_SHA
  )
    throw new Error("checkout SHA differs from the run revision");
  return {
    sourceSha: process.env.GITHUB_SHA ?? "",
    lockSha256: hash(readFileSync("package-lock.json")),
    imageOS: process.env.ImageOS ?? "",
    imageVersion: process.env.ImageVersion ?? "",
    playwrightVersion: JSON.parse(readFileSync("node_modules/playwright-core/package.json", "utf8"))
      .version,
  };
}
function discover(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (name === "manifest.json") continue;
    const path = join(dir, name);
    if (name === "debs" && lstatSync(path).isDirectory()) {
      for (const leaf of readdirSync(path)) {
        const file = join(path, leaf);
        if (!lstatSync(file).isFile()) throw new Error("non-file kit payload");
        files[`debs/${leaf}`] = hash(readFileSync(file));
      }
    } else {
      if (!lstatSync(path).isFile() || lstatSync(path).size === 0)
        throw new Error("empty/non-file kit payload");
      files[name] = hash(readFileSync(path));
    }
  }
  return files;
}
function run(command: string, dir: string, before?: string, after?: string) {
  const expected = identity();
  const manifestPath = join(dir, "manifest.json");
  let kit: BrowserKit;
  if (command === "capture") {
    if (!before || !after) throw new Error("before/after package snapshots are required");
    kit = {
      schema: "playwright-kit/1",
      identity: expected,
      browsers: [...requiredBrowsers],
      changedPackages: changedPackages(
        parsePackages(readFileSync(before, "utf8")),
        parsePackages(readFileSync(after, "utf8")),
      ),
      files: discover(dir),
    };
    validateKit(kit, expected, kit.files);
    writeFileSync(manifestPath, JSON.stringify(kit, null, 2) + "\n");
  } else {
    kit = JSON.parse(readFileSync(manifestPath, "utf8"));
    validateKit(kit, expected, discover(dir));
    if (command === "installed") {
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
    } else if (command !== "verify") throw new Error("unknown kit command");
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
