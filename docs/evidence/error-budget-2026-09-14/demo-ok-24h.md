# Error budget — janela `24h`

**DRAFT / NÃO-RATIFICADO** — tolerâncias candidatas; nada de rótulo CONTROLADO antes do
baseline M-06/Q-020. Política: `docs/specs/M-06/error-budget.md`; taxonomia: ADR-022.

- Gerado em: 2026-09-14T03:38:09.527Z
- Fonte: `docs/evidence/error-budget-2026-09-14/demo-ok-24h.jsonl`
- Janela: `24h` → 2026-09-13T00:01:00.000Z → 2026-09-14T00:01:00.000Z
- Linhas: 301 (parseadas: 301 · ignoradas: 0)
- Requests na janela: 101 (mínimo 100) · chat: 101 · falhas: 1 · saudáveis: 100
- Baseline M-06: `demo-sintetico-nao-ratificado`
- **Veredito: OK** (exit 0)

## Classes

| Classe                                                                           | Base                     | Consumo | Tolerância                                 | Veredito |
| -------------------------------------------------------------------------------- | ------------------------ | ------- | ------------------------------------------ | -------- |
| Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário) | sinais de métrica: 100   | 0       | 0 (zero estrutural)                        | OK       |
| IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)     | requisições de chat: 101 | 1       | 1% de 101 = 1,01                           | OK       |
| Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)            | requests totais: 101     | 0       | 0 (zero estrutural, revisível no baseline) | OK       |

## Consumo por código

| Classe | Código     | N   |
| ------ | ---------- | --- |
| IA     | AI_TIMEOUT | 1   |

## Excluídos do budget (não consomem)

Nenhum evento excluído na janela.

## Monitorados (não consomem)

| Sinal                      | N   |
| -------------------------- | --- |
| FINANCIAL_STATE_INCOMPLETE | 0   |
| AI_TIMEOUT_METRIC          | 0   |

## Detalhe por classe

- **Financeiro crítico (`app.financial.states{state=invalid}` em caminho do usuário)** — 0 estado(s) `invalid` em 100 sinal(is) de métrica
- **IA transitória (`AI_TIMEOUT`/`DEPENDENCY_ERROR` de chat + `app.ai.timeouts`)** — 1 falha(s) de envelope · métrica `app.ai.timeouts` = 0 (consumo = max)
- **Falha de servidor/dependência (`DATABASE_ERROR`/`INTERNAL_ERROR`/5xx)** — 0 falha(s) de servidor/dependência

## Notas

## Referências

- Política: `docs/specs/M-06/error-budget.md`
- Taxonomia de erros: `docs/adr/ADR-022-error-taxonomy-observability.md`
- Degradação graciosa (IA indisponível): Plano Mestre §31
- Apuração/escalonamento: `docs/runbooks/slo-error-budget.md`
