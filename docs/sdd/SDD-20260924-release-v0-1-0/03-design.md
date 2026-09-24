# 03 — Desenho

## Princípios

1. **Escopo congelado.** O SDD descreve a preparação do RC; não modifica o produto.
2. **Base limpa e rastreável.** Só a worktree isolada sobre `420e47b1…` pode produzir prova do RC. O estado sujo do checkout principal é excluído, não “limpo” por esta tarefa.
3. **Evidência antes de estado.** Fonte e teste apontam para uma hipótese; resultado executado e selado no SHA fecha um estado.
4. **Falha explícita.** Divergência entre artefatos é `blocked`, não sucesso por seleção do relatório mais favorable.
5. **Menor escopo.** Correções futuras, se autorizadas, devem ser mínimas, testadas e limitadas aos P0 e blockers nomeados.

## Superfícies de rota preservadas

O desenho não adiciona, remove, renomeia nem torna visível qualquer rota:

- **Rota oficial futura:** permanece o alvo formal de lançamento. Não é publicada nem habilitada nesta SDD; sua ativação depende de revisão e do run aplicável no SHA de release.
- **Rota offline:** permanece a superfície local usada para verificação reproduzível e isolada, sem alterar a configuração de produção. Uma execução local não é CI oficial nem evidência de publicação.
- **Rota pública/espelho:** permanece inalterada e não é habilitada por este pacote. Qualquer tornar pública, espelhar, expor ou mudar visibilidade exige aprovação explícita e ratificação separada; não é efeito colateral de um push.

A distinção entre essas rotas deve permanecer explícita em qualquer revisão futura, inclusive se a implementação criar aliases ou adaptadores.

## Modelo de estado

- `done`: comportamento coberto por evidência executada e selada no SHA exato; exige resultado, manifesto e relatório concordantes.
- `partial`: existe implementação ou ponteiro, mas falta prova executável/selada ou há lacuna funcional declarada.
- `blocked`: existe impedimento externo, contradicção de registro ou ausência de precondição verificável.
- `removed-from-release`: item explicitamente excluído do RC, sem alteração de código nesta SDD.
- `not-applicable`: requisito comprovadamente fora do produto/escopo, com justificativa nominal.

`23.2` não pode receber `done`: `DBT-09` permanece aberta/alta e não existe runner runtime para drenar o outbox. `DBT-19` permanece aberta mesmo que os guards estejam encadeados, pois sua condição de fechamento ainda exige as asserções ausentes.

## Evidência e selagem

A evidência do RC será `metadata-only`: manifesto, relatório, inventário, selos, apontamentos de comando e hashes; nunca logs crus, bundles, patches, screenshots, valores de ambiente ou credenciais. O SHA exato do conteúdo validado deve aparecer no manifesto e no relatório. O verificador final deve exigir `result.txt`, `manifest.result` e `REPORT` com o mesmo veredicto e executar `sha256sum -c` em clone limpo, fora da árvore suja.

## Não decisões

Não se escolhe preço, visibility, publicação, cobrança, migração, proveedor, política de retry, fechamento de dívida ou promoção de placar neste SDD. Tais decisões exigem seu próprio despacho/ADR e, quando aplicável, aprovação humana.
