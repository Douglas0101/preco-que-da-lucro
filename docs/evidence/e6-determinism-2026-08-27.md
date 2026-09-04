# E6 — evidência local de determinismo do harness

**Data local:** 2026-08-27 (America/Sao_Paulo)
**Classificação:** `LOCAL-VERIFIED` para o PostgreSQL local e o checkout abaixo
**Estado:** evidência do harness; não é readiness remoto, aprovação humana ou
fechamento de M-04/M-06

## Contexto do checkout

- Branch: `program/v5-fechamento-sdd`
- HEAD: `154efcd94c97d77d7061ac557e6d6cbf17472395`
- Worktree: dirty, preservado; 57 entradas reportadas por `git status --short`
- Banco: `postgres:17-alpine`, container local `preco-que-da-lucro-postgres`,
  estado `running`
- Runtime do teste: `DATABASE_DRIVER=node-postgres`
- Escopo do patch: `scripts/db/test-ai-budget.ts`; o gate lógico é exclusivo
  do harness E6. Runtime de produção, schema e migrations não foram alterados
  por este patch.

## Comando executado

Com `DATABASE_URL` e `DATABASE_ADMIN_URL` apontando para o PostgreSQL local de
teste, foi executada a matriz:

```bash
for hold in 300 600 1200; do
  for queue in 0 50 200 500; do
    E6_ONLY=1 E6_HOLD_MS="$hold" E6_QUEUE_MS="$queue" \
      npm exec -- tsx scripts/db/test-ai-budget.ts
  done
done
```

O run foi repetido em modo conciso após a primeira execução para capturar uma
linha de métricas por combinação. Cada processo também passou pelas asserções
internas de oito tentativas de reserva e oito conclusões de reserva.

## Resultado observado

| `E6_HOLD_MS` | `E6_QUEUE_MS` | gateway calls | peak active | sucessos | rejeições | `tokens_reserved` | `in_flight` | resultado |
| -----------: | ------------: | ------------: | ----------: | -------: | --------: | ----------------: | ----------: | --------- |
|          300 |             0 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          300 |            50 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          300 |           200 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          300 |           500 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          600 |             0 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          600 |            50 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          600 |           200 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|          600 |           500 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|         1200 |             0 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|         1200 |            50 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|         1200 |           200 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |
|         1200 |           500 |             2 |           2 |        2 |         6 |                 0 |           0 | PASS      |

Saída representativa:

```text
T6/E6 metrics: gatewayCalls=2 peakActiveCalls=2 sucessos=2 rejeições=6 tokens_reserved=0 in_flight=0
T6/E6: limite in-flight sob concorrência: OK
E6_ONLY: cenário E6 concluído
```

## Interpretação e limites

O gate determinístico impediu que os dois requests admitidos liberassem o
provider antes que as oito reservas terminassem. Assim, o resultado confirma
localmente a propriedade do cenário sob as 12 combinações planejadas, sem
relaxar `gatewayCalls <= 2` ou `peakActiveCalls <= 2`.

Esta evidência não prova que o run remoto `33080843742` foi corrigido: aquele
run permanece associado a `develop@12c90a17` e a execução local ainda não foi
publicada. Também não prova a implementação de D-008/D-009, Q-010, outbox,
Neon, CI, produção ou qualquer gate humano. O readiness remoto deverá ser
reexecutado no SHA exato publicado depois das decisões e do fluxo de promoção.
