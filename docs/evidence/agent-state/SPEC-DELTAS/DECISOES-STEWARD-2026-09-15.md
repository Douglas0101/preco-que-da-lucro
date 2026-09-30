# DECISÕES DO SPEC-STEWARD — rodada SDD 2026-09-15

> Papel exercido pelo MAESTRO nesta rodada (acumulação declarada). Cada decisão cita a spec e o inquilino que a levantou. Nenhuma delas altera o texto do Plano Mestre; todas são **leituras** dele ou classificações de status.

## D1 — Enforçado ⟺ política de fontes (WP-B3 / `20.1`)

- **Pergunta do SQUAD-SEC:** o modo `CSP_ENFORCE=true` deve servir as diretivas de report (`report-uri`/`report-to`/`reporting-endpoints`)?
- **Decisão: NÃO** — o enforçado serve **somente** as diretivas de fonte (`security-headers.ts:13-24`), e o canal de coleta fica exclusivo do report-only (`:48-53`). Razões: (a) o artefato normativo anterior (`docs/evidence/csp-enforcement-2026-09-14/report.md`) já descrevia "política literalmente idêntica **sem** as diretivas de report"; (b) `reporting-endpoints` sem `report-to` é anúncio órfão; (c) ADR-016 proíbe relaxar a CSP e ADR-021 exige report-only inicialmente — ambos preservados.
- **Reversão:** 1 linha em `src/lib/security-headers.ts:52` + 1 asserção em T1 (documentado no artefato `docs/evidence/csp-2026-09-15/report.md` §6.4).
- **Impacto:** nenhum sobre `'unsafe-inline'`/hosts; verificado por V-B3 (CONFIRMED) e por 16 testes.

## D2 — Fronteira transacional do worker de outbox (WP-B1 / `23.2`)

- **Pergunta do SQUAD-DB (e do V-B1):** `claim+efeito+marca` numa única transação (sem `processing` persistido) viola o §23?
- **Decisão: NÃO viola** — o §23 fixa a _sequência_ (`SELECT pending → processar → marcar processado`) e exige **idempotência do consumidor**, não a persistência do estado intermediário. A implementação marca `processing` intra-transação, usa `FOR UPDATE SKIP LOCKED` para exclusão mútua e delega a idempotência à inbox (`outbox_consumptions`, PK `(consumer_name, event_id)`).
- **Limite declarado:** handler com I/O externo seguraria a transação; hoje não há consumidor de negócio (por desenho do card).
- **Verificação:** V-B1 CONFIRMED (xmin idêntico entre despesa e evento; 6 mutações mortas por testes específicos).

## D3 — Status de `28.2`/`28.4` com ledger apenas no banco de teste (WP-B2)

- **Fato:** o runner de backfill e o `CREATE TABLE IF NOT EXISTS` do ledger vivem em `scripts/**`; **não** há migration para `backfill_checkpoints`/`backfill_work_items` (`drizzle/**` → 0 hits; `src/db/schema.ts` sem `backfill`).
- **Decisão:** `28.2` (checkpoint) e `28.4` (idempotência) ficam **PARTIAL** — o mecanismo está provado com Postgres real (SIGKILL×2 e erro 22012 no meio do lote), mas a persistência não é schema-managed. `28.1`/`28.3`/`28.5` = **DONE**.
- **Follow-up declarado:** migration para o ledger (escopo natural do próximo WP de banco), com CAS/lease para o gap de concorrência achado por V-B2 (checkpoint last-write-wins; efeito permanece seguro).

## D4 — Classificação de `25.6` (CodeQL) e `25.7` (secret scanning)

- **Decisão:** manter **UNVERIFIABLE** (crédito 0). `25.6` é **misto** (repo-local se o repositório for público — _advanced setup_ é workflow versionado; settings/plano se privado) e a visibilidade **não foi medida** (H-2). `25.7` é settings-only (o `.github/secret_scanning.yml` apenas personaliza, não habilita).
- **Evidência da parte repo-local:** nenhuma — deliberadamente **não** criamos workflow de CodeQL que falharia por licença/setting ausente (o spec-card proíbe).
- **Fila humana:** passo-a-passo em `docs/evidence/supply-chain-classification-2026-09-15.md`.

## D5 — `9.1-ME` (MemoryService/EventService): **NS → PARTIAL (EMENDA 2026-09-15, pós-execução)**

- **Decisão original (antes da onda 2):** NS — existiam apenas contratos _type-only_ `PLANNED` (`src/server/contracts/{memory,event}.contracts.ts`) gated M-04/M-05; crédito 0 para não inflar.
- **EMENDA (achado do verificador V3-A no HEAD integrado):** o WP-B1 entregou o **lado EventService** com runtime real — `DrizzleOutboxRepository implements EventRepositoryPort` (`src/server/repositories/outbox.repository.ts:70-75`), `OutboxWorker` (`src/server/services/outbox.worker.ts:118,162`), tabelas `outbox_events`/`outbox_consumptions` com grants e RLS por tenant (`drizzle/0015_curved_riptide.sql:38-58`, `src/db/schema.ts:849-912`) e append no caminho de runtime (`expense.service.ts:19-22,43-57`). Só o **MemoryService** segue type-only.
- **Decisão vigente:** `9.1-ME` = **PARTIAL** (metade do item existe e está verificada; a outra metade continua gated M-05/§43). Atualizar `docs/specs/M-02/matrix.yaml` (que ainda declara EventService "contract-only") na regeneração do merge.
- **Coerência:** o deferral da F10 (memória) permanece intacto — nada aqui antecipa o gate §43.

## D6 — `35`: escopo da varredura do gate (§35)

- **Decisão:** a árvore de **processo** (`docs/evidence/agent-state/**`, `docs/evidence/_templates/**`) fica **fora** da varredura do gate, que continua exigindo os 7 rótulos dos artefatos de _evidência de performance_ (`docs/evidence/perf-*/**` e `**/*perf-*.md` fora daquelas árvores). Motivo: o nome obrigatório dos cartões de processo (`35-perf-gate.md`) colide com o padrão `*-perf-*` e não é evidência de performance — fail-closed preservado e provado (T6, V-A1).
