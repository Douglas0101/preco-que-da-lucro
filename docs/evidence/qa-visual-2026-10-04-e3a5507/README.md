# QA visual, cliques e operações calculadas — 2026-10-04

## 1. Resultado e fato-fonte

Pedido do usuário: testar visualmente o sistema, suas funções por clique e operações calculadas. Intenção prévia: `PROGRESS.md`, L659; plano inicial: `SPEC.md`. Revisão exercitada: `e3a5507cf5d0a7beb10d383a9f44c1e1537aa05c`.

O roteiro de 12 cenários foi executado em N1, com viewport desktop de 1350 × 880 e móvel de 390 × 844, sobre PostgreSQL 17 sintético, exclusivo e ligado ao loopback. Os cálculos e registros exercitados conferiram com os oráculos independentes; a aprovação geral da aplicação permanece bloqueada por quatro defeitos locais observados: DBT-86 a DBT-89. O cadastro completo de produto por IA continua sem veredito positivo nesta bancada, que foi iniciada sem credencial de provedor.

Evidência **LOCAL-VERIFIED**. Este relatório não é um selo S5, não contém S6 formal e não autoriza release. Nenhuma fonte da aplicação foi alterada: 140 fingerprints anteriores foram conferidos, com zero diferenças. Artefatos documentais permanecem locais, pendentes do próximo milestone de engenharia.

## 2. Ambiente, procedimento e arquivos

- Preview: `http://127.0.0.1:4173/inicio`, N1/browser 2/tab 10, conta A sintética autenticada.
- Runtime: artefato Node `.output/server/index.mjs`; bundle qualificado `index-DpDZQbhM.js`, SHA-256 `da167b8d0072ad1dc771167bc81788f715e7973eaeec6f98e2868e802fdd31b4`.
- Banco: container `pqd-c28-visual-qa`, full ID `545b0ed2cf4a1b1bc8f3be904e6cead46b4d279c3cf75fd7c2806b22b27035d6`, PG17, tmpfs 512 MiB, porta exclusiva `127.0.0.1:41921`. Migrações e seed: exit 0. Não foi usado o container de dados em `:5432`.
- As contas, produtos, despesas e vendas são fixtures desta sessão. Credenciais sintéticas ficam em arquivo privado 0600, fora do repositório; o relatório contém apenas nomes de variáveis e identidades de fixtures.
- Aritmética inicial registrada antes de preencher os campos: Python `decimal`, sem importar o motor financeiro da aplicação. Registros persistidos conferidos depois por SQL somente de leitura no banco exclusivo.
- Captura CUA fornece JPEG. O adaptador privado converteu os pixels em memória para PNG e chamou os módulos existentes `visual-perception`/`visual-redaction` antes de qualquer persistência. `beforeHash` refere-se ao PNG convertido. O shim de `process.env` usa apenas o ambiente privado da fixture. O conversor e os módulos de origem têm fingerprints registrados.
- 39 capturas, cada uma com PNG, acessibilidade e DOM: 117 arquivos conferidos e 117 descobertos na janela desta sessão. Os bytes dos trios vivem no diretório ignorado `docs/evidence/visual/`; não foram reformatados. Índice: `captures/visual-index.json`. Manifesto dos trios: `MANIFEST.visual.sha256`.
- O snapshot de acessibilidade é CUA AX; o DOM é um recorte de `document.body`, com profundidade máxima 12, até 40 filhos por nó e atributos/textos limitados. A captura exclui atributos `value`, passa por redação e nova varredura de resíduos. Este recorte não prova ausência no DOM inteiro. A ausência nominal entre tenants foi verificada separadamente por locators na lista e nas opções abertas.
- Os tamanhos acima são do viewport CSS/override observado. Os bytes JPEG devolvidos pelo adaptador têm cinco tamanhos de pixels: 1350×880 (15), 1327×865 (5), 1335×870 (14), 375×812 (3), 390×844 (2). Todos os 39 PNG foram decodificados e conferidos; o conversor preserva os pixels fornecidos. Não há claim de igualdade pixel-perfect entre tamanho CSS e captura. Recibo: `captures/png-validation.json`.
- `correlationId` é `null`: o header da resposta de cada navegação não foi observado. Não há claim de vínculo com span/trace. A redação não realiza OCR; as telas capturadas não continham credenciais, e emails visíveis em pixels são sintéticos.

