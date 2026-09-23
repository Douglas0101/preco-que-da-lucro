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
- ☐ **Item 9 — repetir o ciclo para o commit `86565f0`.** A evidência selada cobre `3c088b6`; `86565f0`
  é metadata + marcador e **não** passou pelo `local-ci`. Rodar `./scripts/local-ci.sh` em `86565f0`
  quando fizer sentido (custo ~5 min) e decidir se a evidência nova é versionada.
- ☐ **Item 10 — decidir o destino da evidência de `8683c2d`** (local, layout anterior à política, com
  `preservation/` não ignorado). Opções: manter local (atual), versionar só o metadata descartando
  `preservation/`, ou descartar com registro.

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
