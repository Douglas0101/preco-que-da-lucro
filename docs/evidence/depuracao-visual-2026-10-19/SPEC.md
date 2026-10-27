# SPEC — depuração visual / computer user (2026-10-19)

> **Natureza:** este `SPEC.md` foi publicado em **2026-10-21**, na sessão de selagem, e **descreve o
> pacote tal como ele já existia**. O `README.md` do pacote é o registro do resultado.
>
> **Selo:** `MANIFEST.sha256` + este `SPEC.md` publicados na sessão de selagem de 2026-10-21. O **S6
> adversarial de contexto limpo NÃO foi executado** — o `README.md` do pacote declara o pacote como
> "não selado" e nada de selo foi simulado.

## 1. Fato-fonte

- Execução do **gate visual** (`e2e/visual`) e da **suíte de browser** na bancada local `:4173`, na
  árvore `develop` em `4206303` + WIP — o mesmo estado do pacote da Fase 2a.
- Journal `docs/evidence/agent-state/PROGRESS.md` e o registry `docs/evidence/agent-state/DEBTS.md`
  (**DBT-126**, conformidade/alta) — o defeito que o WebKit expôs.
- `README.md` §13–§19 (tabela de resultados) e §62–§72 (achado do WebKit) — as fontes primárias.

## 2. Problema (medido)

1. **WebKit não rodava** na máquina: faltavam **53 dependências de sistema** exigidas pelo engine.
2. **Com WebKit rodando**, o projeto `webkit` reprovou `e2e/ui-stack.spec.ts:339`
   (`expectNoBlockingAxeViolations`) sobre `/simulacoes`, de forma **determinística (2/2 runs)**: run A
   `#82828b` sobre `#ffffff` = **3,8:1**; run B (isolado) `#9a9aa1` sobre `#ffffff` = **2,79:1**; exigido
   para texto normal (12/14/16px) = **4,5:1**.
3. **Chromium e Firefox passaram o mesmo teste no mesmo run** ⇒ a matriz de 2 projetos era **cego** a este
   defeito — lacuna de detecção por engine, **declarada**.

## 3. Contrato (invariante falsificável)

> Os **4** projetos de browser rodam na mesma máquina, e o gate visual afirma — por asserção, não por
> impressão — INV-007 (nenhum `NaN`/`Infinity` renderizado como `R$ 0,00`), INV-006 (produto sem
> rendimento exibe `DADOS INCOMPLETOS` / `—`, nunca zero factual), presença e correção do badge de
> estado, e que o artefato persistido é **redigido**, **selado** (hash) e **correlacionado**.

## 4. Mudanças (o que a sessão tocou)

- **Host:** instalação das **53 dependências de sistema** do WebKit por `apt-get` (senha do humano, uma
  única vez, via stdin) — `captures/webkit-missing-system-deps.txt` lista as 53;
  `captures/browser-install.txt` registra a instalação dos browsers e a sonda de launch.
- **Repositório:** nada. Nenhum arquivo versionado foi alterado por esta sessão; o pacote é evidência
  pura.

## 5. DoD (critérios binários, com o artefato que os prova)

| suíte                       | comando                                                                     | resultado medido                                 | captura                                       |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| gate visual (computer user) | `npx playwright test e2e/visual --project=chromium --project=mobile`        | **10 passed (16,0 s)** — 5 cenários × 2 projetos | `captures/visual-gate.txt`                    |
| e2e completa (2 projetos)   | `npx playwright test --project=chromium --project=mobile`                   | **46 passed (59,3 s)**, exit 0                   | `captures/e2e-full.txt`                       |
| e2e completa (3 projetos)   | `npx playwright test --project=chromium --project=firefox --project=mobile` | **69 passed (1,8 min)**, exit 0 — 23 × 3         | `captures/e2e-3p-chromium-firefox-mobile.txt` |
| e2e completa (4 projetos)   | `npx playwright test` (chromium+firefox+webkit+mobile)                      | **91 passed / 1 failed (2,5 min)**               | `captures/e2e-4p-all-browsers.txt`            |
| walk autenticado CU         | `node .artifacts/cu/depuracao-visual.mjs`                                   | **0 console errors, 0 falhas de rede**           | `captures/cu-walk.json.txt`                   |
| saúde da bancada            | seed idempotente + preview por entrada direta                               | `/` 200, `/inicio` 200, `/produtos` 200          | `captures/bench-health.txt`                   |

**O que o gate visual afirmou** (README §21–§28): INV-007 e INV-006 como acima; badge de estado
presente e correto (`REAL` / `DADOS INCOMPLETOS`); CLS < 0,1 nos projetos que expõem `layout-shift`;
artefato persistido **redigido** (sem segredo/PII), **selado** (hash) e **correlacionado**
(`x-correlation-id`), com `traceId` nulo no processo de teste (limite declarado da ADR-033); chat com
desfecho honesto no ramo controlado.

**O que o walk autenticado mediu** (README §30–§35): `/produtos` com gatilho `Arquivar Produto de
teste` **36×36**, recipiente persistente e foco por teclado; `/produtos/composicao?produto=…` com `h1` =
"Composição do produto", **sem** cair em `/auth`; diálogo de arquivar com título honesto e ação **não**
destrutiva, `ESC` fecha e devolve o foco ao gatilho; `/despesas` com gatilho `Excluir Despesas
variáveis` 36×36, aviso de irreversibilidade e `bg-destructive`.

## 6. Testes (e a falsificação)

- O defeito do WebKit é **determinístico**: 2/2 runs reprovaram, e o re-run isolado reproduziu
  (`captures/webkit-single-test-rerun.txt`) — é o par que prova que o defeito existe, e o
  `captures/webkit-color-contrast-failure.txt` traz alvos, razões e contraste calculado.
- **Controle de ambiente (não é teste):** `captures/webkit-missing-system-deps.txt` + a sonda de launch
  em `captures/browser-install.txt` provam que a falha inicial era de dependência de sistema, e não do
  produto.

## 7. Riscos e limites declarados

- **O WebKit deixou de ser limite**: os 4 projetos rodam. O que resta aberto é o defeito **DBT-126**, que
  o WebKit **expôs** e que chromium/firefox **não** detectam.
- **Não corrigido** nesta sessão: a cor computada do **mesmo** elemento **variou entre os dois runs** e a
  variância **não está explicada** — observação aberta, registrada.
- O walk CU é **read-only**: não exercita mutações nem o `409` da guarda de remoção.
- O `traceId` é **nulo** no processo de teste (limite declarado da ADR-033).
- Artefatos do gate visual em `docs/evidence/visual/` (**gitignored**, selado e redigido) e prints do
  walk em `.artifacts/cu/dep-*.png` (**gitignored**) — **fora** deste manifesto.
- **S6 adversarial não executado.**
- Nenhum commit, push, migration, deploy ou alvo remoto.

## 8. Rollback

Nenhum commit foi feito: o pacote é evidência pura, sem mudança versionada. O estado da máquina é
revertido por `apt-get remove` das dependências do WebKit e remoção dos browsers — procedimento fora do
escopo desta sessão e não registrado aqui como executado.
