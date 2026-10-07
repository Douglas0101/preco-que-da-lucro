# Mudança da cobertura para 60% e recuperação da produção

## Resultado corrente

**LOCAL-VERIFIED; execução remota de release pendente.** A política solicitada pelo usuário foi implementada e testada na bancada isolada. O mínimo obrigatório passa a 60% de new_coverage na análise real do CE. Os cinco controles de segurança/confiabilidade/manutenibilidade/duplicação/hotspots permanecem obrigatórios; outras condições ERROR também bloqueiam. O relatório conserva o status e limiar originais do Sonar, com releasePolicy separada. O espelho e as baselines continuam observações, inclusive NO-VERDICT, sem substituir a análise real de main.

A produção observada ainda usa main `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`, deployment `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`. Esse código procura AI_GATEWAY_API_KEY/LOVABLE_API_KEY e não consome DEEPSEEK_API_KEY, que consta no ambiente Production da Vercel. Develop contém o consumidor DeepSeek e a correção de configuração vazia. A presença nominal de uma variável não prova validade da chave ou configuração efetiva do deployment antigo.

**REMOTE-OBSERVED / aplicado:** autoAssignCustomDomains=false no projeto `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`, confirmado pelo painel e pelo aviso de promoção manual. O alias sage continua no deployment anterior. O ruleset permanece inalterado; o payload proposto conserva PR, strict checks de verify-release/scan + cobertura, exclusão/force push proibidos e bypass vazio. Remove somente update e o required check do espelho após a verificação atual. Evidência em captures/vercel-publication-{before,after}.json e ruleset-{before,proposed}.json.

## Mudanças e fingerprint

ADR-042 e AGENTS.md registram a decisão humana de 60% e a nova sequência: PR verificada → merge → CE real do SHA de main → promoção manual na Vercel. A implementação permanece em develop. O CI Neon cria uma raiz schema-only por PR/run/attempt, verifica criação nova, identidade, endpoint e prazo, e prepara somente schemas copiados vazios para aplicar toda a cadeia de migrations. Não inventa ledger, remove registros de usuários ou dispensa o rollback protegido.

Fonte do candidato: bancada managed critical-redeploy, base `9b0540dc1ee44893c666c0f5eca2a70874161590`, remote develop observado `ce9bd44e6a22228ec623cbb4a99ac2c1be5f2fff`. Hashes dos arquivos em captures/source-fingerprints.txt; capturas não vazias em MANIFEST.sha256. Hashes vinculam bytes locais; não são veredito remoto.

## Evidência

- **RED → GREEN da política, entrypoint real:** captures/policy-red-green.json e instrumento policy-red-green.py.txt executam os bytes do pai 9b0540d e do candidato, em fixtures Git/CE herméticas. O pai sai 1 em 63,2387% com provider ERROR; o candidato aceita sob 60%, conservando esse ERROR original. O candidato recusa 59,99% e segurança rating2, mesmo com cobertura100. Isto é prova local da política, não observação atual do Sonar.
- **Negativo de dados e preparação PG17:** captures/local-neon-fixture-probe.{ts,txt}. No container próprio porta41923, ledger de schema-only vazio e conta sintética por identidade. O rollback 0010 e a nova preparação recusam a conta; ID e issuer permanecem. Após remover exclusivamente a sentinela sintética, 38/38 tabelas verificadas e zero registros apagados pela preparação.
- **Testes focados:** captures/focused-tests.txt, 3 arquivos/122 testes. Cobrem fronteiras, controles preservados, CE/origem/identidade, timeout/relógio, schemas/rows/endpoint e impossibilidade de tornar a decisão do CE opcional.
- **Circuito local:** captures/check-r3.txt, npm run check final exit0 PASS, 134 suítes/1942 testes, 18 condicionais de banco explicitamente skipped nesse processo sem URL. Build e bundle PASS. R2 anterior preservado. R1 encontrou três erros de lint no regex novo; corrigidos, sem relaxar a regra, em captures/check-r1-lint-negative.txt.
- **Banco:** captures/db-test.txt, cadeia completa de18 suítes PASS em PG17 local; captures/db-check.txt PASS. Essa execução satisfaz separadamente os testes condicionais. Não usa production/develop remoto.
- **Produção e CI remoto:** aplicação da política no ruleset, PR com matriz completa, CE do novo main, deployment final e chat real ainda não observados nesta seção. Nenhum resultado de execução anterior é atribuído ao novo candidato.