| Arquivo/captura                                                 | Finalidade                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `SPEC.md`                                                       | Roteiro prévio V01–V12 e limites                                  |
| `captures/arithmetic-preregistered.json`                        | Oráculo Decimal inicial                                           |
| `captures/*preregistered.json`, `captures/period-oracle-*.json` | Entradas e reconciliações anteriores às respectivas operações     |
| `captures/steps.json`                                           | Resultados e tempos dos passos observados                         |
| `captures/db-after-simulation.json`                             | Hipótese persistida e zero vendas antes do primeiro caso positivo |
| `captures/db-final-arithmetic.json`                             | Identidades, valores e totais finais no PostgreSQL                |
| `captures/tenant-b-identity.json`                               | Sentinela estrangeira e membership por identidade                 |
| `captures/tenantB-client-errors.txt`                            | Erro de renderização redigido                                     |
| `captures/source-fingerprints.json`                             | Comparação dos 140 arquivos da revisão exercitada                 |
| `captures/verification.json`, `captures/verify-evidence.txt`    | Verificação executável de integridade e aritmética                |
| `captures/documentary-guards.json`                              | Saídas dos cinco checks documentais; escopo e limites declarados  |
| `captures/runtime.json`, `captures/resource-handoff.json`       | Custódia dos processos, banco e ambiente                          |
| `MANIFEST.sha256`, `MANIFEST.visual.sha256`                     | Hashes dos documentos/metadados e dos trios visuais               |

## 3. Cenários e contas observadas

| Cenário                   | Resultado observado                                                                                                                                           | Limite ou defeito                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| V01 Login                 | Conta A entra por preenchimento e clique; pendência vira shell autenticado                                                                                    | A transição posterior ao acesso protegido sem sessão revelou DBT-86                                                                          |
| V02 Dashboard vazio       | Sem vendas: faturamento `—`, sem inventar volume; produtos 2, despesas fixas 600                                                                              | Overflow DBT-89; card de margem estático DBT-88                                                                                              |
| V03 Produtos              | Completo REAL/custo10/preço20/margem35%; incompleto DADOS INCOMPLETOS/custo e margem `—`                                                                      | Sem NaN/Infinity ou zero no lugar do custo desconhecido neste cenário                                                                        |
| V04 Formulários/navegação | Despesa vazia rejeitada; despesa fixa50 adicionada; histórico restaurado; Ver produto leva ao diagnóstico; Recomeçar abre aviso e Cancelar preserva histórico | Produto novo por IA: retorno controlado de serviço indisponível e input recuperado; criação completa **NO-VERDICT** por ausência de provedor |
| V05 Custos e equilíbrio   | Embalagem100→120 recalcula custo10→12/margem35→25%; preço restaurado100; fixas600+50=650; equilíbrio93 unidades                                               | Quantidades inteiras usam teto; receita de equilíbrio usa limite bruto. Outros custos periódicos não foram alocados por unidade              |
| V06 Simulação             | Preço20/custo5/fixas100/volume50/taxas15%: contribuição12/60%, receita1000, resultado500; salva como manual e persiste após reload                            | Estimativa exibe motivo e bloqueia Salvar; não entra no faturamento factual                                                                  |
| V07 Diagnóstico           | Custo10+adicional2/taxas15%: mínimo14,12 e meta20%18,46; meta90% dá erro; troca de produto limpa2/20                                                          | Trigger mostra UUID: DBT-87                                                                                                                  |
| V08 Vendas                | Quantidade0 rejeitada, banco ainda com zero vendas; 2×25=50, linha e valores persistem após reload                                                            | Identidade e total conferidos em SQL; trigger UUID DBT-87                                                                                    |
| V09 Períodos              | Venda de setembro excluída de mês/trimestre e incluída no ano. Totais finais: mês122,50, trimestre122,50, ano152,50                                           | Dois probes do adaptador de data geraram fixtures com data atual, foram preservados e incluídos na reconciliação; não são falha do filtro    |
| V10 Isolamento            | B vê produto210/tenant202; A tem seus dois produtos e zero ocorrência do marker de B na lista/opções; produtos A ausentes na lista de B                       | Evidência nominal de UI, não certificação completa de RLS; primeiro acesso B ao dashboard falhou com DBT-86                                  |
| V11 Mobile                | Menu por clique e Enter, navegação para Vendas, Escape, registro de1×`12,50`=12,50                                                                            | **FAIL de layout**: formulário tem overflow horizontal13px em viewport390; viewport restaurado                                               |
| V12 Saída                 | Sair leva a auth; acesso a `/inicio` sem sessão redireciona; nenhum dado privado exibido                                                                      | Tokens/cookies não foram inspecionados; transição seguinte é tratada em DBT-86                                                               |

