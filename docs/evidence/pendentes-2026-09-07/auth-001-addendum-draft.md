# Addendum AUTH-001 (DRAFT) — comportamento de login/sessão do cutover A4 (11–12/09) ao sunset G1 (20/09)

> **ESTADO: RASCUNHO — pendente de assinatura humana. Nada neste documento está decidido.**
> Este arquivo é um draft produzido pela rodada PENDENTES-CLOSE (2026-09-07, HEAD `8d26a2c`, análise estática read-only).
> Ao ser assinado, deve ser promovido a decisão formal em `docs/specs/M-02/decisions/` e referenciado a partir de AUTH-001.

- **Data:** 2026-09-07 · **Tipo:** addendum a decisão · **Estado:** DRAFT para assinatura humana (owner go/no-go, cf. M02-D-009 §1.4)
- **Decisão original (AUTH-001):** "Decisão de provedor de identidade" — `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` §7.1 ("A decisão deve ser ADR separado"). Resolvida pelo **ADR-020 — Better Auth e sessões server-driven** (`docs/adr/ADR-020-better-auth-server-driven-sessions.md`, aceito 2026-08-12), revisado pontualmente por **ADR-025** (marker de sessão assinado TTL ≤ 60 s).
- **Refs:** `docs/adr/ADR-021-migration-cutover-supabase-neon.md` (§4, §9) · `docs/specs/M-02/decisions/M02-D-008-G1-memo.md` (sunset 2026-09-20) · `docs/runbooks/cutover-A4.md` (§1 freeze, §5 smoke auth, §13 V2b) · `docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.json` + `reconciliation-restore-2026-09-07.json` (26 tabelas, 0 differences) · `docs/evidence/pendentes-2026-09-07/auth-scope-migration.md` · `scripts/migration/source-to-neon.ts` (L598 `sessionsImported: 0`)

## 1. Questão do addendum

Como se comporta **login/sessão** entre a janela de cutover (11–12/09) e o sunset G1 (20/09), dado que:

1. `sessions` é tabela de identidade dentro do universo de 26 tabelas do cutover, porém **fora do escopo de import por decisão** (ADR-020 §8; ADR-021 §4; contrato do relatório `sessionsImported=0` — `migracao-supabase-neon.md`).
2. A sessão é opaca, server-driven, armazenada no PostgreSQL do **Neon** e validada a cada requisição privada (`auth.server.ts` L30-34, L101-111; ADR-020 §3; ADR-025).
3. No ramo greenfield (a) do G1 o destino inicia sem usuários reais; no ramo (b), usuários legados são importados sem sessões.

## 2. Opções

### Opção A — Manter ADR-020 como está: sessões 100% Neon, sem import, re-login universal

- **Descrição:** nada muda no desenho. Na janela 11–12/09 todo login cria sessão nova no Neon (expira 7 dias, `updateAge` 1 dia). No ramo (a) do G1 não há re-login (nenhum usuário pré-existente); no ramo (b) usuários importados logam novamente (hashes bcrypt legados aceitos — ADR-020 §5; Google reautoriza no novo callback — ADR-021 §4). Até 20/09 o legado permanece congelado/read-only (ADR-021 §9; SUNSET do memo G1), sem ponte de sessão e sem dual-write.
- **Custo:** engenharia **zero** (nenhum código novo); operação: comunicação da janela + smoke de auth já previsto no `cutover-A4.md` §5 (login/logout/negação, better-auth 1.7.x com issuer preenchido).
- **Risco:** baixo. Perda de sessão ativa no cutover é conhecida e documentada; revogação/rotação permanecem íntegras (ADR-020 §7); nenhuma superfície auth adicional.
- **Efeito na janela de freeze:** nenhum (nenhum passo extra de engenharia antes/depois do freeze).

### Opção B — Importar sessões legadas (`sessionsImported > 0`) no T-0

- **Descrição:** estender o import para popular `sessions` (e mapear tokens legados) durante a migração, preservando sessões ativas dos usuários legados através do cutover até 20/09.
- **Custo:** engenharia significativa — token legado (JWT Supabase) não é sessão opaca Better Auth; exigiria tradução/seed de tokens, ajuste do importador e do contrato de reconciliação, além de testes de revogação sobre estado híbrido. Operação: passo extra no dia-D com rollback próprio.
- **Risco:** alto — contradiz ADR-020 §2 (nenhum token Supabase no runtime) e ADR-021 §4 ("sessões não são importadas"); introduz estado legado no destino exatamente no dia de maior risco; invalida o contrato `sessionsImported=0` aceito pelo gate (`migracao-supabase-neon.md`).
- **Efeito na janela de freeze:** amplia a janela (import + reconciliação de sessões + smoke estendido) e cria novo caminho de rollback para estado de sessão.

### Opção C — Ponte de sessão no BFF: aceitar token legado até o sunset 20/09

- **Descrição:** caminho híbrido de validação no runtime Neon: sessão Better Auth OU token Supabase legado, com a ponte removida no sunset.
- **Custo:** engenharia (validador duplo no BFF, feature-flag, remoção pós-sunset) + operação (dois caminhos de validação monitorados por 8 dias).
- **Risco:** médio-alto — viola o gate "nenhum import, SDK, variável ou token Supabase no código executável" (ADR-021 Gates); amplia a superfície de auth na janela; benefício nulo no ramo (a) (não há sessões legadas) e parcial no ramo (b) (sessões legadas já caem quando o legacy entra em manutenção/read-only no cutover).
- **Efeito na janela de freeze:** implementação obrigatoriamente antes do freeze; deploy extra antes do T-0; remoção pós-sunset é novo deploy dentro da janela de freeze de deploys (M02-D-009 §1) — exigiria exceção.

## 3. Recomendação (do agente — não é decisão)

**Recomenda-se a Opção A.** Fundamentação na evidência:

- O import de sessões já é deliberadamente zero (`source-to-neon.ts` L598; contrato `sessionsImported=0` do runbook), e o caminho de sessão Neon é autocontido — `auth-scope-migration.md` §3 mostra que nenhuma tabela de identidade fica em escopo sem plano (`sessions`/`verifications`/`rate_limits` são (b) com justificativa ADR) e que o smoke de auth do A4 cobre o comportamento de login em tráfego real.
- As reconciliações dryrun/restore (26 tabelas, `differences_total: 0`, `pass: true`) provam o mecanismo de ponta a ponta sobre o schema que inclui `sessions` — não há lacuna estrutural a justificar Opção B/C.
- Opções B e C conflitam com gates ADR existentes e acrescentam custo certo no dia-D para benefício especulativo — mesmo padrão de raciocínio do memo G1 §5 ("custo certo, benefício especulativo").
- No ramo greenfield (a) do G1, a Opção A é trivial (primeiro tráfego real, nenhum usuário pré-existente); no ramo (b), o re-login universal é consequência já documentada da exclusão de sessões (ADR-021 §4).

## 4. Assinatura (DRAFT — a preencher pelo humano)

- Nome (humano, legível): __________________________
- Data (UTC): __________________________
- Opção aprovada: [ ] A — sessões 100% Neon, sem import (mantém ADR-020) · [ ] B — import de sessões legadas · [ ] C — ponte de sessão até 20/09
- Assinatura: __________________________
