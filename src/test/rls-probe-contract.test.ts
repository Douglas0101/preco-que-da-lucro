import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts/rls-probe.mjs");

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script, "--target-env", "DATABASE_RESTORE_URL"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 60_000,
  });
}

describe("rls-probe remote target contract", () => {
  it("fails closed before connecting without drill-branch kind", () => {
    const result = run({
      DATABASE_RESTORE_URL: "postgresql://synthetic:synthetic@ep-fake.neon.tech/db",
      ALLOW_REMOTE_DB: "synthetic contract test",
      NEON_MIGRATION_TARGET_KIND: "",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("NEON_MIGRATION_TARGET_KIND=drill-branch");
  });

  it("hard-denies the production endpoint before connecting", () => {
    const result = run({
      DATABASE_RESTORE_URL: "postgresql://synthetic:synthetic@ep-long-violet-aye9g0bn.neon.tech/db",
      ALLOW_REMOTE_DB: "synthetic contract test",
      NEON_MIGRATION_TARGET_KIND: "drill-branch",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("production proibido");
  });
});
