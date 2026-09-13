# C-02A - Re-drill com reparo de grants (2026-09-08) - STOP

## Decisão e limites

Decisão embutida (a) executada: reparo de grants versionado. A mesma imagem
`dump.pgc` do C-02 anterior foi usada para isolar a variável do reparo.
Decisão (b) não foi iniciada: o protocolo de duas falhas consecutivas
encerrou a rodada antes de criar uma segunda branch. Produção recebeu somente
leituras; todas as escritas abaixo ocorreram na branch efêmera.

## A1 - artefato versionado

- `scripts/db/grant-repair.ts` importa `inventory()` e `directPool()` do
  coletor existente (`scripts/db/backup-verify.ts:67-77`).
- Motivo operacional registrado: `C-02 A2 grant repair: roles-before-grants in
fresh drill branch`.
- O plano coleta grants faltantes por identidade, bloqueia extras/mismatches,
  valida roles e emite SQL com **roles-before-grants** antes dos `GRANT`.
- Roles de grupo `NOLOGIN` podem ser criadas somente com flag explícita;
  roles `LOGIN`/privileged ausentes bloqueiam e exigem provisionamento externo.
- Testes unitários com tmpdir: **5 testes novos**; conjunto focado de backup:
  **12/12 testes** (`m02-grant-repair` 5 + `m02-backup-verify` 7).

## Passos executados

| Passo         | Saída observada                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| branch nova   | `restore-2026-09-07-c02a-repair`, `br-solitary-breeze-ayxae7tq`, parent production, `ready`, `expires-at 2026-09-08T06:00:00Z`                                                                                                                                                                               |
| restore       | reset somente em efêmera; `pg_restore --no-owner --no-privileges` exit 1; log reporta `errors ignored on restore: 47`, incluindo schemas/functions/relations de plataforma já existentes, permissão no schema `pgrst`, duplicidade de `project_config` e constraints/indexes; 26 tabelas public e journal 11 |
| grant repair  | exit 0/PASS; source 367 grants, target antes 189, missing 178, extra 0, mismatched 0; roles app_runtime/authenticated/neondb_owner presentes; 179 statements; comparação posterior PASS                                                                                                                      |
| backup-verify | **exit 0/PASS**; `comparison.pass=true`, 27 tabelas, `failures=[]`; `journal.pass=true`, 11/11; `read_only=true`; identidades distintas                                                                                                                                                                      |
| reconcile     | **exit 0/PASS**; 26 tabelas, `differences_total=0`, financeiro zero                                                                                                                                                                                                                                          |
| probe RLS     | **exit 2/ERROR** na fase PROBE; código `42P01`, detalhes omitidos pelo contrato; sem JSON de PASS                                                                                                                                                                                                            |
| cleanup       | branch deletada; prova posterior: somente production ready + develop archived                                                                                                                                                                                                                                |

## STOP e classificação

O probe H-07 não comprovou as negações cross-tenant em `app_runtime`, apesar
do catálogo e dos dados passarem. A relação ausente é **DESCONHECIDA**: a
sonda suprime a mensagem do banco e a tentativa de diagnóstico seguinte não
executou por erro de quoting do shell. Isso constitui a segunda falha
consecutiva; nenhum retry foi feito.

`PS-S5`: **NÃO EMITIDO**. `PS-S6`: permanece selo de parada; este relatório é
uma continuação, não reescreve o veredito anterior. Experimento (b):
**NÃO EXECUTADO** por protocolo de parada, sem resultado presumido.

## Evidência relacionada

- `grant-repair-c02a.md`, `.json`, `.sql`
- `backup-verify-c02a.json`
- `reconcile-c02a.md`, `.json`
- `rls-probe-c02a` não foi produzido porque o script abortou antes da fase de
  persistência do relatório
- `scripts/rls-probe.mjs` stdout/stderr da rodada: `falha na fase PROBE`,
  código `42P01`; o comando não persistiu a mensagem do banco e não expôs
  hostname/URL no artefato.

## Estado do substrato e próximos donos

| Gate                   | Estado após C-02A                                            | Dono/fase-alvo                         |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------- |
| backup/restore externo | Parcial: catálogo/dados/reconcile verdes; RLS não comprovado | engenharia, nova rodada após causa RLS |
| BAK-01a                | Aberta; PS-S5 não emitido                                    | engenharia + decisão humana            |
| BAK-01b PITR/RPO       | Violação aberta: retenção 6h versus >=7d                     | humano/custo Neon                      |
| G1                     | Rascunho no memo M02-D-008                                   | humano, sunset 2026-09-20              |
| SEC-01                 | Fechamento não registrado                                    | humano                                 |
| H1                     | Não executado no ledger                                      | humano; recomputar calendário          |
| T1-T3/T7/OP-H          | Não iniciados                                                | somente depois dos pré-requisitos      |

Top 3 riscos: (1) causa RLS 42P01 desconhecida; mitigar com diagnóstico
read-only/fixture de branch em rodada futura; (2) PITR 6h; mitigar com
upgrade >=7d ou exceção BAK-01b; (3) G-SEC/H1/G1 pendentes; mitigar com
decisões e commits humanos conforme Mimosa.
