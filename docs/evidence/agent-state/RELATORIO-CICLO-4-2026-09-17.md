# RELATÓRIO DO CICLO 4 — NAS-2 (2026-09-17)

**WP:** `9.2`-residual — zerar os **4 pontos de acesso direto à transação** (item PARTIAL do Plano Mestre).
**Base:** `fdd7e4d` (= `develop` após o reconhecimento de infra) · **HEAD do ciclo:** `2d02936` (merge da correção) · **nada pushado** (H-10 aberto, 213 commits locais).

## 1. Loop S0–S9 — checklist do ciclo

| fase               | o que foi feito                                                                                                                                                                                                                                     | evidência                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **S0 SELECT**      | WP escolhido pelo dono entre as trilhas desbloqueadas (não depende de `H-*`); SHA registrado; ambiente do enxame **limpo pela regra `env -u`** (a stop condition do ciclo 3 segue contida — a limpeza do perfil é ação do dono, opção **A** aceita) | `QUEUE.md` §Ciclo 4; `/proc/<pid>/environ` do preview sem `DATABASE_URL_UNPOOLED` |
| **S1 SPEC**        | `SPEC-CARDS/CICLO-4.md`: DoD com 6 critérios, os 4 pontos **nominais** (`MEDICAO:109`), testes obrigatórios, escopo exclusivo, "NÃO fazer", âncoras (`PLANO:790-802`, M-02 `spec.md:57-60`, `V7:2521`)                                              | spec-card versionado                                                              |
| **S2 ISOLATE**     | worktree + branch `mission/n4a-9-2-residual` + container efêmero próprio; **`cwd` explícito** e **`env -u`** em todo comando (lições do ciclo 3 aplicadas — zero colisão desta vez)                                                                 | claim §ambiente                                                                   |
| **S3 BUILD**       | contrato `product.contracts.ts` **type-only**; `product.repository.ts` como único do agregado com o driver; os 4 pontos rewired; regras de negócio preservadas no consumidor                                                                        | `4660d0c` + `5a4bd86`                                                             |
| **S4 VERIFY (E1)** | grep de resíduo (22→0, 4→0, 7→0, com controle positivo), 5 arquivos de teste do card verdes **sem asserção alterada** (36/36), teste de banco novo (14/14), `tsc` 0, `m02:boundaries` 0                                                             | claim `WP-9.2R.md`                                                                |
| **S5 BROWSER**     | bateria **Firefox** no preview local: `/produtos`, `/precos`, `/ponto-equilibrio` **3/3 OK**; capturas seladas                                                                                                                                      | `docs/evidence/cycle-4-92r-2026-09-17/`                                           |
| **S6 ADVERSARIAL** | verificador em contexto novo: **8 CONFIRMED · 1 CORRECTED · 2 REJECTED** (os 2 REJECTED = o defeito de fronteira que o E2 confirmou)                                                                                                                | `CLAIMS-INBOX/WP-9.2R-VERDICT.md`                                                 |
| **S7 GUARD**       | `env-guard --selftest` **13/13** · `secrets-audit` exit 0 · `lockfile-guard` OK · `:5432` **intocado** (26 tabelas) · preview **sem** credencial de produção · nenhum segredo nos artefatos                                                         | este relatório §4                                                                 |
| **S8 SEAL**        | matriz regenerada (MAESTRO): **`directDatabaseFiles` 48 → 46** e `transactionSites` 123 → 119; capturas com manifesto `sha256sum -c` = ALL MATCH; ledger com marcador parent-pinned                                                                 | `docs/specs/M-02/matrix.yaml`; `screenshots.sha256`                               |
| **S9 LAND**        | merge em `develop` (branch diária) com E2 verde; **nada pushado**; follow-ups registrados; próximo despacho proposto                                                                                                                                | `git log --oneline -3`                                                            |

## 2. O que o E2 pegou (e por que valeu a regra)

O E1 do squad estava **verde** (vitest, tsc, boundaries, grep). O **E2 quebrou no `build`**:

```
[plugin tanstack-start-core:import-protection] Import denied in client environment
  Denied by file pattern: **/server/**   Importer: src/lib/products.functions.ts
  Import: "src/server/repositories/product.repository"
```

**Causa-raiz (duas camadas, diagnosticada na correção):**

1. O BFF importava o **repositório** (camada server-interna) — a fronteira M-02 manda o BFF falar com **services**. Trocar para o serviço, porém, **não bastou**.
2. O compilador do TanStack exige `createServerFn` **atribuído a variável**: a **fábrica** `deleteChild(kind)` (única cadeia aninhada do repo, `products.functions.ts:509`) nunca vira candidata a server-fn, então o handler dela permanecia vivo no módulo **cliente** e, com ele, qualquer import `@/server/**` que ele fechava. Os demais `*.functions.ts` só têm cadeias de topo — por isso o serviço neles é eliminado por dead-code e o build é verde.
3. **Correção:** `deleteIngredient`/`deletePackaging`/`deleteFee` viraram **três cadeias de topo**; os 8 call sites passaram a usar `productService`; a asserção de tenant mudou para o serviço (mesma semântica, imediatamente antes da escrita). `build` exit 0.

