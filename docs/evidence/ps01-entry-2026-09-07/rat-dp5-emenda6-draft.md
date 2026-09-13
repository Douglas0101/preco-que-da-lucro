# PS-01 — proposta concreta de ratificação de entrada e Emenda #6

Estado: **DRAFT, NÃO RATIFICADO, SEM ASSINATURA**. Preparado em 2026-09-07.
Base observada: `develop`, HEAD `8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f`.
O roteiro recebido está datado de 2026-09-08; esta revisão não antecipa essa
data como fato de execução. O login informado pelo usuário autentica a
consulta ao console; não é assinatura deste documento, de G1 ou de freeze.

## 1. Texto proposto para RAT em S0

Ratificar DP5 opção **(b)**: evoluir o produtor `m02:snapshot` para produzir
o trio `dump.pgc`, `dump.pgc.sha256` e `metadata.json` quando `--out-dir`
for explicitamente informado, preservando o layout padrão em
`artifacts/snapshots/snapshot-<data>.dump` e sua proteção contra sobrescrita.
A flag já existe no código atual; a implementação altera o contrato do modo
explícito, não introduz uma flag inexistente.

Incluir no escopo de S1 o consumidor `snapshot-fresco` de
`scripts/m02-readiness.mjs`, com validação dos predicados N-5/N-6 e testes.
O glob permanece **literalmente** `.artifacts/backup-drill/*/dump.pgc`.
Nenhum arquivo recebe PASS apenas por existência ou `mtime` recente.

No S10, conservar a decisão C1/opção (a) da fundação
`sdd-continuacao-2026-09-07/01-op-c-01-reescrito.md`: usar o
**console-check manual documentado** no lugar de `branch-audit` e de
`neon-guardrails.md`, cuja criação havia sido rejeitada. Manter os controles
de budget, alertas, compute e cleanup definidos nesse console-check.

Corrigir S11 para: o snapshot nativo observado vence em **2026-10-10**,
**depois** do sunset G1 em **2026-09-20**. Conservar o refresh anterior a
20/09 como âncora operacional própria; ele não decorre de vencimento
anterior ao sunset. Registrar execuções com sua data real.

Preservar a cláusula N-10 sem declarar compensatório como única via: o
console autenticado oferece upgrade, mas nenhum plano foi contratado nem
PITR de sete dias ativado. DP3/DP4, G1, freeze, S3, S4 e operações remotas
de S5 em diante continuam sujeitos aos respectivos selos e decisões.

Esta proposta cobre a preparação e implementação local de S1 após RAT de
S0, a preparação documental de S2 e verificações locais pertinentes.
Commit, push, mudanças de `.env`, contratação, operações de banco,
publicação de ledger e cutover dependem da sequência e dos donos definidos
no roteiro. Nenhuma dessas operações é registrada como executada aqui.

## 2. Texto proposto da Emenda #6 — produtor e consumidor

**DRAFT; data de vigência e registro de ratificação pendentes.**

1. `m02:snapshot` continua sendo a operação sancionada que produz o dump
   lógico read-only. `m02:backup-verify` é exclusivamente um verificador de
   inventários e journal; não produz dump, não restaura e não cria recursos.
2. Sem `--out-dir`, preservar o diretório, os nomes padrão e a proteção
   contra sobrescrita já existentes. Com `--out-dir` explícito, gerar
   `dump.pgc`, `dump.pgc.sha256` e `metadata.json` no diretório informado.
   Se o trio já existir, falhar fechado e exigir um diretório novo; não
   sobrescrever prova anterior. O diretório datado é organizacional.
3. Antes de qualquer conexão, exigir `ALLOW_REMOTE_DB` não vazio e recusar
   endpoint pooled nos dois modos. Preservar a recusa atual a `-pooler`, que
   cobre o sufixo do endpoint; a metadata não substitui a verificação da URL
   em runtime. A URL entra apenas pela variável indicada por nome, nunca
   por argumento, documento, saída ou chat.
4. A metadata do trio deve conter `producer: "m02:snapshot"`,
   `source: "production"`, `connection_kind: "direct"`, `read_only: true`,
   `motivo` não vazio e `created_at` UTC. Registrar também SHA-256, tamanho
   e tempos de início/fim. `created_at` corresponde ao início da captura,
   para que a duração do dump não rejuvenesça o ponto de recuperação.
   Preservar campos legados necessários aos consumidores atuais.
5. O produtor somente emite os arquivos de sucesso depois de concluir o
   dump e calcular seu hash. Saída parcial não equivale a snapshot válido.
   Execução sem motivo e endpoint pooled continuam sendo recusas antes da
   conexão, exit 3; falha de contrato ou artefato incompleto, exit 2.
