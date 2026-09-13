# PENDENTES-CLOSE — relatório de parada (2026-09-07)

## 1. Veredito e STACK_MODE

**STOP-TRIGGER no Q0; rodada incompleta. STACK_MODE = `uncommitted`.**
Branch `develop`, HEAD observado
`8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f`.
O bundle cutover está vermelho fora da única exceção permitida, gsec.
Nenhum commit, staging, edição de código, regeneração de selo anterior
ou mutação em produção. Evidência detalhada em `round-state.md` e
`evidence.json`; saídas anteriores transcritas e identificadas em
`artifacts/q0-checks-observed.txt`.

## 2. Q0 — integridade observada e bloqueio

| Bundle                  | Resultado atual | Efeito                                      |
| ----------------------- | --------------- | ------------------------------------------- |
| cutover-2026-09-07      | **15/18 OK**    | parada; esperado 18/18                      |
| cutover-prep-2026-09-07 | **25/25 OK**    | integridade dos itens enumerados confirmada |
| gsec-2026-09-06         | **12/14 OK**    | vermelho previsto até V0                    |

Os três falhos do cutover são `docs/runbooks/cutover-A4.md`,
`scripts/env-guard.mjs` e
`docs/specs/M-02/emenda-2026-09-07-env-guard.md`. Os dois falhos do gsec
são o guard e sua emenda. Todos foram nomeados e tiveram os hashes atuais
capturados diretamente nesta sessão, antes de qualquer edição.

O Manifest 5 documenta mudanças nos mesmos três caminhos. **INFERENCE:**
a rodada PREP provavelmente desatualizou o selo cutover. A documentação
não basta para transformar automaticamente essa deriva em exceção aceita.
Não se afirma corrupção, regressão de segurança ou adulteração.

Não foi executado readiness após a parada. Falhas de readiness da rodada
anterior permanecem HISTORICAL. Um coletor auxiliar de logs recebeu
`spawnSync sha256sum EPERM`; não houve tentativa de contorno. Os resultados
Q0 válidos são os dos comandos diretos que já haviam concluído.

## 3. Q1–Q6 e tabela §42 por modo

| Fase                   | Natureza            | Estado nesta rodada                                                         |
| ---------------------- | ------------------- | --------------------------------------------------------------------------- |
| Q1 SUMS mecânico       | PREP                | BLOCKED: script, testes e wiring não implementados                          |
| Q2 identidade/migração | PREP                | NOT-CONCLUDED: sem inventário final, addendum ou mudança no GO/NO-GO        |
| Q3 guardrails Neon     | PREP                | somente consulta de metadados: production + develop; sem script ou T-0 novo |
| Q4 fast-path V2b       | PREP                | BLOCKED: Manifest 6 e addendum de quatro passos não produzidos              |
| Q5 fila humana         | PREP                | agenda pedida preservada abaixo; runbook copiável H1–H6 ainda não produzido |
| Q6 fechamento          | relatório de parada | sem scan selado, sem aceite final de SUMS e sem promoção de gate            |

A tabela abaixo apenas localiza os modos do relatório PREP existente;
nenhum item foi reexecutado ou fechado nesta rodada.

| Item §42                        | Modo descrito anteriormente   | Evidência nesta rodada                                        |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| migrations do zero              | mecanismo/CI                  | HISTORICAL; CI atual não consultado                           |
| migrations em cópia de produção | cópia                         | HISTORICAL; nenhuma migração executada                        |
| schema diff revisado            | cópia                         | HISTORICAL; escopo legacy não confirmado aqui                 |
| tenant tests                    | cópia                         | HISTORICAL; sem teste runtime                                 |
| RLS tests                       | cópia/mecanismo               | HISTORICAL; sem probe                                         |
| reconciliation report           | cópia; dados legacy pendentes | paridade legacy×Neon **DESCONHECIDA**                         |
| backup/restore                  | mecanismo; dados pendentes    | HISTORICAL; nenhum dump/restore/refresh                       |
| rollback                        | runbook/mecanismo             | sem nova verificação; hash do runbook diverge do selo cutover |

Integridade de um bundle não demonstra validade operacional de seu
conteúdo. As leituras parciais do migrador/reconciliadores não constituem
inventário Q2 nem veredito sobre o seu gatilho de identidade.

## 4. ESTADO DO SUBSTRATO e limites externos

**REMOTE-VERIFIED-METADATA:** o Neon retornou exatamente `production`
(`br-snowy-violet-aymcvvvv`, ready) e `develop`
(`br-small-hill-aymcu14y`, archived), no projeto
`damp-forest-57346541`. Nenhuma branch efêmera foi observada na resposta.
Nenhuma consulta de dados ou escrita em banco foi realizada.

Tráfego inexistente, produção fixture-free, snapshot até 10/10 e estados
de SEC-01/BAK-01/G1/G2/hPanel/Sonar são declarações do relatório PREP;
nesta rodada permanecem **HISTORICAL/UNVERIFIED**, sem comprovação atual.
Paridade legacy×Neon permanece **DESCONHECIDA**.

