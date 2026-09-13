# 04 - Alinhamento B1-B4 (2026-09-08, append-only, sem commit)

Este documento registra o alinhamento local após C-02A. Não reabre o STOP, não
autoriza novas operações Neon e não altera o texto histórico do Plano Mestre.

## B1 - Addendum de cutover/rollback

O texto canônico do Plano Mestre permanece nas linhas §13.6/§13.7
(`:1172-1191`). O runbook operacional agora possui `cutover-A4.md` §2.3.1 e
`DR-C02A/B`, que acrescentam:

- restore com `--no-owner --no-privileges` + reparo versionado de grants;
- preflight **roles-before-grants**, source read-only e target `drill-branch`;
- `backup-verify` PASS, reconcile 26/26, probe RLS e cleanup como gates
  independentes;
- rollback sem conserto em production: trocar secret/retornar origem somente
  em janela humana, registrar delta e preservar N-10.

Estado após C-02A: reparo/catalog/reconcile PASS; RLS `42P01` desconhecido;
BAK-01a e PS-S5 permanecem abertos.

## B2 - Emenda de §12.2

`docs/specs/M-02/emenda-2026-09-08-urls-direct-pooled.md` fixa o mapeamento:
`DATABASE_URL` pooled de runtime, `DATABASE_ADMIN_URL` direct de operador,
`DATABASE_RESTORE_URL` direct de branch efêmera, e `DATABASE_URL_UNPOOLED`
como legado proibido no dia. O split físico do `.env` ainda é hazard ativo; a
emenda não declara o item 8 de §42 fechado.

## B3 - Decision record e datas

O record `DR-C02A/B` do runbook preserva três alternativas e não presume
decisão humana:

| Alternativa                    | Estado                    | Data/critério                   |
| ------------------------------ | ------------------------- | ------------------------------- |
| (a) aceitar-com-causa + repair | executada, mas RLS falhou | PS-S5 somente após H-07 PASS    |
| (b) restore privilegiado       | não executada por STOP    | nova autorização e branch nova  |
| (c) PITR/backup >=7d           | não executada             | antes de tráfego; G1 2026-09-20 |

D2/V2b mantém deadline 2026-09-10; snapshot nativo exige renovação/validação
antes de 2026-10-10. Nenhuma data é promessa de contratação ou cutover.

## B4 - §42 e schema-diff

### Matriz atualizada

| #   | Item §42                          | Trilha        | Estado real em 2026-09-08                                                      |
| --- | --------------------------------- | ------------- | ------------------------------------------------------------------------------ |
| 1   | migrations do zero                | A             | Mecanizado; journal 11/11                                                      |
| 2   | migrations em cópia de produção   | D/C           | D bloqueada em D2; C não é paridade legacy                                     |
| 3   | schema diff revisado              | D-02          | D2 bloqueada; diff legacy não executado                                        |
| 4   | tenant tests                      | OP-C-02/H-07  | STOP: probe em restore falhou `42P01`                                          |
| 5   | RLS tests                         | OP-C-02/H-07  | STOP: cross-tenant não comprovado                                              |
| 6   | reconciliation report             | D-02/§13.5    | Neon×restore 26/26 PASS; legacy continua DESCONHECIDO                          |
| 7   | backup/restore testado            | C             | Parcial: 178 grants reparados, catálogo/journal/dados PASS; RLS e PITR abertos |
| 8   | direct e pooled URLs configuradas | B/§12.2       | addendum criado; split físico/configuração real pendente                       |
| 9   | rollback documentado              | OP-C-03/§13.7 | Runbook + DR-C02A/B atualizado; execução humana pendente                       |
| 10  | smoke tests automatizados         | OP-C-02/P2    | ferramentas prontas; execução de produção não autorizada                       |

### Diferenciação do schema

| Escopo                                                   | Evidência                                                                               | Classificação                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| tabelas/policies/constraints/indexes/grants de aplicação | `backup-verify-c02a.json`, após repair: 27 comparadas, falhas vazias                    | catálogo aplicado PASS; não equivale sozinho a probe RLS           |
| dados das tabelas de aplicação                           | `reconcile-c02a`: 26/26, diff 0                                                         | mecanismo Neon×restore PASS; ambas as pontas sem dados de negócio  |
| `drizzle`/journal                                        | 1 tabela, 11 entradas iguais                                                            | plataforma de migração PASS                                        |
| `app_private`, `neon_auth`, `pgrst`                      | log de restore: objetos já existentes, permissão/duplicidades; não é delta de aplicação | colisões esperadas de plataforma; não promover a schema-diff limpo |
| legado Supabase×Neon                                     | nenhuma credencial D2                                                                   | DESCONHECIDO/BLOCKED, não inferir igualdade                        |

O branch de C-02A foi deletado; portanto nenhum novo `schema-diff` pode ser
reaberto nesta rodada. A matriz separa explicitamente mecanismo de catálogo,
schema de aplicação, objetos de plataforma e paridade legacy.

## Gate final desta atualização

`PS-S5`: **NÃO EMITIDO**. `PS-S6`: **vigente**. `m02:sums` regen+verify:
9 bundles PASS, com exceção G-SEC rotulada. O working tree continua sem
commit/stage; a validação remota segue encerrada pelo STOP.
