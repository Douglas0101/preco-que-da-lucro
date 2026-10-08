# Fonte literal do usuário no chat — sucessor do QA

## Fato-fonte

Parecer terminal do S6 do pacote `../chat-qa-2026-10-05`: REJECTED, N3 residual P2. A tela em `src/routes/_authenticated/novo-produto.tsx:242` apresenta `user` como texto literal; o helper projetava Markdown também nessa fonte. Fonte `Custo informado R$ 1**0**,00.` autorizou `Custo R$ 10,00.`; `Margem informada 3**0**%.` autorizou `Margem 30%.`, inclusive no retorno e no append de assistant.

## Problema

O parser remove negrito pareado e junta dígitos que continuam separados por asteriscos na mensagem exibida do usuário. N3 não foi integralmente corrigido nas duas rodadas do WP original; o parecer rejeitado é preservado, sem aprovação retroativa.

## Contrato

Fontes `user` são lidas literalmente; candidatos `assistant` recebem a projeção do renderer compartilhado. Os três fragmentos registrados não autorizam 10 ou 30. Fontes contíguas legítimas, inclusive `**R$ 4,00**`, continuam autorizando o numeral contíguo 4, e respostas com negrito continuam válidas. Token monetário malformado também não concede seu prefixo 1; fragmento percentual 3**0% não concede seu sufixo 0. Marcadores literais entre dígitos são consumidos como parte inválida do token, sem removê-los ou ampliar normalização de pontuação. Bloqueio deve ocorrer antes do retorno e append, mantendo settle único. O escopo é proveniência numérica nas notações registradas no WP original, sem promessa de validação semântica ou autorização de mutação.

## Mudanças

Write-set de aplicação fechado: `src/lib/ai/financial-output-grounding.ts` e `src/test/chat-financial-grounding.test.ts`. Documentação: este pacote, status/parecer terminal do pacote original, contrato de papel em AGENTS.md e append-only PROGRESS.md. Nenhuma alteração de renderer, FSM, ferramentas, modelo, configuração de chave, schema ou migration.

## DoD

RED reproduz três fragmentos no helper e fluxo nos bytes pré-reparo; GREEN bloqueia todos e mantém positivos. `npm run check` completo com fixture qualificada e sem provider keys deve passar. Build atualizado em 4174, reteste Chrome com provedor real, readback READ ONLY do produto e ledger, fingerprints e manifesto estrito. S6 de contexto limpo sem REJECTED para o contrato local. CI, publicação e fechamento formal das dívidas não são alegados.

## Testes

`npx vitest run src/test/chat-financial-grounding.test.ts src/test/chat-markdown.test.tsx`: negativos para `1**0**`, `**R$ 1**0` e `3**0**%`; positivos contíguos 4 e 30 com bold no candidato. Integração exige retorno seguro, append idêntico e settle único. RED fixa hash do helper pré-reparo; GREEN e gate fixam os bytes reparados. No Chrome, mensagem de QA pede repetição de valor fragmentado sem ferramenta; depois exige resumo dos dados reais e restauração após reload. Persistência/readback deve manter único produto 01e3b94a-91f4-42f8-9ddb-651f370d1187, sete ferramentas e acrescentar somente os turnos/calls medidos.

## Riscos

O modelo pode recusar espontaneamente o pedido fragmentado; nesse caso o turno real prova continuidade, e o negativo determinístico do fluxo prova a concessão bloqueada. Recorte do histórico, gramática registrada e limites semânticos permanecem. O WIP inicial e fixture emprestada devem ser preservados. Qualidade usa URLs loopback 41922; não toca 5432, produção ou a bancada 4173. A chave existente é herdada privadamente apenas para o servidor; `DeepSeek-API.txt` não é lido.

## Rollback

Reverter somente o delta sucessor nos dois arquivos de aplicação, conservando o restante do patch original e seu parecer. O artefato anterior ao QA continua em `/tmp/pqdl-chat-qa-20261005/output-before`; nenhuma limpeza de banco ou histórico.
