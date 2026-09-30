# RELATÓRIO SDD — `F-D2-runner-failopen` (TRILHO A)

> Trilha A do Bloco 1 do prompt SDD de 2026-09-19. Escopo autorizado pelo MAESTRO: **apenas o Bloco 1**, trilhos A → B → C, serial. Trilho I **parqueado** (MCPs 0/7).
> Selado em `2026-09-19T16:41:10Z` no commit **`5fba8e7e3a9308d29a6e731f7ad7c03914394cad`**. **Land NÃO executado** — Gate C pendente.

## 1. Estado

| Campo      | Valor                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `mission/a-runner-failopen`                                                                                                                                                                   |
| Worktree   | `.worktree-a-failopen` (gitignored por `.gitignore:56` = `.worktree-*/`)                                                                                                                      |
| Base SHA   | `9e22a6799652b4b65b67ea6ae8cfa3c1e662dbf0` (= `origin/develop`, CI verde)                                                                                                                     |
| Head       | **`5fba8e7e3a9308d29a6e731f7ad7c03914394cad`** em `mission/a-runner-failopen` — 4 `M` + 1 `A` (base + 5 arquivos)                                                                             |
| Land       | `develop` = **`1a11ee285cd6c2587f6ad52acaca1ae08529d288`** (`--ff-only` `9e22a67..5fba8e7` + commit documental) — **pushado** a `origin/develop`                                              |
| CI local   | `npm run check` **exit 0** (9/9 gates, incl. gate da matriz) · `npm run db:test` **exit 0** (16 suítes) — `captures/bateria-final-2.log.txt`                                                  |
| CI origin  | **os dois pipelines VERDES** em `1a11ee2` — `UI stack` run `35456266833` (**24/24 passos**) e `CI light` run `35456266847`; `origin/main` = `9724d2c` **intocado** — `captures/ci-digest.txt` |
| MCPs       | **0/7** — `MCP_DOCKER`, `playwright`, `context7`, `github`, `chrome-devtools`, `linear` sem listener; `neon` só cache (113 tools)                                                             |
| Containers | `trk-a-pg` — `postgres:17-alpine`, **PostgreSQL 17.11**, `127.0.0.1:5433` (efêmero)                                                                                                           |
| `:5432`    | **intocado** (H-9 aberto)                                                                                                                                                                     |

### Vínculo commit ↔ selo, e o manifesto

Os sha256 abaixo **não** vêm só do worktree: `git show 5fba8e7:<path> | sha256sum` devolve **os mesmos cinco hashes byte a byte**, o que prova que o commit contém exatamente os bytes verificados pela bateria limpa. O diretório de evidência é inventariado em `MANIFEST.sha256` (**47 entradas**, `sha256sum -c` 47/47, invariante **`checked === discovered` OK**).

### sha256 da revisão sob selo

```
7245a024d59e7d7626d9f6cffff95157a5e12a100c6b7feea238f8be605485d9  .github/workflows/ui-stack.yml
72d953a9679d82fd65d2994b5b62aa5bbeb34b9787ea113da66ff0f6ce926f30  scripts/db/test-products-fk-conflict.ts
5b45dd8201d6469d645f33ad3234d3816eb54d7790317bec577ca8e0a8570a64  scripts/db/test-product-contracts.ts
5e11fc2968603050e0ec4367e554b9d1184f01bd3004e283b4431642a7021ad5  package.json
78b9270412fb72cba69129b2917a4d5034beda752d1860f5bb5f208af24086a3  AGENTS.md
```

## 2. Entrega

### 2.1 O que a spec pedia — e o que a medição encontrou

A spec do F-D2 (`EXECUTION-STATE-PROGRAM.md`, follow-up do land D2) partia de **três premissas**. Todas as três foram medidas contra PG17 efêmero antes de qualquer edição, e **duas são falsas**:

