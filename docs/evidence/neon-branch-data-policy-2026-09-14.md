# Política de dados das branches Neon (§12.4)

**Rodada:** Onda 4 · operador O24 · base `2382636` · branch `ops/onda4-branchpolicy` · 2026-09-14
**Escopo:** registrar a política de dados do branch model `production → develop → preview/pr-<n>`
(`docs/evidence/plan-partials-2026-09-13/part-5-neon-auth.md` §12.4, item 4; `PLANO_MESTRE §12.4`
"Para dados sensíveis, avaliar schema-only branches ou mascaramento").
**Não escopo:** nenhuma mudança de comportamento de dados foi feita nesta rodada — o passo de criação de
branch continua herdando schema **e** dados do parent. O que muda no workflow (§12.4 item 2) é apenas
**qual** branch é o parent.

## 1. Política vigente — herda DATA do parent (aceitável hoje)

Branches efêmeras de PR (`.github/workflows/neon-pr-branch.yml`) e a branch de readiness
(`.github/workflows/neon-readiness.yml`) nascem como cópia do parent, herdando schema **e** linhas.

- `production` = `br-snowy-violet-aymcvvvv` — read-only por mandato, **fixture-free**
  (`docs/evidence/neon-prontidao-2026-09-13.md:62`).
- `develop` = `br-small-hill-aymcu14y` — parent `production`
  (`docs/evidence/neon-prontidao-2026-09-13.md:64`); passa a ser o parent dos PRs não-`main` (§12.4 item 2).
- Fixture-free, proveniência: `docs/evidence/pre-a4-2026-09-06.md:15` (purge DB-01 → **26/26 tabelas zero** +
  smoke 7/7 → CONFORME) e `:49` ("Neon Production fixture-free: 26/26 tabelas zero, smoke 7/7, journal 11/11,
  PG 17.11"); re-verificação mais recente em `docs/evidence/cutover-2026-09-12/README.md:14`
  (smoke 7/7 PASS incluindo `production-fixture-free`).
- Gate contínuo: `scripts/smoke/substrate-smoke.ts:117-132` falha se reaparecerem os marcadores do DB-01
  (`users.email ilike '%@preco-que-da.test'`, `tenants.slug = 'tenant-e2e'`). Recontagem 26/26 **não** foi
  refeita nesta rodada — exigiria conexão remota (H-2/`NEON_API_KEY`).
- Tráfego de produção **não existe** (H-6): não há dado de cliente em produção a vazar para uma cópia.

**Decisão registrada:** herdar o DATA do parent é **aceitável hoje**, porque o parent de produção é
fixture-free e a cópia é descartável com prova de cleanup (`always()`, §12.5). O ganho do `schema-only` hoje
seria nulo em conteúdo e não compensaria o custo do caveat da §3.

## 2. Gatilho de revisão — PII

A política expira no primeiro destes eventos:

1. aparecer PII/dado real de cliente em `production` (inclusive carga de migração legacy — dono humano D2, §13);
2. início do tráfego real (H-6 deixa de valer).

A partir do gatilho, as opções sobre a mesa são `schema-only` **ou** mascaramento, **e somente depois de um
spike** (`docs/evidence/plan-partials-2026-09-13/EXECUCAO-ONDA0.md:54` lista "spike schema-only/mascaramento
Neon" como decisão aberta da Onda 4). O spike **não** foi executado nesta rodada: exige console/API com chave
(H-2) e é pré-requisito da rodada, não desta entrega.

## 3. Caveat ratificado — `schema-only` não copia `drizzle.__drizzle_migrations`

Assumindo `schema-only` (Neon: branch com schema sem linhas), a tabela de controle do drizzle-kit vem
**vazia**. Consequência no workflow atual:

- `npm run db:migrate` (passo "Migrations via DIRECT da branch") tentaria **reaplicar** `0000..0014` sobre um
  schema que já existe e falharia (objeto já existe); hoje esse passo é esperado como no-op justamente porque
  o journal vem herdado do parent;
- o passo "Prova de journal (read-only)" compara `count(*)` de `drizzle.__drizzle_migrations` com
  `drizzle/meta/_journal.json` (**15** entradas hoje, última `0014_mighty_veda`) e acusaria `0 ≠ 15`.

**Mitigação obrigatória se `schema-only` for adotado:** pular `npm run db:migrate` no caminho pós-create e
semear `drizzle.__drizzle_migrations` a partir de `drizzle/meta/_journal.json` (hash/`created_at` no formato
lido por `scripts/db/backup-verify.ts:65` e `scripts/smoke/substrate-smoke.ts:51-54`) **antes** de qualquer
verificação de contador. Sem isso, `db:migrate`, `smoke:substrate` (`journal-count`/`journal-hashes`) e a
prova de journal do PR branch CI ficam inválidos por construção — não por regressão de schema.

## 4. Declarado / não verificável aqui

- O comportamento live da opção `schema-only` (e a confirmação de que o journal não é copiado) **não** foi
  verificado nesta sandbox: exige `NEON_API_KEY` + console/API (H-2). O caveat acima é registrado como
  pré-requisito do spike, com base no plano e no contrato do drizzle-kit — não como medição.
- A troca de parent (§12.4 item 2) não altera a política de dados: `develop` também é fixture-free
  (mesma origem de produção, criada em 2026-08-23); a evidência de dados associada está em
  `docs/evidence/neon-branch-ci-2026-09-14.md`.
