# Depuração visual / computer user — 2026-10-19

Pacote **não selado** (sem `MANIFEST.sha256` e sem S6 adversarial; a cerimônia de selo não foi simulada). Registra a execução do gate visual e da suíte de browser na bancada local `:4173`, na árvore `develop` em `4206303` + WIP (o mesmo estado do pacote da Fase 2a).

## Bancada (medida)

- Postgres local (`preco-que-da-lucro-postgres`) healthy; seed idempotente reexecutado (`e2e:prepare`).
- Build atual do `develop` e preview por **entrada direta** (`.artifacts/bench-preview.sh`), com as **duas** credenciais de IA vazias — nenhuma chamada externa real.
- `curl`: `/` 200, `/inicio` 200, `/produtos` 200.

## Resultados

| suíte                       | comando                                                                     | resultado                                        |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| gate visual (computer user) | `npx playwright test e2e/visual --project=chromium --project=mobile`        | **10 passed (16,0 s)** — 5 cenários × 2 projetos |
| e2e completa (2 projetos)   | `npx playwright test --project=chromium --project=mobile`                   | **46 passed (59,3 s)**, exit 0                   |
| e2e completa (3 projetos)   | `npx playwright test --project=chromium --project=firefox --project=mobile` | **69 passed (1,8 min)**, exit 0 — 23 testes × 3  |
| e2e completa (4 projetos)   | `npx playwright test` (chromium+firefox+webkit+mobile)                      | **91 passed / 1 failed (2,5 min)** — ver §WebKit |
| walk autenticado CU         | `node .artifacts/cu/depuracao-visual.mjs`                                   | **0 console errors, 0 falhas de rede**           |

### O que o gate visual afirmou

- INV-007: nenhum `NaN`/`Infinity` renderizado como `R$ 0,00`.
- INV-006: produto sem rendimento exibe `DADOS INCOMPLETOS` / `—`, nunca zero factual.
- Badge de estado presente e correto (`REAL` / `DADOS INCOMPLETOS`).
- CLS < 0,1 nos projetos que expõem `layout-shift`.
- Artefato persistido é **redigido** (sem segredo/PII), selado (hash) e correlacionado (`x-correlation-id`), com `traceId` nulo no processo de teste (limite declarado da ADR-033).
- Chat: desfecho honesto no ramo controlado — mensagem de indisponibilidade sem figura inventada.

### O que o walk autenticado mediu

- `/produtos`: gatilho `Arquivar Produto de teste` **36×36**, recipiente persistente, foco por teclado.
- `/produtos/composicao?produto=…`: `h1` = "Composição do produto", sem cair em `/auth`, com o conteúdo manual visível.
- Diálogo de arquivar: título honesto, ação **não** destrutiva, `ESC` fecha e devolve o foco ao gatilho.
- `/despesas`: gatilho `Excluir Despesas variáveis` 36×36; diálogo com aviso de irreversibilidade e ação `bg-destructive`; `ESC` fecha.

### IA (prova do ramo controlado)

O log do preview registra `ai.credential_unusable` com `reason=absent` e `ai.budget_settled` com `real: 0` / `outcome: error_dependency_error` nos dois turnos do teste de chat. Nenhum `success` real.

## Capturas

- `captures/visual-gate.txt` — saída bruta do Playwright (gate visual, chromium+mobile).
- `captures/e2e-full.txt` — saída bruta da suíte completa (chromium+mobile).
- `captures/e2e-3p-chromium-firefox-mobile.txt` — saída bruta com o Firefox na matriz (69 passed).
- `captures/e2e-4p-all-browsers.txt` — saída bruta da matriz completa (91 passed / 1 failed).
- `captures/webkit-color-contrast-failure.txt` — o defeito achado pelo WebKit (alvos, razões, contraste calculado).
- `captures/webkit-single-test-rerun.txt` — re-run isolado e determinístico do teste vermelho.
- `captures/cu-walk.json.txt` — JSON do walk autenticado.
- `captures/bench-health.txt` — saúde do preview, seed e ramo de IA.
- `captures/browser-install.txt` — instalação dos browsers e sonda de launch.
- `captures/webkit-missing-system-deps.txt` — as 53 dependências de sistema que o WebKit exigia.

Artefatos do gate visual: `docs/evidence/visual/` (gitignored, selado e redigido). Prints do walk: `.artifacts/cu/dep-*.png` (gitignored).

## Matriz de browsers (medida)

- **Chromium** — instalado (`chromium-1234`): verde.
- **Firefox** — instalado (`firefox-1538`, 153.0): verde.
- **WebKit** — instalado (`webkit-2336`, WebKit 26.5) e **rodando** após as 53 dependências de sistema serem instaladas por `apt-get` (senha do humano, uma única vez, via stdin). **Reprovou 1 teste real** (ver abaixo).

## Achado do WebKit — violação de contraste AA (DBT-126)

O projeto `webkit` reprova `e2e/ui-stack.spec.ts:339` (`expectNoBlockingAxeViolations`) sobre `/simulacoes`, de forma **determinística (2/2 runs)**:

- run A: `#82828b` sobre `#ffffff` = **3,8:1**;
- run B (isolado): `#9a9aa1` sobre `#ffffff` = **2,79:1**;
- exigido para texto normal (12/14/16px): **4,5:1**.

Alvos medidos no DOM: `<p class="text-muted-foreground">Teste uma hipótese…</p>` e `<p class="text-xs text-muted-foreground">Referência de atendimento: SIM-…</p>`.

**Chromium e Firefox passaram o mesmo teste no mesmo run** — a matriz de 2 projetos era cega a este defeito (lacuna de detecção por engine, declarada). Observação aberta: a cor computada do **mesmo** elemento variou entre os dois runs e a variância não está explicada. Registrado como **DBT-126** (conformidade/alta); **não corrigido** aqui porque o token pertence ao WIP de redesign de outra sessão.

## Limites declarados

- **O WebKit deixou de ser limite**: os 4 projetos rodam. O que resta aberto é o defeito DBT-126, que o WebKit **expôs** e que chromium/firefox não detectam.
- O walk CU é **read-only**: não exercita mutações nem o `409` da guarda de remoção.
- Nenhum commit, push, migration, deploy ou alvo remoto.
