# Observabilidade autônoma do OpenCode — execução SDD (2026-10-22)

Pacote local da implementação das 7 fases do prompt de observabilidade, executado na
bancada do host. **Nada foi commitado, empurrado ou publicado**; o WIP alheio da árvore foi
preservado.

## Resultado por fase

| Fase                        | Status                  | Resultado medido                                                                                                                                                                                                                          | Evidência                                                                                                                     |
| --------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **0. Pré-condições**        | ✅ com lacuna declarada | OpenCode `2.1.2`, plugin API `2.1.3`; Context7 adicionado e conectado; Sentry/Cloudflare **não provisionados** (sem OAuth/credenciais); sem Grafana/SigNoz — collector + dashboard locais.                                                | `SPEC.md`; `captures/plugin-list.txt`, `captures/mcp-connected.txt`                                                           |
| **1. Tool calls**           | ✅                      | **26** spans `opencode.tool.call`; 0 órfãos; todos com `tool.name/session_id/message_id/call_id/status/duration_ms`; bloqueios com duração 0.                                                                                             | `captures/canonical/spans.ndjson`; `captures/canonical/verification.json`                                                     |
| **2. Sessão/mensagem**      | ✅                      | **28** spans `usage.scope=step` e **28** `usage.scope=session`; tool spans correlacionados por `session.id` + `message.id`; nenhuma tool call sem sessão.                                                                                 | `captures/canonical/spans.ndjson`; `captures/canonical/verification.json`                                                     |
| **3. Tokens/custo/duração** | ✅                      | Reconciliação exata na janela assentada: spans de passo vs métricas — input **611.437**, output **10.050**, reasoning **9.565**, cache_read **15.486.976**, cache_write **0**, custo **0,149945478 USD**; histograma de duração presente. | `captures/canonical/metrics.ndjson`; `captures/canonical/verification.json`                                                   |
| **4. Enforcement**          | ✅                      | **17/17** casos unitários; 2 bloqueios e2e reais (leitura de `.env` canário e shell referenciando o canário) com `error.type=policy_violation` e regra correta; o comando destrutivo literal **não foi executado** (matcher testado).     | `captures/canonical/captures/policy-check.json`; `captures/canonical/spans.ndjson`; `captures/canonical/plugin-events.ndjson` |
| **5. MCP offline**          | ✅                      | MCP local `mock-offline` saiu com código 1; span `opencode.mcp.status` com `failed` + `error.type=mcp.connection.failed`; agente continuou; servidor removido do config global ao fim. Context7 conectado.                                | `captures/mcp-offline.txt`; `captures/canonical/spans.ndjson`                                                                 |
| **6. Dashboard/alertas**    | ✅                      | Dashboard em `:4180`: **26** tool calls, **2** falhas/bloqueios (taxa **7,69%**), p95 **12.009 ms** / max **12.078 ms**, tokens observados e **3 alertas**: `tool_error_rate`, `tool_max_latency_ms`, `policy_violations`.                | `captures/canonical/dashboard-summary.json`; `screenshots/dashboard.png`                                                      |
| **7. Closure**              | ✅                      | `verification.json` com `issues: []`; `policy-check.json` `failed: 0`; MANIFEST selado; nenhum commit/push.                                                                                                                               | este README; `MANIFEST.sha256`                                                                                                |

## Arquitetura

- **Plugin local** `.opencode/plugins/observability/`:
  - `index.ts`: `Plugin.define` + `ctx.tool.hook("execute.before"/"execute.after")` +
    `ctx.event.subscribe` + `ctx.mcp.list()`; o import do SDK OTel é dinâmico para que uma
    falha de telemetria nunca desligue o enforcement.
  - `policy.ts`: avaliador puro de política (`.env`, comandos destrutivos, force-push,
    reset hard, desligamento). Não persiste input.
  - `telemetry.ts`: `BasicTracerProvider` com dois `BatchSpanProcessor` (JSONL in-memory +
    OTLP/HTTP), `MeterProvider` com leitores JSONL + OTLP; spans `opencode.tool.call`,
    `opencode.llm.usage`, `opencode.mcp.status`; métricas de tool/tokens/custo/MCP.
