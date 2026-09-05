# Auditoria de substrato Supabase→Neon — 2026-09-05

Relatório de evidência da auditoria de conformidade spec ↔ substrato real,
sob disciplina SDD: fatos com evidência reproduzível, gaps como emendas de
spec, divergências como exceções rastreáveis. Auditoria READ-ONLY sobre bancos
de tráfego; única escrita foi no sandbox `br-summer-dream-ayewlgx2` (cópia de
branch, criada para o drill do rollback 0010 e pendente de destruição — ver
§6.3). Sem mudança de comportamento de código.

Consultas executadas entre **2026-09-05T18:47Z e 2026-09-05T19:01Z** (UTC), via
conector Neon (`neondb_owner`, read-only exceto sandbox) e via CLI/git local.

---

## 1. Passo 0 — Matriz requisito → seção → verificação

Extração spec-first (a realidade não participa desta tabela). Corpus varrido:
SDD.md, Plano Mestre, REALINHAMENTO V7, ADR-019/020/021/022-archive/023, spec
M-02 + exceções + decisions. Os itens A4/A5/B3/B4/S8/S9/F10 existem apenas no
ledger e evidências — o equivalente normativo do cutover é ADR-021 (Decisões
§5–9, Gates) e Plano Mestre §13.4–13.7 e §42/§46.

| Requisito                         | Seção                                   | Cláusula-chave                                                                                                      | Como verificar                                        |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Neon como banco canônico          | ADR-019 Decisão §1                      | "O PostgreSQL hospedado inicialmente no Neon é a fonte canônica."                                                   | `DATABASE_URL` do runtime; provider Neon              |
| PostgreSQL 17 fixado              | ADR-023 Decisão §1–2                    | "PostgreSQL 17 é o major fixado para o CI e para o projeto Neon alvo."                                              | `server_version_num`; `EXPECTED_POSTGRES_MAJOR`       |
| Supabase proibido no runtime      | SDD P0 (2026-08-12); ADR-021            | "Supabase está descartado como runtime final e só é permitido como origem read-only"                                | Gate `check:no-supabase-runtime` (CI ui-stack.yml:47) |
| Pooled/direct segregados          | ADR-019 Decisão §2–3; Plano §2.4/§12.2  | `DATABASE_URL` pooled → runtime; admin/direct → migrations                                                          | Código + runbooks                                     |
| Paridade/reconciliação            | ADR-021 Decisão §6; Plano §13.4/13.5    | "A reconciliação cobre contagens, nulos, intervalos, somas, órfãos e checksums"; diferença ≠ 0 bloqueia cutover     | Relatório com difference=0                            |
| Import idempotente/dry run        | ADR-021 Decisão §5                      | "O destino executa dry run por padrão e só confirma com MIGRATION_APPLY=true"                                       | `scripts/migration/source-to-neon.ts`                 |
| Auth server-driven                | ADR-020 Decisão §1                      | "Better Auth é montado … com o adapter Drizzle e as tabelas PostgreSQL canônicas"                                   | Rota `/api/auth/*`; tabela `sessions`                 |
| Sessões não importadas            | ADR-021 Decisão §4                      | "sessões não são importadas"                                                                                        | `sessionsImported=0`                                  |
| Cookie opaco revogável            | ADR-020 Decisão §2–3/§7                 | "Cada validação privada consulta a sessão revogável no PostgreSQL"                                                  | `requireDatabaseAuth` + `disableCookieCache`          |
| Backup/restore                    | Plano §42; SDD §6.4; ADR-021 Decisão §8 | "backup/restore testado"; RPO 15 min/RTO 4 h; rollback pós-escrita = snapshot/PITR                                  | Evidência de snapshot/restore produtivo               |
| Ordem migrations antes de tráfego | ledger A4 (rastro); Plano §13.6         | "0010 via URL direta ANTES de tráfego 1.7.2"                                                                        | Journal aplicado sem runtime deployado                |
| Vigilância 24–72h                 | ledger A5 (rastro)                      | "A5 janela 24–72h pós-deploy; spike = incidente P0/P1"                                                              | Registro 0h/24h/72h (runbook)                         |
| KPIs B3/B4                        | Plano §46; ledger S8                    | 1–2 semanas de `app.*` + KPIs §46; zero tolerância a erro financeiro                                                | Série coletada no coletor OTLP                        |
| Decommission origem               | ADR-021 Decisão §9                      | "A origem permanece congelada por 14 dias. Desativação ou exclusão exige aprovação explícita."                      | Estado da origem                                      |
| Ponto de não-retorno              | ADR-021 Decisão §8                      | "Antes da primeira escrita no Neon, pode voltar ao runtime anterior. Depois, snapshot/PITR. Não haverá dual-write." | Ausência de dual-write                                |
| Prova local ≠ produção            | ADR-023 Consequências                   | "A prova local/CI não substitui … o backup/restore ou o cutover"                                                    | Smoke produtivo                                       |

