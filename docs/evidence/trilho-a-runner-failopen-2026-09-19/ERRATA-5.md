# ERRATA-5 — a mecânica do gate de banco (append-only; aplicar no ledger no land)

> Forma e função idênticas à "ERRATA DE INTEGRIDADE — 2026-09-19 (Stream A; MAESTRO)", que registrou ERRATA-1..4.
> **Não reescreve** as entradas anteriores: corrige o que elas afirmam, mantendo-as no documento como foram escritas.
> Origem: medição do WP `F-D2-runner-failopen` (trilho A), `docs/evidence/trilho-a-runner-failopen-2026-09-19/`.

## ERRATA-5 (material) — `isLoopbackUrl(undefined)` devolve `true`; os bloqueios de banco **não** skippam na CI

Duas entradas do ledger afirmam uma mecânica de gate que **contradiz o código medido**:

1. **`ERRATA-1`** (seção "ERRATA DE INTEGRIDADE", `:1772`): _"os testes vitest de banco exigem `DATABASE_URL_UNPOOLED` além de `DATABASE_ADMIN_URL`/`DATABASE_URL` … Consequência: aqueles testes **skippam silenciosamente na CI** (`describe.skip`)."_
2. **Decisões do MAESTRO** (bloco "Achado que corrige uma spec pendente", `:1830`): _"`isLoopbackUrl(undefined) → false` ⇒ teste **pulado** ⇒ `numPendingTests !== 0` ⇒ prova-FK reprova"_ — e _"o padrão dos ciclos 3–5 (`env -u DATABASE_URL_UNPOOLED`) **não** satisfaz o gate"_.

**Medido em 2026-09-19 contra PostgreSQL 17.11 efêmero (`127.0.0.1:5433`):** as três afirmações são **falsas**.

- O gate é, **verbatim**, `Boolean(adminUrl) && isLoopbackUrl(adminUrl) && isLoopbackUrl(process.env.DATABASE_URL) && isLoopbackUrl(process.env.DATABASE_URL_UNPOOLED)`. **Não existe teste de `!== undefined`.**
- `isLoopbackUrl` começa por **`if (!value) return true;`** — em `src/test/products-fk-conflict.test.ts:232-240` e `src/test/product-contracts.test.ts:168-176`. Portanto valor **ausente** satisfaz o gate: a ausência faz o bloco **executar**, não pular.
- Com `DATABASE_ADMIN_URL`/`DATABASE_URL` loopback e `DATABASE_URL_UNPOOLED` **ausente**, o runner FK mede `13 passed (13), 0 skipped` e sai **0** — logo `env -u DATABASE_URL_UNPOOLED` **satisfaz** o gate.
- Quem fecha o gate é uma URL **definida fora de loopback** (inclusive a de admin): medido `9 passed | 4 skipped` com exit 1 no FK, `5 passed | 9 pending` no `product-contracts`.

**Causa raiz dos 13 skips que originaram a spec (medida, não inferida):** o vitest **não** carrega o `.env` do checkout para `process.env`. Numa corrida crua as três variáveis chegam **ausentes** — logo `Boolean(adminUrl)` é falso e o gate fecha. É esse o mecanismo dos 13 skips em `npm run test` local; **não** é a ausência de `DATABASE_URL_UNPOOLED`.

**Consequência (a que mais importa):** no `ui-stack.yml` o bloco `env:` do job **já fornecia** `DATABASE_ADMIN_URL` e `DATABASE_URL` loopback ⇒ o gate **já abria** ⇒ **os bloqueios de banco já executavam e passavam na CI antes do F-D2** (a CI verde em `9e22a67` só é compatível com blocos executando-e-passando, dado o gate aberto). **O fail-open que o F-D2 descrevia não existia como descrito.** O que ele de fato fechou, por medição própria, foram dois fail-opens distintos e reais:

- **deleção silenciosa de prova** — sem piso de cardinalidade, um arquivo reduzido a poucos casos todos passando sairia **exit 0 verde** (o caso de "0 casos" **não** era o fail-open: o vitest sai 1);
- **prova sem assertor** — `src/test/product-contracts.test.ts` tinha **9 casos gated e nenhum runner**, de modo que um gate fechado deixaria `npm run test` verde com `5 passed | 9 skipped`.

**Escopo desta errata:** documental. A `DATABASE_URL_UNPOOLED` declarada no `env:` do job permanece **correta e desejável** — torna o alvo determinístico em vez de dependente do que o ambiente do runner ofereça, e imuniza a CI contra uma futura inversão do ramo `undefined` de `isLoopbackUrl`. O que muda é a **razão registrada**, não a ação.

**Lição (para o próximo boot):** _"o ledger divergiu do código"_ é exatamente o gatilho de parada do prompt SDD. Duas entradas concordantes entre si **não** são duas fontes: a ERRATA-1 e o "achado" derivaram do mesmo erro de leitura, e a concordância entre elas mascarou-o. A medição contra PG17 efêmero custou minutos e evitou um land sobre premissa falsa.

**Residual declarado (não coberto por esta errata):** `F-D2-runner-substitution` — os guards pinam cardinalidade, não identidade; uma PR que reescreva os 9 casos gated como 9 casos não-DB de mesma contagem passa verde.
