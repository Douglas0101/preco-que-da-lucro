# PS-01 — relatório de entrada, recon Neon e proposta de ratificação

## 1. Veredito, escopo e estado de execução

**ENTRADA DE INTEGRIDADE CONFORME; PS-S0 NÃO EMITIDO; EXECUÇÃO OPERACIONAL
PARADA ANTES DE S1. STACK_MODE = `uncommitted`.**

Revisão executada em **2026-09-07**, no checkout
`/home/douglas-souza/preco-que-d-main`, branch `develop`, HEAD
`8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f`. A data de 2026-09-08 no
PS-01 recebido é a data do DRAFT/calendário, não de execução desta revisão.

O escopo concluído foi: leitura do roteiro e das fontes locais; conferência
dos sete bundles por `npm run m02:sums -- --verify`; recon de metadados pelo
plugin Neon; consulta ao console após o login realizado pelo usuário; e
preparação de uma proposta concreta de RAT/Emenda #6. Código, ledger,
matrizes, configurações de ambiente e recursos de banco não foram alterados.
Não houve staging, commit, push, deploy, SQL, dump, restore ou snapshot-create.

O PS-01 abre com “DRAFT p/ ratificação (N-A1)” e exige que nenhum passo
inicie sem o selo de entrada. A regra de parar diante de achado fora da
matriz também está em `docs/runbooks/a4-matriz-hipoteses.md:3-8`.
As divergências de contrato na seção 3 impedem emitir um selo operacional
por inferência. A confirmação de login não é ratificação de escopo.

## 2. Evidências de entrada e hashes

O comando direto de verificação retornou **exit 0, PASS**, com estes
resultados. A evidência persistida está em `sums-verify.log`.

| Bundle                                | Resultado atual                                | SHA-256 do arquivo SHA256SUMS (prefixo de 12 caracteres) |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `sdd-continuacao-2026-09-07`          | GREEN, 8/8                                     | `95f3d4bda65f`                                           |
| `cutover-2026-09-07`                  | GREEN, 19/19                                   | `563a1d59cf8b`                                           |
| `cutover-prep-2026-09-07`             | GREEN, 25/25                                   | `541cee6c1bd2`                                           |
| `pendentes-2026-09-07`                | GREEN, 9/9                                     | `7b303b6dd4b8`                                           |
| `gsec-2026-09-06`                     | RED-LABELED, 18/20 + 2 divergências permitidas | `f702e692e79b`                                           |
| `fase0-2026-09-06`                    | GREEN, 28/28                                   | `20587bc20a8d`                                           |
| `checagens-pos-publicacao-2026-09-05` | GREEN, 4/4                                     | `41aca569c02b`                                           |

As duas divergências G-SEC são somente
`docs/specs/M-02/emenda-2026-09-07-env-guard.md` e `scripts/env-guard.mjs`,
com o rótulo existente “vermelho-esperado até assinatura do memo (V0)”.
Nenhum SUMS foi regenerado ou editado nesta rodada.

`source-hashes.json` contém hashes completos, tamanhos e nomes das fontes
verificadas, incluindo os WIPs rastreados, ledger, scripts e os sete SUMS.
O anexo PS-01 recebido tem SHA-256
`ceccf87cef715f3456afdfbe16f92660949bbac660959298846b7ea8d7b7c0c8`.
Esses hashes identificam bytes observados; não são selos PS-S0…PS-S10.

`entry-checks.json` conserva a captura de HEAD/status/lista de alterações.
A subcaptura de npm nesse JSON retornou exit 0 sem stdout/stderr e é
**CAPTURE-INCOMPLETE/NO-VERDICT**; não sustenta PASS. A execução direta,
com a saída íntegra em `sums-verify.log`, sustenta a conclusão acima. A
limitação de captura foi preservada, sem simulação de saída.

A primeira validação agregada da entrega também encontrou `spawnSync git
EPERM` ao chamar Git de dentro do Node; o erro está em
`validation-attempt1.txt` e não é resultado de teste da aplicação. Essa
forma de execução não foi repetida. As verificações de conteúdo usam
somente filesystem; HEAD e staging são observados por comandos Git
diretos, como no início da sessão. Os resultados finais ficam em
`validation.json`, com a limitação preservada.