### GAP-DOC do próprio Passo 0

1. **Sucedente de Storage — SEM CLÁUSULA** em nenhum documento normativo varrido.
2. **Sucedente de Realtime — SEM CLÁUSULA** (grep `Realtime|WebSocket|SSE|EventSource` em `docs/**` = zero normativas).
3. **Paridade quando o destino é fixture e a origem é DESCONHECIDA — SEM CLÁUSULA** (runbook cobre origem read-only presente/ausente, mas não exige decisão explícita de estado da origem).

Três emendas emitidas: `M02-D-006.md`, `M02-D-007.md`, `M02-D-008.md`
(`docs/specs/M-02/decisions/`), RFC curta fato/decisão/impacto cada.

---

## 2. Passo 1 — Substrato Neon e a pergunta decisiva (Leitura A/B)

### 2.1 Substrato Neon (evidência direta)

| Fato                                                                                                                                             | Evidência                                                                   | Timestamp (UTC)            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------- |
| Projeto `damp-forest-57346541`, branch production `br-snowy-violet-aymcvvvv`, banco `neondb`, PostgreSQL **17.11** (`server_version_num=170011`) | `describe_project` + `select current_setting('server_version_num')`         | 2026-09-05T18:47–18:53Z    |
| Journal: **11** entries                                                                                                                          | `select count(*) from drizzle.__drizzle_migrations` → `11`                  | 2026-09-05T18:52Z          |
| **11/11 hashes reconciliados** com `drizzle/0*.sql` locais (sha256 por arquivo)                                                                  | comparação programática hash a hash; repetida por `npm run smoke:substrate` | 2026-09-05T18:52Z e 19:00Z |
| Última aplicação (journal 10/11): **2026-09-02T03:34–03:35Z** (0009/0010), 0008 em 2026-08-29T19:16Z, base em 2026-08-12                         | `created_at` do journal (epoch ms → ISO)                                    | idem                       |
| Compute read-write ativo, região aws-us-east-2, hosts direct/pooled `ep-long-violet-aye9g0bn[-pooler]`                                           | `list_branch_computes`                                                      | 2026-09-05T18:53Z          |
| `.env` local: `DATABASE_URL` → pooled do MESMO endpoint; `DATABASE_DRIVER` não definido → default `neon-serverless`                              | leitura de `.env` (valores redigidos)                                       | 2026-09-05                 |
| CI usa Docker PostgreSQL 17 local com `node-postgres`                                                                                            | `docker-compose.yml`, `.env.example`, H-003                                 | 2026-09-05                 |

### 2.2 ONDE APONTA O BANCO DE TRÁFEGO — veredito

**Nem Leitura A nem Leitura B como formuladas. A pergunta não tem referente
hoje: não existe runtime em tráfego.**

