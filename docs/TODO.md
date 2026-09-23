# TODO — fila de execução do agente

> **Escopo deste arquivo:** fila de trabalho **do agente** (itens que um agente pode pegar e executar
> sozinho). **Não é** a fila humana — essa vive em `docs/evidence/agent-state/QUEUE.md`, cujo escritor é
> o **MAESTRO** e que agente **não** edita (regra registrada na §1 do journal). O mesmo vale para o
> registry de dívidas `DEBTS.md`.
>
> Convenção do repo preservada: pendência antiga nunca é apagada sem destino declarado.

## Estado do ciclo

- **Ciclo:** `SDD-20260923` — **FECHADO** (itens 1–4 entregues; itens 5–8 especificados).
- **Refs:** `develop` = `86565f0` (8 commits à frente de `origin/develop`), `origin/develop` = `a2f5ff6`,
  `origin/main` = `9724d2c` (ambos intocados).
- **Gate:** `m02:state:check` **VERDE**; `./scripts/local-ci.sh` = `verdict=success` (311 s) em `3c088b6`.
- **Push:** bloqueado por cota de plataforma. Nenhum push sem aprovação humana explícita.

## Fila

- ☑ **Item 1 — corrigir `m02:state:check`.** Bloco aditivo no ledger (`+29 -0`); verde em `3c088b6` e
  mantido em `86565f0`.
- ☑ **Item 2 — revalidar o novo HEAD.** `local-ci` `success` em 311 s, etapa `m02:state:check` = `success`
  (era `failure` em `8683c2d`), `pendencies` vazio.
- ☑ **Item 3 — política de evidência `metadata-only`.** Manifesto declara a política com contagens
  medidas; `evidence.git.sha256` (85 arquivos, 0 logs) verifica **em clone limpo**; etapa
  `evidence-policy-check` fail-closed com **controle negativo de 6 casos, 0 falhas**.
- ☑ **Item 4 — commitar script e metadata.** Commit `86565f0`; **0** `*.log`, **0** bundle, **0** patch.
- ☐ **Item 5 — `SDD-20260923-local-ci-hardening`** — SPEC escrita; aguarda aprovação (inclui L1/L2 abaixo).
- ☐ **Item 6 — `SDD-20260923-boundary-guard-dbt19`** — SPEC escrita; aguarda aprovação (**muda contrato
  de CI** ⇒ provável ADR).
- ☐ **Item 7 — `SDD-20260923-post-billing-sweep`** — SPEC escrita; **bloqueado** pelo billing.
- ☐ **Item 8 — `SDD-20260923-push-publication-policy`** — SPEC escrita; aguarda aprovação.
- ☑ **Item 9 — selar o tip `20cba84`.** `local-ci` `verdict=success` em **328 s**, `m02:state:check` =
  `success`, `pendencies` vazio, e2e verde, tier de banco por escopo. Evidência versionada
  (`ab3ef42`) e **selo versionável verificado em clone limpo (85/85)**.
- ☑ **Item 6 (preparação) — DBT-19 via ADR.** `ADR-030` em **PROPOSTA** + SDD completa
  (REQ-01…REQ-10, AC-01…AC-10, T0…T11, RISK-01…RISK-10). **Custo medido:** ≈2,0 s. **Nada implementado.**
- ☐ **Item 6 (implementação) — BLOQUEADO por aprovação de contrato.** Destrava T1–T11 do
  `04-plan.md`. Enquanto não aprovado: `package.json`, `npm run check`, `ui-stack.yml` e `DEBTS.md`
  permanecem intocados.
- ☐ **Item 5 — `SDD-20260923-local-ci-hardening`** — SPEC escrita; aguarda aprovação (incorpora L1/L2 e a
  redução de ruído do scan de segredo: excluir a credencial loopback documentada).
- ☐ **Item 7 — `SDD-20260923-post-billing-sweep`** — **bloqueado** pelo billing.
- ☐ **Item 8 — `SDD-20260923-push-publication-policy`** — aguarda aprovação.
- ☐ **Item 10 — destino da evidência de `8683c2d`** (local, layout anterior à política).

## Lacunas declaradas no ciclo (candidatas a dívida no registry)

- ☐ **L1 — contagens do manifesto são "em `measuredAt`", não finais.** Delta exato de 3 arquivos criados
  depois da última medição (`evidence-policy-final.status`, `evidence-git-checksum.log`,
  `manifest.sha256`). `filesTotal=125` declarado × `128` final; `logsTotal=32` × `33`.
- ☐ **L2 — `manifest.sha256` fora do selo versionável** (criado depois do último `generate_git_checksum`;
  coberto pelo selo integral). Severidade baixa: derivável do `manifest.json`.
- ☐ **[bloqueante: escritor] Abrir `DBT-23` para L1/L2.** `DEBTS.md` tem o **MAESTRO** como escritor —
  agente não escreve nele. Ação humana declarada, não esquecimento.

## Bloqueado aguardando decisão humana

- ☐ **[aprovação] Postar status `local-ci/supervised` no GitHub.** Dry-run pronto em
  `docs/evidence/local-ci/<sha>/github-status.dry-run.sh`; exige `LOCAL_CI_POST_STATUS=1 LOCAL_CI_APPROVED=1`.
- ☐ **[política] Tornar o repositório público** — decisão estratégica; não executada.
- ☐ **[política] Exceção de `*.log` no `.gitignore`** (`!docs/evidence/local-ci/**/*.log`) para a política
  `full-logs`. Só com aprovação explícita; hoje vale `metadata-only`.
- ☐ **[cota] Varredura dos 18 SHAs da janela sem verificação** — depende do billing voltar
  (`SDD-20260923-post-billing-sweep`).
- ☐ **[custo] O primeiro push custará a heavy (≈9,7 min).** Medido: os commits do ciclo tocam a **raiz**
  do ledger e `scripts/**`, fora do `paths-ignore` — é a armadilha do `L154`. Decidir se/quando pagar.

## Cancelados

- (nenhum)