| Operação                         | Oráculo independente                                               | Tela/banco                                                                       |
| -------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Preço mínimo                     | `(10+2)/(1−0,15)` = 14,12                                          | 14,12                                                                            |
| Preço para meta de 20%           | `(10+2)/(1−0,15−0,20)` = R$ 18,46                                  | R$ 18,46                                                                         |
| Simulação de 50 unidades         | Receita R$ 1.000; variáveis R$ 400; fixas R$ 100; resultado R$ 500 | Tela e SQL conferem; hipótese manual e equilíbrio de 9 unidades persistidos      |
| Venda inicial                    | `2×25` = R$ 50                                                     | Bruto, líquido e item de R$ 50; quantidade 2, preço R$ 25 e UUIDs persistidos    |
| Embalagem alterada               | `120/10` = R$ 12; `20−12−3` = R$ 5; `5/20` = 25%                   | Custo R$ 12 e margem 25%; embalagem restaurada para R$ 100, conferida em SQL     |
| Equilíbrio após despesa de R$ 50 | `ceil(650/7)` = 93; limite bruto 92,857142…                        | 93 unidades; limite bruto 92,86; receita teórica R$ 1.857,14                     |
| Meta de lucro de R$ 350          | `ceil((650+350)/7)` = 143; `143×20` = R$ 2.860                     | 143 unidades e receita R$ 2.860; limite bruto 142,857… corresponde a R$ 2.857,14 |
| Decimal brasileiro móvel         | `1×12,50` = R$ 12,50                                               | Preço e item persistidos como 12,5000                                            |
| Faturamento final                | Atuais `50+30+30+12,50` = R$ 122,50; setembro R$ 30; ano R$ 152,50 | UI mês/ano e SQL mês/trimestre/ano conferem                                      |

## 4. Defeitos declarados e riscos

| Dívida | Evidência concreta                                                                                                                                                                                         | Severidade / condição de fechamento                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DBT-86 | Logout→acesso protegido sem sessão→login B aceita auth e cai em `TypeError: Cannot read properties of undefined (reading 'count')`, `inicio-D11vMURS.js`; Try again não recupera; reload completo recupera | Alta. Repetir a sequência A/B em contexto fresco, provar payload válido ou erro controlado e recuperação pelo botão; nenhum acesso a resumo parcial como sucesso. Causa de cache/transição é hipótese, não root cause confirmada |
| DBT-87 | Diagnóstico, Simulações, Vendas e Ponto de Equilíbrio mostram UUID no trigger; opções abertas têm nomes corretos; UUID fica cortado no celular                                                             | Média. Seleção inicial e após troca devem exibir o nome correto e preservar ID no payload, em desktop/mobile e reload                                                                                                            |
| DBT-88 | Com vendas reais e receita50, depois152,50, Margem consolidada continua `—` e pede registrar vendas. `inicio.tsx` mantém `value="—"` e a mensagem fixa                                                     | Média. Contrato explícito para agregado: resultado calculado/reconciliado quando suportado ou indisponibilidade com causa verdadeira; zero vendas não pode virar margem fictícia                                                 |
| DBT-89 | Dashboard1350: clientWidth1335/scrollWidth1345; Vendas390: clientWidth375/scrollWidth388; capturas mostram barra horizontal/campo além do card                                                             | Média. Geometria e controles verificados por página e breakpoint, sem conteúdo essencial oculto e com `scrollWidth <= clientWidth`; incluir controle que detecte os bytes atuais                                                 |

Os quatro achados são do autor nesta QA; não são N ou CORR de uma lane S6. Permanecem **ABERTA**. Não houve correção de aplicação nesta sessão.

Limites: um navegador N1 com dois tamanhos de viewport; nenhum novo run da matriz de quatro engines foi executado nesta sessão. OAuth Google, recuperação de senha, cadastro externo, provedor IA real, criação completa de produto por IA, exclusão permanente, CLS/trace e certificação exaustiva de tenant/RLS não receberam veredito positivo. Custos e metas foram comparados apenas no escopo das premissas informadas, sem presumir alocação das despesas variáveis periódicas de R$ 200. A QA não paga déficit de cobertura main nem reabre a proteção de release.

## 5. Auto-verificação pré-S6

KPI do autor: **4 achados capturados / 4 achados desta QA**. S6: **NOT-STARTED**; total de achados de S6, CORR, N e densidade adversarial não foram medidos. Não há alegação de contexto limpo.