| Aferição                                | Resultado                                                                                                                                                                                                                               | Classificação                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Runtime deployado (Hostinger)           | Plano **não adquirido** em 2026-08-23 (`hostinger-hpanel-verification.md`: 0/11 PASS); contratação pendente desde 2026-08-24; nenhum deploy registrado em nenhum ledger                                                                 | **CONSTATADO: não existe**     |
| Os 4 accounts no Neon                   | São fixture/probe criadas **2026-08-30**: `u2.probe@…`, `u3.probe@…`, `qa.local.admin@…` (owner), `qa.local.admin+member@…` (member, "Tenant E2E"); 1 produto "Produto de teste", 2 despesas, 1 conversa, 2 sessões — zero usuário real | **FATO (SELECT)**              |
| Runtime Supabase                        | Gate CI proíbe; `grep @supabase                                                                                                                                                                                                         | supabase.co                    | createClient`em`src/` = vazio; runbook: "o projeto nunca rodou oficialmente no Supabase" | **CONFORME** (runtime) |
| Conteúdo da origem Supabase             | Sem credencial read-only; `curl https://svcqcuqfajiyankjurfv.supabase.co/...` → código 000 (sem saída de rede desta sessão)                                                                                                             | **DESCONHECIDO**               |
| Config de env de um processo em tráfego | Não há processo; config de deploy não existe                                                                                                                                                                                            | **DESCONHECIDO/NÃO-APLICÁVEL** |

**Veredito (com evidência, não conclusão):** (i) o único substrato de dados vivo
é o Neon — journal 11/11 reconciliado, único banco com qualquer dado do
programa; (ii) as "4 contas" que sustentavam a dúvida são resíduo de fixture
E2E/probe de 2026-08-30, não tráfego; (iii) portanto o cutover não é uma troca
em vivo — **é o primeiro deploy**. A "distinção entre Neon bonito e Neon em
tráfego" foi resolvida por ausência: não há tráfego. A inferência proibida
(existir Neon com dados ⇒ Neon serve tráfego) foi evitada e registrada.

### 2.3 CI vs deploy

CI = Docker PostgreSQL 17 local + `node-postgres` (H-003 autoriza; ADR-023
exige major igual — cumprido). Deploy = inexistente. A comparação de connection
strings de tráfego não é possível: **NÃO-APLICÁVEL hoje**, e o requisito "a
prova local/CI não substitui o cutover" (ADR-023) permanece soberano — CI verde
não é deploy. Sem divergência classificável; o gate é o smoke produtivo
futuro.

---

## 3. Passo 2 — Paridade de dados (condicional à M02-D-008)

| Dado                                | Neon (SELECT, 2026-09-05)             | Origem Supabase |
| ----------------------------------- | ------------------------------------- | --------------- |
| users / tenants / memberships       | 4 / 3 / 4                             | DESCONHECIDO    |
| products / expenses / conversations | 1 / 2 / 1 (resíduo de teste)          | DESCONHECIDO    |
| snapshots / ai_usage / sales        | 0 / 0 / 0                             | DESCONHECIDO    |
| accounts                            | 4 (`local:credential`, 0 issuer nulo) | DESCONHECIDO    |
| sessions                            | 2 (fixture, expiram 2026-09-06)       | DESCONHECIDO    |

- Toda a massa do Neon data de **2026-08-30** (fixture/perf waves) — nenhum
  dado de usuário real.
- Divergência de contagem: **não mensurável** (origem inacessível). Nada foi
  "corrigido" (read-only).
- Procedimento de paridade: ADR-021 §6 + runbook cobrem a rota com origem
  read-only; a rota "origem vazia/limpa" exige decisão — **M02-D-008** (emenda).
- Se a decisão for provisionamento limpo, o Passo 2 **encerra** sem migração de
  dados; se a rota read-only for escolhida, janela de freeze e delta/re-sync
  voltam a valer (Plano §13.6).

---

## 4. Passo 3 — Componentes não-Postgres do Supabase

