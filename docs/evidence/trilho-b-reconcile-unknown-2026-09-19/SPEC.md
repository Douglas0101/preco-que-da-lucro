# SPEC — TRILHO B: job de reconciliação de uso desconhecido (`F-D2-reconcile-usage-unknown`)

**WP:** TRILHO B do prompt SDD · **Data:** 2026-09-19 · **Branch:** `mission/b-reconcile-unknown` · **Base:** `f06c6d8`
**Autorização:** humana (_"Aprovar land + seguir ao trilho B"_).
**Âncoras:** `docs/evidence/c3-queue-2026-09-19/SPEC-reconciliation-job.md` (spec aprovada) · §14.6 (OWASP API4) · P0-17 · dívida assumida pelo `INV-006` variante B.

---

## 1. Problema

No caminho desconhecido, `settle` **retém** `tokens_reserved` e grava `outcome='usage_unknown'` com
`real_tokens = NULL` (`src/lib/ai/budget-ledger.server.ts:677`). A escolha erra para o lado seguro, mas
`N` eventos assim consomem o teto diário do tenant **sem consumo real correspondente** e podem bloquear
o tenant com `AI_QUOTA` por um valor que nunca foi gasto. Hoje **nada** trata esses eventos: eles ficam
em `status='settled'` + `outcome='usage_unknown'` indefinidamente, e o predicado do varredor existente
(`sweepOrphansInTransaction`, `status='reserved'`) é **disjunto** — o sweep nunca os alcança.

## 2. Fato-fonte medido (o que muda o desenho)

| fato                                                                                                                                | fonte                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| O gateway é OpenAI-compatível em `/v1/chat/completions`, **sem retrieval por id**                                                   | `src/lib/chat.functions.ts:243`                     |
| `ai_usage` **não guarda payload** — nenhuma coluna com resposta crua ou `usage_json`                                                | `src/db/schema.ts:795-828`                          |
| ⇒ a ação (i) da spec (_"reconciliar junto ao gateway"_) é **estruturalmente impossível**                                            | consequência das duas linhas acima                  |
| ⇒ **100 %** dos eventos terminam na ação (ii) `reconciliation_failed`                                                               | idem                                                |
| `settle` grava `settled_at` **também** no caminho desconhecido                                                                      | `budget-ledger.server.ts` (bloco `applySettlement`) |
| `ai_usage.status` tem CHECK restrito a `('reserved','settled','expired')`; `outcome` **não tem CHECK**                              | `src/db/schema.ts` (`ai_usage_status_check`)        |
| Índice existente: `ai_usage_tenant_status_reserved_idx (tenant_id, status, reserved_at)` — só o prefixo `(tenant_id, status)` serve | `src/db/schema.ts`                                  |

**Consequência de projeto:** o job **não chama o gateway**. Ele marca, de forma persistida e auditável,
que a reconciliação **falhou** — e a liberação da reserva vira **decisão humana, em comando separado**.

## 3. Decisões humanas já registradas (não reabrir)

1. **Reserva retida → NÃO liberar.** O job marca `reconciliation_failed` (persistido + evento estruturado, que é o alarme real; as métricas existem no código mas são inertes — D7, WP `F-otel-provider-order`)
   e **não toca em `ai_daily_budgets.tokens_reserved`**. A liberação é um **comando humano separado**,
   explícito.
2. **Gatilho → script npm + cron documentado**, **sem** rota HTTP nova.

## 4. Contrato

| campo        | valor                                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada      | `ai_usage` com `tenant_id = $1` **and** `status = 'settled'` **and** `outcome = 'usage_unknown'` **and** `settled_at < now() - interval 'X'`, `order by settled_at asc` **limit** `batchSize`                                                                                                                             |
| Isolamento   | **por `tenant_id`**, executado sob a identidade daquele tenant (`transactionManager.run(identity, …)` ⇒ `set_config('app.current_tenant_id', …)`, `src/db/client.server.ts:124-126`). **Nunca** varredura global com filtro na aplicação                                                                                  |
| Idempotência | INV-009: CAS por `usage_id` + `tenant_id` + `status='settled'` + `outcome='usage_unknown'` com `returning`; se `!claimed`, nada acontece. Replay é no-op                                                                                                                                                                  |
| Ação (i)     | **não implementada** — impossível (§2). Não se inventa número.                                                                                                                                                                                                                                                            |
| Ação (ii)    | `outcome = 'reconciliation_failed'` **persistido**. `real_tokens` continua `NULL`. `settled_at`, `status` e **`tokens_reserved` inalterados**                                                                                                                                                                             |
| Auditoria    | evento estruturado `ai.reconciliation_failed` por linha, com `usageId`, `budgetTokens`, `ageMs`; **jamais** apagar o fato de que o uso foi desconhecido                                                                                                                                                                   |
| Métricas     | `app.ai.reconciliation_total` (linhas tratadas) · `app.ai.reconciliation_failed` (linhas em falha) · gauge observável `app.ai.reconciliation_oldest_age_ms` — **declaradas, porém INERTES** (defeito D7: os instrumentos nascem noop no import do módulo). Não montar alerta sobre elas; o alarme é o evento estruturado. |
| Proibições   | não inventar número · não converter desconhecido em zero · não liberar sem trilha · não criar estado novo em `status`                                                                                                                                                                                                     |