Este diretório novo é um **pacote de revisão não selado**, não incluído nos
sete bundles anteriores. Não foi criado um `SHA256SUMS` manual nem emitido
PS-S0. Depois da RAT, sua integração aos manifests/SUMS deverá usar o fluxo
`m02:sums` já definido, preservando a cadeia de assinaturas e commits.

## 3. Divergências que a ratificação precisa resolver

| ID          | Classificação                                                | Fato observado e consequência                                                                                                                                                                                                           | Proposta concreta                                                                                                             |
| ----------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PS-GAP-01   | VIOLAÇÃO do contrato N-5 no consumidor atual; LOCAL-VERIFIED | `scripts/m02-readiness.mjs:142-170` usa `statSync(...).mtimeMs` para escolher o dump e decidir frescor. Não lê metadata nem verifica SHA-256. Criar só o trio no produtor não implementa N-5.                                           | Incluir o consumidor e testes em S1; conservar literalmente o glob `.artifacts/backup-drill/*/dump.pgc`.                      |
| PS-GAP-02   | GAP-DOC entre S10 e fundação; LOCAL-VERIFIED                 | S10 exige `branch-audit` e `neon-guardrails.md`; `sdd-continuacao-2026-09-07/01-op-c-01-reescrito.md:3-10` registra sua remoção e adoção do console-check.                                                                              | Conservar C1/opção (a), usando o console-check manual com os controles reais definidos pela fundação.                         |
| PS-GAP-03   | GAP-DOC de calendário                                        | S11 diz que o nativo de 10/10 expira antes do sunset; a âncora G1 é 20/09. 10/10 é posterior a 20/09.                                                                                                                                   | Corrigir a relação temporal; manter o refresh <20/09 como obrigação própria.                                                  |
| PS-DELTA-01 | Implementação pendente já prevista por DP5                   | A flag `--out-dir` já existe; `scripts/m02-snapshot.mjs:155-163` continua gerando `snapshot-<data>.dump` mesmo no diretório explícito. Em `:219-239`, os campos atuais são `script/origin/direct/started_at`, sem o contrato exato N-5. | Evoluir o modo explícito para o trio e completar a metadata, preservando o padrão.                                            |
| PS-DELTA-02 | GAP-DOC já conhecido                                         | `cutover-A4.md:97-110` e a fundação OP-C atribuem o dump ao `backup-verify`; o verificador faz leitura/comparação, conforme `scripts/db/backup-verify.ts:151-183`.                                                                      | Aplicar a sequência de seis passos da proposta, distinguindo produção do dump, restore, reconciliação, verificação e cleanup. |

A fundação ainda registra DP5 como ABERTO em
`sdd-continuacao-2026-09-07/02-decisoes-dp1-dp6.md:33-38`; o anexo propõe
DP5=(b), mas está DRAFT. A Emenda #5 também permanece DRAFT em
`sdd-continuacao-2026-09-07/03-emenda-05-split-draft.md:1-5`.

A cobertura necessária de nomes já existe: `.gitignore:11-15` cobre
`.env`, `.env.sanctioned-remote` e `gate.env`; `git check-ignore -v`
confirmou esses nomes e `git ls-files` não os listou. O padrão
`scripts/m02-secrets-audit.ts:39-40` reconhece `.env.*`. Isso prova cobertura
do padrão, não execução do split nem ausência de todos os segredos.

## 4. Neon e navegador: recon ao vivo

O plugin Neon respondeu para a organização `org-purple-snow-18870527`
(Free), projeto `damp-forest-57346541`, nome
`preco-que-da-lucro-g3-pg17`, PostgreSQL major 17. A consulta retornou
`history_retention_seconds=21600`: **6 horas**, abaixo da exigência de sete
dias. Evidência sanitizada: `neon-recon.json`.

