# WP-BAT-1 — fechamento das lacunas das baterias §32/§33 (2026-09-17)

> **Alvo:** preview local `http://127.0.0.1:4277` (`node .output/server/index.mjs`, build do HEAD `190954b`) + container PG17 **efêmero** `nas2c7-pg` (`:55434`) com a fixture `scripts/e2e/seed-auth.ts`. **Navegação por Firefox** (Playwright). Nada tocado em produção/Neon/`:5432`; todo lançamento com `env -u DATABASE_URL_UNPOOLED`; toda mutação de banco **restaurada e provada**.
> **Regra do WP:** o que a aplicação **pôde** exercitar foi medido por sonda própria; o que não pôde é **declarado** com o motivo e o ponteiro da camada que cobre — nunca marcado como medido.

## 1. Resultados

| #     | item                                        | veredicto                                | evidência (bruta)                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §32.1 | **Replay de mutação**                       | **MEDIDO — não idempotente por desenho** | a mesma despesa adicionada 2× pela UI criou **2 linhas** (`antes=2 → depois=4`, removidas depois: `restaurado=true`). A garantia de replay existe no **caminho de tools** (`tool_executions` + `idempotency_records`) e no `idempotency_key` do outbox — coberta por `db:test` (`test-tool-security`: "replay ok/replayed=true") e **não medida por sonda própria aqui** (o chat local não tem gateway de IA) |
| §32.2 | **Session fixation**                        | **PASS**                                 | dois logins ⇒ **tokens distintos** (`tokensDiffer=true`); `HttpOnly` ✔ `SameSite=Lax` ✔; cookie **forjado** ⇒ `get-session` = `null` (nenhuma sessão); **logout de B invalida só B** (A segue com `user`); nome do cookie tem **prefixo** (`preco_que_da_lucro.session_token`) — o prefixo foi a causa de um erro do meu primeiro probe, registrado                                                           |
| §32.3 | **Rate abuse (IA)**                         | **PASS**                                 | 22 envios no chat: o **21º** devolve **"⚠️ Muitas solicitações. Aguarde e tente novamente."** (bucket `chat\|<userId>` 20/600 s, consumido antes do gateway) — `chat-ratelimit.png`                                                                                                                                                                                                                           |
| §32.4 | _Bônus medido:_ rate limit de **auth**      | **PASS**                                 | rajada de logins ⇒ **429** com corpo `{"message":"Too many requests. Please try again later."}` (janela de 60 s)                                                                                                                                                                                                                                                                                              |
| §33.4 | `yield_qty := NULL`                         | **PASS**                                 | card do produto ⇒ **DADOS INCOMPLETOS**; sem `R$ 0,00` (`yield-null.png`)                                                                                                                                                                                                                                                                                                                                     |
| §33.5 | `tax_rate := NULL`                          | **PASS**                                 | banner "O diagnóstico do preço atual está incompleto…" + `Preço mínimo: —` + `Preço para margem-alvo: —`; a única ocorrência de `R$ 0,00` na página é **"Custo dos ingredientes"** — semântica **O-1** já declarada no ciclo 3 (lista vazia = 0 por desenho), **não** fabricação (`tax-null.png`)                                                                                                             |
| §33.6 | **Contribution ≤ 0**                        | **ACHADO B-7** (ver §2)                  | preço R$ 1,00 < custo R$ 10,00: a margem é exibida honestamente (**`-R$ 9,15 (-915,00%)`**) e o `Faturamento necessário` fica `—`, **mas** o card "VOCÊ PRECISA VENDER" mostra **"Erro de cálculo"** em vez de "Não atingível" (`pe-price-below-cost.png`)                                                                                                                                                    |
| §33.7 | **Unidades 10,1 → 11**                      | **PASS**                                 | com despesa fixa 70,70 e margem 7 ⇒ **`11 un. (bruto 10,10)`** — arredondamento e exibição do bruto corretos (`rounding-70-70.png`)                                                                                                                                                                                                                                                                           |
| §33.8 | _Unidade incompatível → incomplete/invalid_ | **NÃO MEDIDO (declarado)**               | só entra por **ingrediente criado no chat** (requer gateway de IA, indisponível local) ⇒ ponteiro: `src/lib/finance.ts` (FIN-006, `convertUnit`) + testes unitários                                                                                                                                                                                                                                           |
| §33.9 | _Markup arbitrário inexistente_             | **NÃO MEDIDO neste WP (declarado)**      | coberto por e2e (`ui-stack`: "diagnostic forms prices only from explicit assumptions") e pelo ciclo 3 (nenhum "preço sugerido" observado)                                                                                                                                                                                                                                                                     |