| Componente     | Estado                               | Evidência (file:line)                                                                                                                                                                                                                                                | Homologado?                                                                                                                                                                        | § da matriz                                                                              |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Auth           | SUCEDENTE-IMPLEMENTADO               | `src/server/auth/auth.server.ts:19-29` (adapter Drizzle, tabela `sessions`); `requireDatabaseAuth` em `src/middleware/request-context.ts:93-135` valida sessão no Postgres com `disableCookieCache`; rate-limit em `src/server/auth/rate-limit-storage.server.ts:16` | E2E de login (`e2e/ui-stack.spec.ts:27-46`), integração (`scripts/db/test-auth-integration.ts`), cross-tenant (`src/test/cross-tenant-denial.perf-waves.test.ts`) — **homologado** | ADR-020/021                                                                              |
| JWKS/Neon Auth | NÃO-USADO em runtime                 | `NEON_AUTH_BASE_URL`/`NEON_AUTH_JWKS_URL` em `.env`, zero leitores em `src/`/`scripts/`                                                                                                                                                                              | n/a                                                                                                                                                                                | —                                                                                        |
| Email (Resend) | SUCEDENTE-IMPLEMENTADO               | `src/server/email/email-adapter.server.ts:1,21-28`; sem `RESEND_API_KEY` no `.env` local (bloqueia fluxo local)                                                                                                                                                      | Não executado fora do código                                                                                                                                                       | ADR-020                                                                                  |
| Storage        | **SEM-SUCEDENTE-IDENTIFICADO**       | Zero código de objetos (`grep AWS                                                                                                                                                                                                                                    | S3                                                                                                                                                                                 | bucket                                                                                   | upload                             | presign`em`src/`); `products.image` sem consumo (`src/db/schema.ts:46`); `neon-storage.env` órfão com credenciais live | nada a homologar | **EM-01 (M02-D-006)** |
| Realtime/WS    | SUCEDENTE-PARCIAL (request/response) | Chat em `src/lib/chat.functions.ts` + `chat-execution.server.ts:478`; sem WS/SSE (grep vazio, sem pacote `ws`); FSM em `src/lib/chat-fsm.server.ts:8-78`                                                                                                             | FSM unit-tested (`src/test/chat-fsm.server.test.ts`); chat **sem E2E**; M-08 `PENDING`                                                                                             | **EM-02 (M02-D-007)**; WS-01..07 no closeout P1                                          |
| PostgREST/Edge | SEM-SUCEDENTE (sem remanescente)     | `grep postgrest                                                                                                                                                                                                                                                      | edge function                                                                                                                                                                      | functions/v1`= vazio; API = server functions +`src/routes/api/` (health, auth catch-all) | n/a                                | —                                                                                                                      |
| Client legado  | REMOVIDO                             | `grep @supabase                                                                                                                                                                                                                                                      | supabase.co                                                                                                                                                                        | createClient`em`src/` = vazio; gate em CI                                                | **homologado** (gate automatizado) | ADR-021                                                                                                                |

---

## 5. Classificação exaustiva de achados

| #   | Achado                                                                                                     | Classificação                                                       | Registro/fase-alvo                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Journal 11/11 hashes, PostgreSQL 17.11, RLS/roles/colums confirmados                                       | **CONFORME**                                                        | —                                                                                          |
| 2   | Runtime sem Supabase (gate CI + grep)                                                                      | **CONFORME**                                                        | —                                                                                          |
| 3   | issuer IS NULL = 0 (4 contas `local:credential`)                                                           | **CONFORME**                                                        | —                                                                                          |
| 4   | Sucedente de Storage sem cláusula + sem código                                                             | **GAP-DOC**                                                         | M02-D-006 (EM-01)                                                                          |
| 5   | Sucedente de Realtime sem cláusula                                                                         | **GAP-DOC**                                                         | M02-D-007 (EM-02)                                                                          |
| 6   | Paridade condicional a decisão de origem                                                                   | **GAP-DOC**                                                         | M02-D-008 (EM-03)                                                                          |
| 7   | Fixture E2E/probe no Neon production (4 contas, dados de teste) diverge do provisionamento limpo (ADR-021) | **VIOLAÇÃO**                                                        | **DB-01** — limpeza/ratificação pré-A4; guard do down 0010 recontado após limpeza          |
| 8   | Credenciais live (S3 Neon + OpenAI) órfãs em `neon-storage.env` em disco, sem consumidor                   | **VIOLAÇÃO** (gestão de segredos)                                   | **DB-02** — revogação ou ratificação antes de produção; arquivo não versionado (gitignore) |
| 9   | Vars `SUPABASE_*`/`VITE_SUPABASE_*` residuais em `.env`                                                    | **FALSO-ALARME** (não são lidas por código; gate cobre runtime)     | limpeza recomendada, sem gate                                                              |
| 10  | "4 contas em tráfego" (premissa da rodada)                                                                 | **FALSO-ALARME** (são fixture; não há tráfego)                      | veredito §2.2                                                                              |
| 11  | Conteúdo da origem Supabase                                                                                | **DESCONHECIDO** (estado legítimo; credencial read-only ausente)    | M02-D-008                                                                                  |
| 12  | Config de env de processo em tráfego                                                                       | **DESCONHECIDO/NÃO-APLICÁVEL** (não existe deploy)                  | BLOCKER-EXT-01                                                                             |
| 13  | Backup/restore produtivo (retention 6h, zero snapshots gerenciados)                                        | **DESCONHECIDO** (gate §42 aberto — já registrado; reconfirmado)    | pré-requisito A4                                                                           |
| 14  | Sonar `main` "Quality Gate not computed"                                                                   | **DESCONHECIDO** (painel autenticado necessário; estado inalterado) | follow-up registrado                                                                       |

