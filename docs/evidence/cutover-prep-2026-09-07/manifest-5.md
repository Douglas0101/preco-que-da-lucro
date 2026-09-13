# Manifest 5 — feixe CUTOVER-PREP P1–P6 (commit único, HUMANO)

Pré-requisitos em cadeia: **V0** (Manifests 1–3, G-SEC-EXEC) e **V4**
(Manifest 4, CUTOVER-READY) ainda pendentes neste mesmo working tree
(STACK_MODE=`uncommitted`, HEAD `8d26a2c`). Este manifest é o TERCEIRO bloco
da pilha. Nenhum commit pelo agente (gate floor 9). Branches efêmeras desta
rodada (`probe-membership-2026-09-07`) já deletadas com prova
(`role-membership-test-2026-09-07.md` §3); as do T-0 não criaram branch.
`artifacts/snapshots/` fica FORA do commit (dump ignorado por `*.dump`; os
companheiros `.sha256`/`.metadata.json` são artefatos locais reprodutíveis).

Nota de empilhamento: `scripts/env-guard.mjs`,
`docs/specs/M-02/emenda-2026-09-07-env-guard.md`, `docs/runbooks/cutover-A4.md`
e `package.json` também pertencem aos manifests anteriores (V0/V4). Se o humano
pousar a pilha em sequência hoje, o CONTEÚDO ATUAL da árvore já inclui emendas

# 2/#3 (V4) **+ #4 (esta)** e os hooks `m02:*` de V4 **e** os 4 scripts novos +

hook `prem02:snapshot` desta rodada — basta conferir no pré-flight final. Se
V0/V4 já tiverem pousado ANTES com conteúdo mais antigo, os quatro arquivos
voltam a este staging com a delta da Emenda #4/runbook/§2.5/package.json.

## Staging list (arquivos exatos deste feixe)

| Arquivo                                                                                                                                                                      | Estado     | Origem                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/m02-v2b.mjs` + `scripts/m02-v2b.d.mts`                                                                                                                              | novo       | P1 (V2b one-command)                                                                                      |
| `scripts/m02-role-membership.mjs` + `.d.mts`                                                                                                                                 | novo       | P3 (GAP-TOOLING)                                                                                          |
| `scripts/m02-snapshot.mjs` + `.d.mts`                                                                                                                                        | novo       | P5 (snapshot read-only)                                                                                   |
| `scripts/m02-cutover-t0.mjs` + `.d.mts`                                                                                                                                      | novo       | P4 (T-0 mecanizado)                                                                                       |
| `src/test/m02-v2b.test.ts`                                                                                                                                                   | novo       | P1 (9 testes unit, sem rede)                                                                              |
| `src/test/m02-role-membership.test.ts`                                                                                                                                       | novo       | P3 (4 testes: pré-conexão/Emenda #3)                                                                      |
| `src/test/m02-snapshot.test.ts`                                                                                                                                              | novo       | P5 (4 testes: motivo/pooled/fail-closed)                                                                  |
| `src/test/m02-cutover-t0.test.ts`                                                                                                                                            | novo       | P4 (2 testes: parsing + rótulos sem env)                                                                  |
| `.github/workflows/neon-pr-branch.yml`                                                                                                                                       | novo       | P2 (§26; fork-guard; cleanup always; pin por SHA)                                                         |
| `scripts/env-guard.mjs`                                                                                                                                                      | modificado | P5/Emenda #4 (`m02:snapshot` sancionada; selftest 12→13; MANAGED_KEYS +`SUPABASE_MIGRATION_DATABASE_URL`) |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md`                                                                                                                             | modificado | P5/Emenda #4 (§4 linha nova + §10 datada; NÃO relaxa hard-deny de migrate)                                |
| `docs/runbooks/cutover-A4.md`                                                                                                                                                | modificado | P3 (§2.5 T-0 (v) role-membership ANTES do smoke + linha na §10)                                           |
| `package.json`                                                                                                                                                               | modificado | wiring: `m02:v2b`, `m02:role-membership`, `m02:snapshot`, `m02:cutover-t0`, hook `prem02:snapshot`        |
| `docs/evidence/cutover-prep-2026-09-07/` — 26 arquivos (inclui este manifest, `report.md`, `evidence.json`, `SHA256SUMS`, `attempt1-*`/`attempt2-*` do T-0 e logs de aceite) | novo       | P0–P6 (round-state, drills, logs de aceite, T-0 oficial, baseline)                                        |

