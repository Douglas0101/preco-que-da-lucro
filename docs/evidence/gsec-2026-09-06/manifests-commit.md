# G-SEC T4 — Manifests de commit (ação humana = 5–15 min)

Gate não liga para committer humano (bind provado — `triagem-achados.md` §T0.2).
Todos os comandos abaixo são copiar-colar, a partir da raiz do repo, branch
`develop` (commit direto sancionado pelo ADR-017; alternativa em PR no final).

## Pré-flight (1 min, tudo deve passar antes de commitar)

```
npm run m02:matrix:check        # esperado PASS
npm run m02:boundaries          # esperado PASS (0 ocorrências)
git status --short              # deve conter EXATAMENTE os arquivos dos manifests abaixo
```

Conferência de segredos: nenhum arquivo listado contém valores de variáveis
(conferido contra `m02:secrets-audit` — docs/scripts/json + package.json).
**Excluído de propósito**: `gate.env` (segredo gerado, vive em /tmp, fora do
repo) e `.env` (nunca versionado).

## Manifest 1 — Fase 0 A4 (docs + gates novos)

| Arquivo                                | Estado                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| `docs/runbooks/a4-matriz-hipoteses.md` | novo                                                            |
| `docs/specs/M-02/excecoes.md`          | modificado (emenda "probe de monitoramento")                    |
| `scripts/m02-readiness.mjs`            | novo                                                            |
| `scripts/m02-forensic-bundle.ts`       | novo                                                            |
| `package.json`                         | modificado (2 entradas: `m02:readiness`, `m02:forensic-bundle`) |

```
git add docs/runbooks/a4-matriz-hipoteses.md docs/specs/M-02/excecoes.md
git commit -m "docs(runbooks): matriz H-xx do cutover A4 + emenda 'probe de monitoramento' (Fase 0.2/0.1)"
git add scripts/m02-readiness.mjs scripts/m02-forensic-bundle.ts package.json
git commit -m "feat(m02): gate m02:readiness fail-closed + m02:forensic-bundle (Fase 0.1/0.4)"
```

## Manifest 2 — Rodada G-SEC (triagem, designs, memo, manifests) + kit forense

| Arquivo                                                                                                                                                   | Estado                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `docs/evidence/gsec-2026-09-06/` (triagem-achados.md, designs-endurecimento.md, memo-G-SEC.md, manifests-commit.md, report.md, evidence.json, SHA256SUMS) | novo                                                                 |
| `docs/forensic-kit.md`                                                                                                                                    | novo (untracked até hoje; inclui addendum §10 do bundle operacional) |

```
git add docs/evidence/gsec-2026-09-06 docs/forensic-kit.md
git commit -m "docs(gov): triagem G-SEC 13/13 falso-alarme técnico + memo G-SEC + designs T2 (BLOCKER-GOV-01)"
```

## Manifest 3 — Entrada de ledger (conserta o `m02:state:check`)

O marker parent-pinned precisa apontar para o `HEAD^` no momento da checagem —
por isso o ledger é o ÚLTIMO commit. Bloco mecânico (o `__PARENT_SHA__` é
substituído automaticamente pelo sha do commit anterior):

```
PARENT=$(git rev-parse HEAD)
cat >> EXECUTION-STATE-PROGRAM.md <<EOF

## Fase 0 A4 + G-SEC — prontidão, portão NO-GO e desbloqueio de governança (2026-09-06)

- Latest state marker parent = \`__PARENT_SHA__\`
- Matriz H-xx publicada (\`docs/runbooks/a4-matriz-hipoteses.md\`, 11/11 itens mapeados);
  emenda "probe de monitoramento" (\`excecoes.md\`); gates \`m02:readiness\` +
  \`m02:forensic-bundle\` criados e testados.
- Fase 0.3: TTFF Neon 1637/1727/2480 ms (3 amostras, compute suspenso); max_connections
  901; PG 17.11; retention 6h; pooler confirmado; branch efêmera criada e deletada;
  produção intocada (read-only).
- Portão A4: NO-GO (hPanel BLOCKED-AUTH ~10–11/09 · G1 não assinada, sunset 20/09 ·
  SEC-01 aberta). G2 pendente não bloqueia. ESTADO DO SUBSTRATO inalterado.
- G-SEC (BLOCKER-GOV-01): triagem 13/13 falso-alarme técnico (união gate inline 12 +
  scan selado 11; scans divergem por escopo de testes e cobertura .py); bind do gate
  provado agente-only; memo com garfo (b) manual agora + (a) rodada de fix na sequência.
  Evidência: docs/evidence/gsec-2026-09-06/ e fase0-2026-09-06/.
EOF
sed -i "s/__PARENT_SHA__/$PARENT/" EXECUTION-STATE-PROGRAM.md
git add EXECUTION-STATE-PROGRAM.md
git commit -m "chore(ledger): Fase 0 A4 + G-SEC (2026-09-06)"
```

