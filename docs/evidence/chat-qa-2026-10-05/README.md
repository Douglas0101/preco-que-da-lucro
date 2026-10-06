# QA do chat — Chrome e DeepSeek, 2026-10-05

## 1. Resultado e escopo

Bancada local `http://127.0.0.1:4174/novo-produto`, PostgreSQL 17 isolado em `127.0.0.1:41922`, conta sintética e histórico existente. O backend já estava configurado para `deepseek-flash` no endpoint HTTPS exato do DeepSeek. A chave esteve apenas no ambiente privado do processo Web; `DeepSeek-API.txt` não foi aberto nem copiado. Nenhuma chave entrou no código, nos argumentos ou nos artefatos.

Três turnos reais antes da correção cadastraram Pizza QA Chrome 05-10, com sete ferramentas bem-sucedidas e oito chamadas liquidadas no ledger. O preço é 30, o rendimento é 1 unidade, os ingredientes custam 4 e 6 por embalagem unitária, o regime é MEI e o imposto continua ausente. O turno 3 apresentou R$ 10 calculados pelo modelo sem resultado do motor financeiro; esse fato originou DBT-93.

**Estado terminal deste WP: REJECTED no contrato de fonte do usuário.** O gate r4 e QA real local passaram, mas o S6 final identificou residual P2 de N3: a projeção de Markdown fabricou números nas mensagens do usuário que a tela mostra literalmente. N cumulativo=4; N1/N2/N4 confirmados, N3 parcial; CORR=2 documentais. Relato terminal integral em `captures/s6-terminal-rejected.txt`. Este WP encerra suas duas rodadas sem fechamento. O residual segue no [WP sucessor](../chat-source-literal-2026-10-05/README.md), sem terceira rodada ou aprovação retroativa.

As evidências locais desta etapa continuam válidas para os respectivos bytes: 133 arquivos/1868 testes, build/bundle e sete pares de mensagens/doze chamadas liquidadas. Não provam o claim rejeitado. Não há CI do patch, commit, push, promoção de main, deployment ou validação de produção. DBT-93 e DBT-94 continuam ABERTAS para fechamento formal.

## 2. Mudança e identidade

O fluxo final valida a fonte dos números antes de exibir e persistir a resposta. A fonte pode ser uma mensagem do usuário ou um campo financeiro registrado em uma ferramenta bem-sucedida. Exemplos do sistema, respostas anteriores do próprio assistente, quantidades e ferramentas recusadas não dão crédito. Valor sem fonte gera orientação segura, conservando a liquidação do consumo realizado.

A leitura do negrito foi extraída para um parser puro que corresponde ao renderer do assistente. O S6 terminal rejeitou sua aplicação às fontes user, pois essas mensagens são exibidas literalmente e fragmentos pareados ainda fabricavam números. A correção completa dessa distinção fica no WP sucessor. A validação distingue moeda de percentual, preserva o sinal e reconhece R$, BRL, real/reais e por cento. Não executa matemática financeira nem autoriza mutações.

HEAD base `cafde4e8689a97bd6983490f965ca14f377c2e38`, branch `develop`. Os fingerprints dos cinco arquivos de implementação/teste estão em `captures/source-fingerprints-before-gate.txt`. O conjunto próprio inclui também SPEC, este README, capturas, AGENTS, DBT-93, acréscimos ao journal e os dois arquivos da matriz regenerados. O WIP anterior de C29 e local-ci permanece em custódia.

## 3. Evidência executada

| Fase                    | Resultado                                                                                      | Captura                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Baseline                | Runtime e chave presentes; fixture isolada; branch e WIP enumerados                            | `captures/baseline.json`                                                                          |
| QA inicial              | 3 respostas reais, cadastro e falha de proveniência                                            | `playwright-mcp-chat/turns-before-fix.json`, `03-before-fix.png`                                  |
| Leitura do banco        | 7 tools succeeded, 8 usage settled/known; MEI confirmado em leitura complementar               | `captures/db-readback-in-progress.json`, `product-complete-readback.json`                         |
| RED                     | 3 falhas nomeadas + 1 positivo nos bytes do pai, hash comparado ao HEAD                        | `captures/red-grounding.txt`                                                                      |
| GREEN inicial           | 4 testes centrais; bateria de chat com 100 testes                                              | `captures/green-grounding.txt`, `green-focused.txt`                                               |
| Gate r1                 | Deslocamento de dois sites de linha; matriz regenerada, sem alterar invariantes                | `captures/full-check-matrix-drift.txt`                                                            |
| Gate r2                 | 1833 PASS, 5 falhas; registro separado por causa                                               | `captures/full-check-r2.txt`                                                                      |
| Regressões de S6 e gate | 159 PASS, 0 skips: fonte/sinal/markup, renderer/XSS, INV-013, registry, métricas               | `captures/green-s6-regressions.txt`                                                               |
| Gate completo final     | exit 0, 133 arquivos / 1859 testes PASS, build e bundle PASS                                   | `captures/full-check-r3.txt`                                                                      |
| Chrome atualizado       | 2 turnos PASS; reload preservou resposta; compositor e envio reabertos; console sem warn/error | `playwright-mcp-chat/turns-complete.json`, `06-final-chat.png`, `captures/db-readback-final.json` |

