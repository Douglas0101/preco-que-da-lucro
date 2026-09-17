# RELATÓRIO DO CICLO 7 — NAS-2 (2026-09-17)

**WP:** `WP-BAT-1` — fechar as lacunas das baterias **§32** (security matrix) e **§33** (financial regression) que o ciclo 3 deixou cobertas apenas por unit/`db:test`/e2e — ou sem cobertura nenhuma.
**Base:** `190954b` (= `origin/develop` **com CI verde**) · **sem alteração de código de produto** · **publicado** (`8305a67`).

## 1. Loop S0–S9 — checklist

| fase               | o que foi feito                                                                                                                                 | evidência                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **S0 SELECT**      | WP na ordem prescrita pelo supervisor (após `F-C4-1`)                                                                                           | `QUEUE.md` §Ciclo 5/6/7                        |
| **S1 SPEC**        | `SPEC-CARDS/CICLO-7.md`: matriz item a item **com o método**, RED/GREEN não se aplicam (bateria), regra de honestidade "não medido = declarado" | spec-card versionado                           |
| **S2 ISOLATE**     | preview local dedicado (`:4277`) + container efêmero `nas2c7-pg` (`:55434`) + fixture semeada; `env -u`, `cwd` explícito                        | §3 abaixo                                      |
| **S3 BUILD**       | **n/a** — bateria não toca `src/`                                                                                                               | `git status` limpo para `src/`                 |
| **S4 VERIFY**      | as sondas **são** a verificação; cada mutação de banco com **restauração provada** no mesmo script                                              | artefato §3                                    |
| **S5 BROWSER**     | navegação **Firefox** (Playwright) nas 4 superfícies (`/produtos`, `/diagnostico`, `/ponto-equilibrio`, `/despesas`, `/novo-produto`)           | 8 capturas + manifesto                         |
| **S6 ADVERSARIAL** | despachado com missão explícita de **pinar o B-7**; **veredicto em curso** no fechamento deste relatório                                        | `CLAIMS-INBOX/WP-BAT-1-VERDICT.md` (a caminho) |
| **S7 GUARD**       | nenhuma mutação fora do container efêmero; `:5432`/Neon/produção intocados; nenhuma credencial de produção no ambiente                          | §3                                             |
| **S8 SEAL**        | artefato + 8 capturas com `sha256sum -c` = ALL MATCH; claim escrito; ledger com marcador parent-pinned                                          | `battery-wp-bat-1-2026-09-17/`                 |
| **S9 LAND**        | commit + push em `develop`; nada tocado em produção                                                                                             | `8305a67`                                      |

## 2. Resultados (o que o ciclo 3 não tinha medido)

| item                             | veredicto                                                                         | evidência                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| §32.2 session fixation           | **PASS**                                                                          | tokens distintos por login; logout isola sessões; cookie forjado ⇒ sem sessão; `HttpOnly`+`SameSite=Lax` |
| §32.3 rate abuse (IA)            | **PASS**                                                                          | 21º envio ⇒ "Muitas solicitações. Aguarde e tente novamente."                                            |
| §32.4 rate limit de auth (bônus) | **PASS**                                                                          | 429 + corpo `Too many requests…`                                                                         |
| §32.1 replay                     | MEDIDO (UI não idempotente por desenho; garantia no caminho de tools — declarada) | 2 linhas novas, restaurado                                                                               |
| §33.4 `yield_qty=NULL`           | **PASS**                                                                          | DADOS INCOMPLETOS, sem `R$ 0,00`                                                                         |
| §33.5 `tax_rate=NULL`            | **PASS**                                                                          | incompleto + `—`; `R$ 0,00` da página = semântica O-1 (ingredientes)                                     |
| §33.6 `contribution ≤ 0`         | **ACHADO B-7**                                                                    | "Erro de cálculo" onde o motor diz `unreachable` e o `/diagnostico` explica o estado                     |
| §33.7 unidades 10,1→11           | **PASS**                                                                          | `11 un. (bruto 10,10)`                                                                                   |
| §33.8/§33.9                      | **não medidos — declarados**                                                      | ponteiros: `finance.ts` FIN-006 (unit) · e2e `ui-stack` (markup)                                         |

## 3. Ambiente, higiene e limites

- Container **efêmero** `nas2c7-pg` (`:55434`) + preview `:4277`; **nenhum** acesso a `:5432`, Neon ou produção; todo lançamento com `env -u DATABASE_URL_UNPOOLED`.
- **Todas** as mutações de banco restauradas e **provadas** (`restaurado=true` por item).
- **Erro de método registrado:** o primeiro probe de sessão reenviava o cookie **sem o prefixo** (`preco_que_da_lucro.session_token`) e concluía "sem sessão" — resultado descartado e medição refeita. Fica no artefato (limites de método).
- Limites: bateria local (produção segue bloqueada por H-6/H-2); o caminho de **tools** de IA não é exercitável sem gateway (declarado).

## 4. Achado B-7 — o que falta para fechá-lo

- **Fato:** a superfície `/ponto-equilibrio` não entrega o rótulo que a régua do §33 espera ("Contribution ≤ 0 → break-even **não atingível**").
- **Hipótese (marcada):** `breakEven` chega `null` ao card (`createBreakEvenInput` exige `metrics` `ok` e preço não-nulo — `ponto-equilibrio.tsx:82-91`).
- **Próximo passo:** o adversarial **pina o mecanismo** (qual `status` o loader devolve com preço < custo) e decide entre _defeito de rótulo_ e _gating indevido_; se confirmado, vira **WP-B7** (correção mínima: ou o gating aceita o estado, ou o rótulo é corrigido na origem).

## 5. Placar e próximo despacho

- **Placar: inalterado** (86,36% parcial / 80,21% crua) — bateria é evidência de validação.
- **Próximo:** **`MEM-D4`** (H-12 aprovado + SD-C3-12) · filas paralelas: `F-C6-1`/`F-C6-2`, `F-C5-2`/`F-C5-3`, `WP-B1`, e **B-7** se o veredicto confirmar.
- **Gates humanos:** **H-10 fechado**, **H-12 aprovado**; seguem **H-6**, **H-4**, **H-9**, **H-2**, **H-11**, **H-5**, **H-8**.