| Premissa registrada                                                             | Medido                                                                                                                                 | Veredicto |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Os testes de banco "skippam silenciosamente na CI" (`ERRATA-1`, `:1772`)        | Com admin+URL loopback e `DATABASE_URL_UNPOOLED` **ausente**, o bloco **executa**: `13 passed (13), 0 skipped`                         | **FALSA** |
| `isLoopbackUrl(undefined) → false` ⇒ teste pulado (decisão do MAESTRO, `:1830`) | `if (!value) return true` — verbatim em `src/test/products-fk-conflict.test.ts:232-240` e `src/test/product-contracts.test.ts:168-176` | **FALSA** |
| O padrão dos ciclos 3–5 (`env -u DATABASE_URL_UNPOOLED`) não satisfaz o gate    | Satisfaz: exit 0, `13 passed (13)`                                                                                                     | **FALSA** |

**Causa raiz dos 13 skips que originaram a spec (medida):** o vitest **não** carrega o `.env` do checkout para `process.env` — numa corrida crua as três variáveis chegam **ausentes**, logo `Boolean(adminUrl)` é falso e o gate **fecha**. É por isso que `npm run test` local mostra 13 skips; **não** é a variável que o ledger culpa. Na CI o bloco `env:` do job fornece admin+URL loopback ⇒ o gate **abre** ⇒ **os blocos de banco já executavam e passavam na CI antes deste WP** (a CI verde em `9e22a67` é a prova indireta: com o gate aberto, uma falha seria vermelha).

> **Consequência para o registro:** o defeito que o F-D2 descrevia **não existia como descrito**. O que este WP de fato fecha são dois fail-opens **reais e distintos**, ambos encontrados por medição própria (§2.2). A correção do ledger é a **ERRATA-5** (§5) — _append-only_, aguardando ratificação no land.

### 2.2 Correção entregue (5 arquivos)

1. **`.github/workflows/ui-stack.yml`** — `DATABASE_URL_UNPOOLED` declarada no `env:` **do job** (linha 51), valor loopback determinístico, com comentário que documenta a semântica real do gate. **O que isto resolve:** torna o alvo de banco determinístico em vez de dependente do que o ambiente do runner ofereça. **O que isto NÃO é:** não é o que faz os casos rodarem na CI — eles já rodavam (o comentário diz isso explicitamente, para não propagar a premissa falsa).

2. **`scripts/db/test-products-fk-conflict.ts`** — piso de cardinalidade `MIN_TOTAL_TESTS = 13`, avaliado **antes** do assert de falhas; cabeçalho reescrito para descrever a mecânica medida.

3. **`scripts/db/test-product-contracts.ts`** _(novo, 112 linhas)_ — runner que faltava. **Defeito real fechado:** `src/test/product-contracts.test.ts` tem **14 casos, 9 deles gated** por `dbDescribe`, e **nenhum passo** de `db:test` assertava que executaram. Um gate fechado deixaria `npm run test` verde com `5 passed | 9 skipped`.

4. **`package.json:61`** — cadeia `db:test` 15 → **16** passos (nenhum passo removido; prefixo da base idêntico, verificado por adversário contra `git show 9e22a67:package.json`).

5. **`AGENTS.md:61`** — documentação 15 → **16** suítes (AGENTS.md documenta os comandos ⇒ muda no mesmo commit).

### 2.3 O fail-open que os pisos fecham

Não é "0 casos" — o vitest **sai 1** com 0 casos e o runner reprova no assert de `status`. O fail-open real é **deleção silenciosa de prova**: um arquivo reduzido a poucos casos, todos passando, sairia **exit 0 e verde** com a cobertura encolhida. Medido nos dois sentidos (§3.2).

### 2.4 Fora de escopo (declarado, não silenciado)

- **Incompatibilidade dos workflows Neon** (§6.1) — achado pré-existente, não corrigido.
- **Gap de substituição** (§6.2) — residual do próprio runner, registrado como follow-up.
- Nenhum arquivo de `src/**` foi tocado. Nenhuma migration. Nenhuma dependência.

### 2.5 A `DATABASE_URL_UNPOOLED` no `env:` do job — adjudicação do alias legado