Nenhuma exceção nova autoriza novos acessos. IDs novos: **DB-01**, **DB-02**
(padronizados com fase-alvo; rastro no ledger).

---

## 6. Passo 4 — De-risk do cutover (artefatos spec-first)

### 6.1 Smoke de substrato (Passo 4a)

Requisito nasce da coluna "como verificar" da matriz do Passo 0 (Regra 1) e da
regra global 6 (checagem repetível → script). Artefato:
`scripts/smoke/substrate-smoke.ts` + `npm run smoke:substrate`. Read-only,
asserções: major 17; journal count + 11/11 hashes; `app_runtime` sem
superuser/BYPASSRLS; RLS ativa nas 20 tabelas com `tenant_id`; `issuer IS NULL`
= 0. Saída JSON com timestamp.

**Execução contra produção (2026-09-05T19:00:40Z→19:00:43Z): `PASS 6/6`**
(`postgres-major`, `journal-count`, `journal-hashes`, `app-runtime-role`,
`tenant-tables-rls`, `accounts-issuer-null`).

### 6.2 Drill do rollback 0010 (Passo 4b) — em sandbox

- Sandbox: branch Neon `sandbox-drill-down-0010-20260905` (`br-summer-dream-ayewlgx2`),
  cópia da production (`parent_lsn 0/2085780`), criada 2026-09-05T18:55:37Z.
- Down executado no sandbox (`UPDATE accounts SET issuer=NULL WHERE provider_id='credential' AND issuer='local:credential'`):
  raio efetivo **4/4 contas** (`issuer_nulo_apos_down=4`) — **confirma que o
  down NÃO é no-op e casa todas as contas atuais**, exatamente como a guarda
  do arquivo prevê.
- Reconciliação simulada: forward 0010 reexecutado (idempotente) → **4/4
  restauradas** (`reconciliadas=4`, `nulas=0`).
- Produção nunca foi tocada: única escrita foi no sandbox.

### 6.3 Destruição do sandbox

O branch sandbox `br-summer-dream-ayewlgx2` mantém apenas o estado pós-drill e
deve ser destruído. A exclusão de branch é operação destrutiva do conector —
execução condicionada a autorização do operador nesta rodada. **Pendente.**

### 6.4 Runbook A5 (Passo 4c) e KPIs B3 (Passo 4d)

Adendos ao `docs/runbooks/migracao-supabase-neon.md`: checagens 0h/24h/72h,
critérios de abort explícitos (5 itens) e baseline de KPIs B3 declarado
**não mensurável (amostra zero)** — não há baseline do Supabase porque a
origem nunca serviu tráfego oficial; inventar taxa zero é proibido (M02-D-008).

---

## 7. Passo 5 — Desbloqueio externo

Pedido de acesso hPanel redigido com escopo exato (deploy, env vars, logs,
restart, acesso remoto ao DB como confirmação negativa), dependências e prazo
de 3 dias úteis: `docs/evidence/substrato-2026-09-05/hpanel-request.md`.
Registrado no ledger como **BLOCKER-EXT-01**.

---

## 8. Matriz de prontidão por componente