O custo de USD 0,0239 do primeiro trecho é a estimativa configurada do ledger, não uma fatura do provedor. O total final de dez chamadas conhecidas/liquidadas foi USD 0,0304 estimados. Tokens e liquidação foram medidos por chamada. O evento real de bloqueio, uma ocorrência, está em `captures/runtime-events-safe.json`; readiness do runtime atualizado retornou 200 em `captures/runtime-refreshed.json`. Os tempos até observar respostas na UI não são latência precisa do provedor.

Gate completo r4 do reparo N4: exit 0 / 133 arquivos / 1868 testes PASS, sem skips, build e bundle em `captures/full-check-r4.txt`. A fonte da rodada RED N4 tinha SHA256 `932f1430926a5d2bb9834fb9e2e4c896c6c7a3c4dc79f50b8179789f06fb2485`, igual ao hash observado pelo revisor antes do reparo. Fingerprints finais em `captures/source-fingerprints-final.txt`.

Reteste do build final N4: solicitação de valor inválido recebeu resposta segura e o resumo seguinte preservou 4/6/30 e MEI; compositor habilitado. Sete pares de mensagens e doze usage IDs liquidados/known, custo estimado total USD 0,0369. Evidências: `playwright-mcp-chat/turns-final-build.json`, `07-final-build.png`, `captures/runtime-final-build.json`, `runtime-events-final-build.json`, `db-readback-final-build.json`. As capturas r3 são preservadas como etapa anterior, com dez chamadas/5 pares.

## 4. Riscos e limites

A checagem mede proveniência numérica no recorte de mensagens que o fluxo já carrega, não a correção semântica de cada frase nem a associação contextual de todos os valores a um produto. Valores por extenso e outros formatos financeiros fora das notações testadas não são uma garantia desta checagem. O banco mantém o produto em status draft, com a conversa completed; cadastro conversacional concluído não é garantia de completude financeira. Campo financeiro novo precisa ser registrado; chave ausente, novo provider ou ambiente publicado continuam exigindo verificação própria.

DBT-90/91/92 são dívidas independentes. Neste cenário houve um create_product, set_yield válido e regime MEI persistido; isso não fecha os cenários antigos. A captura `05-restore-before-paint.png` registra um quadro inicial vazio após reload e não é usada como aprovação visual. O estado visível foi reinspecionado e a captura `06-final-chat.png` mostra o histórico/restauração e a resposta final. O container e o histórico foram emprestados da bancada existente e preservados, sem limpeza destrutiva.

## 5. Auto-verificação e checklist antes da revisão final

KPI de prevenção dos novos limites encontrados pelo S6: **0/4** capturados pelo autor antes da revisão. O autor reproduziu o defeito original e encontrou as falhas do gate, mas esses fatos não são contados como prevenção dos quatro achados S6. Densidade desta revisão inicial: N=3, CORR=0. Três reparos foram confirmados; N3 permanece parcial no parecer terminal. O KPI não aumenta retroativamente.

