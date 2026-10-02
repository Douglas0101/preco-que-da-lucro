import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertInstalled,
  changedPackages,
  parsePackages,
  validateKit,
  type BrowserKit,
  type KitIdentity,
} from "../../scripts/ci/playwright-kit";

const identity: KitIdentity = {
  sourceSha: "a".repeat(40),
  lockSha256: "b".repeat(64),
  imageOS: "ubuntu24",
  imageVersion: "20260928.1.0",
  playwrightVersion: "1.62.1",
};
const files = {
  "browsers.tar.gz": "c".repeat(64),
  "debs/libexample_1.0_amd64.deb": "d".repeat(64),
};
function fixture(): BrowserKit {
  return {
    schema: "playwright-kit/1",
    identity: { ...identity },
    browsers: ["chromium", "firefox", "webkit"],
    changedPackages: { libexample: "1.0" },
    files: { ...files },
  };
}

describe("Playwright kit identity and offline preparation", () => {
  it("accepts the exact source, toolchain, image and nonempty payload", () => {
    expect(() => validateKit(fixture(), identity, files)).not.toThrow();
  });
  it.each(Object.keys(identity) as (keyof KitIdentity)[])("rejects different %s", (key) => {
    const kit = fixture();
    kit.identity[key] = "different";
    expect(() => validateKit(kit, identity, files)).toThrow("identity mismatch");
  });
  it("does not convert absent source identity into success", () => {
    expect(() => validateKit(fixture(), { ...identity, sourceSha: "" }, files)).toThrow();
  });
  it("rejects a browser missing from the release matrix", () => {
    const kit = fixture();
    kit.browsers.pop();
    expect(() => validateKit(kit, identity, files)).toThrow();
  });
  it("rejects corrupted bytes with the same file name", () => {
    expect(() =>
      validateKit(fixture(), identity, { ...files, "browsers.tar.gz": "e".repeat(64) }),
    ).toThrow("hash mismatch");
  });
  it("rejects an omitted deb and newly discovered unsealed payload", () => {
    expect(() =>
      validateKit(fixture(), identity, { "browsers.tar.gz": files["browsers.tar.gz"] }),
    ).toThrow("discovery");
    expect(() =>
      validateKit(fixture(), identity, { ...files, "extra.deb": "e".repeat(64) }),
    ).toThrow("discovery");
  });
  it("rejects a changed system package without an offline deb", () => {
    const kit = fixture();
    kit.files = { "browsers.tar.gz": files["browsers.tar.gz"] };
    expect(() => validateKit(kit, identity, kit.files)).toThrow("offline payload");
  });
  it("rejects empty, duplicate or malformed system inventory", () => {
    for (const source of ["", "liba\t1\nliba\t2", "liba\t1\textra"])
      expect(() => parsePackages(source)).toThrow();
    expect(() => changedPackages({}, { liba: "1" })).toThrow();
    expect(() => changedPackages({ liba: "1" }, {})).toThrow();
  });
  it("keeps new and upgraded package identities and rejects removals", () => {
    expect(changedPackages({ liba: "1", libb: "2" }, { liba: "3", libb: "2", libc: "1" })).toEqual({
      liba: "3",
      libc: "1",
    });
    expect(() => changedPackages({ liba: "1", libb: "2" }, { liba: "1" })).toThrow("removed");
  });
  it("does not claim offline installation when a package is absent or has another version", () => {
    expect(() => assertInstalled({ liba: "1" }, { liba: "1" })).not.toThrow();
    expect(() => assertInstalled({ liba: "1" }, {})).toThrow();
    expect(() => assertInstalled({ liba: "1" }, { liba: "2" })).toThrow();
  });
  it("the actual YAML preserves both budgets, full matrix, SHA pins and offline verify", () => {
    const yaml = readFileSync(".github/workflows/ui-stack.yml", "utf8");
    const prepare = yaml.slice(yaml.indexOf("  prepare-browsers:"), yaml.indexOf("  verify:"));
    const verify = yaml.slice(yaml.indexOf("  verify:"));
    expect(prepare).toContain("timeout-minutes: 12");
    expect(verify).toContain("timeout-minutes: 12");
    expect(prepare).toContain("playwright install --with-deps chromium firefox webkit");
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
