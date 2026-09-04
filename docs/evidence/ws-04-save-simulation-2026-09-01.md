# WS-04 — saveSimulation + persistência (2026-09-01)

## Mudanças

- `src/lib/query-options.ts`: `savedSimulationsQueryOptions` (`["simulations","saved"]`, operacional).
- `src/routes/_authenticated/simulacoes.tsx`: campo "Nome da simulação" + botão "Salvar simulação" (habilitado com resultado `ok` e nome), `saveSimulation` BFF com recálculo server-side (INV-009) e snapshot; invalida a listagem; card "Simulações salvas" com badge e versão do motor.

## Verificação

- `vitest` 333/333; `simulation.service.test.ts` adaptado (fake transaction para o snapshot na mesma transação) com os cenários canônicos preservados.
- Build/bundle verdes.

## Notas

- Sem auto-save (decisão de produto do plano §5.4.1). Badge "Simulação" sempre presente nos resultados hipotéticos; nenhum dado de simulação vira KPI factual.
