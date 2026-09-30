# WP5 `F-B1-e2e` — a invariante `preset Nitro ≡ gate do analytics`

**Work package:** `F-B1-e2e` (Bloco 3, quinto na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:82`
**Base:** `612c34bc9dfb49945854b29773362f012df07020` (develop pós-WP4)
**Branch:** `mission/wp5-analytics-e2e`

---

## 1. Sumário

O `@vercel/analytics` só pode montar quando o build é para a Vercel. A decisão tem **uma única
fonte** — `process.env.VERCEL` em `vite.config.ts` — que escolhe ao mesmo tempo o preset do Nitro
(`vercel` vs `node-server`) e a constante `__VERCEL_ANALYTICS_ENABLED__` que o bundle cliente lê em
`src/lib/vercel-analytics.ts`. No preset `node-server` (local, CI, Hostinger) o caminho
`/_vercel/insights/script.js` não existe, e montar o componente injeta um script que responde
404 com `text/html` sob `nosniff` (achado B-1, ciclo 3).

Até este WP, **nenhum teste forçava o acoplamento**. Uma edição futura que troque a fonte do preset
— ou o `define` — podia ligar/desligar a analytics em silêncio. O WP adiciona a única asserção
comportamental que mede a invariante: no preview node-server do Playwright, **zero** requisições a
`/_vercel/insights/*` e `window.va === undefined`.

## 2. O que muda

| #   | arquivo                              | mudança                                                          |
| --- | ------------------------------------ | ---------------------------------------------------------------- |
| 1   | `e2e/analytics-gate.spec.ts`         | spec nova (4 projetos do config: chromium/firefox/webkit/mobile) |
| 2   | `docs/evidence/f-b1-e2e-2026-09-20/` | este selo                                                        |

Nada de runtime, `vite.config.ts`, gate, CSP ou preset muda: o WP **mede** a invariante existente.

## 3. Evidência

### 3.1 A spec, verde no preview node-server (4/4)

`bash .artifacts/zz-wp5-e2e.sh green e2e/analytics-gate.spec.ts` → `.artifacts/wp5-e2e-green.log`:
`4 passed` — chromium, firefox, webkit e mobile, com o listener instalado **antes** do primeiro
`goto`, o **documento** observado (instrumentação viva), a espera pelo **marcador de hidratação**
`__reactContainer$` (do `hydrateRoot(document)` do entry) e dois frames após o commit. Sem
hidratação a medição não vale e o teste falha — não passa vazio.

### 3.2 A falsificação — a invariante é detectável

`bash .artifacts/zz-wp5-falsifica.sh` → `.artifacts/wp5-falsifica.log`, `FALSIFICA_EXIT=0`:

| corrida                                    | resultado                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| gate mutado para `true` (`sed` de 1 linha) | `RED_EXIT=1` · **8** ocorrências textuais de `/_vercel/insights/script.js` no log (4 requisições × 2 renderizações) |
| restauro                                   | sha256 `b8951518…` **antes e depois**, `git status` limpo para o arquivo                                            |
| gate restaurado                            | `GREEN_EXIT=0` · **0** ocorrências do script de insights                                                            |

O veredicto é **calculado** (RED ≠ 0 **e** ≥ 1 ocorrência textual; restauro byte a byte; GREEN = 0
**e** 0 ocorrências) — não é impressão de saída. A mutação **nunca** é comitada.

### 3.3 E1 — a suite completa local

`bash .artifacts/zz-wp5-e2e.sh full` → `.artifacts/wp5-e2e-full.log`: **60 passed (2.3m)** no
preview node-server (build + `npm run preview` do webServer do Playwright), contra PG17 efêmero
`wp5-pg` em `127.0.0.1:5439`. A bateria recusa rodar com a porta `4173` ocupada (um preview antigo
seria reusado pelo `reuseExistingServer` local) e tem fase `cleanup`
(`bash .artifacts/zz-wp5-e2e.sh cleanup` → `.artifacts/wp5-e2e-cleanup.log`) que derruba o container
e mede `:5432`/`:5439`/`:4173` com zero listeners.

### 3.4 Gate local e E2

`npm run check` exit 0 sobre os bytes finais (`.artifacts/wp5-gate.log`, com a matriz determinista
sem regenerar e o bundle idêntico: `473230` minified · `assets/index-eXg04t5H.js: 237694`). No HEAD
integrado após o merge, `npm run check` + a spec nova novamente. Capturas no MANIFEST.

## 4. Riscos e limites declarados

| item                                                                            | situação                                                                                                                            |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| o teste mede o preview local; a Vercel real não é executável aqui               | **N8 declarado** — prende a divergência `gate=true` sob `node-server`; `gate=false` na Vercel não é executável aqui                 |
| poderia passar por vacuidade (listener depois do `goto`)                        | mitigado: listener antes do primeiro `goto`; exige o **documento** observado e o marcador de hidratação `__reactContainer$` (S6 N1) |
| `window.va` era asserido como função (serialização inerte)                      | corrigido: `typeof window.va === "undefined"`, string serializável (S6 N2)                                                          |
| a mutação de falsificação toca um arquivo de runtime                            | mitigado: `sed` de uma linha, backup + sha256 antes/depois; a mutação não entra em commit                                           |
| a segunda navegação autenticada trazia `NS_BINDING_ABORTED` no Firefox          | removida: o `<Analytics />` vive no `__root` e a página pública já o monta; a asserção segue comportamental                         |
| **N3 (S6):** `reuseExistingServer` local podia reusar preview antigo            | mitigado na bateria: falha se a porta `4173` estiver ocupada                                                                        |
| **N6 (S6):** a spec roda sob o `globalSetup` (auth/PG obrigatórios)             | declarado — a spec não usa `storageState`, mas a suíte não sobe sem seed; os scripts do selo sempre sobem PG                        |
| **N9 (S6):** scratch gitignored (`gate-bak.ts`, `e2e-auth.json`, traces do RED) | declarado — fora do diff; o `gate-bak.ts` fica como cópia de custódia do restauro                                                   |
| `.artifacts/` fora do `ignores` do ESLint 9 flat config                         | segue declarado (WP1–WP4); as capturas do selo usam `.txt`                                                                          |

## 5. Arquivos tocados

`e2e/analytics-gate.spec.ts` (novo; sha256 `9b1c58e9…`, na captura `hashes.txt`) + este selo.
Nenhum `src/**`, `vite.config.ts`, `package.json` ou manifest no diff — a mutação transitória do
gate foi restaurada byte a byte (`b8951518…` antes e depois) e o S7 asserta isso.

## 6. Como reproduzir

```bash
# sobe container PG17 efemero, migra e roda a spec nova nos 4 projetos
bash .artifacts/zz-wp5-e2e.sh green e2e/analytics-gate.spec.ts

# suite completa (E1)
bash .artifacts/zz-wp5-e2e.sh full

# falsificacao: muta o gate, espera a spec vermelha com a requisicao, restaura e espera verde
bash .artifacts/zz-wp5-falsifica.sh

# derruba o container e mede H-9/4173/5439 com zero listeners
bash .artifacts/zz-wp5-e2e.sh cleanup

# o gate do repositorio, sobre os bytes finais
npm run check
```

## 7. S6 ADVERSARIAL

**Revisão auditada (R_a):** `e2e/analytics-gate.spec.ts` `affe7279…`; instrumentos
`zz-wp5-e2e.sh` `0c9f1ff2…` e `zz-wp5-falsifica.sh` `73d76e11…`; logs GREEN/falsifica/full.
**Método:** auditoria read-only por **subagente de contexto limpo** (substituição declarada da lane
`.pi/delegate`), veredicto selado verbatim em `captures/adversarial-wp5-verdict.md.txt`.

**Veredicto:** **6 CONFIRMED · 1 CORRECTED (C2) · 0 REJECTED · 0 UNVERIFIABLE.** A invariante é
real (C1), o GREEN/RED são honestos quanto ao que mostram (C3/C4/C5) e o escopo está contido (C6).
O que não se sustentava era a **integralidade da anti-vacuidade** declarada e a consistência do
selo (C2/C7 + N1/N2/N4).

**Defeitos novos e tratamento:**

| achado                                                                | tratamento                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **N1** — espera de hidratação era sleep fixo (fail-open de timing)    | passou a esperar o marcador `__reactContainer$` do `hydrateRoot(document)` + dois frames; sem hidratar, falha |
| **N2** — `window.va` era asserido como função (serialização inerte)   | passou a `typeof window.va === "undefined"` (string serializável)                                             |
| **N3** — `reuseExistingServer` podia reusar preview antigo em `4173`  | a bateria recusa rodar com a porta ocupada                                                                    |
| **N4** — SPEC descrevia a navegação `/inicio` removida                | ERRATA §8 no SPEC; README alinhado                                                                            |
| **N5** — rótulo "requisições" contava ocorrências textuais            | rótulo corrigido no instrumento e no log re-executado                                                         |
| **N6/N8/N9** — acoplamento a auth/PG, medição em uma direção, scratch | **declarados** na §4                                                                                          |
| **N7** — lacunas de captura (`check`, H-9, cleanup)                   | fechadas: `gate-local.log.txt`, `bateria-cleanup.log.txt` e S7 que asserta portas/containers                  |

**Revisão final (R_b):** a spec e o SPEC foram corrigidos e a falsificação e a E1 **re-executadas
do zero** sobre os bytes finais (RED 4/4 projetos com a requisição; GREEN 4/4; E1 `60 passed`).
As correções **não afrouxam nenhuma asserção** — tornam a medição sincronizada com a hidratação e a
anti-vacuidade verdadeira.
