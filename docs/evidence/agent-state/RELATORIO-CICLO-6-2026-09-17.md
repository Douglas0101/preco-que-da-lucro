# RELATÓRIO DO CICLO 6 — NAS-2 (2026-09-17)

**WP:** `F-C4-1` — o mapeamento `23503 → CONFLICT` estava **latentemente morto** (defeito **pré-existente**, severidade ALTA, achado do veredicto adversarial do ciclo 4).
**Base:** `0b797b8` (= `origin/develop` **com CI verde**) · **entrega:** `959fae1` → merge **`b362671`** · **publicado:** sim.

## 1. Loop S0–S9 — checklist

| fase               | o que foi feito                                                                                                                                                                                                                                                         | evidência                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **S0 SELECT**      | WP escolhido na ordem prescrita pelo supervisor (H-10 → `WP-9.2T` → **`F-C4-1`** → `WP-BAT-1` → `MEM-D4`); base com CI verde                                                                                                                                            | `QUEUE.md` §Ciclo 6               |
| **S1 SPEC**        | `SPEC-CARDS/CICLO-6.md`: DoD de 6 itens, RED→GREEN obrigatório, **controle negativo**, escopo exclusivo, "NÃO fazer"                                                                                                                                                    | spec-card versionado              |
| **S2 ISOLATE**     | worktree + branch `mission/n6a-fk-conflict` + container efêmero próprio; `cwd` explícito; `env -u`                                                                                                                                                                      | claim §ambiente                   |
| **S3 BUILD**       | `isForeignKeyViolation` passa a **caminhar a cadeia de `cause`** (profundidade limitada), copiando o padrão canônico de `memory.repository.ts:303-311`; **sem** consolidar helpers (diff mínimo, declarado)                                                             | `959fae1` (13+/1−)                |
| **S4 VERIFY (E1)** | **RED real** (teste entregue rodado contra o pai: `4 failed \| 5 passed`) → **GREEN** (`9 passed`); **caminho real de banco** medido sob `app_runtime` + GUCs: **409/CONFLICT** com histórico e filho **preservados**; `tsc`/`build`/`boundaries`/`format`/`eslint` = 0 | claim `WP-C4-1.md`                |
| **S5 BROWSER**     | **não aplicável ao WP** (nenhuma superfície de UI tocada): smoke de boot como evidência — `/`, `/auth`, `/api/health/live`, `/api/health/ready` = **200**; rotas autenticadas servem o shell SPA (4231 B); a bateria real do WP é a de banco (acima)                    | este relatório §3                 |
| **S6 ADVERSARIAL** | verifier em contexto novo: **25 CONFIRMED · 5 CORRECTED · 0 REJECTED · 2 UNVERIFIABLE** — núcleo **não falsificado**                                                                                                                                                    | `CLAIMS-INBOX/WP-C4-1-VERDICT.md` |
| **S7 GUARD**       | env-guard **13/13** · secrets-audit exit 0 · lockfile OK · `:5432` **intocado** (26 tabelas) · preview **sem** `DATABASE_URL_UNPOOLED`                                                                                                                                  | este relatório §4                 |
| **S8 SEAL**        | matriz **regenerada pelo MAESTRO** (`directDatabaseFiles` **46 → 47** — o arquivo de teste novo conta como arquivo de banco direto; `matrix:check` verde); claim corrigido **append-only**; ledger com marcador parent-pinned                                           | `docs/specs/M-02/matrix.yaml`     |
| **S9 LAND**        | merge em `develop` com **E2 verde**; push autorizado; follow-ups registrados; nada tocado em produção                                                                                                                                                                   | `git log`; `SUPERVISION-LOG`      |

## 2. O que o veredicto provou (e o que corrigiu)

**Provado (o núcleo):** o fix funciona no **caminho real** — o verifier subiu o próprio container, migrou, rodou sob `app_runtime` com GUCs de tenant e mediu `ApplicationError{code: CONFLICT, status: 409, retryable: false}` no delete de filho com histórico, com **histórico e filho preservados**; o **shape** medido por ele: `depth 0 = DrizzleQueryError (sem code)` → `depth 1 = DatabaseError code 23503`; controles negativos seguram (`23505`, sem `cause`, `cause` circular, `null`/string/objeto, cadeia de 1000 níveis → `false` sem travar); diff mínimo (2 hunks, `catch`/mensagem intactos); testes existentes **sem asserção alterada**.

**Corrigido:** o erro anterior era **503 `DATABASE_ERROR`** (não 500); as contagens de skip do arquivo novo são **5 passed | 4 skipped** no `check`; e — **material** — o commit **introduz drift de matrix** (o claim dizia "nada a regenerar"), já regularizado pelo MAESTRO.

## 3. Dívidas novas (registradas, não silenciadas)

| id         | conteúdo                                                                                                                                                                                                                                                                                                                                        | por que importa                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **F-C6-1** | o mapeamento é **agnóstico de tabela** e a mensagem é fixa ("histórico de preços"): um `23503` de outra FK vira 409 com texto errado. Impacto **hoje nulo** (só existe uma FK `RESTRICT` desse par), mas mente no futuro. Somado: a folga de profundidade (real = 1; tabela até 3) — um segundo wrapper voltaria a falhar **em silêncio** (503) | correção pequena: inspecionar `constraint` no erro e/ou mensagem genérica + teste de profundidade           |
| **F-C6-2** | **a prova de banco fica fora do E2**: `db:test` não roda o arquivo novo e `check` roda vitest **sem** `DATABASE_ADMIN_URL` (o vitest **não** lê `.env`) ⇒ **5 passed \| 4 skipped**; a única prova de 409/CONFLICT **não entra na CI**                                                                                                          | mesma classe do R6 do ciclo 4 — encadear os testes de banco novos em `db:test` (ou prover a URL no `check`) |

## 4. Guard (S7)

`env-guard --selftest` **13/13** · `secrets-audit` exit 0 · `lockfile-guard` OK · `:5432` **intocado** (26 tabelas) · preview do ciclo **sem** `DATABASE_URL_UNPOOLED` · containers efêmeros removidos · nenhum host remoto · nenhuma migração fora de container.

## 5. Placar e próximo despacho

- **Placar: inalterado** (86,36% parcial / 80,21% crua) — `F-C4-1` é correção de defeito **fora** do denominador do Plano (o item não existe na régua).
- **Próximo (ordem do supervisor):** **`WP-BAT-1`** (lacunas de bateria §32/§33) → depois **`MEM-D4`** (H-12 aprovado + SD-C3-12). Filas paralelas: **F-C6-1**/**F-C6-2** (deste ciclo), **F-C5-2**/**F-C5-3** (scanner/gate da matriz) e **WP-B1** (`@vercel/analytics`).
- **Gates humanos:** **H-10 fechado** · **H-12 aprovado** · seguem **H-6** (2 min no Firefox do dono), **H-4** (plano Free ⇒ 6 h), **H-9**, **H-2**, **H-11**, **H-5**, **H-8**.
