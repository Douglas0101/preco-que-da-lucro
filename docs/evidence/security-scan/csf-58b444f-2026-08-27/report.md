# Security Review: preco-que-d-main

## Scope

Local Standard security re-scan of the exact fix tip e61c8c80ed7477828e0f44fd6a0c4f799ae9aa48 for the ai-budget-race finding.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_8e4a601a221b879e44fb1eb0802956f976c9574e78ec7dd8f4d6c9fa0f86b8b9
- Revision: e61c8c80ed7477828e0f44fd6a0c4f799ae9aa48
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: PostgreSQL 17 with node-postgres was exercised locally; neon-serverless is covered only by ledger contract tests; no Neon endpoint or real provider was used.
- Artifacts reviewed: src/lib/ai/budget-ledger.server.ts, src/lib/chat-execution.server.ts, src/lib/chat.functions.ts, src/lib/chat-data.ts, src/db/schema.ts, drizzle/0006_loud_lockjaw.sql, scripts/db/test-ai-budget.ts, src/db/client.server.ts, src/lib/tools/runner.ts, src/lib/tools/registry.ts, src/middleware.ts, src/lib/auth-policy.ts
- Scan context: Validate atomic budget reservation, idempotent settlement, orphan TTL sweep, per-tool-round accounting, tenant boundary, and server-only packaging.

Limitations and exclusions:
- Coverage is partial: six bounded security surfaces reviewed from a 240-file target inventory.
- The scan does not validate Neon, production, migration/cutover state, provider billing, or real external traffic.
- Banach found a direct test-only callModelForTests export/consumer seam; no productive bypass was found.
- A double transaction failure during settlement can defer correction to the lazy TTL sweep; one bounded retry reduces but does not eliminate this operational residual.
- The local full check has a reproducible unrelated finance property-test failure; the changed security path and remote CI are green.
- Excluded Neon endpoints and production infrastructure: H-003 and the v3 mandate prohibit real Neon/production access.
- Excluded real provider billing or external gateway traffic: The plan authorizes mocks/local tests only; no real provider credit may be spent.
- Excluded src/routes/auth.tsx: The mandate explicitly prohibits editing or using this canary as implementation scope.
- Excluded TAC or chatgpt.com/cyber: TAC is not granted; the scan is local Standard only and does not bypass enrollment.
- Excluded REQ-012 D1/Workers portability: Portability is explicitly deferred pending a future human architectural decision.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 0 |
| Severity mix | none |
| Confidence mix | none |
| Coverage | partial |
| Validation mode | Bounded semantic Standard review plus executable local PostgreSQL tests and CI evidence. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

Authenticated tenant members can submit concurrent messages, retries, tool calls, and requests that fail or abort; the protected assets are tenant budget counters, ai_usage settlement state, tenant isolation, and gateway credentials.

### Assets

- per-tenant model-call quota
- per-tenant token quota
- per-tenant in-flight quota
- ai_usage settlement and audit records
- tenant isolation and gateway credentials

### Trust Boundaries

- authenticated request to server action
- server execution layer to PostgreSQL ledger
- server execution layer to external AI gateway
- tenant transaction and RLS boundary

### Attacker Capabilities

- submit authenticated messages concurrently
- retry requests or repeat settlement-triggering paths
- trigger timeout, abort, provider error, and tool-round paths

### Security Objectives

- reserve budget atomically before gateway contact
- return deterministic AI_QUOTA without external contact when reservation fails
- settle each usage at most once and recover expired orphan reservations
- prevent cross-tenant budget access
- keep the gateway caller server-only

### Assumptions

- local PostgreSQL 17 is representative for the active node-postgres path
- neon-serverless contract coverage is interface-level only under H-003
- real Neon, production, and provider behavior are outside this scan

## Findings

### No findings

No reportable findings survived the canonical discovery, validation, and reportability gates.

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| AI budget admission and settlement | Atomic quota reservation, idempotent settlement, and orphan recovery | No issue found | Reviewed src/lib/ai/budget-ledger.server.ts, src/db/schema.ts, and drizzle/0006_loud_lockjaw.sql. T1-T10 passed against local PostgreSQL 17. |
| Chat gateway entrypoint | Pre-fetch admission and external AI gateway reachability | No issue found | Reviewed src/lib/chat-execution.server.ts and src/lib/chat.functions.ts. Reservation precedes the production model fetch, each round settles in finally, and chat.functions.ts contains no budget SQL. |
| Tenant and RLS boundary | Tenant isolation and database authorization | No issue found | Reviewed tenant transaction handling, PostgreSQL RLS policy, runtime grants, and server-side database selection in src/db/schema.ts, src/db/client.server.ts, and src/lib/chat-data.ts. |
| Tool-round boundary | Independent budget accounting for tool rounds | No issue found | Reviewed the tool execution path and its integration with src/lib/chat-execution.server.ts. T5 and tool-round regression checks passed. |
| Server-only packaging | Client/server module boundary around gateway and ledger code | No issue found | The build-boundary correction was verified by a successful production build and green UI-stack CI at e61c8c8. |
| Repository remaining surfaces | Unreviewed repository scope | Needs follow-up | The target inventory contains 240 files; this bounded Standard pass has six scoped review receipts and does not claim exhaustive coverage or absence of other vulnerabilities. |

## Open Questions And Follow Up

- Whether to remove or further constrain the test-only callModelForTests export is outside the authorized production write-set and remains for human review.
- Repository remainder outside the six bounded security surfaces was inventoried but not reviewed to exhaustive depth in this local Standard pass.
  - Follow-up prompt: Review deferred unit standard-scan-remainder and close its stated proof gap. Paths: ..
- Banach identified callModelForTests as a direct test-only gateway seam; no productive consumer or production bypass was found, but the seam remains a residual review item.
  - Follow-up prompt: Review deferred unit test-only-gateway-seam and close its stated proof gap. Paths: src/lib/chat.functions.ts, src/test/model-gateway.test.ts.
