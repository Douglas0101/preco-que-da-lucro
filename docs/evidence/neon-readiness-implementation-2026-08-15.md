# Evidência de implementação do gate Neon — 2026-08-15

## Referência e escopo

- SHA-base remoto verificado: merge de PR #11 em `develop`,
  `0ceabc265ede0480566f79e838f0ad760eb41eff`.
- O gate Neon continua preparado, mas a execução de branch, migração de dados,
  cutover ou mutação de produção segue fora do escopo enquanto as contas e
  chaves são criadas.
- O checkout de P1 acompanha um diff local não commitado porque o metadata Git
  está somente leitura neste ambiente; histórico publicado não foi reescrito.

## Matriz do coordenador

| Frente                                                  | Estado                              | Evidência disponível                                                                                                           | Limite                                                  |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Workflow manual protegido                               | confirmado localmente               | `.github/workflows/neon-readiness.yml`, environment `neon-readiness`, confirmação para `apply`, falha por credenciais ausentes | reviewers e secrets precisam ser configurados no GitHub |
| URLs direct/pooled                                      | implementado, não executado         | o workflow exige as duas saídas da branch e testa conexões sem imprimir credenciais                                            | nenhum endpoint Neon foi acessado nesta execução        |
| Migrations zero/existente, RLS, privilégios e ownership | implementado no gate, não executado | `npm run db:test` (inclui ausência de ownership do `app_runtime`) e `npm run db:check` no workflow manual                      | depende de branch Neon real                             |
| Dry run e reconciliação                                 | implementado no gate, não executado | `MIGRATION_APPLY=false`, `MIGRATION_ALLOW_UPSERT=false`, relatório privado e validação de `different=0`/órfãos                 | depende de `SUPABASE_MIGRATION_DATABASE_URL` read-only  |
| Preview de PR                                           | confirmado como opcional            | `neon-preview.yml` registra que `skipped` não é evidência                                                                      | continua condicionado a secrets/vars remotos            |
| OAuth, Resend, backup/restore e smoke                   | bloqueado                           | não fazem parte de uma prova local                                                                                             | exigem credenciais, ambiente e aprovação operacional    |
| Cutover/rollback                                        | bloqueado                           | runbook mantém manutenção, snapshot/PITR, rollback e retenção de 14 dias                                                       | nenhuma janela de produção foi autorizada               |

## Resultado

A implementação fecha a lacuna de CI: ausência de credenciais agora bloqueia o
workflow manual protegido, enquanto o preview de PR permanece informativo e
não pode ser interpretado como sucesso de migração. Não há evidência nesta
execução de branch Neon criada, URLs conectadas, reconciliação zero,
`sessionsImported=0` em dados reais, backup/restore, OAuth, Resend ou cutover.