## 2. Achado B-7 (candidato — a confirmar pelo adversarial)

- **Observado:** com `contribution ≤ 0`, `/ponto-equilibrio` exibe **"Erro de cálculo"** no card "VOCÊ PRECISA VENDER".
- **Contraste medido no mesmo estado:** `/diagnostico` **explica** o estado — alerta **"Seu preço de venda está abaixo do custo unitário"** — e a margem negativa é exibida corretamente nas duas telas.
- **O motor está certo:** `calculateBreakEvenUnits` devolve `status: "unreachable"` + `reason: "NON_POSITIVE_CONTRIBUTION"` (`src/lib/finance.ts:404-410`) e `break-even.ts:131-139` faz o mesmo; a função de rótulo da própria página mapeia `unreachable → "Não atingível"` (`src/routes/_authenticated/ponto-equilibrio.tsx:374-377`).
- **Hipótese (marcada como hipótese, não como fato):** o rótulo cai no **fallback** porque `result` chega `null` ao card — `breakEven` é `null` quando `createBreakEvenInput(...)` devolve `null` (`ponto-equilibrio.tsx:82-91`), o que exige `metrics` não-`ok` **ou** `selectedPrice === null`. O adversarial deve **pinar o estado real** (qual `metrics.status` o loader devolve com preço < custo) e decidir entre _defeito de rótulo_ e _gating indevido_.
- **Régua do plano:** o item §33 espera "**Contribution <= 0 → break-even não atingível**" — hoje a superfície `/ponto-equilibrio` **não** entrega esse rótulo.

## 3. Ambiente e higiene

- Container `nas2c7-pg` (efêmero, `:55434`) + preview em `:4277` (pid verificado; `DATABASE_URL` ⇒ `127.0.0.1:55434`); **nenhum** acesso a `:5432`, Neon ou produção; `env -u DATABASE_URL_UNPOOLED` em todo lançamento.
- **Todas** as mutações de banco foram restauradas e a restauração foi **provada** por `psql` no mesmo script (`restaurado=true` em cada item).
- Capturas em `screenshots/` com manifesto `sha256sum -c` = ALL MATCH.

## 4. Limites declarados

1. Bateria executada em **Firefox** (Playwright) contra preview **local**; produção/Neon seguem bloqueados por gate (H-6/H-2).
2. O item §32.1 (replay) foi medido **na UI** (não idempotente por desenho); a idempotência do caminho de tools **não** foi exercitada por sonda própria (sem gateway de IA local).
3. §33.8/§33.9 ficam com o ponteiro da camada que cobre — **não** são "medidos" por este WP.

---

## Correção pós-veredicto (append-only, 2026-09-17) — §33.6/B-7

A **hipótese** registrada acima ("`breakEven` chega `null` por `createBreakEvenInput`") foi **refutada por medição** (`CLAIMS-INBOX/WP-BAT-1-VERDICT.md`): o card **recebe** `breakEven={"status":"invalid", "units":{"errors":[{"code":"INVALID_DECIMAL","field":"contributionMargin"}]}}` e `metrics.status="ok"`.

- **Causa pinada:** `src/lib/break-even.ts:78` rejeita decimal **negativo** (`contributionMargin="-9.15"`) em `parseBaseInputs` (`:192-204`) ⇒ `status:"invalid"`; o ramo `NON_POSITIVE_CONTRIBUTION` (`:126-139`) nunca é atingido no caminho do cliente.
- **Contraste:** `/diagnostico` usa `finance.ts:383-423` (`calculateBreakEvenUnits`), aceita margem negativa e devolve `unreachable` ⇒ "Não atingível".
- **Borda medida:** `cm=−9.15 → invalid` · `cm=0 → unreachable` · `cm=+0.1 → reachable`.
- **Veredicto: DEFEITO** (classificação errada escondendo o rótulo honesto). Correção mínima: aceitar negativo para `contributionMargin`/`contributionMarginPct` no `parseDecimal`.
- **Outras correções do veredicto:** provas de restauração **não versionadas** (o commit é docs-only); resíduo de sondagem no container (efêmero, destruído); bloqueio do chat volta **200** (não 429) com envelope `$TSR/Error`; `R$ 0,00` usa NBSP.
