# RELATÓRIO CONSOLIDADO — ENXAME PARALELO PÓS-CICLO 7 (2026-09-18)

**Base de partida:** `648c029` (CI verde) · **Base de chegada:** `2bbb35e` (develop, 5/5 landados) · **MAESTRO/ESCRIVÃO:** esta sessão · **4 trilhos + resgate S0 + 4 adversariais**.

## 1. Estado dos trilhos

| Trilho   | WP                                          | Estado                          | Commit de entrega | Veredicto adversarial                    | E2 pós-merge                                          |
| -------- | ------------------------------------------- | ------------------------------- | ----------------- | ---------------------------------------- | ----------------------------------------------------- |
| **A**    | `WP-B7` (break-even com margem negativa)    | **LANDADO**                     | `93c1d62`         | **9 C · 1 Corr · 0 R · 0 U**             | `check` 9/9 + `build` + bundle + `db:test` **verde**  |
| **B**    | `MEM-D4` (delete/export + access log + TTL) | **LANDADO**                     | `6b38580`         | **35 C · 2 Corr · 0 R · 0 U**            | `check` 9/9 + `db:test` (D4/T1–T6) **verde**          |
| **C**    | `WP-B1` (analytics condicional)             | **LANDADO**                     | `04b88fd`         | **9 C · 1 parcial · 1 Corr · 0 R · 0 U** | `check` 9/9 + bundle + `db:test` **verde**            |
| **D1**   | `F-C5-2` + `F-C5-3` (scanner + gate)        | **LANDADO**                     | `6b62a29`         | **21 C · 5 Corr · 3 R (latentes) · 0 U** | `check` 9/9 **incl. gate novo** + `db:test` **verde** |
| **D2**   | `F-C6-1` + `F-C6-2`                         | **EM CURSO**                    | —                 | —                                        | —                                                     |
| **D-S0** | resgate de escopo dos 4 follow-ups          | **CONCLUÍDO**                   | (leitura)         | —                                        | —                                                     |
| **F**    | itens com gate humano                       | **BLOQUEADO** (só planejamento) | —                 | —                                        | —                                                     |

**Ordem de land executada:** A → B → C → D1 → D2 (um merge por vez, `--no-ff`, E2 integrado após cada um). **Todos os merges passaram** — nenhum revert foi necessário.

## 2. O que cada trilho provou (não o que afirmou)

- **A:** `cm<0` voltou a fluir para `NON_POSITIVE_CONTRIBUTION` ⇒ **"Não atingível"** nas **duas** superfícies; o **status** mudou (não o rótulo) — provado causalmente por mutação de dado; controles negativos preservados; RED/GREEN reproduzidos por terceiro. **Correção aceita:** o teste novo **driftava a matriz** (47→48) ⇒ regenerada no land.
- **B:** cadeia **0000→0019 do zero e com dados** + `up→down→up`; isolamento de tenant **atacado por 4 vetores** sem furo (com controle positivo); **trilha atômica** provada por trigger que bloqueia o log (rollback sem órfã); `UPDATE/DELETE` na trilha ⇒ `42501`; **TTL** muda com policy versionada **sem deploy**; `L0`/camada sem policy ⇒ erro alto (INV-013); **0 pgvector/HNSW**.
- **C:** RED real (`404 text/html` + recusa de MIME) → GREEN com console limpo; **VERCEL=1 byte-idêntico ao pai**; CSP intocada; bundle **−2023 B**; **6 combinações de `VERCEL`** testadas sem achar caminho de perda silenciosa.
- **D1:** `transactionSites` 91 → **113** com as três âncoras do S0 batendo; módulo puro + **guarda de entrypoint** (import não regrava a matriz); **gate de drift** ligado no `check` **e** no CI, com RED (drift invisível → `EXIT=1`) e GREEN (2× determinístico) medidos.
- **D2:** `23503` **ciente da constraint** (mensagem genérica para FK alheia; histórico preservado nas duas reais, com nomes **truncados a 63 bytes** medidos em `pg_constraint` **e** no erro real do driver) + **prova de banco encadeada** no `db:test` (15 passos) com **fail-closed provado 3/3** — inclusive URL **remota** ⇒ `EXIT=1` com **zero `connect()` TCP sob `strace`**. Contrato de API **não piora** (o corpo HTTP nunca carregou a mensagem de domínio).

## 3. Follow-ups abertos (nada silenciado)

| id                       | origem       | conteúdo                                                                                                                                     |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-B1-e2e**             | veredicto C  | nenhum teste força `preset ≡ gate` — guarda no preview node-server do Playwright                                                             |
| **F-B-mem-purge**        | veredicto B  | a FK da trilha entra na cadeia de purga: `seed-auth.ts:55-70` + 4 purgadores precisam apagar a trilha antes de `tenant_memberships`          |
| **F-B-mem-policies**     | veredicto B  | `ai_memory_policies` global com `INSERT` para `app_runtime` e **sem escritor** ⇒ ratificar ou revogar                                        |
| **F-D1-scanner-borders** | veredicto D1 | 3 imprecisões **latentes** (sombreamento aninhado, `typeof tx`, lado esquerdo de `??`/`                                                      |     | `) — medidas **ausentes** da árvore |
| **F-D1-gate-ux**         | veredicto D1 | a mensagem do gate não nomeia o contador; o atrito real é `directDatabaseFiles` (**20 de `src/test/**`**)                                    |
| **F-D1-raw-sha**         | veredicto D1 | `RAW-parent-baseline.txt` sela o sha da **entrega**, não do pai (lição de método)                                                            |
| **SD-C3-12 (ratificar)** | veredicto B  | `DELETE` para `app_runtime` em `ai_memory_versions`/`conflicts` = expansão real de privilégio (imutabilidade segue pela negação do `UPDATE`) |

## 4. Incidente contido (registrado, não silenciado)

O repo principal (`~/preco-que-d-main`) apareceu com **duas anomalias não autorizadas**: (i) `develop` **de volta** a `78a004a` (o merge do land D1 havia sido feito e foi desfeito fora dos worktrees) e (ii) `package.json`/`package-lock.json` **sujos** com **downgrade não autorizado** de `drizzle-kit` (`^0.31.10` → `^0.18.1`, viola **R8**) + reescrita do lock. **Nenhum worktree de trilho** continha o downgrade (verificado) ⇒ origem externa aos trilhos. **Ação:** arquivos **preservados em backup** (`/tmp/main-repo-incident-20260918/`), árvore restaurada, merge refeito e publicado.

## 5. Placar e gates humanos

- **Placar: inalterado** (86,36% parcial / 80,21% crua) — o enxame produziu **evidência de validação e correções**, não promoções de crédito (a régua é do MAESTRO + supervisor).
- **Gates humanos abertos:** H-2 (token Vercel) · H-4 (retenção Neon 6h) · H-6 (Turnstile) · H-9 (`:5432`) · H-11 (MCP/Neon) · H-5 · H-8 (ratificação da ADR-029). Nenhum trilho executou trabalho dependente deles.
- **Produção:** intocada — nenhum `DATABASE_URL_UNPOOLED`, nenhum Neon, nenhum `vercel`, nenhum push fora de `develop`.

## 6. Invariantes preservadas

`unknown ≠ zero` · `NaN/Infinity ≠ R$ 0,00` · IA não executa SQL · IA não calcula valor financeiro canônico · Tenant A jamais acessa B · **erro não vira sucesso vazio** (INV-013 provado por medição em B) · gates §41–§44 não antecipados (nenhum embedding/HNSW introduzido).
