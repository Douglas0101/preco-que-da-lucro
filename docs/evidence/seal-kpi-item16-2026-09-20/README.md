# WP-R4 — selo mecânico, KPI do checklist, item 16 e identidade de bundle

**Work package:** `WP-R4` (itens aprovados por `ask_user_question`, `L134`/`L138`)
**Fato-fonte:** análises avançadas de 2026-09-20 (achados a–d); `L134`.
**Base:** `2f407f7` · **Branch:** `mission/r4-seal-kpi`
**Natureza:** docs + tooling de contrato; nenhum runtime tocado.

---

## 1. Problema e resultado

Oito lacunas do arco R3→R1: `selo.sh` ad-hoc por WP (com `D -eq L` passando **0 = 0**), KPI de
eficácia do checklist ausente, enumeração multi-sítio sem item formal, `UNVERIFIABLE` sem semântica,
complementaridade dos filtros de CI sem teste, falsificação do guard só manual, "bundle idêntico"
por **tamanho** e citação `run@sha` que aceitava run no-op. **Resultado:** `scripts/m02-seal.mjs`
compartilhado (não-vacuidade, `D≠L`, sha256, `SPEC`/`README`, ancestralidade offline, `run@sha`
com ≥ 1 check aplicável), KPI/auto-verificação no template, item 16 (guard 16 itens), U e
periodicidade no `AGENTS.md`, teste de cobertura dos dois workflows, falsificação do guard na CI e
sha256 de conteúdo no bundle.

## 2. O que muda

| #   | arquivo                                      | mudança                                                         |
| --- | -------------------------------------------- | --------------------------------------------------------------- |
| 1   | `scripts/m02-seal.mjs` + `.d.mts`            | selo compartilhado e falsificável                               |
| 2   | `scripts/lib/m02-ci-coverage.ts`             | invariante de cobertura (listas iguais, PR irrestrito, checks)  |
| 3   | `scripts/lib/bundle-identity.mjs` + `.d.mts` | sha256 de conteúdo + hash agregado validado                     |
| 4   | `scripts/check-bundle.mjs`                   | report schema 2 com `sha256` por artefato e do grafo            |
| 5   | `scripts/m02-work-package-guard.mjs`         | 16 itens + âncora do KPI                                        |
| 6   | `docs/evidence/_templates/work-package.md`   | itens 10/15/16 + KPI/auto-verificação + apêndices               |
| 7   | `AGENTS.md`                                  | 16 itens, KPI, U × ausência, calibração separada, `m02-seal`    |
| 8   | 4 suítes de teste                            | 44 casos (17 seal, 6 cobertura, 6 guard, 4 bundle + regressões) |
| 9   | `docs/evidence/seal-kpi-item16-2026-09-20/`  | este selo                                                       |

## 3. Evidência

- **RED dirigido pelo S6:** `captures/s6-red-tests.log.txt` — `10 failed | 34 passed` (flags sem
  valor, manifesto duplicado, symlink, MANIFEST aninhado, install-only, `paths-ignore` no PR, guards
  comentados, checks ausentes na light, nome de bundle inválido).
- **GREEN:** `captures/s6-green-tests.log.txt` — `44 passed (44)`.
- **Gate:** `captures/gate-local.log.txt` com `CHECK_EXIT=0` (assertado pelo selo), guard de 16 itens
  e `debts guard: OK (12 dividas)`.
- **Aceitação real:** `captures/acceptance.log.txt` — `m02-seal` aceita os selos R1 (13) e R3 (20),
  valida a ancestralidade do `L133`, aceita o run heavy `35532153460@90976ba`, **reprova** o light
  no-op `35532153466@90976ba` e reprova flag sem valor (exit 2).
- **S7:** `captures/s7-guard.log.txt` — escopo, runtime/placar intocados, `:5432` 0 listeners,
  `origin/main` = `9724d2c`.

## 4. Riscos e limites declarados

| item                                                              | situação                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `m02-seal` valida estrutura/não-vacuidade, não a verdade da prosa | declarado: conteúdo segue com S6/humano                                              |
| filtro de passos aplicáveis é heurística documentada              | declarado e testado com o JSON real da light no-op                                   |
| cobertura não compara `pull_request` da light                     | declarado: a heavy irrestrita cobre PRs; a igualdade de `push` é o invariante        |
| `--run` exige `gh` com rede                                       | declarado: é flag de selo, não roda em `check`; a lógica pura é testada com fixtures |
| `.gitignore` modificado por processo externo na janela do WP      | declarado: fora do escopo, não versionado por este WP                                |

## 5. Como reproduzir

```bash
node scripts/m02-seal.mjs --dir docs/evidence/debts-registry-2026-09-20
node scripts/m02-seal.mjs --dir docs/evidence/debts-registry-2026-09-20 --ancestry docs/evidence/agent-state/PROGRESS.md
node scripts/m02-seal.mjs --dir docs/evidence/debts-registry-2026-09-20 --run 35532153460@90976ba
npx vitest run src/test/m02-seal.test.ts src/test/m02-ci-coverage.test.ts
npm run check
```

## 6. S6 ADVERSARIAL

**Revisão auditada:** `8909f70` (seal, cobertura, bundle, guard/template, AGENTS, testes, SPEC).
**Método:** subagente read-only de contexto limpo com sondas em `/tmp`; veredicto selado verbatim em
`captures/adversarial-r4-verdict.md.txt`.

**Veredicto:** **7 CONFIRMED · 1 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE · 12 N** (2 materiais:
N1 = flags `--ancestry`/`--run` sem valor passavam como `OK` — fail-open no tool de prova;
N2 = `pull_request` com `paths-ignore` passava como "irrestrito").

| achado | tratamento (revisão final)                                                       |
| ------ | -------------------------------------------------------------------------------- |
| N1     | flag sem valor vira erro de uso (exit 2), com teste                              |
| N2     | `paths-ignore` sob PR zera `pullRequestAny`; fixture reprova                     |
| N3     | regex ancorada na linha de execução (comentário não satisfaz)                    |
| N4     | cobertura exige os 5 checks da light + 2 da heavy                                |
| N5–N8  | comentário 16 itens; SPEC 33 casos; symlink/MANIFEST aninhado/duplicado reprovam |
| N9     | teste com `?????` pina o `DEGENERATE` sem depender do length                     |
| N10    | agregado lança para nome com `:`/`\n` e hash inválido                            |
| N11    | install não conta como check aplicável                                           |
| N12    | item 5 do §8 justificado                                                         |

## 7. Hashes

`captures/hashes.txt` (9 arquivos do WP) e `MANIFEST.sha256` gerado/conferido por
`scripts/m02-seal.mjs --write` + verificação `checked === discovered`.