O item (a) do DoD manda **declarar** a variável no `env:` do job. Duas fontes do repositório tratam esse nome como aposentado, então o conflito foi adjudicado com o texto **verbatim**, não por impressão:

- `docs/specs/M-02/emenda-2026-09-08-urls-direct-pooled.md:18` — classifica `DATABASE_URL_UNPOOLED` como **"direct legado"**, uso permitido nesta norma: "**alias de transição, não usar no runtime nem no dia A4**"; coluna Escrita: "**proibida na rodada**".
- `docs/specs/M-02/emenda-2026-09-08-urls-direct-pooled.md:33-34` — "permanece no conjunto examinado pelo guard para detectar hazard, mas **não é um caminho alternativo para a regra**".
- `docs/runbooks/cutover-A4.md:212` — `DATABASE_URL_UNPOOLED`: "**ausente** de todo passo do **dia**".

**Adjudicação:** a proibição é **escopada** — mira o **runtime** e o **dia A4**, não a CI. O uso aqui é `env:` de **job de CI**, valor **loopback**, sem nenhum consumidor em `src/**` (o guard **continua** a examinar o nome, `emenda:33`) ⇒ **não viola a letra**.

**Recomendação ao supervisor: manter o item (a) — mas com a razão correta.** Ele **não** abre o gate (medido: a ausência já o abre); o valor real é **determinismo** e **imunidade** caso o ramo `undefined` de `isLoopbackUrl` seja um dia invertido — sem a declaração, a CI passaria a depender de um comportamento implícito em vez de um valor explícito. Deviar do DoD escrito exigiria razão mais forte que a disponível: **o que muda é a justificativa, não a ação.**

## 3. Evidência

### 3.1 Matriz do gate (medida, `scripts/db/test-products-fk-conflict.ts` / `test-product-contracts.ts`)

| `DATABASE_URL_UNPOOLED` | FK                                    | contracts                             |
| ----------------------- | ------------------------------------- | ------------------------------------- |
| ausente                 | exit 0 · 13/13/0 pending              | exit 0 · 14/14/0                      |
| loopback                | exit 0 · 13/13/0                      | exit 0 · 14/14/0                      |
| remota                  | exit **1** · 9 passed / **4 pending** | exit **1** · 5 passed / **9 pending** |

O gate é exatamente (verbatim, ambos os arquivos): `Boolean(adminUrl) && isLoopbackUrl(adminUrl) && isLoopbackUrl(DATABASE_URL) && isLoopbackUrl(DATABASE_URL_UNPOOLED)`. **Uma URL remota sozinha fecha o bloco** — inclusive a de admin.

### 3.2 Controles de falsificação

| Controle                                   | Resultado                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| arquivo com **0 casos**                    | vitest sai **1** ⇒ reprova no `assert.equal(result.status, 0)` antes das demais              |
| arquivo com **1 caso que passa**           | **exit 1** — `AssertionError … não produziu casos suficientes: 1 < 13`                       |
| o mesmo 1 caso **sem o piso** (adversário) | **exit 0** · `1 passed (1), 0 skipped` ⇒ o piso é a **única** barreira                       |
| URL remota                                 | exit 1, prova declarada pulada, **zero `connect()`** (o gate fecha antes de qualquer socket) |

### 3.3 Bateria final (revisão selada)

**Duas corridas, e a segunda é a autoritativa** — a primeira reprovou por contaminação minha, não pelo entregável.

| Corrida               | Log bruto                          | `db:test`                                  | `npm run check` | Causa                                                                                                                                            |
| --------------------- | ---------------------------------- | ------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1ª (contaminada)      | `captures/bateria-final.log.txt`   | **0** (16 suítes, as duas linhas de prova) | **1**           | 88 erros `prettier/prettier`, **100 % em `.artifacts/`** (scratch gitignored meu + do adversário), **zero** em arquivo do repositório — ver §6.4 |
| **2ª (autoritativa)** | `captures/bateria-final-2.log.txt` | **0** (16 suítes, as duas linhas de prova) | **0**           | ambiente limpo                                                                                                                                   |

