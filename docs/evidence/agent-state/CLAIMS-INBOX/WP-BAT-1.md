# CLAIM — WP-BAT-1 (baterias §32/§33 — fechamento de lacunas)

- **wp / papel / data:** WP-BAT-1 · QA-BROWSER (executado pelo MAESTRO nesta rodada) · 2026-09-17
- **base:** `190954b` (= `origin/develop` **com CI verde** nos dois pipelines) · **sem** alteração de código (`src/` intocado — `git status` prova)
- **artefato principal:** `docs/evidence/battery-wp-bat-1-2026-09-17/BATERIAS-32-33.md` + `screenshots/` (8 capturas, manifesto `sha256sum -c` = ALL MATCH)

## 1. O que foi medido (resumo; detalhe no artefato)

| item                             | veredicto                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §32.1 replay de mutação          | MEDIDO — UI **não** idempotente por desenho (2 linhas); garantia vive no caminho de tools (`db:test`/`test-tool-security`) — declarado, não medido aqui |
| §32.2 session fixation           | **PASS** (tokens distintos; logout isola sessões; cookie forjado ⇒ sem sessão; HttpOnly + SameSite=Lax)                                                 |
| §32.3 rate abuse (chat)          | **PASS** (21º envio ⇒ "Muitas solicitações. Aguarde e tente novamente.")                                                                                |
| §32.4 (bônus) rate limit de auth | **PASS** (429 + corpo)                                                                                                                                  |
| §33.4 `yield_qty=NULL`           | **PASS** (DADOS INCOMPLETOS; sem R$ 0,00)                                                                                                               |
| §33.5 `tax_rate=NULL`            | **PASS** (incompleto + `—`; o `R$ 0,00` da página é a semântica O-1 de ingredientes)                                                                    |
| §33.6 `contribution ≤ 0`         | **ACHADO B-7** — `/ponto-equilibrio` mostra "Erro de cálculo" em vez de "Não atingível" (motor devolve `unreachable`; `/diagnostico` explica o estado)  |
| §33.7 unidades 10,1 → 11         | **PASS** (`11 un. (bruto 10,10)`)                                                                                                                       |
| §33.8 unidade incompatível       | NÃO MEDIDO (declarado; requer chat/IA) — ponteiro `finance.ts` FIN-006                                                                                  |
| §33.9 markup arbitrário          | NÃO MEDIDO neste WP (declarado) — coberto por e2e + ciclo 3                                                                                             |

## 2. Método e higiene

- Preview local (`:4277`) + container efêmero `nas2c7-pg` (`:55434`), fixture semeada; **Firefox** (Playwright) para a navegação.
- `env -u DATABASE_URL_UNPOOLED` em todo lançamento; `cwd` explícito; `:5432`/Neon/produção **nunca** tocados.
- **Toda** mutação de banco restaurada e a restauração **provada** no mesmo script (`restaurado=true` por item).
- **Erro meu, registrado:** o primeiro probe de sessão reenviava o cookie **sem o prefixo** (`preco_que_da_lucro.session_token`) e devolvia "sem sessão" — o resultado foi descartado e a medição refeita com o nome completo. Fica no artefato como limite de método.

## 3. Resíduos declarados

1. **B-7** (achado): mecanismo exato **não pinado** — hipótese (marcada como hipótese no artefato): `breakEven` chega `null` ao card por `createBreakEvenInput` (`ponto-equilibrio.tsx:82-91`) quando `metrics` não é `ok`. O adversarial deve decidir entre _defeito de rótulo_ e _gating indevido_.
2. §32.1 (replay no caminho de tools) e §33.8/§33.9: **não medidos** por sonda própria — ponteiros declarados.
3. A bateria **não** promove nenhum item do Placar Mestre (é evidência de validação; o crédito depende da régua).

---

## 4. Correções pós-veredicto adversarial (append-only — o veredicto vence)

`CLAIMS-INBOX/WP-BAT-1-VERDICT.md`: **CONFIRMED 8 · CORRECTED 3 · REJECTED 0 · UNVERIFIABLE 0** (contexto novo; sonda própria por _fiber props_ + chamada autenticada ao server fn + bordas de banco; baseline hasheada de 17 tabelas, `ALL_MATCH=1`).

1. **B-7 — minha hipótese estava ERRADA (CORRECTED).** O veredicto mediu no fiber que o card **recebe** resultado: `metrics.status="ok"` (margem −9,15 é resultado legítimo) e `breakEven={"status":"invalid","units":{... "INVALID_DECIMAL","contributionMargin"}}` — **não** é `null`, logo **não é gating** e `createBreakEvenInput` (`ponto-equilibrio.tsx:82-91`) **não** é a causa. A causa é a **classificação**: o guard de decimal negativo em `src/lib/break-even.ts:78` (via `parseBaseInputs` `:192-204`) rejeita `contributionMargin="-9.15"` ⇒ `invalidResult` ⇒ `status:"invalid"`, e o ramo `NON_POSITIVE_CONTRIBUTION` (`:126-139`) **nunca é atingido** no caminho do cliente. O `/diagnostico` usa **outro** motor (`finance.ts:383-423`, `calculateBreakEvenUnits`), que aceita margem negativa e devolve `unreachable` ⇒ "Não atingível" — **duas telas, mesmo estado, respostas opostas**. Borda medida: `cm=−9.15 → invalid` · `cm=0 → unreachable` · `cm=+0.1 → reachable` (inconsistência interna da mesma função). **Veredicto: DEFEITO confirmado**; correção mínima recomendada: aceitar decimal negativo para `contributionMargin`/`contributionMarginPct` em `parseDecimal` (mantendo `price` não negativo e a rejeição de NaN/overflow).
2. **"Restaurado=true" sem prova versionada (CORRECTED):** o commit `8305a67` só adiciona docs — **nenhum script de sonda/prova** foi versionado, então minhas afirmações de restauração **não são reexecutáveis por terceiros**. O estado final **é** consistente com a fixture (conferido pelo veredicto), mas isso é inferência dele, não a minha prova. **Lição registrada:** provas de restauração precisam ser versionadas junto do artefato.
3. **Resíduo do WP no container (CORRECTED):** sobraram `chat_messages` (20× `probe ratelimit`), `rate_limits` (4 linhas), `ai_usage`/`ai_daily_budgets` (`chat_count=20`) e 12 `sessions`. Nada é campo semeado alterado — e é **corroboração independente** do limite de 20 envios — mas a frase "todas as mutações restauradas" era **forte demais** para o resíduo de sondagem. Container é **efêmero** e foi destruído no cleanup.
4. **Resíduos novos do veredicto:** (a) o bloqueio do bucket de chat volta **HTTP 200** com envelope `$TSR/Error` (o de auth devolve 429 real) — assimetria de contrato a considerar; (b) `R$ 0,00` usa **NBSP** (U+00A0) — varredura com espaço comum dá falso "0 ocorrências"; (c) o manifesto `screenshots.sha256` só valida de dentro de `screenshots/` e 2 PNGs não são citados no texto.
