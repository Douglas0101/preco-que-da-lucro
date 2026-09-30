# Error budget — janela `7d`

**DRAFT / NÃO-RATIFICADO** — tolerâncias candidatas; nada de rótulo CONTROLADO antes do
baseline M-06/Q-020. Política: `docs/specs/M-06/error-budget.md`; taxonomia: ADR-022.

- Gerado em: 2026-09-14T03:38:07.480Z
- Fonte: `src/test/fixtures/error-budget/basic-7d.jsonl`
- Janela: `7d` → 2026-09-06T11:59:00.000Z → 2026-09-13T11:59:00.000Z
- Linhas: 19 (parseadas: 19 · ignoradas: 0)
- Requests na janela: 11 (mínimo 100) · chat: 3 · falhas: 7 · saudáveis: 3
- Baseline M-06: não declarado
- **Veredito: FAIL** (exit 1)

## Classes

| Classe                                                                           | Base                   | Consumo | Tolerância                                 | Veredito  |
| -------------------------------------------------------------------------------- | ---------------------- | ------- | ------------------------------------------ | --------- |
| Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário) | sinais de métrica: 2   | 0       | 0 (zero estrutural)                        | OK        |
| IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)     | requisições de chat: 3 | 2       | candidata 1% em 7d (não ratificada)        | DRAFT     |
| Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)            | requests totais: 11    | 4       | 0 (zero estrutural, revisível no baseline) | EXHAUSTED |

## Consumo por código

| Classe   | Código           | N   |
| -------- | ---------------- | --- |
| IA       | AI_TIMEOUT       | 1   |
| IA       | DEPENDENCY_ERROR | 1   |
| servidor | DATABASE_ERROR   | 1   |
| servidor | DEPENDENCY_ERROR | 1   |
| servidor | HTTP_5XX         | 1   |
| servidor | INTERNAL_ERROR   | 1   |

## Excluídos do budget (não consomem)

| Código           | N   |
| ---------------- | --- |
| AI_QUOTA         | 1   |
| HTTP_4XX         | 1   |
| VALIDATION_ERROR | 1   |

## Monitorados (não consomem)

| Sinal                      | N   |
| -------------------------- | --- |
| FINANCIAL_STATE_INCOMPLETE | 1   |
| AI_TIMEOUT_METRIC          | 1   |

## Detalhe por classe

- **Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário)** — 0 estado(s) `invalid` em 2 sinal(is) de métrica
- **IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)** — 2 falha(s) de envelope · métrica `app.ai.timeouts` = 1 (consumo = max)
- **Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)** — 4 falha(s) de servidor/dependência

## Notas

- Tolerância de IA transitória (1% em 7d) é candidata: ratificação só em Q-020 com baseline M-06; nenhum rótulo CONTROLADO antes disso.
- Consumo de IA usa o máximo entre falhas de envelope e `app.ai.timeouts` para não subcontabilizar abortos.

## Referências

- Política: `docs/specs/M-06/error-budget.md`
- Taxonomia de erros: `docs/adr/ADR-022-error-taxonomy-observability.md`
- Degradação graciosa (IA indisponível): Plano Mestre §31
- Apuração/escalonamento: `docs/runbooks/slo-error-budget.md`