| Recurso                                  | Observação atual                                                               | Limite                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `production`, `br-snowy-violet-aymcvvvv` | `ready`, default                                                               | Não houve consulta SQL ou nova contagem de linhas                          |
| `develop`, `br-small-hill-aymcu14y`      | `archived`                                                                     | Estado do Neon, independente da branch Git de mesmo nome                   |
| Efêmeras                                 | Nenhuma na listagem completa                                                   | Não é evidência de cleanup de um drill novo                                |
| `snap-tiny-smoke-ayc382ji`               | Criado em 2026-09-05T22:37:46Z, expira em 2026-10-10T23:59:59Z                 | Snapshot pré-purge existente; não substitui snapshot do dia ou dump fresco |
| Console após login humano                | Autenticado; History window oferece 0h/1h/2h/6h; upgrade anunciado até 30 dias | Nenhuma configuração foi salva                                             |
| Modal de planos                          | Launch e Scale oferecidos                                                      | Plano não selecionado; contratação e retenção ativada não comprovadas      |

Consulta autenticada:
[History window do projeto](https://console.neon.tech/app/projects/damp-forest-57346541/settings#storage).
O modal foi fechado sem selecionar plano. Logo, **não há prova de upgrade
impossível** e não cabe escrever “compensatório = única via”. Permanece
válido o default compensatório escolhido em DP2, com a insuficiência de
PITR explicitamente aberta. Este é um insumo de recon, não PS-S6.

Cláusula N-10 recebida, preservada literalmente:

> Cláusula de tráfego DP2: BAK-01 reabre no carimbo "Tráfego: EXISTE"
> salvo PITR≥7d ativo (dump lógico não satisfaz RPO≤15min com writes).

O acesso inicial a `list_projects` sem organização retornou HTTP 400;
resolvida a organização, a consulta passou. `list_snapshots` passou; não há
regressão 404/400 do endpoint de snapshot nesta sessão. Duas tentativas de
leitura pública de docs via ferramenta web falharam por content-type
`text/markdown`; não foram repetidas nem usadas como evidência de produto.
Alertas/budget/monitoramento não foram integralmente auditados, portanto o
console-check de T-0 permanece pendente.

## 5. Ponte com selos reais PS-S0…PS-S10

“Ausente” significa nenhum selo emitido nesta rodada. A evidência de entrada
da seção 2 não substitui a aprovação ou o hash de um selo operacional.

| Passo | Selo real | Hash do selo | Situação e dependência restante                                                  |
| ----- | --------- | ------------ | -------------------------------------------------------------------------------- |
| S0    | Ausente   | —            | Integridade de entrada PASS; RAT/Emenda #6 e divergências pendentes              |
| S1    | Ausente   | —            | Implementação e testes não iniciados; depende de PS-S0                           |
| S2    | Ausente   | —            | Cobertura de nomes conferida; Emenda #5 ainda DRAFT, sem selagem humana          |
| S3    | Ausente   | —            | Cadeia de commits/push e CI não iniciada; depende de PS-S1 e PS-S2               |
| S4    | Ausente   | —            | Split de `.env`, rewiring e provas deny/allow não executados                     |
| S5    | Ausente   | —            | Nenhum dump/restore/reconcile/cleanup novo; depende de PS-S4                     |
| S6    | Ausente   | —            | Retenção 6h confirmada; veredito duplo depende das provas de S5                  |
| S7    | Ausente   | —            | Snapshot existente revalidado por listagem; snapshot-create do dia não executado |
| S8    | Ausente   | —            | DP3/DP4/G1 e D2 pendentes; sem V2b ou NO-GO datado nesta rodada                  |
| S9    | Ausente   | —            | Homologação hPanel 11/11 não iniciada nesta rodada; depende de PS-S3             |
| S10   | Ausente   | —            | Sem freeze, T-0, deploy, smoke ou carimbos; dependências não satisfeitas         |

S11 permanece como calendário condicionado ao fechamento anterior. Nenhum
monitor, automação ou lembrete foi criado a partir das datas do roteiro.

## 6. Tabela §42 por modo e ESTADO DO SUBSTRATO

| Item §42                          | Modo disponível/documentado   | Evidência e classificação nesta revisão                                                     |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Migrations do zero                | Local/CI                      | DOCUMENTADO; não reexecutado                                                                |
| Migrations em cópia de produção   | V2b/drill                     | PENDENTE; sem prova nova                                                                    |
| Schema diff revisado              | Cópia/legado                  | PENDENTE D2/triagem; sem prova nova                                                         |
| Tenant tests                      | H-07 runtime + CI             | Runtime DESCONHECIDO; não executado                                                         |
| RLS tests                         | H-07 runtime + CI             | Runtime DESCONHECIDO; não executado                                                         |
| Reconciliation report             | Origem × cópia                | PENDENTE; paridade não medida nesta rodada                                                  |
| Backup/restore testado            | Nativo + compensatório        | Snapshot nativo listado ao vivo; dump/restore externo novo AUSENTE; PITR 6h VIOLAÇÃO/ABERTA |
| URLs direct e pooled configuradas | Web pooled / operações direct | Contrato/padrões locais conferidos; valores não lidos; split não executado                  |
| Rollback documentado              | Runbook, app-level            | DOCUMENTADO; não exercitado nesta rodada                                                    |
| Smoke automatizado                | Substrato + HTTP/Auth/RLS     | Código/documentação presentes; não executado nesta rodada                                   |

**ESTADO DO SUBSTRATO:** Tráfego inexistente **segundo o ledger** em
`EXECUTION-STATE-PROGRAM.md:1239-1240`; runtime/hPanel não revalidado.
Neon production `ready`, develop `archived`, zero efêmera na listagem.
Fixture-free/journal 11/11/smoke 7/7 são registros históricos do ledger,
não medições desta sessão. Snapshot nativo existente até 2026-10-10;
retenção PITR configurada de 6h. Paridade **DESCONHECIDA**. G1 sem
assinatura: `M02-D-008-G1-memo.md:40-45`. SEC-01/BAK-01/G1/G2/hPanel/Sonar
continuam pendências registradas; nenhuma foi encerrada aqui. A5 ainda sem
carimbos e sem janela de observação. Métricas sem amostra:
**NÃO MENSURÁVEL**.

## 7. Top-3 riscos, entrega e fila residual

1. **Falso PASS de snapshot:** o consumidor usa `mtime`; completar apenas
   o produtor deixa o gate sem N-5. Resolver o escopo de S1 antes de selar.
2. **Restauração insuficiente para o primeiro tráfego:** PITR atual 6h,
   sem novo restore compensatório nem prova de independência/custódia.
   Snapshot nativo existente não fecha BAK-01; cláusula N-10 obrigatória.
3. **Sequência sem assinaturas e prova de runtime:** G1/freeze, cadeia de
   commits/CI e hPanel permanecem pendentes. Datas planejadas e recon
   administrativa não substituem esses selos.

Próxima decisão concreta: ratificar a proposta
`rat-dp5-emenda6-draft.md`, que contém o texto de RAT, Emenda #6 DRAFT,
escopo de escrita, testes e a sequência C/§2.3 em seis passos. Seu conteúdo
mantém o glob, inclui o consumidor em S1, conserva C1 no T-0 e corrige S11.
Não foi preenchida assinatura nem alterado o arquivo de decisões vigente.

Após RAT: S1 e preparação/selagem S2 → cadeia S3 pelos donos definidos →
split S4 → DR S5/S6 → nativo S7; V2b S8 somente com DP3/DP4 e D2. O pedido
D2, no momento autorizado, continua sendo **URL POSTGRES read-only do
legado Supabase (auth+public) via SUPABASE_MIGRATION_DATABASE_URL**;
credencial não deve ser enviada no chat. OP-H (11/11) e OP-C (freeze/T-0,
deploy/smoke/carimbos e A5 0/24/72h) continuam pendentes. A5 não pode ser
comprimida em uma única execução. S11 conserva as âncoras 20/09, 06/10 e
10/10, com a relação temporal corrigida.

As decisões de plano pago, origem/G1 e cutover não foram tomadas pelo
agente. A revisão entregue permite aprovar uma mudança local concreta;
não representa GO de produção.