Nas duas, as linhas de prova são idênticas: `13 passed (13), 0 skipped` e `14 passed (14), 0 skipped`, ambas contra `127.0.0.1:5433`. **A revisão não mudou entre as corridas** (o scratch nunca fez parte dela); mudou o ambiente.

O scratch de sonda foi **preservado como prova** em `captures/adversarial-probes/` (43 arquivos, 340 KB) com sufixo `.txt` para que nem o ESLint nem o prettier o processem — é a receita de reprodução das falsificações do §3.2 e da caça do §3.4.

### 3.4 Adversarial (S6) — contexto fresco, `oracle` (read + bash)

10 claims auditados: **C1–C8 e C10 CONFIRMED · C9 CORRECTED** (a árvore do repo principal tem `M PROGRESS.md`, o symlink `deepseek-harness` e os artefatos do incidente de dependência — todos conhecidos e declarados) · **0 REJECTED · 0 UNVERIFIABLE**.

Confirmado de forma independente e load-bearing: o `numTotalTests` é um **número real** no reporter JSON (`undefined >= 14` seria `false` — falha fechada de qualquer modo); não há caminho de sumário obsoleto/parcial (arquivo vazio e exceção de coleta saem 1 **antes** de ler o sumário; `mkdtempSync` por corrida); nenhum segredo/host remoto introduzido. A caça aberta encontrou os dois residuais da §6.

### 3.5 Achados que **não** são deste WP, mas foram provados aqui

- `it.todo` derrota o guard de `numPendingTests` (reporta `numTodoTests`, não pending) — quem salva é `numPassedTests === numTotalTests`.
- **A CI executava os casos de banco em dobro**: uma vez em `npm run test` e outra em `db:test` (consequência da §2.1).

### 3.6 CI real — os dois pipelines verdes em `1a11ee2` (o DoD f)

| Pipeline                   | run           | conclusão                       |
| -------------------------- | ------------- | ------------------------------- |
| `UI stack` (pesado)        | `35456266833` | **`success`** — 24 de 24 passos |
| `CI light (docs/evidence)` | `35456266847` | **`success`**                   |

A etapa `Run npm run db:test` **executou de verdade na CI**, com as **duas** linhas de prova e `0 skipped`:

```
prova de banco (src/test/products-fk-conflict.test.ts) contra 127.0.0.1: 13 passed (13), 0 skipped — admin=127.0.0.1:5432
prova de banco (src/test/product-contracts.test.ts) contra 127.0.0.1: 14 passed (14), 0 skipped — admin=127.0.0.1:5432
```

Bruto: `captures/ci-ui-stack-db-test-step.txt` (**341 linhas**, a etapa inteira extraída do log da CI, ANSI cru)
com companion legível `ci-ui-stack-db-test-step.ansi-stripped.txt`; metadados dos runs em
`captures/ci-digest.txt`. Na CI o alvo é o serviço `postgres:17-alpine` do próprio job
(`127.0.0.1:5432` **dentro do runner**) — loopback, exatamente como o `:5433` da validação local.

Também `success` no mesmo run: `npm run test` (`Test Files 87 passed (87)`), `db:check`, `build`,
`check:bundle`, `Audit dependencies` e `test:e2e` (chromium/firefox/webkit).

## 4. Gates

| Gate                                            | Estado                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — `db:test` verde + prova em PG17 efêmero | **SATISFEITO** (16 suítes, 0 skipped, `:5433` — e, na CI, `:5432` do job, também 0 skipped)                                                                |
| **B** — B1 concluído, sem contenção             | **SATISFEITO** — contenção A × B verificada **∅** (`ui-stack.yml` + `scripts/db/*` vs `budget-ledger.server.ts`/`telemetry.ts`/script novo/`package.json`) |
| **C** — aprovação do supervisor                 | **SATISFEITO** — autorizado pelo humano (`Aprovar land + seguir ao trilho B`); land e push executados                                                      |
| **I** — trilho I                                | N/A (parqueado; MCPs 0/7)                                                                                                                                  |

