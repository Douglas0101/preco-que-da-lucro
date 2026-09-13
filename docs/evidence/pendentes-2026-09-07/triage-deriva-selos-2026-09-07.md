# Triagem da deriva de selos — 3 caminhos divergentes (retomada PENDENTES-CLOSE)

- **Rodada**: PENDENTES-CLOSE (retomada autorizada), 2026-09-07T03:37Z
- **HEAD**: `8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f` (branch `develop`, STACK_MODE `uncommitted`, 0 novos commits)
- **Autorização**: decisão do mantenedor nesta sessão — retomar pela triagem das 3 divergências e, se confirmadas como alterações documentadas do Manifest 5, regenerar os selos de forma controlada e continuar Q0–Q6.
- **Gatilho original**: `Q0-SUMS-CUTOVER-UNLABELLED` — "m02:sums vermelho não-rotulado em bundle não-gsec" (roteiro L138–141), aplicado à verificação equivalente do Q0.
- **Classificação de método**: INFERENCE (proveniência + confirmação de conteúdo). Comparação byte-a-byte com o estado selado é **impossível**: os 3 arquivos nunca foram commitados em nenhum ref, não há stash com eles, não há cópia/snapshot do conteúdo selado (verificado por `git log --all`, `git stash list`, busca em `docs/evidence/`, `artifacts/`, baseline `.mimosa`).

## 1. Auditoria de hashes (reexecutada nesta sessão)

`sha256sum -c` dos 4 bundles: cutover **15/18**, gsec **12/14**, cutover-prep **25/25**, pendentes **5/5** — idêntico ao STOP (03:09:16Z). Nenhuma deriva nova desde a parada.

