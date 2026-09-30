# Error budget — janela `7d`

**DRAFT / NÃO-RATIFICADO** — tolerâncias candidatas; nada de rótulo CONTROLADO antes do
baseline M-06/Q-020. Política: `docs/specs/M-06/error-budget.md`; taxonomia: ADR-022.

- Gerado em: 2026-09-14T03:38:08.094Z
- Fonte: `src/test/fixtures/error-budget/financial-invalid.jsonl`
- Janela: `7d` → 2026-09-06T12:00:00.000Z → 2026-09-13T12:00:00.000Z
- Linhas: 4 (parseadas: 4 · ignoradas: 0)
- Requests na janela: 3 (mínimo 100) · chat: 0 · falhas: 1 · saudáveis: 2
- Baseline M-06: não declarado
- **Veredito: FAIL** (exit 1)

## Classes

| Classe                                                                           | Base                   | Consumo | Tolerância                                 | Veredito  |
| -------------------------------------------------------------------------------- | ---------------------- | ------- | ------------------------------------------ | --------- |
| Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário) | sinais de métrica: 1   | 1       | 0 (zero estrutural)                        | EXHAUSTED |
| IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)     | requisições de chat: 0 | 0       | candidata 1% em 7d (não ratificada)        | UNKNOWN   |
| Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)            | requests totais: 3     | 1       | 0 (zero estrutural, revisível no baseline) | EXHAUSTED |

## Consumo por código

| Classe     | Código                  | N   |
| ---------- | ----------------------- | --- |
| financeiro | FINANCIAL_STATE_INVALID | 1   |
| servidor   | INTERNAL_ERROR          | 1   |

## Excluídos do budget (não consomem)

Nenhum evento excluído na janela.

## Monitorados (não consomem)

| Sinal                      | N   |
| -------------------------- | --- |
| FINANCIAL_STATE_INCOMPLETE | 0   |
| AI_TIMEOUT_METRIC          | 0   |

## Detalhe por classe

- **Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário)** — 1 estado(s) `invalid` em 1 sinal(is) de métrica
- **IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)** — sem requisições de chat na janela
- **Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)** — 1 falha(s) de servidor/dependência

## Notas

- Tolerância de IA transitória (1% em 7d) é candidata: ratificação só em Q-020 com baseline M-06; nenhum rótulo CONTROLADO antes disso.

## Referências

- Política: `docs/specs/M-06/error-budget.md`
- Taxonomia de erros: `docs/adr/ADR-022-error-taxonomy-observability.md`
- Degradação graciosa (IA indisponível): Plano Mestre §31
- Apuração/escalonamento: `docs/runbooks/slo-error-budget.md`