## Riscos e limites declarados

O usuário escolheu uma política com menor cobertura, não uma melhora da métrica. O preset remoto Sonar way pode continuar mostrando ERROR abaixo de80; o CI exibe sua decisão ADR-042 separadamente. O recorte da PR não prova o recorte de main: publicação aguarda o CE real de main. Schema-only é Beta; init_source/empty inventory inesperados bloqueiam, sem fallback para cópia com contas. Não se usa produção como banco de prova. Credenciais continuam Via A. O login humano foi informado, porém a aba controlada ainda mostra Entrar; a validação autenticada aguarda sessão observável. Hostinger/recuperação/placar e dívidas sem relação com este reparo mantêm seus próprios limites.

## Auto-verificação pré-S6

| #   | Item                        | Prova / limite                                                                                                                                    |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo           | Entry point dos bytes do pai rejeita cobertura63,2387; candidato aceita60 e rejeita59,99. Conta sintética preservada pelo rollback/guarda.        |
| 2   | Fronteira nos dois sentidos | Casos0/59,99/60/79,9/80/100 e cinco controles não relacionados a cobertura.                                                                       |
| 3   | Identidade                  | Projeto, task, analysisId, revisão e superfície; PR/run/attempt, init_source e conexão vinculada ao endpoint.                                     |
| 4   | Não exit-code-only          | Artefato preserva status/condições; teste de banco verifica ID/issuer após recusa e ausência efetiva dos objetos após preparação vazia.           |
| 5   | Sem sleep fixo como prova   | Polling do CE segue estado e relógio monotônico com deadline e teto de observações; aprovação somente SUCCESS da identidade esperada.             |
| 6   | Sem identidade degenerada   | Negativos para ID/run vazio, endpoint inexistente/duplicado, permanent IDs e origem diferente.                                                    |
| 7   | Estado compartilhado        | PG17 próprio, ledger vazio assertado antes da sentinela, locks antes da descoberta de registros; main/develop reconciliados antes de mutar.       |
| 8   | Sentinela real              | Conta sintética inserida e lida por identidade; issuer preservado após as duas recusas.                                                           |
| 9   | Fingerprint                 | Fonte do pai via git show9b0540d; fonte candidata SHA256 em instrumentos e source-fingerprints.                                                   |
| 10  | checked === discovered      | 38 tabelas descobertas/38 verificadas, descoberta vazia e schema desconhecido recusados; manifesto não vazio.                                     |
| 11  | S6 de contexto limpo        | IN-PROGRESS: autorização humana recebida; revisão independente somente leitura/testes iniciada, sem veredito antecipado.                          |
| 12  | Fail-closed                 | Condições ausentes/ignoradas, valores contraditórios, CE não concluído e inventário não vazio recusados.                                          |
| 13  | Bancada isolada             | Worktree próprio; principal WIP protegido por931 hashes. Container tmpfs próprio porta41923; cleanup/ausência exigidos antes do handoff.          |
| 14  | Gates + capturas            | Logs de check/focados/PG e recibos da Vercel; gates remotos pendentes nomeados.                                                                   |
| 15  | CI por commit               | PENDENTE: novo commit ainda não publicado; nenhum run antigo conta como aprovação desta alteração.                                                |
| 16  | Multi-sítio                 | Guardas conferem workflows descobertos; inventário PG percorre todos os schemas/tabelas de usuário e recusa desconhecidos.                        |
| 17  | Precondição ambiente        | Helper exige contexto CI/projeto/branch criada, fonte schema-only, prazo e endpoint; instrumento PG exige loopback41923, versão17 e ledger vazio. |

KPI pré-S6: três erros de lint capturados/corrigidos pelo autor; riscos de contas herdadas, ledger vazio e relógio do polling tratados antes da revisão. Total de achados independente ainda desconhecido; densidade e CORR/N não calculáveis antes de S6. Nenhum 0 fictício é declarado.

## S6 ADVERSARIAL

IN-PROGRESS. Autorização humana explícita recebida nesta sessão; lane independente de contexto limpo iniciada. Claims, CORR, N e veredito aguardam o relatório real. Este estado não é aprovação nem fechamento formal do work package.

## Rollback

Reverter por commits ordinários e restaurar ruleset-before.json, preservando histórico e WIP. Manter a produção sem promoção automática. Caso o novo deployment falhe, usar o deployment anterior observado, sem rollback de dados de production.