## Pós-flight (2 min)

```
npm run m02:state:check         # esperado PASS ("latest parent-pinned state marker is valid")
npm run m02:readiness           # esperado INCOMPLETE exit 2 (estado honesto; ver report.md)
git log --oneline -4            # 4 commits: docs, scripts, gsec, ledger
git push origin develop         # dispara ui-stack CI; acompanhar verde
```

Se algo divergir do esperado: PARAR (protocolo da rodada — 2 falhas consecutivas
no mesmo passo = parar e reportar), coletar saída e consultar o memo G-SEC.

## Alternativa em PR (se o operador preferir revisão)

Mesmos arquivos em 2 branches (`docs/pre-a4-fase0`, `scripts/m02-readiness-gate`)
→ `gh pr create --base develop` → CI verde → merge. O ledger entra depois do
último merge, com o mesmo bloco do Manifest 3.

## NOTA E2 (2026-09-07, rodada G-SEC-EXEC) — estado da árvore durante E1

A rodada de fix (E2) roda NO working tree antes de E1 pousar. Por isso, o
pre-flight do Manifest 1 verá arquivos ALÉM dos listados acima. Atualização de
sequenciamento (CI-safe commit a commit): **o Manifest 1 passa a incluir os
itens do ENV-GUARD**, porque o `package.json` agora contém o wiring dos hooks
`pre*` e o commit 2 precisa levar o script junto (senão o CI quebra no
commit intermediário):

**Manifest 1 — lista FINAL (adicionados 3 itens):**

| Arquivo                                          | Estado                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `docs/runbooks/a4-matriz-hipoteses.md`           | novo                                                        |
| `docs/specs/M-02/excecoes.md`                    | modificado (emenda "probe de monitoramento")                |
| `scripts/m02-readiness.mjs`                      | novo                                                        |
| `scripts/m02-forensic-bundle.ts`                 | novo                                                        |
| `package.json`                                   | modificado (entradas m02:* **+ wiring pre\* do ENV-GUARD**) |
| `scripts/env-guard.mjs`                          | novo (E2.2)                                                 |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md` | novo (E2.2)                                                 |

Commit 2 (scripts) passa a ser:
`git add scripts/m02-readiness.mjs scripts/m02-forensic-bundle.ts scripts/env-guard.mjs package.json`
(mensagem sugerida: `feat(m02): gate m02:readiness + m02:forensic-bundle + env-guard default-deny (Fase 0.1/E2.2)`)

**Manifest 3 — lista FINAL (fix da opção a, commit único):**
`src/lib/ai-endpoint.server.ts` · `src/test/ai-endpoint.server.test.ts` ·
`src/lib/chat.functions.ts` · `scripts/smoke/substrate-smoke.ts` ·
`scripts/db/purge-fixtures.ts` · `src/db/client.server.ts` · `scripts/build.mjs` ·
`src/test/auth-policy.test.ts` · `scripts/forensic/forensic_validate.py` ·
`src/routes/auth.tsx` · `docs/specs/M-02/matrix.yaml` +
`docs/specs/M-02/matrix.generated.yaml` (regeneradas — drift legítimo do import
novo; linhas deslocadas +4) ·
`docs/evidence/gsec-2026-09-06/**` · `docs/forensic-kit.md` — mensagem sugerida:
`fix(security): SSRF-GUARD na origem + SSL verify-full + POOL max + WARN-NITRO renew + cosméticos zero-finding (G-SEC a)`

O pre-flight do Manifest 1 deve ver EXATAMENTE: os 7 arquivos do Manifest 1 +
os 12 do Manifest 3 + untracked pré-existentes (.pi/, .mimosa/, evidências
locais, PLANO_OTIMIZADO…). Qualquer outra coisa = PARAR.
