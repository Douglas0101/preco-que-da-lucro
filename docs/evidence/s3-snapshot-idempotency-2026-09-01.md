# S3 — Snapshot Idempotency Key Derivation (WS-03) — 2026-09-01

## Decision

`UNIQUE (tenant_id, calculation_type, idempotency_key)` on
`calculation_snapshots` (migration `0008`) is **ACCEPTED without adding
`entity_id` to the index**, because the idempotency key itself encodes the
entity. **No migration change is needed.**

The derivation rule (plan §10.6 entity requirement + §22 idempotency
semantics) is centralized in one pure helper:

`deriveSnapshotIdempotencyKey` in `src/server/services/calculation-snapshot.service.ts`

```
idempotency_key = sha256( canonical_json([
  calculationType,
  entityType,
  entityId ?? "no-entity",
  engineVersion,
  normalizedInputs            // object keys recursively sorted
]) )
```

- **Canonical JSON**: inputs are normalized by recursively sorting object keys
  before serialization, so payloads that differ only in property insertion
  order hash to the same digest.
- **`"no-entity"` token** (`NO_ENTITY_TOKEN`): documented stand-in for
  scenario-type calculations that legitimately have no row-level entity —
  today only `break_even` (`entity_type = "break_even_scenario"`,
  `entity_id = NULL`).

## §10.6 equivalence-class argument

The UNIQUE index partitions snapshots into equivalence classes keyed by
`(tenant_id, calculation_type, idempotency_key)`. Because
`calculationType + entityType + entityId + engineVersion + inputs` are all
injected into the key hash:

1. **Distinct entities, identical payload → distinct keys.** Two products
   diagnosed under byte-identical assumptions produce different entityIds and
   therefore different keys, so they land in different equivalence classes and
   both rows persist. The index cannot collapse them even though it omits
   `entity_id` — the entity is already a factor of the key. Adding
   `entity_id` to the index would be redundant.
2. **Replay safety.** Re-running the same calculation (same tenant, type,
   entity/engine version/inputs) yields the same key; the repository `append`
   (`onConflictDoNothing` + re-select) returns the original row — no
   duplication.
3. **Tenant isolation.** `tenant_id` is the first column of the UNIQUE index,
   so identical keys derived in different tenants remain distinct rows; the
   key hash intentionally carries no tenant component.
4. **Legitimate dedup for no-entity scenarios.** Two `break_even` calls with
   equal assumptions and `entity_id = NULL` share the
   `("break_even", ..., "no-entity", ...)` key and dedup — this is the
   intended behavior for scenario-type calculations.

## Refactored call sites (inline `createHash` blocks deleted)

| Site                                                                      | calculation_type        | entity                                          |
| ------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
| `src/server/services/diagnostic.service.ts` (`recordDiagnosticSnapshots`) | `diagnostic`, `pricing` | `("product", productId)`                        |
| `src/server/services/simulation.service.ts` (`save`)                      | `simulation`            | `("simulation", row.id)`                        |
| `src/lib/break-even.functions.ts` (`calculateBreakEven`)                  | `break_even`            | `("break_even_scenario", null)` → `"no-entity"` |

Note: the previous inline derivation for diagnostic encoded the productId
(without an `entityType`) and the simulation/break-even keys omitted the
entity-type factor; the new helper makes the full tuple
`(calculationType, entityType, entityId, engineVersion, inputs)` part of every
key. Key values therefore change once (a fresh snapshot is recorded after
deploy) — expected, since the §22 contract required the richer encoding.

## Verification

1. **Unit tests** — `src/test/snapshot-idempotency.test.ts` (5 tests,
   passing): determinism under key-order permutation; distinct entities +
   identical payload → different keys (the equivalence-class argument above is
   restated in the test header); tenant uniqueness carried by the index
   itself; break-even `no-entity` token + legitimate dedup;
   calculation/entity-type discrimination.
2. **Replay + no-duplication proof against a SCRATCH database**
   (`s3_verify`, created/migrated/dropped in the local Docker
   `postgres:17-alpine`; never the shared `preco_que_da_lucro_test`):
   - `DROP DATABASE IF EXISTS s3_verify WITH (FORCE); CREATE DATABASE s3_verify;`
   - `npx tsx scripts/db/migrate.ts` with
     `DATABASE_URL`/`DATABASE_ADMIN_URL` pointed at the scratch DB
     (`DATABASE_DRIVER=node-postgres`) — all migrations applied.
   - Throwaway script (deleted after the run) seeded a fixed
     tenant/user/owner-membership triple and exercised
     `calculationSnapshotRepository.append` inside real transactions:
     - same derived key appended twice (second call with reordered input
       keys) → **1 row, identical `id`** (replay returns the original);
     - same inputs, different `entityId` → **2 rows, distinct `id`s**
       (collision impossible despite the UNIQUE lacking `entity_id`);
     - break-even `entityId = null` with equal-but-reordered inputs → same
       key, **deduped to 1 row**.
   - `DROP DATABASE IF EXISTS s3_verify WITH (FORCE);`
3. **Static checks** — `npx tsc --noEmit -p tsconfig.json` clean;
   `npx vitest run src/test/snapshot-idempotency.test.ts` green; existing
   `simulation.service.test.ts` / `break-even.service.test.ts` unaffected;
   touched files prettier-formatted.