| #   | Item                      | Demonstração                                                                                                                                                                    |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo         | RED executou fluxo do pai e comparou seu SHA256; três sintomas falharam, positivo passou.                                                                                       |
| 2   | Duas direções             | Pares de mudança de centavos/percentual e sinal positivo/negativo; fonte legítima passa e alteração reprova.                                                                    |
| 3   | Identidade                | Testes nomeiam cenário e confrontam a resposta persistida; readback usa UUID específico do produto e conversa.                                                                  |
| 4   | Sintoma, não só exit      | Testes exigem ausência da soma indevida, resposta segura persistida e settle único; banco exige valores e estados.                                                              |
| 5   | Marcador observável       | Chrome espera mensagem/compositor via locators, sem sleeps fixos para afirmar prontidão.                                                                                        |
| 6   | Identidade não degenerada | UUID real do produto; respostas diferentes e valores 4/6/30 comparados; não basta uma lista vazia.                                                                              |
| 7   | Estado compartilhado      | Readback em BEGIN READ ONLY qualifica par de URLs loopback 41922 e encontra uma sentinela exata.                                                                                |
| 8   | Sentinela por cenário     | Produto real 01e3b94a-91f4-42f8-9ddb-651f370d1187; unitários isolam fonte e observam persistência/ledger.                                                                       |
| 9   | Revisão                   | Baseline HEAD, hash RED e fingerprints antes do gate; revisão final confere bytes atuais.                                                                                       |
| 10  | Descoberta                | MANIFEST gerado e conferido pela descoberta não vazia de todos os arquivos do pacote, sem manifest auto-incluído; auditManifest rejeita divergência e descoberta vazia.         |
| 11  | S6 limpo                  | Revisor inicial iniciado com fork_turns=none; pareceres REJECTED inicial e terminal preservados; residual encaminhado ao WP sucessor.                                           |
| 12  | Fail-closed               | REJECTED para a fonte user fragmentada de N3. Demais fronteiras testadas passam; JSON inválido não concede valor e emite evento sem payload.                                    |
| 13  | Isolamento                | DB 41922 e runtime 4174 assertados; 5432/4173 intocados. Nenhum recurso novo de DB foi criado; emprestado preservado. Credenciais do provedor ausentes no gate de testes/build. |
| 14  | Captura de gates          | Logs RED/GREEN/r1/r2/final e registros browser/DB, incluindo falhas; sem selo apontando run inexistente.                                                                        |
| 15  | CI por revisão            | NÃO VERIFICADO: patch local não publicado, sem run aplicável ao patch. Não há selo de land/release nem fechamento formal atribuído a CI.                                        |
| 16  | Sites                     | `captures/financial-output-sites.txt` enumera saída final, persistência e projeção compartilhada; campos novos sem registro não fornecem crédito.                               |
| 17  | Ambiente                  | Scripts de gate/readback assertam branch, HEAD e DB; provider overrides removidos. Worktree deliberadamente dirty, enumerado; isso impede alegar selo formal de árvore limpa.   |

## 6. S6 ADVERSARIAL

Rodada 1: REJECTED; N=3, CORR=0. Registro recebido em `captures/s6-r1-record.txt`. O parecer rejeitado não é apresentado como aprovação.

Terminal: REJECTED, N cumulativo=4/CORR=2 documentais. N1, N2 e N4 confirmados; N3 parcial. O relatório integral nomeia a contraprova de fonte user literal em helper e fluxo, o ledger preservado e a qualificação local das demais evidências. As duas rodadas ficam encerradas neste estado; reparo residual no WP sucessor.

## 7. Correções forçadas e rollback

N1: capturar sinal antes/depois da moeda, mantendo o sinal do campo financeiro da ferramenta. N2: cobrir BRL, singular real e por cento em fonte e candidato. N3: compartilhar o parser que reconhece somente negrito pareado, preservando caracteres literais. Os seis controles de integração de S6 exigem que a versão rejeitada não alcance a mensagem persistida. N4: aplicar a projeção compartilhada também ao check de não-finito. RED adicional: 7 falhas nomeadas / 51 positivos; GREEN de regressões: 168 PASS. Segunda rodada de correção, sem supressão de achado. N confirmados corrigidos=3; N3 parcial. CORR=2 documentais, sem neutralizar o residual. A auto-inclusão transitória do manifesto foi removida; o audit relê os arquivos após escrita e valida também por sha256sum.

As falhas do gate r2 foram corrigidas sem alterar testes: DBT-93 anexada dentro da tabela; parsing inválido registrado sem payload; harness remove overrides de provedor em vez de strings vazias. Nenhum guard, orçamento, teste ou regra foi removido.

Rollback limitado aos arquivos próprios; preservar WIP e histórico existentes. Artefato anterior do servidor está em `/tmp/pqdl-chat-qa-20261005/output-before`. Sem migration ou alteração de dados de produção.
