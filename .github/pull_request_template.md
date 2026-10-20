## Resumo

<!-- O que muda e por quê — a causa-raiz, não o sintoma. -->

## Checklist geral

- [ ] `npm run check` verde antes do push.
- [ ] Nenhum teste, regra de lint ou orçamento foi afrouxado, pulado ou removido.

## Controles destrutivos e honestidade de UI

> Obrigatório se o PR toca controles que mudam dados. Contrato completo: `docs/adr/ADR-046-semantica-de-remocao-e-paridade-manual-ia.md` §3.

- [ ] Recipiente visível persistente — o controle não depende de `:hover` (inexistente em touch).
- [ ] O verbo da UI é o verbo do servidor: "Arquivar" para soft delete, "Excluir" para hard delete.
- [ ] `aria-label` nomeia o alvo (ex.: `Arquivar <nome>`) e o controle é operável por teclado.
- [ ] `variant="destructive"` somente quando a ação é irreversível.
- [ ] `AlertDialog` na composição canônica: `AlertDialogCancel` antes de `AlertDialogAction`; título e descrição declaram a consequência real.

## Evidência

<!-- Ponteiros (capturas seladas, runs, recibos) — nunca cole conteúdo longo. -->