| #   | Item do checklist         | Demonstração ou limite explícito                                                                                                                               |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo         | Quantidade0, meta90%, custo desconhecido e marker estrangeiro; registros e capturas. Sem patch de aplicação a falsificar contra o pai: esta QA não sela um fix |
| 2   | Duas direções             | Meta20% válida/90% inválida; quantidade0 rejeitada/2 aceita; custos100/120/restauração; mês vs ano com identidade histórica                                    |
| 3   | Identidade                | UUIDs de sale/item/simulation/product/tenant/user nos oráculos; cenário por label no índice, não aprovação só por contagem                                     |
| 4   | Além de exit code         | Entradas, telas, linhas persistidas e soma SQL; relatório mantém quatro falhas apesar da integridade verde                                                     |
| 5   | Sem sleep fixo            | Locators e estados reais de retorno. Capturas pré-debounce/transição são declaradas sem veredito de cálculo; finais esperam resultado esperado                 |
| 6   | Sem identidade degenerada | UUIDs fixos ou reais não vazios, hash PNG, preço/quantidade, tenant B positivo e negativo A                                                                    |
| 7   | Estado compartilhado      | PG17 próprio, IDs/labels/tmpfs/loopback conferidos; ambiente sem provider; probes de data preservados, oráculos recalculados antes de novas operações          |
| 8   | Sentinela real            | Produto210 em B confirmado por join de membership e login positivo; venda histórica com occurred_at real; quantidade0 seguida de SQLcount0                     |
| 9   | Revisão                   | 140 fingerprints sem diferença; bundle qualificado; HEAD e runtime registrados                                                                                 |
| 10  | checked === discovered    | 39 trios/117 paths iguais à descoberta na janela desta sessão; manifestos não vazios e conferência estrita de arquivos                                         |
| 11  | S6 limpo                  | Não executado; este relatório é do autor, sem promoção a selo                                                                                                  |
| 12  | Fail-closed               | Assertivas do verificador falham se faltar identidade/hash/valor; falhas de UI permanecem falhas e criação IA sem provedor permanece NO-VERDICT                |
| 13  | Isolamento                | Container próprio e porta41921; Node loopback4173; nenhuma fonte, banco externo ou processo não pertencente à QA foi alterado                                  |
| 14  | Gate + captura            | `steps.json`, labels do índice, script/resultado SQL, redacted console e checksums. Nenhum exit avulso promove release                                         |
| 15  | run@sha                   | Nenhum novo run CI ou selo run@sha; revisão é a já publicada, evidência desta QA é local e ainda não commitada                                                 |
| 16  | Multi-sítio               | Todos os9 destinos expostos na navegação foram visitados; seletores de produto em4 telas observados; não é prova exaustiva de todo formulário/API              |
| 17  | Ambiente                  | Bancada com WIP documental declarado; dependências e build existentes, fingerprints, seed próprio e origem local; nenhum contorno de gate/limite real          |

Ocorrências do instrumento foram reconciliadas: CUA JPEG versus PNG; ambiente `process.env` no módulo; serialização de DOM; consulta SQL inicial com nomes de coluna inexistentes corrigida para `params`/`result`; preenchimento de `input[type=date]` por CUA não retido em React, resolvido pelo `setValue` nativo e verificação após editar outros campos; roles AX de período diferem dos roles DOM; locator de meta esperava `un.` enquanto a UI usa `unidades`. Esses episódios não foram classificados como falhas da aplicação. A sequência e os probes persistidos ficam documentados, sem apagamento oculto.

## 6. S6 adversarial

**NOT-STARTED.** Nenhuma claim foi submetida à lane de contexto limpo. Nenhum resultado deste documento altera o placar do MAESTRO, o gate main, o ruleset ou a autoridade de release.

## 7. Correções e custódia

Aplicação: zero correções. Adaptador de evidência: conversão em memória e shim privado, sem alteração do módulo versionado. Embalagem restaurada para R$ 100 pela UI; despesa fixa de R$ 50, hipótese manual e cinco vendas sintéticas permanecem para inspeção. Dois registros de R$ 30 com data atual são probes do preenchimento de data e estão incluídos nas contas finais.

O preview fica aberto e o viewport padrão foi restaurado. O processo e o banco pertencem a esta QA; a custódia está em `captures/resource-handoff.json`. Remoção futura exige conferir full ID/labels do container e fingerprint do processo antes de encerrá-los. Nenhum cleanup remoto foi executado ou alegado.

## 8. DoD e próximo milestone

Roteiro, oráculos, capturas redigidas, verificação de identidade/aritmética e registry de achados preparados. Integridade documental é verificável pelos manifestos. A aplicação **não recebe aprovação geral**: fechar DBT-86–89, testar novamente os casos negativos e positivos, completar a pré-condição do provedor no trilho autorizado quando aplicável e então realizar S6/contexto limpo e os checks atuais da revisão que integrar as correções.
