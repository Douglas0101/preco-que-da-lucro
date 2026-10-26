# SPEC — Observabilidade autônoma do OpenCode (SDD)

**Status:** implementado e verificado localmente em 2026-10-22; **não commitado e não publicado**.
**Runtime:** OpenCode `2.1.2`, plugin API `2.1.3`, Node do host `v24.21.0`.
**Escopo:** instrumentar o **runtime do agente OpenCode** (tool calls, sessões, custo/tokens,
MCPs, enforcement e dashboard local). Não instrumenta o servidor do produto
`Preço Que Dá Lucro` — esse já tem OTel próprio em `src/instrumentation/telemetry.ts`.

## Reconciliação V1 → V2 (fonte: docs oficiais e pacote `@opencode/plugin@2.1.3`)

| Prompt original (V1)                         | Contrato V2 usado                                  | Observação                                                                            |
| -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tool.execute.before` / `tool.execute.after` | `ctx.tool.hook("execute.before"/"execute.after")`  | Mesmo ciclo, registrado no `setup` do plugin.                                         |
| `callID`                                     | `event.id` (`Tool.CallID`)                         | O campo V2 não se chama `callID`.                                                     |
| `client.app.log()`                           | JSONL estruturado + `console.error`                | O contexto V2 não expõe `app.log`; o log do servidor recebe o stderr.                 |
| `message.updated`                            | `session.step.ended` + `session.usage.updated`     | O step carrega `assistantMessageID`, `cost` e `tokens`; o usage carrega o acumulado.  |
| `trace_counter` / `trace_span`               | `Counter`/`Histogram` + `startSpan` do OTel JS     | Spans e métricas reais, exportados por OTLP/HTTP e JSONL.                             |
| Plugin npm `opencode-otel`/`tracekit`        | Plugin local em `.opencode/plugins/observability/` | Sem dependência de pacote de terceiros; usa `@opentelemetry/*` já instalados no repo. |

## Requisitos e critérios de aceitação

### R1 — Instrumentação de tool calls

Cada execução de ferramenta (built-in ou MCP) gera um span `opencode.tool.call` com
`tool.name`, `tool.session_id`, `tool.message_id`, `tool.call_id`, `tool.agent`,
`tool.status` (`completed`/`error`/`blocked`) e `tool.duration_ms`.
**Aceitação:** 100% dos spans de tool call têm os cinco identificadores e duração; zero
spans órfãos (`tool.orphan`); o status reflete o desfecho real.

### R2 — Correlação de sessão e mensagem

Os spans de tool call carregam o `session.id` e o `message.id` da chamada; os spans de uso
(`opencode.llm.usage`) carregam `usage.scope` (`step`/`session`) e, quando disponível,
`message.id`.
**Aceitação:** nenhuma tool call sem `session`/`message`; a árvore de spans é ordenável
por sessão; os spans de passo e de sessão são distinguíveis.

### R3 — Métricas de tokens, custo e duração

`session.step.ended` alimenta `opencode.llm.tokens` (por `type`) e
`opencode.llm.cost_usd`; cada tool call alimenta `opencode.tool.calls` e
`opencode.tool.duration` (histograma). O leitor de métricas exporta a cada 10 s e
`forceFlush` no shutdown.
**Aceitação:** a soma das métricas de tokens/custo na janela assentada é **igual** à soma
dos spans `usage.scope=step`; a duração do histograma corresponde às tool calls.

### R4 — Enforcement de segurança

`execute.before` avalia a política pura (`policy.ts`) e lança
`policy_violation:<rule>: <reason>` antes da execução. Regras: `.env` real (leitura,
escrita, descoberta e shell), `rm -rf` em raiz/home/sistema, `mkfs`, `dd` em `/dev/`,
fork bomb, `chmod -R 777 /`, `git push --force`, `git reset --hard` e desligamento do host.
**Aceitação:** 17 casos unitários verdes; bloqueio e2e de leitura de um `.env` canário e de
um comando shell que referencia o canário; span de bloqueio com `error.type=policy_violation`
e `policy.rule`; nenhuma execução maliciosa prossegue. O `rm -rf /` literal é **testado no
matcher, nunca executado**.

### R5 — Resiliência a MCP offline

O plugin assina `mcp.status.changed`, consulta `ctx.mcp.list()` e emite
`opencode.mcp.status` com `mcp.server`, `mcp.status` e, em falha,
`error.type=mcp.connection.failed`. O hook nunca lança por falha de MCP; o fallback é do
próprio OpenCode.
**Aceitação:** um MCP local que sai com código 1 aparece como `failed` no span e no
`opencode mcp list`; o agente continua operando; o servidor é removido depois.

### R6 — Dashboard e alertas

Dashboard local em `:4180` lê `spans.ndjson`/`metrics.ndjson` e expõe `/api/summary` com:
taxa de erro por tool, p95/max de duração, tokens/custo e alertas.
**Aceitação:** alertas disparam para taxa de erro > 5%, duração máxima > 10 s e violações
de política > 0; a página é servida e capturada; nenhum dado sensível aparece.

### R7 — Evidência e closure

Pacote em `docs/evidence/observability/` com SPEC, README, capturas, screenshots e
`MANIFEST.sha256`; verificação fail-closed (`verify-evidence.mts`) e política
(`policy-check.mts`).
**Aceitação:** `verification.json` com `issues: []`; `policy-check.json` com
`failed: 0`; MANIFEST verificado; nenhum commit/push.

## Não-objetivos / limites declarados

- **Não** provisiona Grafana, SigNoz, Jaeger, Tempo, Sentry ou Cloudflare. O collector
  local OTLP/HTTP + dashboard são o backend verificável desta bancada; Sentry/Cloudflare
  exigiriam OAuth/credenciais e não foram testados.
- **Não** compara tokens com o `ai_usage` do Postgres do produto: aquele é o consumo do
  chat do produto; este é o consumo do runtime do agente OpenCode. A fonte de verdade do
  agente é `session.step.ended`/`session.usage.updated`, e a reconciliação é feita contra
  esses spans.
- **Não** executa o comando destrutivo literal; o matcher é testado e o e2e usa canários.
- O runtime do OpenCode roda no host; a evidência é local e não é RUM de produção.
