# Error budget — janela `7d`

**DRAFT / NÃO-RATIFICADO** — tolerâncias candidatas; nada de rótulo CONTROLADO antes do
baseline M-06/Q-020. Política: `docs/specs/M-06/error-budget.md`; taxonomia: ADR-022.

- Gerado em: 2026-09-14T03:38:08.830Z
- Fonte: `src/test/fixtures/error-budget/insufficient.jsonl`
- Janela: `7d` → 2026-09-06T12:00:00.000Z → 2026-09-13T12:00:00.000Z
- Linhas: 2 (parseadas: 2 · ignoradas: 0)
- Requests na janela: 2 (mínimo 100) · chat: 0 · falhas: 0 · saudáveis: 2
- Baseline M-06: não declarado
- **Veredito: INSUFFICIENT** (exit 2)

## Classes

| Classe                                                                           | Base                   | Consumo | Tolerância                                 | Veredito |
| -------------------------------------------------------------------------------- | ---------------------- | ------- | ------------------------------------------ | -------- |
| Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário) | sinais de métrica: 0   | 0       | 0 (zero estrutural)                        | UNKNOWN  |
| IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)     | requisições de chat: 0 | 0       | candidata 1% em 7d (não ratificada)        | UNKNOWN  |
| Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)            | requests totais: 2     | 0       | 0 (zero estrutural, revisível no baseline) | OK       |

## Consumo por código

Nenhum código consumiu budget na janela.

## Excluídos do budget (não consomem)

Nenhum evento excluído na janela.

## Monitorados (não consomem)

| Sinal                      | N   |
| -------------------------- | --- |
| FINANCIAL_STATE_INCOMPLETE | 0   |
| AI_TIMEOUT_METRIC          | 0   |

## Detalhe por classe

- **Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário)** — sem linhas `app.financial.states` no input: counter OTEL-only hoje; exporte a série para JSONL (runbook) — fail-closed
- **IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)** — sem requisições de chat na janela
- **Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)** — 0 falha(s) de servidor/dependência

## Notas

- Sem sinal financeiro: `app.financial.states` é um counter OTEL e só é medido aqui quando a série é exportada para JSONL; sem export a classe permanece UNKNOWN (fail-closed).
- Tolerância de IA transitória (1% em 7d) é candidata: ratificação só em Q-020 com baseline M-06; nenhum rótulo CONTROLADO antes disso.
- fail-closed: N=2 < --min-requests=100; nenhum veredito verde é emitido.

## Referências

- Política: `docs/specs/M-06/error-budget.md`
- Taxonomia de erros: `docs/adr/ADR-022-error-taxonomy-observability.md`
- Degradação graciosa (IA indisponível): Plano Mestre §31
- Apuração/escalonamento: `docs/runbooks/slo-error-budget.md`