## 5. Superfície a tocar

| arquivo                                                 | mudança                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/budget-ledger.server.ts`                    | novo método `reconcileUnknownUsage(tenantId, options)` + tipos, no mesmo `transactionRunner` do `sweepOrphans` |
| `src/instrumentation/telemetry.ts`                      | 2 contadores + 1 gauge observável em `applicationMetrics`                                                      |
| `scripts/db/reconcile-ai-usage.ts` **(novo)**           | CLI do job (enumeração de tenants + execução por tenant + resumo)                                              |
| `scripts/db/release-unknown-reservations.ts` **(novo)** | **comando humano** de liberação, com `--confirm` explícito e dry-run por padrão                                |
| `scripts/db/test-reconcile-ai-usage.ts` **(novo)**      | teste de banco do ciclo completo em PG17 efêmero                                                               |
| `package.json`                                          | scripts `db:reconcile-ai-usage`, `db:release-unknown-reservations`; **cadeia `db:test` 16 → 17**               |
| `AGENTS.md`                                             | contagem de suítes 16 → 17 (mesmo commit)                                                                      |
| `docs/runbooks/reconcile-ai-usage.md` **(novo)**        | linha de cron documentada + procedimento humano de liberação                                                   |

## 6. DoD

- [ ] Nenhuma linha `usage_unknown` fica sem tratamento além de `X` — **invariante verificável por query**.
- [ ] Replay **não** duplica ajuste (CAS) — provado por execução dupla no teste.
- [ ] Falha **não** vira sucesso vazio (INV-013): `reconciliation_failed` é **estado persistido**, não log.
- [ ] `tokens_reserved` **não muda** no job (decisão humana 1) — assertado no teste.
- [ ] Isolamento de tenant provado **com controle positivo** (0 linhas do outro tenant tocadas).
- [ ] Métricas emitidas e verificadas.
- [ ] Ciclo completo verde em PG17 efêmero **antes** de publicar.
- [ ] `npm run check` exit 0; `db:test` com a suíte nova, 0 skipped.

## 7. Fora de escopo (declarado)

- **Não** libera reserva automaticamente (é comando humano).
- **Não** cria índice novo nem migration — o índice existente serve pelo prefixo `(tenant_id, status)`.
  Se a medição mostrar varredura cara com volume, vira WP próprio com migration classificada.
- **Não** cria scheduler embutido: entrega o script + a linha de cron documentada.
- **Não** toca `.github/workflows/**` (contenção ∅ com o TRILHO A).

## 8. Riscos

| risco                                                   | mitigação                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marcar `reconciliation_failed` e ninguém liberar depois | evento estruturado sempre emitido, uma linha por evento — é o alarme que funciona — mais as métricas e o gauge de idade, que são inertes hoje (D7); o runbook traz o comando de liberação passo a passo |
| `outcome` sem CHECK aceitar valor fora do previsto      | conjunto fechado de três literais no código, com teste de replay                                                                                                                                        |
| Job competir com o `sweep` existente                    | predicados **disjuntos** (`status='settled'` vs `status='reserved'`); nada do sweep é alterado                                                                                                          |
| Transação longa com muitos eventos                      | `batchSize` (teto por execução) + `order by settled_at asc`                                                                                                                                             |
| Mudar KPI já lido                                       | o job **não** escreve valores financeiros; só o rótulo de estado                                                                                                                                        |

## 9. Rollback

`git revert` do commit do WP + remover a linha de cron do runbook. **Nenhuma migration** entra, então não
há rollback de schema. Linhas já marcadas como `reconciliation_failed` permanecem verdadeiras
(o uso **foi** desconhecido) — reverter o código não as torna falsas.