GitHub confirmou somente o nome `develop`. SHA remoto e CI do tip não
foram comprovados. Navegador não utilizado após a parada. Não se presume
scan selado, floor 9 atual ou autorização de cutover a partir dessas leituras.

## 5. Fila humana H1–H6 e calendário

Esta é a agenda solicitada, preservada para retomada; não substitui o
runbook Q5 com passos copiáveis e checkpoints validados. Donos abaixo
são os papéis previstos no roteiro; a atribuição a Douglas é proposta,
sem assinatura realizada pelo agente.

| Item | Objetivo e checkpoint requerido                                                                                                                                                                   | Dono proposto                          | Deadline                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| H1   | resolver a deriva inicial; V0+V6+M5; assinatura → SUMS → verificação verde → staging → commits humanos; state verde pós-C2, mapa readiness pós-C3, CI e selftest 13/13 pós-C4, hashes nos ledgers | Douglas / mantenedor signatário        | 07/09, estimativa do roteiro 45–60 min         |
| H2   | PR trivial deliberado após C4: comprovar branch Neon criada/deletada e rls-probe real em CI, antes do freeze                                                                                      | Douglas / mantenedor GitHub            | antes de 10/09                                 |
| H3   | obter D2 legacy SELECT-only, validar V2b e usar Manifest 6 após Q4; diff inconcluso mantém NO-GO de dados                                                                                         | Douglas / operador Supabase            | até 10/09                                      |
| H4   | hPanel, SEC-01, G1 e checklist de guardrails Neon assinado; checkpoint documental e técnico                                                                                                       | Douglas / operador hPanel e signatário | 10–11/09                                       |
| H5   | cutover após T-0, GO/NO-GO de identidade, membership §2.5 antes de smoke e Emenda #3 restrita à janela                                                                                            | Douglas / operador de cutover          | 11–12/09                                       |
| H6   | refresh de snapshot, probe/sunset G1, renovação WARN-NITRO, decisão sobre gate opção c e encerramento dos ledgers                                                                                 | Douglas / mantenedor e signatário      | refresh <20/09; G1 em 20/09; WARN-NITRO <06/10 |

Mapa de flips C1–C4: **REQUER VALIDAÇÃO NA RETOMADA**. Não foi inferido
do HEAD atual nem testado nesta rodada. A ordem pedida para SUMS permanece
assinaturas/appends → `m02:sums` → `sha256sum -c` verde → staging.
O atalho `npm run m02:sums` ainda não foi adicionado, e esses comandos
nesta seção são a especificação da retomada, não instruções prontas para
executar agora. Nenhum staging com SUMS vermelho.

Observação de calendário: o anexo associa snapshot com validade 10/10 à
frase “expira antes do sunset” de 20/09. 10/10 é posterior a 20/09.
Preservado o requisito independente de refresh antes de 20/09; validade
real do snapshot e justificativa do prazo precisam de verificação humana.
Nenhum lembrete ou automação foi criado.

## 6. Top-3 riscos e condição concreta de retomada

1. **Integridade cruzada da pilha:** três arquivos compartilhados divergem
   do selo cutover. Regenerar o selo sem triagem apagaria o sinal que Q0
   foi solicitado a registrar. Comparar as alterações PREP documentadas
   com os três conteúdos atuais e decidir explicitamente a base aceita.
2. **V2b até 10/09:** dados legacy permanecem DESCONHECIDOS e Q2/Q4 ainda
   não foram concluídos. O deadline de dados continua condicionando o GO.
3. **Pilha e prova operacional pendentes:** manifests não commitados,
   primeira execução real do workflow, assinaturas e hPanel precisam
   ocorrer antes do freeze; metadados Neon não suprem essas provas.

A ação pendente imediata é reconhecer ou rejeitar, após triagem, a deriva
dos três caminhos do cutover nos hashes atuais de `evidence.json`. Só
então retomar Q0 (incluindo readiness) e a implementação Q1–Q6. Antes de
novos subprocessos de coleta, esclarecer também a origem do `EPERM`, sem
contornar o gate. A exceção gsec não foi expandida e nenhuma assinatura
foi produzida pelo agente.

## 7. Entrega, mecanização e preservação

Entregues `round-state.md`, este `report.md`, `evidence.json` e transcrições
identificadas das verificações e da falha de coleta. A implementação dos
mecanismos Q1–Q4 não começou; o runbook Q5 e o scan selado Q6 permanecem
pendentes. **Nenhuma nova mecanização operacional foi entregue.**

O registro local do STOP é o único write-set utilizado. Os três selos
originais, código, package.json, matrizes, ledgers e manifests anteriores
foram preservados. Nenhum commit, staging, push, PR, workflow dispatch,
SQL, branch Neon, migração ou ação de produção ocorreu nesta rodada.

O SHA256SUMS deste novo registro cobre apenas os cinco arquivos do relato
da parada; não é scan de segurança, não valida bundles anteriores nem
cumpre o aceite Q6. Sua geração local não reexecuta a operação que recebeu
EPERM. O coletor bloqueado não foi apresentado como executado.