- **Collector** `scripts/observability/collector.mjs` (`:4318`): recebe OTLP/HTTP JSON,
  conta spans/metric points e grava recibos em `otlp-transport.ndjson`; última carga em
  `otlp-last-traces.json`/`otlp-last-metrics.json`.
- **Dashboard** `scripts/observability/dashboard.mjs` (`:4180`): lê os JSONL, expõe
  `/api/summary` e uma página estática; alertas avaliados no processo.
- **Verificadores**: `policy-check.mts` (17 casos) e `verify-evidence.mts` (fail-closed:
  spans, correlação, reconciliação de tokens/custo, MCP, OTLP, boot, política).

## Como reproduzir

```sh
node scripts/observability/collector.mjs      # :4318
node scripts/observability/dashboard.mjs      # :4180
npx tsx scripts/observability/policy-check.mts
npx tsx scripts/observability/verify-evidence.mts
```

O plugin é carregado automaticamente de `.opencode/plugins/`; para forçar recarga após
editar, `touch .opencode/plugins/observability/index.ts` (o watcher do OpenCode recarrega).

## Achados e limites

1. **O prompt usa APIs V1.** O runtime é V2: `tool.execute.before/after` virou
   `ctx.tool.hook("execute.before"/"execute.after")`, `callID` virou `event.id`,
   `client.app.log()` não existe no contexto V2 (JSONL + stderr no lugar) e
   `message.updated` foi substituído por `session.step.ended`/`session.usage.updated`.
   A tabela de reconciliação está em `SPEC.md`.
2. **Sentry/Cloudflare não foram provisionados** (sem OAuth/credenciais). Context7 foi
   adicionado ao config global e consultado por MCP (chamadas reais em
   `captures/context7-*.json`).
3. **O `ai_usage` do Postgres do produto não é a fonte do consumo do agente.** A
   reconciliação é contra `session.step.ended` (fonte de verdade do OpenCode); comparar
   com o chat do produto seria categoria errada.
4. **O primeiro passo após a carga do plugin pode ser acumulado da sessão.** Por isso a
   reconciliação usa a janela assentada (>15 s) e o dashboard mostra tokens observados,
   não uma soma ingênua de amostras.
5. **Boundary de reload:** uma tool call que cruza um reload do plugin não tem
   `tool.duration_ms` (o `before` viveu na instância antiga). O span foi movido para
   `captures/reload-boundary.ndjson` e está fora do veredito; a primeira passagem está em
   `captures/first-pass/`.
6. **Sem Grafana/SigNoz:** o dashboard/alertas local é o backend verificável. Um backend
   externo exigiria provisionamento e credenciais, fora do escopo local.
7. **Nenhum `rm -rf /` literal foi executado.** O matcher foi testado com 17 casos; o e2e
   usou um `.env` canário e um shell que referencia o canário, ambos bloqueados.

## Custódia

- **Snapshot selado:** `captures/canonical/` (spans, métricas, boot, eventos, recibos
  OTLP, `verification.json`, `dashboard-summary.json`). Os arquivos da raiz
  (`spans.ndjson` etc.) continuam sendo o log vivo do plugin e podem crescer; o selo e o
  veredito usam o snapshot congelado.
- Evidência bruta viva: `spans.ndjson`, `metrics.ndjson`, `plugin-boot.ndjson`,
  `plugin-events.ndjson`, `otlp-transport.ndjson`, `otlp-last-*.json`.
- Primeira passagem (antes do ajuste de diretório): `captures/first-pass/`.
- Cópia do diretório antigo (`/home/douglas/docs/evidence/observability`):
  `captures/runtime-home/`.
- `MANIFEST.sha256` cobre este diretório; o WIP alheio da árvore (L980–L983) não foi
  alterado.
- **Nenhum commit, push, deploy, migration ou alvo remoto foi tocado.**
