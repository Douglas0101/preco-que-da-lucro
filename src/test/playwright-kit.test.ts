import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertInstalled,
  changedPackages,
  imageVersionFromEnvironment,
  parsePackages,
  readDeb,
  resolveImageVersion,
  validateAttestation,
  validateKit,
  type BrowserKit,
  type KitIdentity,
  type KitAttestation,
} from "../../scripts/ci/playwright-kit";

const identity: KitIdentity = {
  lockSha256: "b".repeat(64),
  imageOS: "ubuntu24",
  imageVersion: "20260928.1.0",
  architecture: "x64",
  playwrightVersion: "1.62.1",
};
const files = {
  "browsers.tar.gz": "c".repeat(64),
  "debs/libexample_1.0_amd64.deb": "d".repeat(64),
};
const run = { sourceSha: "a".repeat(40), runId: "1234", runAttempt: "1" };
const attestation = (): KitAttestation => ({
  schema: "playwright-kit-run/1",
  ...run,
  manifestSha256: "e".repeat(64),
});
function fixture(): BrowserKit {
  return {
    schema: "playwright-kit/3",
    identity: { ...identity },
    basePackagesSha256: "a".repeat(64),
    browsers: ["chromium", "firefox", "webkit"],
    changedPackages: { libexample: "1.0" },
    debPackages: {
      "debs/libexample_1.0_amd64.deb": {
        name: "libexample",
        version: "1.0",
        architecture: "amd64",
      },
    },
    files: { ...files },
  };
}
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Playwright resource cache and current run attestation", () => {
  it("accepts the exact toolchain, image and complete payload independent of source SHA", () => {
    expect(() => validateKit(fixture(), identity, files)).not.toThrow();
    const next = { ...run, sourceSha: "f".repeat(40), runId: "5678" };
    expect(() =>
      validateAttestation({ ...attestation(), ...next }, next, "e".repeat(64)),
    ).not.toThrow();
    expect(() => validateAttestation(attestation(), next, "e".repeat(64))).toThrow("mismatch");
  });
  it.each(Object.keys(identity) as (keyof KitIdentity)[])(
    "rejects different resource %s",
    (key) => {
      const kit = fixture();
      kit.identity[key] = "different";
      expect(() => validateKit(kit, identity, files)).toThrow("identity mismatch");
    },
  );
  it("accepts an imageVersion mismatch when the base package set is identical", () => {
    const kit = fixture();
    kit.identity.imageVersion = "20261023.334.3";
    expect(() => validateKit(kit, identity, files, kit.basePackagesSha256)).not.toThrow();
  });
  it("rejects an imageVersion mismatch when the base package set differs", () => {
    const kit = fixture();
    kit.identity.imageVersion = "20261023.334.3";
    expect(() => validateKit(kit, identity, files, "b".repeat(64))).toThrow("imageVersion");
  });
  it("requires a base package identity", () => {
    const kit = fixture();
    kit.basePackagesSha256 = "short";
    expect(() => validateKit(kit, identity, files)).toThrow("base package");
  });
  it("rejects absent identity, unsupported platform and legacy source-bound format", () => {
    for (const expected of [
      { ...identity, lockSha256: "" },
      { ...identity, architecture: "arm64" },
      { ...identity, imageOS: "ubuntu22" },
    ])
      expect(() => validateKit(fixture(), expected, files)).toThrow();
    const kit = fixture();
    Object.assign(kit, { schema: "playwright-kit/1" });
    expect(() => validateKit(kit, identity, files)).toThrow("schema");
  });
  it.each(["sourceSha", "runId", "runAttempt"] as const)(
    "rejects stale %s even when resource hashes match",
    (key) => {
      expect(() =>
        validateAttestation({ ...attestation(), [key]: "different" }, run, "e".repeat(64)),
      ).toThrow("mismatch");
      expect(() =>
        validateAttestation(attestation(), { ...run, [key]: "" }, "e".repeat(64)),
      ).toThrow("absent");
    },
  );
  it("rejects an attestation for another manifest and degenerate run IDs", () => {
    expect(() => validateAttestation(attestation(), run, "f".repeat(64))).toThrow(
      "manifest mismatch",
    );
    expect(() =>
      validateAttestation(attestation(), { ...run, runId: "0" }, "e".repeat(64)),
    ).toThrow();
    expect(() =>
      validateAttestation(attestation(), { ...run, runAttempt: "0" }, "e".repeat(64)),
    ).toThrow();
  });
  it("rejects a missing browser, corrupt bytes and newly discovered unsealed payload", () => {
    const kit = fixture();
    kit.browsers.pop();
    expect(() => validateKit(kit, identity, files)).toThrow();
    expect(() =>
      validateKit(fixture(), identity, { ...files, "browsers.tar.gz": "e".repeat(64) }),
    ).toThrow("hash mismatch");
    expect(() =>
      validateKit(fixture(), identity, { "browsers.tar.gz": files["browsers.tar.gz"] }),
    ).toThrow("discovery");
    expect(() =>
      validateKit(fixture(), identity, { ...files, "extra.deb": "e".repeat(64) }),
    ).toThrow("discovery");
  });
  it("requires a matching archive for EVERY changed package, not merely one deb", () => {
    const kit = fixture();
    kit.changedPackages.libmissing = "2";
    expect(() => validateKit(kit, identity, files)).toThrow("libmissing");
    const wrongVersion = fixture();
    wrongVersion.debPackages["debs/libexample_1.0_amd64.deb"].version = "0.9";
    expect(() => validateKit(wrongVersion, identity, files)).toThrow("identity");
    const wrongArch = fixture();
    wrongArch.debPackages["debs/libexample_1.0_amd64.deb"].architecture = "arm64";
    expect(() => validateKit(wrongArch, identity, files)).toThrow("identity");
  });
  it("supports Debian multiarch identities and all-architecture packages", () => {
    const kit = fixture();
    kit.changedPackages = { "libexample:amd64": "1.0" };
    expect(() => validateKit(kit, identity, files)).not.toThrow();
    kit.debPackages["debs/libexample_1.0_amd64.deb"].architecture = "all";
    expect(() => validateKit(kit, identity, files)).not.toThrow();
  });
  it("rejects an unregistered archive inventory even when its file is sealed", () => {
    const kit = fixture();
    kit.debPackages = {};
    expect(() => validateKit(kit, identity, files)).toThrow("discovery");
  });
  it("rejects empty, duplicated or malformed system inventory and package removals", () => {
    for (const source of ["", "liba\t1\nliba\t2", "liba\t1\textra"])
      expect(() => parsePackages(source)).toThrow();
    expect(() => changedPackages({}, { liba: "1" })).toThrow();
    expect(() => changedPackages({ liba: "1" }, {})).toThrow();
    expect(() => changedPackages({ liba: "1", libb: "2" }, { liba: "1" })).toThrow("removed");
    expect(changedPackages({ liba: "1", libb: "2" }, { liba: "3", libb: "2", libc: "1" })).toEqual({
      liba: "3",
      libc: "1",
    });
  });
  it("does not claim installation when an actual package is absent or another version", () => {
    expect(() => assertInstalled({ liba: "1" }, { liba: "1" })).not.toThrow();
    expect(() => assertInstalled({ liba: "1" }, {})).toThrow();
    expect(() => assertInstalled({ liba: "1" }, { liba: "2" })).toThrow();
  });
  it("reads the actual control metadata of a Debian archive instead of trusting its filename", () => {
    const dir = mkdtempSync(join(tmpdir(), "playwright-deb-"));
    dirs.push(dir);
    mkdirSync(join(dir, "package/DEBIAN"), { recursive: true });
    writeFileSync(
      join(dir, "package/DEBIAN/control"),
      "Package: libexample\nVersion: 1.0\nArchitecture: amd64\nMaintainer: Test <test@example.test>\nDescription: isolated test fixture\n",
    );
    const file = join(dir, "misleading_0.9_arm64.deb");
    execFileSync("dpkg-deb", ["--build", join(dir, "package"), file]);
    expect(readDeb(file)).toEqual({ name: "libexample", version: "1.0", architecture: "amd64" });
  });
  it("the real CLI accepts this checkout key and rejects another checkout revision", () => {
    const dir = mkdtempSync(join(tmpdir(), "playwright-key-"));
    dirs.push(dir);
    const output = join(dir, "output.txt");
    const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const env = {
      ...process.env,
      GITHUB_SHA: sourceSha,
      ImageOS: "ubuntu24",
      ImageVersion: identity.imageVersion,
      GITHUB_OUTPUT: output,
    };
    const positive = spawnSync(process.execPath, ["scripts/ci/playwright-kit.ts", "key"], {
      env,
      encoding: "utf8",
    });
    expect(positive.status, positive.stderr).toBe(0);
    expect(readFileSync(output, "utf8")).toMatch(
      /^key=playwright-kit-v3-[a-f0-9]{64}-[a-f0-9]{64}\n$/,
    );
    const before = createHash("sha256").update(readFileSync(output)).digest("hex");
    const negative = spawnSync(process.execPath, ["scripts/ci/playwright-kit.ts", "key"], {
      env: { ...env, GITHUB_SHA: "f".repeat(40) },
      encoding: "utf8",
    });
    expect(negative.status).toBe(2);
    expect(negative.stderr).toContain("checkout SHA differs");
    expect(createHash("sha256").update(readFileSync(output)).digest("hex")).toBe(before);
  });
  it("the actual YAML caches only resources and preserves budgets, matrix, SHA pins and offline verify", () => {
    const yaml = readFileSync(".github/workflows/ui-stack.yml", "utf8");
    const prepare = yaml.slice(yaml.indexOf("  prepare-browsers:"), yaml.indexOf("  verify:"));
    const verify = yaml.slice(yaml.indexOf("  verify:"));
    expect(prepare).toContain("timeout-minutes: 12");
    expect(verify).toContain("timeout-minutes: 12");
    expect(prepare).toContain("playwright install --with-deps chromium firefox webkit");
    expect(prepare).toContain("actions/cache/restore@");
    expect(prepare).toContain("actions/cache/save@");
    expect(prepare).not.toContain("restore-keys:");
    expect(prepare).not.toContain("path: ~/.cache/ms-playwright");
    expect(prepare.match(/path: .artifacts\/browser-kit\/resource/g)).toHaveLength(2);
    expect(prepare).toContain("node scripts/ci/playwright-kit.ts verify-resource");
    expect(prepare).toContain("node scripts/ci/playwright-kit.ts attest");
    expect(verify).not.toContain("playwright install --with-deps");
    expect(verify).toContain("--no-download --no-remove");
    expect(verify).toContain("needs: prepare-browsers");
    expect(verify).toContain("verify-release");
    expect(verify).toContain(
      "--project=chromium --project=firefox --project=webkit --project=mobile",
    );
    const actions = [...yaml.matchAll(/uses: ([^\s]+)@([^\s]+)/g)];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action[2]).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("runner image identity source", () => {
  it("reads the version from the image metadata file", () => {
    expect(
      imageVersionFromEnvironment("PATH=/usr/bin\nImageOS=ubuntu24\nImageVersion=20261012.334.1\n"),
    ).toBe("20261012.334.1");
  });
  it("accepts quoted values and trims whitespace", () => {
    expect(imageVersionFromEnvironment('ImageVersion="20261023.334.3"\n')).toBe("20261023.334.3");
    expect(imageVersionFromEnvironment("ImageVersion= 20261012.334.1 \n")).toBe("20261012.334.1");
  });
  it("returns an empty string when the file has no image version", () => {
    expect(imageVersionFromEnvironment("PATH=/usr/bin\n")).toBe("");
  });
  it("prefers the image metadata over the provisioner environment", () => {
    expect(resolveImageVersion("ImageVersion=20261012.334.1\n", "20261023.334.3")).toBe(
      "20261012.334.1",
    );
  });
  it("falls back to the provisioner environment when the file has no image version", () => {
    expect(resolveImageVersion("PATH=/usr/bin\n", "20261023.334.3")).toBe("20261023.334.3");
    expect(resolveImageVersion("", undefined)).toBe("");
  });
  it("names both image identities in the mismatch", () => {
    const kit = fixture();
    kit.identity.imageVersion = "20261012.334.1";
    expect(() => validateKit(kit, identity, files)).toThrow(
      "kit identity mismatch: imageVersion (kit=20261012.334.1, runner=20260928.1.0)",
    );
  });
});
