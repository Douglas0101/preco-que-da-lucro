# TODO — fila de execução do agente

> **Escopo deste arquivo:** fila de trabalho **do agente** (itens que um agente pode pegar e executar
> sozinho). **Não é** a fila humana — essa vive em `docs/evidence/agent-state/QUEUE.md`, cujo escritor é
> o **MAESTRO** e que agente **não** edita (regra registrada na §1 do journal).
>
> Convenção do repo preservada: pendência antiga nunca é apagada sem destino declarado.

## Estado do ciclo

- **Ciclo:** `SDD-20260923` (ledger + política de evidência)
- **Última atualização:** 2026-09-23 (UTC)
- **Push:** bloqueado (billing de plataforma). Nenhum push sem aprovação humana explícita.

## Fila

- ☑ **Item 1 — corrigir `m02:state:check`.** Bloco novo no ledger com o marcador parent-pinned apontando
  para `8683c2d`; sem reescrever histórico; sem `--amend`.
- ☑ **Item 2 — revalidar o novo HEAD** com `./scripts/local-ci.sh` e selar evidência por SHA.
- ☑ **Item 3 — política de evidência `metadata-only`.** Manifesto declara a política; `evidence.git.sha256`
  cobre só o que o Git versiona; nenhum `*.log` entra em commit.
- ☑ **Item 4 — commitar script + metadata da evidência** (nada de `*.log`, bundle ou patches).
- ☐ **Item 5 — `SDD-20260923-local-ci-hardening`** (SPEC escrita; implementação aguarda aprovação).
- ☐ **Item 6 — `SDD-20260923-boundary-guard-dbt19`** (SPEC escrita; aguarda aprovação).
- ☐ **Item 7 — `SDD-20260923-post-billing-sweep`** (SPEC escrita; aguarda aprovação).
- ☐ **Item 8 — `SDD-20260923-push-publication-policy`** (SPEC escrita; aguarda aprovação).

## Bloqueado aguardando decisão humana

- ☐ **[bloqueante: aprovação] Postar status `local-ci/supervised` no GitHub.** Dry-run pronto em
  `docs/evidence/local-ci/<sha>/github-status.dry-run.sh`; exige `LOCAL_CI_POST_STATUS=1 LOCAL_CI_APPROVED=1`.
- ☐ **[bloqueante: política] Tornar o repositório público.** Decisão estratégica; não executada.
- ☐ **[bloqueante: política] Exceção de `*.log` no `.gitignore`** (`!docs/evidence/local-ci/**/*.log`) para
  a política `full-logs`. Só com aprovação explícita; hoje vale `metadata-only`.
- ☐ **[bloqueante: cota] Varredura dos 18 SHAs da janela sem verificação.** Depende do billing voltar; a
  SPEC está escrita no item 7.

## Cancelados

- (nenhum)