**NÃO entram**: `ledger-snippet-v2b.md` (V2b **não executou** — sem
`SUPABASE_MIGRATION_DATABASE_URL`; prova do exit 3 em
`v2b-exec-sem-credencial.log`); `docs/specs/M-02/matrix*.yaml`
(`m02:matrix:check` PASS sem drift — regen proibido); `EXECUTION-STATE-PROGRAM.md`
intocado (zero edições de ledger pelo agente); `artifacts/` local; produção
intacta.

## Pré-flight (nesta ordem; tudo deve passar ou ser rótulo honesto)

```
npm run m02:env-guard-selftest     # 13/13 (novo count, Emenda #4)
npx vitest run src/test/m02-v2b.test.ts src/test/m02-role-membership.test.ts \
  src/test/m02-snapshot.test.ts src/test/m02-cutover-t0.test.ts \
  src/test/ai-endpoint.server.test.ts src/test/auth-policy.test.ts     # 35/35 sem DB (npx = gap documentado do pretest guard)
npm run typecheck                  # exit 0
npx eslint .                       # exit 0 (115 prettier já fixados)
npm run m02:matrix:check           # PASS sem drift (se acusar drift: regen HUMANO antes do commit; proibido nesta rodada)
npm run m02:boundaries             # PASS
npm run m02:state:check            # VERMELHO ROTULADO enquanto V0 não pousa (esperado; fica verde na cadeia)
npm run m02:secrets-audit          # COMPLETE_WITH_LIMITS; possible_secret_literals=[]
npm run m02:v2b -- --plan          # exit 0, DAG impresso, sem conexão
npm run m02:cutover-t0 -- --skip-snapshot   # exit 0 com pendings rotulados (a dupla completa exige DATABASE_ADMIN_URL do dia)
sha256sum -c docs/evidence/cutover-prep-2026-09-07/SHA256SUMS   # a partir da raiz
```

Conferência de segredos do staging: os nomes acima, conferidos por
`git diff --cached -U0 | grep -E '(postgres(ql)?://[^ ]*:[^ ]*@|npg_)'` → deve
imprimir **nada** (evidências só hostnames mascarados; `possible_secret_literals`
= `[]`).

## Commit único (Mensagem 5)

```
git add scripts/m02-v2b.mjs scripts/m02-v2b.d.mts scripts/m02-role-membership.mjs scripts/m02-role-membership.d.mts \
  scripts/m02-snapshot.mjs scripts/m02-snapshot.d.mts scripts/m02-cutover-t0.mjs scripts/m02-cutover-t0.d.mts \
  src/test/m02-v2b.test.ts src/test/m02-role-membership.test.ts src/test/m02-snapshot.test.ts src/test/m02-cutover-t0.test.ts \
  .github/workflows/neon-pr-branch.yml package.json docs/evidence/cutover-prep-2026-09-07
# + env-guard.mjs e emenda #4 e runbook cutover-A4.md SE (e somente se) os
# manifests anteriores já tiverem pousado com conteúdo pré-Emenda-#4
git commit -m "feat(cutover-prep): V2b one-command + Neon PR-branch CI + T-0 mecanico + snapshot baseline + membership GAP-TOOLING (Emenda #4) — PREP; gate §42 nao alterado; paridade legacy DESCONHECIDA ate V2b executar"
```

Ledger: **nenhum bloco de ledger por este manifest** — a linha `freeze ativo:`
e o snippet V2b (quando executar) continuam sendo anexos humanos no dia
(runbook §1/§13; bloco do Manifest 4 não pousado).

## Pós-flight

```
npm run m02:state:check        # VERDE pós-cadeia (V0→V4→V5)
npm run m02:env-guard-selftest # 13/13 no código commitado
git push origin develop        # CI ui-stack + primeiro run real do neon-pr-branch.yml em PR
sha256sum -c docs/evidence/cutover-prep-2026-09-07/SHA256SUMS
```
