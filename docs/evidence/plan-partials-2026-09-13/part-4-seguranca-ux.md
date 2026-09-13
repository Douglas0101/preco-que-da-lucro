# PART-4 — Segurança de produção, rate limits, UX financeira e baseline F0-04

**Fonte:** auditoria read-only de 2026-09-13 sobre `develop @ 83efb16`; Plano Mestre §§5, 18, 20.
**Fato transversal:** `.gitignore` ignora `*.log` (linha 3), `.artifacts/` (49), `docs/evidence/**/artifacts/` (104),
`logs/` (105) e `raw/` (107) → evidência nova grava `.jsonl/.json/.txt` diretamente no diretório da evidência.

## F0-04 — Baseline de performance re-derivável (primeiro)

- Problema: números dev-evidence com log-fonte em `/tmp` perdido; AI latency sem nenhuma medição; CWV só "after".
- Ações: `scripts/perf/capture-baseline.mjs` (local-only; preview Nitro `node-server` + Docker PG17; circuito
  dashboard/produtos/break-even/simulação/diagnóstico/chat com provider mock) e `scripts/perf/summarize.mjs`
  (p50/p95/n por rota, RT-count, AI latency, bundle, LCP/CLS/TTFB).
- `src/lib/chat.functions.ts:191-218`: adicionar `logJson("info","ai.model_attempt",{model,attempt,durationMs,outcome})`
  ao lado de `aiDuration.record` para métrica re-derivável sem OTLP.
- Raw versionado em `docs/evidence/perf-controlled-<data>/` + `report.md` com os 8 itens de §5 e rótulo CONTROLADO
  (mock/local ≠ produção; M-06/Q-020 não consumido). Atualizar a seção F0-04 do ledger.

## 20.1 — CSP enforcement

- Hoje: sempre `content-security-policy-report-only`; enforce só com `CSP_ENFORCE=true` (`security-headers.ts:17-26`);
  sem endpoint de coleta; e2e trava o header report-only (`e2e/ui-stack.spec.ts:58`).
- Ações: `src/routes/api/csp-report.ts` (padrão de `vitals.ts`, payload cap + `logJson("warn","csp.violation")`, 204)
  - `report-uri`/Reporting-Endpoints em `security-headers.ts`; validar no **preview Vercel** com `CSP_ENFORCE=true`
    (e2e/ui-stack + sales-dashboard contra `PLAYWRIGHT_BASE_URL`), ajustar o assert do e2e; produção depois, com rollback por env.
- Gates: 3 execuções soak report-only sem violação → enforce no preview (zero `securitypolicyviolation`) → produção.
- Nonce: **não** (CSP estática; nonce exigiria threading por SSR sem driver concreto). Evidência
  `docs/evidence/csp-enforcement-<data>/{report.md,csp-violations.jsonl,headers.txt}`; H-2 opcional (sem token, dono altera no painel e registra).

## 20.5 — Rate limits (chat/tool/exports)

- Auth já tem buckets atômicos em DB (`rate-limit-rules.server.ts:3-12`). Chat tem contagem **com corrida**
  (`chat-execution.server.ts:101-113` + env `AI_CHAT_LIMIT_PER_10_MINUTES` default 20/10min, ADR-021 arquivado:19;
  SDD:2052 diz 10/min — corrigir a divergência). Tool-heavy não tem bucket; exports **não existe**.
- Ações: extrair `consumeInTransaction` em `rate-limit-storage.server.ts:52-101`; regra CHAT `{600s, 20}` chave `chat|<userId>`,
  TOOL `{600s, 40}` chave `tool|<userId>`; aplicar no `reserveChatAndLoadHistory` e no `runRegisteredTool` (após Zod+AuthZ,
  antes do claim de idempotência) → `RATE_LIMIT` (429); exports documentados como N/A com condição de reabertura.
- Testes: unit das regras + burst distribuído no padrão `test-auth-integration.ts:134-163`; evidência `docs/evidence/rate-limits-<data>/`.

## 18.1 — Estado `estimated`

- `forecast` existe no engine (`finance.ts:473,649-665`) e no CHECK, mas a UI fixa `manual_simulation`
  (`simulacoes.tsx:97-113,325-331,405`) e a persistência rejeita forecast (`simulation.service.ts:43-45`).
- Ações v1 (S): seletor `manual_simulation` × `forecast` no card; badge `SIMULAÇÃO` vs `ESTIMATIVA` + origem do volume;
  salvar desabilitado para forecast com nota. v2 (produto): persistir/historicizar forecast (fora do escopo imediato).
- Testes: unit de `buildSimulationInput` + e2e de toggle acessível.

## 18.3 — Explain calculation

- `CalcExplainer` existe e cobre diagnóstico + break-even (`diagnostico.tsx:296-364`, `ponto-equilibrio.tsx:292-306`).
- Ações: slot `explain` no `MetricCard` (`inicio.tsx:243-275`) para os 4 KPIs + melhor margem, e um explainer no
  resultado da simulação (`simulacoes.tsx:399-417`) com fórmulas de `finance.ts:316-357,690-712` e origem do volume.
- Testes: `src/test/calc-explainer.test.tsx` (teclado, foco, axe) + e2e autenticado.

## 18.5 — Skeleton

- Faltam exatamente 4 rotas: `inicio.tsx:42,76`, `produtos.tsx:163`, `ponto-equilibrio.tsx:44,89`, `diagnostico.tsx:189,510`
  (padrão já usado em `simulacoes.tsx:502-538`).
- Ações: skeletons com a geometria real; manter anúncio a11y (`role="status"` + `sr-only` "Carregando…");
  medir CLS/LCP/TTFB no harness do F0-04 (`docs/evidence/ux-financeira-<data>/cls-<rota>.json`).

## Ordem

`F0-04 → 18.5 → 18.1 → 18.3 → 20.5 → 20.1` (CSP por último; mede e valida no preview).
