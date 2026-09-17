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