6. `snapshot-fresco` conserva o glob vigente. Verifica metadata completa,
   valores exatos de produtor/origem/conexão/read-only, motivo, SHA-256 do
   conteúdo igual ao declarado e ao sidecar, e `0 <= idade < 24h` calculada
   de `created_at`. Data inválida ou futura, hash divergente ou artefato
   ausente não podem produzir PASS. `mtime` não define frescor.
7. `.dump` no diretório padrão e snapshot nativo não substituem o trio do
   gate. Dump local e restore isolado não provam, sozinhos, retenção externa
   imutável, independência administrativa, RPO, RTO ou Auth/RLS de runtime.
8. Preservar todos os hard-denies, os kinds e janelas sancionados, a
   proibição de mudar o glob e a regra de executar operações via npm.

## 3. Escopo de escrita proposto para S1 e documentação de S2

| Arquivo                                          | Alteração proposta                                          |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `scripts/m02-snapshot.mjs`                       | Distinção de modo explícito, trio, metadata e falha fechada |
| `scripts/m02-snapshot.d.mts`                     | Contrato de tipos coerente com o produtor                   |
| `src/test/m02-snapshot.test.ts`                  | Testes determinísticos do produtor, sem banco remoto        |
| `scripts/m02-readiness.mjs`                      | Validar N-5/N-6 mantendo o glob literal                     |
| Teste focado de `snapshot-fresco`                | Rejeitar hashes/metadados/idades inválidos e uso de mtime   |
| `package.json`, se necessário                    | Wiring de teste/selftest sem loader remoto                  |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md` | Texto datado de #5/#6 após o ato correspondente             |
| `docs/runbooks/cutover-A4.md`, §2.3              | Corrigir produtor/verificador e descrever os seis passos    |
| Fundação C/OP-C e manifests atingidos            | Retificação explícita; preservar a evidência histórica      |

As coberturas existentes de `.gitignore` e `m02:secrets-audit` já reconhecem
`.env.sanctioned-remote`. Documentar a prova em S2; só alterar esses arquivos
se faltar cobertura real. Não editar código de autenticação, `rls-probe`,
matriz gerada ou outros WIPs para esta correção.

## 4. Critérios de validação propostos

Preservar os testes existentes e acrescentar os cinco grupos do produtor:
default inalterado; trio nomeado; metadata completa; pooler recusado nos
dois modos; motivo ausente recusado nos dois modos. Os casos que recusam
pré-conexão precisam provar que nenhuma chamada de banco é tentada.

No consumidor, exercitar trio válido, metadata ausente/incompleta, produtor
ou origem errados, conexão diferente de direct, `read_only` falso, motivo
vazio, hash divergente, idade de 24h ou mais, data futura e mudança apenas
de `mtime`. Testes devem usar arquivos temporários e relógio controlado,
sem imitar resultados de um dump/restore real.

S1 somente recebe selo após testes pertinentes passarem. S0 e S2 exigem
registro explícito do ato humano. Regenerar e verificar os SUMS afetados
somente pelo `m02:sums`, após os appends autorizados e antes do staging.

## 5. Sequência proposta C/§2.3 em seis passos

1. Produzir dump pelo `npm run m02:snapshot -- --out-dir <diretorio-da-rodada>`
   com motivo por invocação e conexão direct fornecida pelo loader sancionado.
2. Restaurar o dump em branch efêmera `restore-<data>`, kind `drill-branch`,
   pelo fluxo npm sancionado; registrar identidade e inventário antes/depois.
3. Reconciliar origem/snapshot e cópia restaurada: diff financeiro zero;
   exigir origem quiescente ou manifesto do instante da captura.
4. Executar `npm run m02:backup-verify` com hosts distintos, checar
   `comparison.pass`, `journal.pass` e `read_only: true` e preservar artefatos.
5. Executar cleanup `always()` apenas da efêmera identificada, mantendo a
   prova antes/depois. Ausência de cleanup impede selo de sucesso.
6. Validar o trio pelo gate `snapshot-fresco`, conservando o glob e
   calculando a idade exclusivamente de `created_at`.

Isto especifica a sequência, não atesta wiring completo dos comandos de
restore/cleanup; os comandos exatos serão revisados antes de S5, após PS-S4.
O dump de S5 pode vencer antes de T-0: garantir um trio válido com menos de
24h antes da primeira chamada de readiness de T-0, sem inverter a ordem
de T-0. Não usar a nova dupla posterior a readiness para justificar um
readiness anterior sem snapshot válido.

## 6. Registro de ratificação

**PENDENTE.** Nenhum nome, assinatura, data de aprovação ou selo PS-S0 foi
preenchido. O relatório de entrada associado documenta as verificações já
executadas; ele não constitui aprovação desta proposta.