**Lição incorporada ao processo:** o **E1 de todo WP que toca módulo alcançável pelo cliente passa a incluir `npm run build`** (registrado no `SPEC-CARDS/CICLO-4.md` e no `SUPERVISION-LOG`).

## 3. Veredicto adversarial (`WP-9.2R-VERDICT.md`)

**8 CONFIRMED · 1 CORRECTED · 2 REJECTED · 0 UNVERIFIABLE** — com sondas próprias (worktree `--detach`, container `:55480`, probe de 20 asserções sob `app_runtime`).

Resíduos que **viram follow-up** (registrados, não silenciados):

| id     | severidade                              | conteúdo                                                                                                                                                                                                                                                                                                                                 | encaminhamento                                                                         |
| ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **R2** | **ALTO — pré-existente**                | o mapeamento `23503 → CONFLICT` em `products.functions.ts:189-192` está **latentemente morto**: `drizzle-orm@0.45.2` embrulha em `DrizzleQueryError` com `code=undefined` e `23503` no `.cause` ⇒ `deleteIngredient`/`deletePackaging` com histórico devolvem erro interno em vez de **409**. **Antes e depois** do WP (não é regressão) | **F-C4-1** — WP próprio (correção pequena, com teste que falha hoje)                   |
| **R3** | MÉDIO — **residual real do item `9.2`** | o contrato é independente de driver em runtime (bundle 0 bytes), mas o **grafo de tipos** ainda alcança `@/db/client.server` via `RequestContext.transaction` (prova: `tsc` com `@/db/*` remapeado ⇒ TS2307 em `src/lib/request-context.ts:1,42`). É literalmente o "contextos são tipados pelo driver" que o item nomeia                | **F-C4-2 / WP-9.2T** — desacoplar o tipo do contexto (mudança de infra, ciclo próprio) |
| R4     | BAIXO                                   | `src/test/contracts.test.ts:9-19` (lista canônica `CONTRACTS`) não inclui o contrato novo                                                                                                                                                                                                                                                | incluir junto do próximo WP de contratos                                               |
| R6     | BAIXO                                   | o bloco de banco do teste novo **skipa** sem URL loopback e não está na cadeia `db:test` (o E2 com container vê 9 skips)                                                                                                                                                                                                                 | encadear em `db:test` no próximo ciclo                                                 |

## 4. Bateria S5 (Firefox) e um achado para o §20.1

- **3/3 rotas OK** no Firefox contra o preview local (`/produtos`, `/precos`, `/ponto-equilibrio`), sem erro **novo** de console.
- **Achado:** o Firefox **expõe no console** as violações da CSP **Report-Only** — `would block an inline script`, `an inline style`, `a JavaScript eval` — além do já conhecido 404 do `_vercel/insights/script.js` (**B-1**). Ou seja: a política atual, se **enforçada**, bloquearia scripts/estilos **inline** (o canal de soak do §20.1 está fazendo exatamente o trabalho dele). **Consequência para H-6/`20.1`:** promover a CSP exige nonce/hash para os inline do SSR — não é só "ligar o switch". Registrado como insumo do gate.

## 5. Placar e próximos passos

- **Placar: inalterado** (86,36% parcial / 80,21% crua) — o item `9.2` **não** fecha ainda: o residual R3 (tipagem do contexto) é parte do próprio item. O WP entregou a metade **runtime** (4 pontos zerados, medido: `directDatabaseFiles` 48→46).
- **Próximo despacho proposto (S0 do ciclo 5):** `WP-9.2T` (desacoplar o tipo de `RequestContext.transaction` do driver ⇒ fecha `9.2`) **ou** `WP-BAT-1` (lacunas de bateria §32/§33) **ou** `MEM-D4` (bloqueado pelo briefe **H-12**).
- **Gates humanos:** **H-10** (push/CI — 213 commits locais) · **H-6** (hPanel; Turnstile bloqueia automação — 2 min no Firefox do dono) · **H-4** (**causa-raiz identificada:** plano **Free** ⇒ retenção 6 h; exige upgrade para Launch ou exceção P9) · **H-2** (token Vercel; SPA inacessível por automação) · **H-9** (`:5432`) · **H-12** (TTL/export) · **H-11** · **H-5** · **H-8**.
- **Ambiente:** `:5432` intocado · containers efêmeros removidos/removíveis · preview do ciclo parado ao fim · **nada pushado**.