## 5. ERRATA-5 (APLICADA ao ledger no land)

O ledger afirma hoje, em dois lugares, uma mecânica **contrária ao código medido** — e o meu comentário no YAML a contradiz abertamente. Se o land não registrar a correção, o próximo boot **re-deriva a crença falsa**. Texto pronto em `ERRATA-5.md` (append-only, mesma forma da ERRATA-1..4 do Stream A).

## 6. Riscos, follow-ups e decisões pendentes

### 6.1 Achado: workflows Neon incompatíveis com o contrato do runner (PRÉ-EXISTENTE)

`.github/workflows/neon-pr-branch.yml:300-306` e `.github/workflows/neon-readiness.yml:249-253` rodam `npm run db:test` contra branch **remota** e sem `DATABASE_URL_UNPOOLED`. Medido: **exit 1** nos dois runners (`a prova de banco foi pulada (4 | 9 testes pendentes)`). São **vermelhos por desenho** desde o F-C6-2 (2026-09-18/19), hoje mascarados (`NEON_API_KEY` ausente ⇒ skip gracioso; `workflow_dispatch` manual).

**Conflito de desenho, não bug:** o kill-switch é _loopback-only_ por construção (anti-credencial-de-produção) ⇒ **nenhum CI com alvo remoto pode exercitar essas provas**. "Drill de branch Neon" e "kill-switch" são mutuamente exclusivos. Exige decisão de supervisor — não é patch de trilho A.

### 6.2 Residual: gap de substituição (follow-up `F-D2-runner-substitution`)

Os guards (piso + zero-pending + `passed === total`) pinam **cardinalidade**, não **identidade**. Uma PR que reescreva os 9 casos gated de `product-contracts.test.ts` como 9 casos **não-DB** de mesma contagem passa verde — sem nenhuma cobertura de banco. Medido pelo adversário: 14 casos triviais + admin apontando para porta fechada ⇒ exit 0, `14 passed (14), 0 skipped`. Correção sugerida (do próprio adversário): assertar títulos de suíte a partir de `testResults`, ou marcador gravado no banco.

**Não implementado aqui** — `AGENTS.md` proíbe explicitamente emendar "while I'm here" no mesmo fix; e a defesa por nome é derrotável por rename, então merece spec própria.

### 6.3 Decisões pendentes

1. **Gate C** — autorizar o land (merge `--no-ff` da `mission/a-runner-failopen` em `develop` + commit dos 5 arquivos + journal).
2. **Ratificar a ERRATA-5** no ledger (append-only, propriedade do MAESTRO).
3. **Decidir** o destino dos workflows Neon (§6.1).
4. `H-9` segue aberto (`:5432` nunca tocado).
5. **Confirmar a adjudicação do alias legado** (§2.5): manter o item (a) com a razão corrigida, ou removê-lo por desnecessidade.

### 6.4 Armadilha de ambiente: `.artifacts/` reprova `npm run check` (scratch gitignored **não** é lint-ignored)

`.artifacts/` está em `.gitignore:49`, mas o **ESLint 9 flat config não honra `.gitignore`**. Todo `.mjs`/`.ts` de sonda gravado ali **é lintado**. Foi exatamente isso que derrubou a 1ª bateria selada: `CHECK_EXIT=1`, **88 erros `prettier/prettier`, 100 % dentro de `.artifacts/` e zero em arquivo do repositório**.

**Não é defeito do entregável** (na CI o diretório não existe), mas **é** um jeito de reprovar o gate local por contaminação própria — e um ciclo de verificação desperdiçado. Regra para os próximos WPs: **gravar scratch de sonda com extensão que o lint não processa** (`.sh`, `.json`) **ou removê-lo antes de rodar o gate**. O scratch do adversário foi preservado como prova em `captures/adversarial-probes/` com sufixo `.txt`, que nem ESLint nem prettier processam.
