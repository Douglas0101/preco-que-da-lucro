# Fonte literal do usuário no chat — resultado local

## 1. Resultado e escopo

WP sucessor de escopo único para o residual N3 do [QA original](../chat-qa-2026-10-05/README.md), cujo parecer terminal REJECTED e duas rodadas permanecem preservados. A mensagem do usuário é lida literalmente; somente o candidato assistant recebe a projeção de negrito do renderer. Sem alteração da tela, FSM, ferramentas, modelo ou chave.

RED reproduziu seis falhas nomeadas, com 86 controles positivos aprovados. GREEN passou em cinco arquivos e 177 testes, sem skips. O gate r5 passou em 133 arquivos e 1877 testes, com build e bundle aprovados; seus fingerprints foram preservados em `captures/source-fingerprints-r5.txt`.

O S6 encontrou N1: uma fonte monetária malformada concedia crédito ao prefixo `1`, tanto no retorno quanto na persistência. O segundo reparo deste WP consome os marcadores entre dígitos como um token inválido. RED confirmou seis falhas e 177 controles positivos; GREEN final aprovou 183 testes em cinco arquivos. O `npm run check` final (r6) aprovou 133 arquivos e 1883 testes, sem skips, incluindo build e bundle. Os cinco fingerprints de código permaneceram iguais antes e depois desse gate.

No Chrome, a conversa local terminou com nove pares de mensagens, 14 chamadas reais ao modelo liquidadas com uso conhecido, sete ferramentas e um único produto. Foram preservados os custos informados de 4 e 6, preço de 30, regime MEI e alíquota ausente. O negativo real teve recusa espontânea do modelo, sem valor indevido; o bloqueio do helper é medido pelos testes determinísticos. A revisão S6 foi retomada após a interrupção externa e concluiu com zero rejeições no contrato local, 83 controles e 34 fluxos aprovados. CI, publicação e fechamento formal das dívidas permanecem pendentes.

## 2. Identidade e mudança

Base develop cafde4e8689a97bd6983490f965ca14f377c2e38, WIP anterior preservado. Delta de aplicação deste sucessor somente em `financial-output-grounding.ts` e `chat-financial-grounding.test.ts`. Os cinco fingerprints do conjunto completo de chat estão registrados em `captures/source-fingerprints.txt`; os bytes RED do helper são 6fd7320d69e52bb352f0c17795b281663ed8c50c8f5aac3ca754b466b57bc5cb.

## 3. Evidências

`captures/red-source-literal.txt`: 6 falhas/86 positivos, helper pré-reparo assertado antes e depois. Três fragmentos exercitados no helper e fluxo; três novos controles legítimos mantidos. `captures/green-source-literal.txt`: cinco arquivos/177 testes PASS, sem skips. Hashes reparados em `captures/source-fingerprints.txt`. REDprefix6failed/177PASS nos bytes do helper7616407e99dde71e2db1f737881484a418d98c4fb0a060053e946468476e6310; GREENfinal183PASS/5arquivos, sem skips. Gate final em captures/full-check-r6.txt:133/1883,build/bundlePASS. Reteste em playwright-mcp-chat/turns-final.json e08-final-r6.png; readiness200 em captures/runtime-refreshed.json; produto/ledger em captures/db-readback-final.json. Estimativa configurada USD0.0435 total, não fatura. Recusa real do provedor e zero eventos do guard nesta fase em captures/runtime-events-final.json. Reload restabeleceu o resumo exato e compositor ativo; nenhum novo tool/cadastro.

## 4. Riscos e limites

Proveniência numérica nas notações registradas, sem garantia semântica, de associação a produto ou de autorização de mutação. Modelo real pode recusar espontaneamente o cenário negativo; os testes de fluxo determinísticos medem a concessão do parser. Bancada existente 4174/PG17 41922 e histórico emprestados preservados; ausência de teste publicado/CI é declarada. DBT-93, DBT-94 e DBT-95 continuam ABERTAS. O WP original permanece REJECTED para seus próprios bytes.

## 5. Auto-verificação pré-S6

