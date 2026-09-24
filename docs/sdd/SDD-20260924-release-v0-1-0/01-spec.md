# 01 — Especificação do release

## Identidade e congelamento

- **ID:** `SDD-20260924-release-v0-1-0`
- **Versão:** `v0.1.0-mvp`
- **Alvo:** `2026-09-26`
- **Branch:** `release/v0.1.0-mvp`
- **Base local do RC:** `420e47b1a2d1222cc53a1c6cf955f8fc0a4c9dd0`
- **`origin/develop`:** `a2f5ff67e58ccff9035a972eff4ef171912036ca`
- **`origin/main`:** `9724d2c73b269d0a0199ea305308f3237b38fa09`
- **`SCOPE_FREEZE=yes`**: não ampliar produto, escopo, dependências, rotas, gates ou publicação durante este SDD.
- **Natureza:** especificação e rastreabilidade; **não implementa produto nem altera contrato**.

A worktree limpa `/tmp/preco-release-v0-1-0-420e47b` é a única base admissível para o RC. O checkout principal, com downgrade não relacionado de `drizzle-kit` para `^0.18.1` e 1.161 arquivos não rastreados sob `docs/evidence/local-ci/**`, deve ser preservado e excluído do RC. Não usar esse checkout para gates, selos ou decisões de release.

## Fonte normativa e regra de estado

A fonte P0 é `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md`, §36, linhas 2019–2037, e §41, linhas 2148–2160. Os IDs locais `P0-01`…`P0-17` são estáveis nesta SDD e preservam a ordem e o texto canônico da lista.

Estados permitidos, exclusivamente: `done`, `partial`, `blocked`, `removed-from-release` e `not-applicable`. A regra de evidência é estrita: **sem `done` sem evidência executável produzida nesta tarefa e vinculada ao SHA exato**. Implementação observada por ponteiros de fonte/teste, sem execução produzida e selada no SHA de release, permanece `partial` ou `blocked`. A lista histórica de sucesso, quando aplicável, é apenas um ponteiro de origem; não é uma alegação de release.

## Escopo congelado

1. Especificar e rastrear os 17 P0 do §36.
2. Especificar as 11 condições do gate §41.
3. Preservar os blockers abertos: `DBT-09` (alta, runner de outbox inexistente), `DBT-19` (aberta) e a contradição `23.2` (não pode receber `done`).
4. Definir rotas oficial futura, offline e pública/espelho sem alteração de visibilidade; a rota pública/espelho exige aprovação explícita.
5. Produzir contrato de evidência `metadata-only`, binding por SHA exato, concordância entre `result.txt`, manifesto e relatório, e verificação independente `sha256sum -c` em clone limpo.
6. Registrar o incidente de billing HTTP 404 sem repetir a consulta e sem inferir que uma leitura não alterou nada.
7. Não publicar, não fazer push/PR/release, não acessar billing, não usar `:5432`, não remover worktree, não expor segredos e não editar os registros de dívida/fila.

## Requisitos do pacote

| Requisito | Conteúdo verificável                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REQ-01`  | Os 17 P0 estão listados nominalmente, com estado, ponteiro de evidência pendente e ação.                                                                                                                     |
| `REQ-02`  | As 11 linhas de §41 estão listadas com evidência e ação; `CI verde` não é presumido.                                                                                                                         |
| `REQ-03`  | A regra de `done` e a disciplina de resultado não verificado estão explícitas.                                                                                                                               |
| `REQ-04`  | As três superfícies de rota permanecem invariantes e a rota pública/espelho tem aprovação explícita como condição.                                                                                           |
| `REQ-05`  | A política de evidência é `metadata-only`, com inventário, SHA exato, concordância de veredicto e clone limpo.                                                                                               |
| `REQ-06`  | O incidente de billing e os vetos do swarm são revelados e convertidos em controles, sem repetição ou publicação indevida.                                                                                   |
| `REQ-07`  | O pacote é autocontido em oito documentos core, contém os dois documentos de decisão outbox/DBT-09 exigidos e registra somente o journal append-only da sessão; não altera produto, registries ou contratos. |

## Saídas

O diretório `docs/sdd/SDD-20260924-release-v0-1-0/` contém os oito documentos core exigidos e os dois documentos de decisão outbox/DBT-09:

- `01-spec.md`
- `02-acceptance.md`
- `03-design.md`
- `04-plan.md`
- `05-risk.md`
- `06-traceability.md`
- `07-evidence.md`
- `08-report.md`
- `outbox-dbt09.md`
- `MAESTRO-REQUEST-DBT-09-RELEASE.md`

## Fora de escopo

Código de produto, migrations, alterações de `package.json`/`package-lock.json`, `AGENTS.md`, `DEBTS.md`, `QUEUE.md`, workflows, scripts de gate, matriz, dados, banco, cobrança, preço, publicação e decisão de produto. A única alteração de arquivo existente para este pacote é a entrada append-only de journal em `docs/evidence/agent-state/PROGRESS.md`, registrada por intenção e resultado conforme o protocolo. Nenhuma promoção de estado, placar ou dívida é feita por este pacote.
