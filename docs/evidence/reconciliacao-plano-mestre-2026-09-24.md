# Ponte de rastreabilidade — ciclo de setembro × Plano Mestre v2.0

- **Data:** 2026-09-24
- **Origem:** cruzamento externo entre o checkpoint SDD de 2026-09-24 e o
  `PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` (registro final 2026-08-27)
- **Achado que este documento fecha:** o cruzamento apontou **interseção zero de identificadores** entre os
  dois documentos e não pôde decidir, com o material que tinha, se pertenciam ao mesmo repositório.
  **Pertencem** — provado abaixo por três vias independentes.

## 1. Prova de que é o mesmo repositório (§E2 do cruzamento, executado)

```text
12c90a1 (PR #21, develop)  EXISTE e É ancestral de origin/develop
55cb550 (PR #22, main)     EXISTE e É ancestral de origin/main
33037007387                não é objeto git — é id de run do GitHub (esperado)
```

E os **seis arquivos-âncora do plano existem** (§E4), incluindo o próprio plano:

| Arquivo                                                            | Última modificação no git |
| ------------------------------------------------------------------ | ------------------------- |
| `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` | **2026-08-27**            |
| `docs/MAPA_CRUZADO_DIRETRIZ_PLANO_PRECO_QUE_DA_LUCRO.md`           | 2026-08-09                |
| `docs/REALINHAMENTO_OPERACIONAL_V7_PLANO.md`                       | 2026-08-15                |
| `docs/auditoria-ambiental-2026-08-26.md`                           | 2026-08-26                |
| `docs/evidence/csf-58b444f-final-2026-08-27.md`                    | 2026-08-27                |
| `docs/evidence/release-readiness-develop-main-2026-08-27.md`       | 2026-08-27                |

**Conclusão:** mesmo repositório, mesma linha `develop`. A ausência de referências cruzadas era
**lacuna de documentação**, não separação de projetos.

## 2. Vocabulário — os três sentidos de "selo" (ambiguidade apontada pelo cruzamento)

O checkpoint usa "selo" em três sentidos distintos sem defini-los. Definição canônica, para auditoria:

| Termo                   | Arquivo                                        | O que é                                                                                         |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Selo versionável**    | `<rodada>/evidence.git.sha256`                 | hashes dos arquivos **não-ignorados** da rodada, excluindo a si mesmo. É o que entra no commit. |
| **Selo integral**       | `local-ci/<sha>.sha256` (raiz, local)          | hashes de **todos** os arquivos da rodada, inclusive logs e artefatos. Não versionado.          |
| **Campos de veredicto** | `<rodada>/result.txt` e `manifest.json.result` | o veredicto em si. A invariante nova exige que **coincidam**.                                   |

Na rodada `1b54a89c`: o **integral confere** (a rodada não foi reescrita) e os **campos de veredicto se
contradizem** (`failure` × `success`), com o **versionável inválido**. Os três enunciados são
simultaneamente verdadeiros e não se contradizem.

## 3. Vocabulário — onde vivem as dívidas

| Termo                  | Arquivo                                 | Escritor                         |
| ---------------------- | --------------------------------------- | -------------------------------- |
| **registry**           | `docs/evidence/agent-state/DEBTS.md`    | **MAESTRO** (o agente não edita) |
| **fila humana**        | `docs/evidence/agent-state/QUEUE.md`    | **MAESTRO**                      |
| **journal**            | `docs/evidence/agent-state/PROGRESS.md` | agente (append-only)             |
| **ledger**             | `EXECUTION-STATE-PROGRAM.md`            | agente (marcador parent-pinned)  |
| **pedidos ao MAESTRO** | `docs/sdd/*/MAESTRO-REQUEST-*.md`       | agente                           |

Estado verificado em 2026-09-24: `DBT-19` **ABERTA** (1 ocorrência no registry); `DBT-23` **não
registrada** (0 ocorrências) — o pedido existe em `docs/sdd/SDD-20260923-evidence-policy/MAESTRO-REQUEST-DBT-23.md`
e aguarda o MAESTRO.

## 4. Numeração de itens — a ambiguidade que o cruzamento apontou

O cruzamento notou que "Item 5" e "item 7" não casam com o P0 canônico do plano nem com os passos do §40.
**Correto:** existe uma **terceira numeração**, a do **despacho do ciclo** (fila do agente em
`docs/TODO.md`). Ela é independente do P0 do plano. Mapa:

| "Item" do despacho | O que é                                                           | Onde                 |
| ------------------ | ----------------------------------------------------------------- | -------------------- |
| Item 5             | `SDD-20260923-local-ci-hardening` (hardening do `local-ci`)       | `docs/TODO.md` §Fila |
| **Item 7**         | `SDD-20260923-post-billing-sweep` — **bloqueado pela plataforma** | `docs/TODO.md` §Fila |
| Item 8             | `SDD-20260923-push-publication-policy`                            | idem                 |
| Item 9             | selar o tip `20cba84`                                             | idem                 |
| Item 10            | destino da evidência de `8683c2d`                                 | idem                 |

O "item 7" do checkpoint era **esta** referência, não um item da sua própria lista de pendências —
referência que o texto não resolvia.

## 5. Deriva de regime de push (apontada como tensão)

| Período           | Regime                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| até 2026-08-27    | fluxo ativo: PRs #21/#22 mergeados, `release-readiness` registrado                                                                |
| desde ~2026-09-22 | **push bloqueado por cota/billing** da plataforma; `npm run check` local é o fallback declarado; 31 commits locais não publicados |

Não é inconsistência: é mudança de regime por **precondição externa não satisfeita** (cota), com
protocolo próprio no `AGENTS.md` § "Protocolo de bloqueio de CI".

## 6. Riscos compostos que o cruzamento corretamente aproximou

1. **flake do e2e × gates de "CI verde".** Os gates §41/§42/§45 do plano ancoram em CI verde; o e2e tem
   flake vivo (1 em 30) com investigação **deferida** e retry **proibido sem ADR**. Toda alegação de
   "CI verde" enquanto isso durar carrega ressalva. SDD:
   `docs/sdd/SDD-20260924-e2e-flake-investigation/`.
2. **`DBT-19` × integridade do pipeline.** Nenhum teste **pinna** a cadeia `check` de 16 gates: um gate
   pode ser removido com tudo verde. Isso desarma em silêncio qualquer gate do plano que dependa dela.
   É o item mais urgente do próximo ciclo de código — e é a recomendação que o próprio checkpoint já
   fazia.

## 7. O que este documento **não** faz

- Não altera o plano, o ledger do programa, `DEBTS.md` nem `QUEUE.md`.
- Não move numeração nem promove item algum a fechado.
- Não afirma nada sobre a **validade** das claims do plano; o cruzamento externo já as revalidou
  (TanStack Start em RC, OTel JS logs em Development, Neon PG18 GA em 2026-05-01).
