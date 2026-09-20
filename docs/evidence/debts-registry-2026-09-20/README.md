# WP-R1 — registry de dívidas (`DEBTS.md`) + guard mecânico

**Work package:** `WP-R1` (Fase 0, ordem aprovada em `L126`)
**Fato-fonte:** `L126`; `ledger-reconciliation-2026-09-20/README.md:93`; análises avançadas de 2026-09-20; `L136` (caminho decidido).
**Base:** `6d9b22f` · **Branch:** `mission/r1-debts`
**Natureza:** docs + tooling de contrato; nenhum runtime tocado.

---

## 1. Problema e resultado

As dívidas declaradas ao longo dos WPs viviam só em prosa no journal e nos selos — sem ID, origem,
classe, severidade e closure test mecânicos, uma dívida "sabe-se lá" some, e um registry sem guard
degenera em silêncio (vazio, duplicado, `N/A`). **Resultado:** o registry canônico
`docs/evidence/agent-state/DEBTS.md` com **12 dívidas** (`DBT-01..12`, proveniência por `Lnn`/selo/§)
e o guard `scripts/m02-debts-guard.mjs` (node-only) que reprova degeneração **e** closure ausente
com status ativo — nas duas direções — ligado aos três pipelines.

## 2. O que muda

| #   | arquivo                                    | mudança                                                                             |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | `scripts/m02-debts-guard.mjs`              | guard node-only; colunas pelo header, tabela dupla reprova, `--registry` p/ fixture |
| 2   | `src/test/m02-debts-guard.test.ts`         | 16 casos em fixtures tmp                                                            |
| 3   | `docs/evidence/agent-state/DEBTS.md`       | registry canônico (12 dívidas) + regras de adição                                   |
| 4   | `package.json`                             | `m02:debts-guard` na cadeia do `check`                                              |
| 5   | `.github/workflows/ui-stack.yml`           | passo no `verify`                                                                   |
| 6   | `.github/workflows/ci-light.yml`           | passo no leve (docs-only)                                                           |
| 7   | `AGENTS.md`                                | contrato do registry + cadeia do gate + scripts do leve                             |
| 8   | `docs/evidence/debts-registry-2026-09-20/` | este selo (SPEC, README, capturas, manifesto)                                       |

## 3. Evidência

- **RED (guard ausente):** `captures/red-vitest.log.txt` — `10 failed | 0 passed`, todas por
  `Cannot find module`.
- **RED dirigido pelo S6:** `captures/s6-red-vitest.log.txt` — `2 failed | 14 passed` (header fora
  de ordem; segunda tabela canônica) antes das correções do guard.
- **GREEN:** `captures/s6-green-vitest.log.txt` — `16 passed (16)`; e o registry real:
  `captures/gate-local.log.txt` (`debts guard: OK (12 dividas…)`).
- **Gate local:** `captures/gate-local.log.txt` com `CHECK_EXIT=0` assertado pelo selo.
- **S7:** `captures/s7-guard.log.txt` — escopo, runtime/placar intocados, symlink não versionado,
  credenciais 0, `:5432` 0 listeners, `origin/main` = `9724d2c`.

## 4. Riscos e limites declarados

| item                                                        | situação                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| o guard valida **estrutura**, não o mérito da dívida        | declarado: conteúdo é julgado pelo S6/humano; o guard impede degeneração e closure ativo sem test |
| a numeração `DBT-01..12` foi consolidada neste WP           | declarado: só 01/02/07/08 tinham dono no registro; os demais vêm de N declarados com `origem`     |
| `EM_TRATAMENTO` é convenção editorial, não regra de máquina | declarado no registry e no SPEC §6                                                                |
| `DEBTS.md` tem dono MAESTRO (`L126`)                        | execução autorizada explicitamente nesta sessão; o guard impede o apodrecimento                   |

## 5. Como reproduzir

```bash
node scripts/m02-debts-guard.mjs                                  # OK (12 dividas)
node scripts/m02-debts-guard.mjs --registry <fixture>             # reprova degenerados/closure
npx vitest run src/test/m02-debts-guard.test.ts                   # 16 passed
npm run check                                                     # cadeia com o guard
```

## 6. S6 ADVERSARIAL

**Revisão auditada:** `775883e` (guard, testes, registry, wiring, SPEC). **Método:** subagente
read-only de contexto limpo, sondas próprias em `/tmp`; veredicto selado verbatim em
`captures/adversarial-r1-verdict.md.txt`.

**Veredicto:** **5 CONFIRMED · 2 CORRECTED · 4 REJECTED · 0 UNVERIFIABLE · 8 N** (2 materiais:
N2 = 4 grupos de regra sem teste — a matriz de mutação deletou taxonomias e ID-pattern sem a suíte
reprovar; N3 = as 12 dívidas não eram asseridas).

| achado | tratamento (revisão final)                                                             |
| ------ | -------------------------------------------------------------------------------------- |
| N1     | DoD destravado até o fecho; capturas RED/GREEN/gate agora seladas                      |
| N2     | 4 casos de regressão (id, células, severidade, status): `16 passed`                    |
| N3     | o caso real assere `debts guard: OK (12 dividas`                                       |
| N4/N5  | header achado pelo **nome** (qualquer ordem) e tabela dupla reprova; casos 10/11 novos |
| N6     | `EM_TRATAMENTO` declarado como convenção no registry e no SPEC                         |
| N7     | `AGENTS.md` sem "all three scripts"                                                    |
| N8     | `origem` de DBT-01/DBT-04 ganhou os fatos-fonte que sustentam as cláusulas de closure  |

## 7. Hashes

`captures/hashes.txt` (8 arquivos do WP) e `MANIFEST.sha256` do selo, ambos conferidos por
`sha256sum -c`; `checked === discovered` assertado pelo selo.