| Caminho                                          | Selo cutover (L14/17/18) | Selo gsec (L11/12) | Atual (== STOP) | Cutover | Gsec                     |
| ------------------------------------------------ | ------------------------ | ------------------ | --------------- | ------- | ------------------------ |
| `docs/runbooks/cutover-A4.md`                    | `252f9c7e…cb38c`         | —                  | `f547aeec…c916` | FALHOU  | não selado               |
| `scripts/env-guard.mjs`                          | `625b6bed…acb1`          | `7f3247f2…062`     | `808b4a5b…21f5` | FALHOU  | FALHOU (previsto até V0) |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md` | `7772dd8a…fee4e`         | `efc0d47a…3acf`    | `0ed014d1…3267` | FALHOU  | FALHOU (previsto até V0) |

As demais 15 entradas do cutover (incl. `m02-reconcile.mjs`, `rls-probe.mjs`) e as demais 12 do gsec (incl. `ai-endpoint.server.ts` + teste) conferem OK.

## 2. Proveniência — Manifest 5 (docs/evidence/cutover-prep-2026-09-07/manifest-5.md)

L12–19 (nota de empilhamento): "`scripts/env-guard.mjs`, `docs/specs/M-02/emenda-2026-09-07-env-guard.md`, `docs/runbooks/cutover-A4.md` e `package.json` também pertencem aos manifests anteriores (V0/V4). Se o humano pousar a pilha em sequência hoje, o CONTEÚDO ATUAL da árvore já inclui emendas #2/#3 (V4) **+ #4 (esta)**…".

L34–36 (tabela de staging, fase CUTOVER-PREP):

- `scripts/env-guard.mjs` | modificado | P5/Emenda #4 (`m02:snapshot` sancionada; selftest 12→13; MANAGED_KEYS +`SUPABASE_MIGRATION_DATABASE_URL`)
- `docs/specs/M-02/emenda-2026-09-07-env-guard.md` | modificado | P5/Emenda #4 (§4 linha nova + §10 datada; NÃO relaxa hard-deny de migrate)
- `docs/runbooks/cutover-A4.md` | modificado | P3 (§2.5 T-0 (v) role-membership ANTES do smoke + linha na §10)

L50: pré-flight exige `npm run m02:env-guard-selftest` **13/13 (novo count, Emenda #4)**.

**Leitura de proveniência**: o selo `cutover-2026-09-07` selou o conteúdo pré-Emenda-#4 (estado da rodada CUTOVER-READY, que também é a geração selada pelo gsec para env-guard/emenda — por isso os selos cutover e gsec divergem entre si para os mesmos 2 arquivos). A rodada CUTOVER-PREP alterou os 3 caminhos conforme o Manifest 5 e **não selou o estado posterior** (o SUMS do prep é 100% interno aos 25 arquivos do bundle). O estado atual é a terceira geração (pós-#4), não selada por nenhum bundle.

## 3. Confirmação de conteúdo (executada nesta sessão)

1. **env-guard.mjs** = Emenda #4: `m02:snapshot` em `SANCTIONED_REMOTE` (L34); `SUPABASE_MIGRATION_DATABASE_URL` em `MANAGED_KEYS` (L507); `npm run m02:env-guard-selftest` → **13/13 pass** (inclui caso novo `remoto+m02:snapshot → ALLOW`).
2. **emenda-2026-09-07-env-guard.md** = Emenda #4: §10 "Emenda #4 (2026-09-07, rodada CUTOVER-PREP) — `m02:snapshot` na allowlist sancionada (read-only dump)" (L146); linha nova na §4 (L45); **hard-deny preservado** — L166: "não relaxa o hard-deny de `db:migrate` contra produção".
3. **cutover-A4.md** = P3: §2.5 "(v) Role membership do runtime — `m02:role-membership`" com "Ordem obrigatória: este passo executa **ANTES da seção 5 (smoke A4)**" (L149, L175) + linhas na §10 (L377–378).

## 4. Veredito

| Caminho                                          | Veredito              | Base                                                        |
| ------------------------------------------------ | --------------------- | ----------------------------------------------------------- |
| `docs/runbooks/cutover-A4.md`                    | **DOCUMENTED-CHANGE** | Manifest 5 L36 (P3) + §2.5/§10 presentes                    |
| `scripts/env-guard.mjs`                          | **DOCUMENTED-CHANGE** | Manifest 5 L34 (Emenda #4) + selftest 13/13 + marcadores    |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md` | **DOCUMENTED-CHANGE** | Manifest 5 L35 (Emenda #4) + §10 datada + hard-deny intacto |

3/3 confirmados → **GATE: PASS**. Autorizada a regeneração controlada **exclusivamente via `m02:sums`** (mecanismo sancionado, roteiro L33–34), após a implementação do Q1.

## 5. Preservação do registro (a regeneração não apaga a divergência)

Conforme round-state pendentes §3, os valores selados originais permanecem registrados aqui, em `../cutover-2026-09-07/SHA256SUMS` (substituído no momento da regeneração, mas preservado verbatim abaixo e em `evidence.json` da rodada anterior com expected/actual dos 5 pares) e em `artifacts/q0-checks-observed.txt`.

### 5.1 SHA256SUMS original de cutover-2026-09-07 (18 entradas, verbatim)

```
4ccd05db17b970f0996a7f41f79b50d0777ce9b568548cb8db25ffa071db4d77  docs/evidence/cutover-2026-09-07/env-guard-drill.md
8300d6ef7ed05d8cf344f5711a85eccbc8c4e33ef9b493719c4c7c2050bf7409  docs/evidence/cutover-2026-09-07/dryrun-notes.md
e860449a0198de432421c71c4bf190d4d0b490c53b90fd1c0024e293cbff3891  docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.md
b607b72a5ac1876fe167622e8586b75a73b96999b6c7a64564aa360b89509ff5  docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.json
fe0f4adeb0b98fce1ee7977a28eb083135b093e65f9fb5a7ebc15b958779ec80  docs/evidence/cutover-2026-09-07/schema-diff-2026-09-07.md
edd8b0731128fe9bb8ab83227973a7a9ebcdd29da0c0fa0089b5a9c10f9e48cd  docs/evidence/cutover-2026-09-07/restore-drill-2026-09-07.md
e085c1db970e88655da84ae0b168c7981e26b2c1bf7337c9b460d45363cb1c6b  docs/evidence/cutover-2026-09-07/reconciliation-restore-2026-09-07.md
7b1053372dd416538f6d62faac3405b966022511ef27f081a0ff020566eaf0ea  docs/evidence/cutover-2026-09-07/reconciliation-restore-2026-09-07.json
67a1d33d48dd108930c31e72a589ca91e6379a9ed43f1a2cdf12a70368e3393b  docs/evidence/cutover-2026-09-07/rls-probe-2026-09-07.md
277fdcf45d47d1314476025351976555378a9ec078566844084a83ebe01979d3  docs/evidence/cutover-2026-09-07/rls-probe-2026-09-07.json
ee18f11f2e94f7ba75183b781bc3bbe30a51bae77d58c98afab9590732cb772c  docs/evidence/cutover-2026-09-07/branch-cleanup-2026-09-07.md
d6a929175c1e422c5e64a3986d2514c6bc0296c30d022402937f6dbc0676af42  docs/evidence/cutover-2026-09-07/manifest-4.md
51bc50fde9e804ac9b620743ded005663588e594248ea6a26d4484683932643d  docs/evidence/cutover-2026-09-07/evidence.json
252f9c7eb846e95b2b11dd27c273c7054d722f67ae9bb79354b48ef3714cb38c  docs/runbooks/cutover-A4.md
ab660d090fa31a8ac18dac70a55208dbc79a544c3b446d1287a5198831a18e20  scripts/m02-reconcile.mjs
95c94bc13d2e9360da23b6caedcf98c5965d754b006ffe99d354f8aecd2883cd  scripts/rls-probe.mjs
625b6bed9654b75923068df1d90e8714f3e585d959c0aa08714868128114acb1  scripts/env-guard.mjs
7772dd8a28128737a79b4354a62a1d34f4cddf1a95003c0e0e098f72894fee4e  docs/specs/M-02/emenda-2026-09-07-env-guard.md
```

### 5.2 SHA256SUMS original de gsec-2026-09-06 (14 entradas, verbatim)

```
b117c280e5ab0aab35ee6dc7939abbe61b550b8982116eab1a2a0bd61ef772e9  docs/evidence/gsec-2026-09-06/triagem-achados.md
b26df8910d3b939a36e250f1710af1c3ff5993bc1173bc558b916933c5355b3e  docs/evidence/gsec-2026-09-06/designs-endurecimento.md
32f9bb99c4ca34afd80ba9fc679cadfb723b7d25b5de9a71c995df6ce359c173  docs/evidence/gsec-2026-09-06/memo-G-SEC.md
00ffe89a94240602fbc9bea1569f5183ecbd796d14a6a2f1c54dd5732c45964e  docs/evidence/gsec-2026-09-06/manifests-commit.md
afcddb7aa0e1411ff86e80873acca8357f9c95ba37a76ec660e01b9ff5c2fb83  docs/evidence/gsec-2026-09-06/report.md
3ea78ef2ff7a01cfdedc405f8139ed58273cc3c45844c06ab37fc55e5a610f94  docs/evidence/gsec-2026-09-06/artifacts/readiness-gsec-exec.json
01699101d2bc7865115f07c33db7281848fdbc599e3ca0f0c8bd7167566111ef  docs/evidence/gsec-2026-09-06/artifacts/secrets-audit-gsec-exec.json
bf5ef11f76a696c9de9a6ce7a6af55ace3f639e1dec4352a434a7d7bd3910cfb  docs/evidence/gsec-2026-09-06/artifacts/git-status-final.txt
3bae070d2f8203549cf5b27714a366491ca40722ebee764bf2e5f4ac7fc8027b  docs/evidence/gsec-2026-09-06/artifacts/keepwarm/probe.json
1185df7d112213b9a0f62f71523ee32e7c0456be654e2474a02c2f3206169f2b  docs/evidence/gsec-2026-09-06/artifacts/keepwarm/log.txt
7f3247f2ba8bbdc16f9ff47fb152a579f5961ae3c8b3209e61d17073d7d9c062  scripts/env-guard.mjs
efc0d47ada34fbf990ea3896c22445592f59e09082ca5dab4d834d6af1003acf  docs/specs/M-02/emenda-2026-09-07-env-guard.md
53276d37e03eee73ae7e1282498d517f61e8916c2f6e33f57fbe7836d891a0a4  src/lib/ai-endpoint.server.ts
180e0ff61d3e161ab40a4893ba8f5ba463cabd5cc28cdfb3812f33c328a8e80f  src/test/ai-endpoint.server.test.ts
```

## 6. Regras da regeneração autorizada (fixadas nesta triagem)

1. Regeneração **somente** por `npm run m02:sums`; proibido editar SUMS à mão.
2. `cutover-2026-09-07` volta a 18/18 contra o conteúdo atual (pós-Emenda-#4, agora documentado por este arquivo).
3. `gsec-2026-09-06` **preserva o tripwire**: as 2 entradas nomeadas permanecem nos hashes selados originais (§5.2), rotuladas "vermelho-esperado até assinatura do memo (V0)" — rótulo único, datado, exclusivo do gsec (roteiro L40–42). Liberação pós-V0 é passo do H1 (fila humana).
4. Este arquivo é parte do bundle `pendentes-2026-09-07` e será selado pela regeneração.