| Componente   | Prontidão               | Base                                                                             |
| ------------ | ----------------------- | -------------------------------------------------------------------------------- |
| Schema       | **PRONTO**              | 11/11 hashes; PostgreSQL 17.11; colunas/CHECKs/RLS/roles confirmados             |
| Dados        | **PRONTO-COM-EXCEÇÕES** | Só fixture (DB-01); paridade DESCONHECIDA condicional a M02-D-008                |
| Auth         | **PRONTO-COM-EXCEÇÕES** | better-auth 1.7.x + issuer OK; smoke produtivo pendente; Resend sem config local |
| Storage      | **NÃO-INICIADO**        | Sem sucedente nem cláusula (EM-01); nenhum arquivo a migrar hoje                 |
| Realtime     | **PRONTO-COM-EXCEÇÕES** | request/response homologado; wire-level M-08 pendente (EM-02)                    |
| Config/infra | **DESCONHECIDO**        | Sem deploy; hPanel 0/11; backup/restore §42 não comprovado                       |

## 9. Caminho crítico recomputado

`BLOCKER-EXT-01 (hPanel) → pré-A4 (DB-01 limpeza + M02-D-008 decisão + §42 backup) → A4 deploy+smoke → A5 24–72h → B3 1–2 semanas → B4 → Fase C`.

- Calendário após desbloqueio hPanel: A4 ≈ 1 dia; A5 = 3 dias; B3 = 7–14 dias;
  **B4 atingível ≈ 11–18 dias úteis após acesso hPanel**.
- Colisão identificada: M02-2/3/4 (refactors do código) durante A5/B3 exigem
  re-deploy a cada merge → recomenda-se change freeze de deploys na janela,
  com merges permitidos e deploys pós-B4, ou exceções justificadas.
- Bloqueios novos nesta rodada: nenhum além de DB-01/DB-02 (que são
  pré-requisitos, não bloqueadores externos).

## 10. Grau de confiança para o ensaio de smoke

**Alta para o substrato (6/6 PASS repetível), nula para a camada de aplicação
em produção** — o smoke produtivo (login, CRUD tenant-scoped, chat, smoke
financeiro) exige o runtime que ainda não existe. O pedido hPanel pode ser
enxuto (camada de aplicação apenas; ver `hpanel-request.md` §"O que muda").

## 11. ESTADO DO SUBSTRATO

| Dimensão | Estado (2026-09-05)                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tráfego  | **NÃO EXISTE** — nenhum runtime deployado (Hostinger sem plano ativo; 0/11 hPanel)                                                                                                   |
| Neon     | Production `br-snowy-violet-aymcvvvv` @ `damp-forest-57346541`: PG 17.11, journal 11/11 (última aplicação 2026-09-02T03:35Z), `smoke:substrate` 6/6 PASS; dados = fixture 2026-08-30 |
| Paridade | DESCONHECIDO (origem Supabase sem credencial read-only); condicional a M02-D-008                                                                                                     |
| Blockers | BLOCKER-EXT-01 (hPanel); DB-01 (fixture); DB-02 (credenciais órfãs); §42 backup; sandbox `br-summer-dream-ayewlgx2` aguarda destruição                                               |

## 12. Top-3 riscos de cutover

1. **Backup/restore não comprovado antes do primeiro tráfego** (retention Neon
   6h < janela A5 72h; zero snapshots). Mitigação: snapshot gerenciado/PITR
   criado e restore exercitado em branch antes do deploy (§42 + SDD §6.4).
2. **Deploy em plataforma não homologada** (Node ≥24.15, proxy >60s, restart,
   logs) com smoke produtivo único de auth. Mitigação: executar os 11 itens do
   checklist hPanel ANTES de apontar o domínio; abort criteria do runbook A5.
3. **Estado da origem não decidido + fixture no destino** (DB-01 + M02-D-008):
   decisão tardia reabriria paridade/freeze na véspera do deploy. Mitigação:
   decisão humana de M02-D-008 como pré-requisito do A4, com limpeza da fixture
   e recontagem da guard do down 0010.

## 13. Preservação

Auditoria read-only sobre produção; única escrita no sandbox do drill (§6.2).
Nenhum banco de tráfego alterado; nenhum force-push; sem reescrita de spec
existente (emendas como arquivos datados novos).