O residual veio do S6 original; não é um novo achado prevenido pelo autor. N1 do sucessor foi encontrado pelo S6, preservando o KPI de prevenção 0/1. N1 recebeu regressão, reparo e GREEN do autor, seguido de confirmação independente na segunda rodada. Parecer final: N novo=0, CORR=0, N cumulativo=1 corrigido e zero rejeições no contrato local. A interrupção anterior permanece como evento histórico; nenhuma contagem foi alterada retroativamente. Checklist pré-registrado e confrontado pelo revisor:

| #   | Item                 | Demonstração                                                                                                           |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo    | RED exige seis falhas nos bytes pre-reparo identificados por hash.                                                     |
| 2   | Duas direções        | Fonte fragmentada não autoriza10/30; fonte contígua4/30 com resposta bold deve passar.                                 |
| 3   | Identidade           | Cada fonte/candidato nomeado; integração confronta append assistant com conteúdo retornado.                            |
| 4   | Sintoma              | Exige bloqueio, orientação segura e settle único, não apenas exit code.                                                |
| 5   | Marcador             | Chrome aguardou mensagem/compositor via locators; runtime550683readyHTTP200; reload confere igualdade da resposta.     |
| 6   | Valores distintos    | Fragmentos1/0 e3/0 confrontados com10/30; positivos4 e30.                                                              |
| 7   | Estado compartilhado | Readback qualifica ambas URLs loopback41922 e BEGIN READ ONLY.                                                         |
| 8   | Sentinela            | Produto exato01e3b94a-91f4-42f8-9ddb-651f370d1187, fixture e histórico existentes.                                     |
| 9   | Fingerprint          | Hash RED antes/depois; hashes finais dos cinco arquivos antes/depois do gate.                                          |
| 10  | Descoberta           | Manifesto exclui somente raiz; descoberta não vazia, audit de releitura e sha256sum, sem selo de árvore limpa.         |
| 11  | S6 limpo             | Revisor novo fork_turns=none encontrou N1; retomada confirmou o reparo com 0 REJECTED local, 83 controles e 34 fluxos. |
| 12  | Fail-closed          | Fonte literal fragmentada não concede numeral fabricado; candidato segue renderer.                                     |
| 13  | Isolamento           | Bancada4174/41922 assertada;4173/5432 preservadas; qualidade sem provider keys.                                        |
| 14  | Gates capturados     | RED/GREEN/r5/r6/readiness/Chrome/DB capturados, com negativos, sintomas e estados observados.                          |
| 15  | CI                   | NÃO VERIFICADO; patch não publicado, sem selo formal de land/release.                                                  |
| 16  | Sites                | Fonte user literal, candidato Markdown, guard final e append enumerados por rg.                                        |
| 17  | Ambiente             | Branch/HEAD/deps e URLs qualificados; dirty WIP declarado, não árvore limpa.                                           |

## 6. S6 ADVERSARIAL

Concluído para o contrato local, com **0 REJECTED**, após o segundo reparo. Parecer bruto em `captures/s6-final.txt`: 83 controles do helper/renderização e 34 fluxos injetados, cobrindo 17 cenários com uso conhecido e ausente. Retorno e append foram confrontados, com uma chamada ao modelo, uma reserva e uma liquidação em cada fluxo. N novo=0/CORR=0 nesta confirmação; N cumulativo do sucessor=1, corrigido e confirmado. Calibrações separadas em memória reproduziram as concessões ao restaurar cada defeito.

O relato inicial e as quatro contraprovas de N1 estão em `captures/s6-n1-record.txt`. A tentativa interrompida por limite externo permanece em `captures/s6-interrupted.txt` como evento histórico, seguida de retomada sem troca de modelo. O WP original continua terminal REJECTED, N cumulativo=4/CORR=2, para seus próprios bytes. A integridade de 23 entradas citada pelo parecer identifica o pacote anterior à incorporação do relatório; o manifesto atual foi regenerado e auditado por releitura depois da incorporação. CI, land, release, produção e fechamento formal das dívidas não foram verificados.

## 7. Correções e rollback

Primeiro reparo deste WP: selecionar projeção conforme role, sem remover Markdown do usuário. Segundo reparo: consumir marcadores repetidos entre dígitos como token inválido, bloqueando a concessão parcial (N1/DBT-95). Preservar pareceres do original. Rollback limita-se ao delta sucessor nos dois arquivos e preserva configuração/histórico. Nenhum gate afrouxado.
