import { describe, expect, it } from "vitest";
import {
  assertEvidence,
  assertTarget,
  fixtureStateMatches,
  PRODUCTION_BRANCH,
  PROJECT_ID,
  type PurgeEvidence,
} from "../../scripts/db/purge-fixtures";
import { directConnectionConfig, type Inventory } from "../../scripts/db/backup-verify";
import proofFile from "../../docs/evidence/pre-a4-2026-09-05/implementation/native-restore-verify.json";
const time = Date.parse("2026-09-06T03:00:00Z");
const proof = (): PurgeEvidence => ({
  verification: structuredClone(proofFile),
  snapshot: {
    id: proofFile.snapshot_id,
    source_branch_id: PRODUCTION_BRANCH,
    expires_at: "2026-10-10T23:59:59Z",
  },
  snapshot_checked_at: new Date(time).toISOString(),
});
describe("administrative safety boundaries", () => {
  it("requires fresh, unexpired passing snapshot evidence", () => {
    expect(() => assertEvidence(proof(), time)).not.toThrow();
    const expired = proof();
    expired.snapshot.expires_at = new Date(time).toISOString();
    expect(() => assertEvidence(expired, time)).toThrow();
    expect(() => assertEvidence(proof(), time + 600_001)).toThrow();
    const wrong = proof();
    wrong.snapshot.id = "different";
    expect(() => assertEvidence(wrong, time)).toThrow();
  });
  it("refuses production writes and wrong project/branch identities", () => {
    const identity = { project_id: PROJECT_ID, branch_id: PRODUCTION_BRANCH, endpoint_id: "ep" };
    expect(() => assertTarget(identity, PRODUCTION_BRANCH, proof(), true)).toThrow();
    expect(() => assertTarget(identity, PRODUCTION_BRANCH, proof(), false)).not.toThrow();
    const restore = proofFile.restore_branch;
    expect(() =>
      assertTarget({ ...identity, branch_id: restore }, restore, proof(), true),
    ).not.toThrow();
    expect(() =>
      assertTarget(
        { ...identity, project_id: "other", branch_id: restore },
        restore,
        proof(),
        true,
      ),
    ).toThrow();
  });
  it("detects changed content at equal counts and catalog drift", () => {
    const inv = structuredClone(proofFile.source) as Inventory;
    expect(fixtureStateMatches(inv, inv)).toBe(true);
    const changed = structuredClone(inv);
    changed.tables["public.users"].checksum = "changed";
    expect(fixtureStateMatches(changed, inv)).toBe(false);
    const catalog = structuredClone(inv);
    catalog.catalog = [];
    expect(fixtureStateMatches(catalog, inv)).toBe(false);
  });
  it("enforces certificate verification despite URL ssl overrides and refuses pooling", () => {
    const config = directConnectionConfig(
      "postgres://operator:fake@example.neon.tech/neondb?sslmode=no-verify&sslrootcert=untrusted&uselibpqcompat=true",
    );
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("ssl");
    expect(() => directConnectionConfig("postgres://u:p@ep-pooler.neon.tech/db")).toThrow();
    expect(directConnectionConfig("postgres://u:p@127.0.0.1/db").ssl).toBe(false);
  });
});
