# C29 — Correções DBT-86 a DBT-89

## Fato-fonte

QA local de e3a5507 em `docs/evidence/qa-visual-2026-10-04-e3a5507/README.md` e
condições de fechamento DBT-86/87/88/89 no registry. Continuação autorizada pelo
usuário: F0/F1/F2 concluídas; completar F3 e integrar F4 em develop.

## Problema

Transições de sessão cacheiam envelopes de erro como sucesso; seletores mostram
UUID; dashboard mantém margem fixa; grades extrapolam a largura disponível.
F3 adicional: contribuição calculada com preço de catálogo diverge de venda real.

## Contrato

Resumo válido ou recuperação controlada; nome visível e UUID no wire; margem
sobre receita real com custos/taxas atuais, ou indisponibilidade verdadeira;
scrollWidth <= clientWidth sem ocultar conteúdo essencial.

## Mudanças

A continuação usa a bancada existente em 55f3ddf. Write-set fechado (inclui
alterações já pendentes das fases anteriores e os controles desta retomada):

- `AGENTS.md`
- `docs/adr/ADR-041-dashboard-consolidated-margin.md`
- `docs/evidence/agent-state/DEBTS.md`
- `docs/evidence/agent-state/PROGRESS.md`
- `docs/evidence/ciclo-29/`
- `docs/evidence/qa-visual-2026-10-04-e3a5507/`
- `docs/specs/M-02/matrix.generated.yaml`
- `docs/specs/M-02/matrix.yaml`
- `e2e/sales-dashboard.spec.ts`
- `package.json`
- `scripts/db/test-dashboard-margin.ts`
- `scripts/qa/bench-lib.mjs`
- `scripts/qa/consolidated-margin-gate.mjs`
- `scripts/qa/geometry-gate.mjs`
- `scripts/qa/long-name-fixture.mjs`
- `scripts/qa/product-select-gate.mjs`
- `scripts/qa/repro-dbt86.mjs`
- `src/components/ui/select.tsx`
- `src/lib/dashboard-summary-guard.ts`
- `src/lib/dashboard.functions.ts`
- `src/routes/_authenticated/diagnostico.tsx`
- `src/routes/_authenticated/inicio.tsx`
- `src/routes/_authenticated/ponto-equilibrio.tsx`
- `src/routes/_authenticated/simulacoes.tsx`
- `src/routes/_authenticated/vendas.tsx`
- `src/server/repositories/sales.repository.ts`
- `src/server/services/dashboard.service.ts`
- `src/server/services/sales.service.ts`
- `src/test/calc-explainer.test.tsx`
- `src/test/dashboard-consolidated-margin.db.test.ts`
- `src/test/dashboard-summary-guard.test.ts`
- `src/test/dashboard.service.test.ts`
- `src/test/financial-metrics.test.ts`
- `src/test/observability-spans.test.ts`
- `src/test/sales.service.test.ts`

## DoD

- Check integral verde; nenhum teste, limiar ou orçamento removido.
- PG17 efêmero próprio: cadeia completa db:test/db:check e casos nomeados sem skips.
- Validação local 3.4: ok/empty/incomplete, preço real, contribuição negativa,
  períodos e escopo por identidade; recuperação no erro de resumo.
- Matriz E2E com quatro projetos; precondição local ausente é declarada e exige CI.
- Registry, lockfile e matriz sincronizados; npm ci no checkout principal.
- Commit normal e push develop; observar CI atual pelo SHA. Main segue bloqueada.

## Testes

Baselines privados F0 red e check verde; F1 55f3ddf e controles de envelope;
F2 seletores 26/26 e geometria 18/18. Nesta sessão, controles independentes
mostraram três falhas no agregado de margem antes da correção, em
31-margin-actual-price-red.log; focused green em 32-margin-actual-price-green.log.
O gate de UI usa estado/requisição observáveis, sem sleep fixo.

## Riscos

Custos e taxas históricos por venda não são armazenados. Descontos líquidos sem
alocação fiscal deixam margem indisponível. ADR041 PROPOSTA, não ratificada.
S6 formal de contexto limpo permanece pendente; este pacote não promove placar
ou release. Evidência histórica não substitui check atual; fontes privadas
não entram no repositório sem sanitização. Não há migração de banco neste lote.

## Rollback

Reverter commits novos por git revert em develop após avaliação dos consumidores.
Preservar 55f3ddf e WIP/custódia; nunca reset/clean/force push. Fixtures novas
ficam apenas em PG17 próprio e podem ser descartadas por identidade do recurso.
