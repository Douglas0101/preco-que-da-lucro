# Plano de fechamento dos PARTIAL do Plano Mestre (2026-09-13)

**Fonte:** `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` · placar medido em
`docs/evidence/plan-recap-2026-09-13/part-E-medicao.md` (77,8% crédito; 33 PARTIAL).
**Método:** 5 subagentes read-only (serviços/dados, banco/CI, observabilidade, segurança/UX, Neon/Auth) sobre
`develop @ 83efb16`; este documento consolida as fatias `part-1..part-5` e a arquitetura de execução (enxame + supervisão).
**Escopo:** os 33 PARTIAL. As 25 NS (memória F10, supply chain, backfill, etc.) seguem deferrals com gate e **não** entram aqui.

## 1. Impacto no placar

- Cada PARTIAL que fecha vale **+0,5 de crédito** (0,5/187 = +0,267%).
- Todos os 33 → **86,6%**; os ~29 não bloqueados por humano → **~85,5%**.
- Onda 0 (7 itens) → ~80%.

## 2. Ondas

| Onda | Escopo                                                                      | Itens | Migrations               | Bloqueio humano           |
| ---- | --------------------------------------------------------------------------- | ----- | ------------------------ | ------------------------- |
| 0    | Fundações sem migration: F0-04, §27a/b, §35, §32 fixação+SQLi, AUTH-005 A+B | 7     | —                        | —                         |
| 1    | Dados/arquitetura: 9.1, 9.2, 14.3, T2, BFF-002/003, §28                     | 9     | 0012, 0013               | —                         |
| 2    | Observabilidade: 16.7, 19.2, 19.3, 19.5, 17.8, §29, §30                     | 7     | 0014 (se RUM persistido) | M-06/Q-020 p/ SLO         |
| 3    | Segurança/UX: 18.1, 18.3, 18.5, 20.5, 20.1                                  | 5     | —                        | H-2 opcional (CSP/Vercel) |
| 4    | Neon/Auth: §12.4, §12.5, §12.6, §13.6, §13.7                                | 5     | —                        | H-4 (PITR), H-6 (tráfego) |

## 3. Decisões transversais

- **Numeração de migrations:** 0012 = `tool_executions` (14.3), 0013 = `version` (T2), 0014 = `rum_vitals` — na ordem de execução; atualizar `scripts/db/test-migrations.ts` (12→N) e `scripts/m02-v2b.mjs:32`.
- **§27 sem header nos SQL publicados:** o Drizzle calcula sha256 do conteúdo integral; classificação vai em registry sidecar + checker (header retroativo quebraria replay/DB já migrado).
- **Checkpoint do backfill (§28):** tabela `app_private.backfill_checkpoints` auto-provisionada pelo runner — sem migration Drizzle (journal 12/12 fica intacto).
- **Dependências novas: zero.** `@opentelemetry/instrumentation-pg` recusado (não cobre o driver Neon de produção).
- **Gates novos** (§27 checker, §35 teste) exigem atualizar `AGENTS.md` no mesmo commit (AGENTS.md:79).
- **Evidência versionada:** raw como `.jsonl/.json/.txt` em `docs/evidence/<tema>-<data>/` (nunca `.log`, `artifacts/`, `logs/`, `raw/` — gitignored).

## 4. Decisões ratificadas / abertas

- **Ratificada:** BFF create/update split + `M02-D-010` (update exige `version`; `upsert*` vira adapter) — Onda 1.
- **Abertas (não bloqueiam a Onda 0):** RUM persistido vs log-only (Onda 2); spike schema-only/mascaramento Neon (Onda 4); exports N/A vs feature (Onda 3).

## 5. Bloqueios humanos

- **H-4** → §13.7 (upgrade Launch/PITR ≥7 d) e configuração §12.6 (spending limit, plano pago). **P9** se exceção.
- **H-6** → execução §13.6 (tráfego real) e séries de produção.
- **Credenciais Google** (passo humano comum) → AUTH-005 parte D; A+B fecham a verificação de segurança.
- **H-2** (opcional) → CSP via CLI e inventário de drift Vercel. **D-0** e H-3/H-5 → carimbo do dia-D.

## 6. Arquitetura de execução (enxame + supervisão)

**Papéis:** S (supervisor; dono exclusivo de `package.json`, `AGENTS.md`, `PROGRESS.md`,
`EXECUTION-STATE-PROGRAM.md`, `drizzle/meta/**`; integra e commita) · O1..O5 (operadores; 1 item, 1 worktree,
1 branch, arquivos exclusivos) · V (verificador adversarial read-only por integração) · R (reconciliador de
worktree órfão/crash) · Humano (fila H).

**Parâmetros ratificados:** WIP = **3 operadores**; **V por integração** (nenhuma integração libera a próxima sem
PRONTO); **token DB por operador** (lock `/tmp/opencode/onda0-db.lock`, 1 suíte por vez; S revalida no HEAD integrado).

**Isolamento:** `git worktree add .worktree-onda0-<slug> -b ops/onda0-<slug> <C1>` (`.worktree-*/` gitignored);
symlink de `node_modules`; **nunca copiar `.env`**; env local canônico `127.0.0.1:5432/preco_que_da_lucro_test`.
Proibições: `git add -A`, checkout de outro branch no mesmo worktree, rebase/amend/force, npm install, rede externa,
editar fora da propriedade, tocar journal/ledger/marcador.

**Pipeline:** P0 C1 (plano + L33 ▶ + marcador) → PA (O2, O3, O1; 3 slots) → integrações I1=O2 → I2=O3 → I3=O1 →
PB (O4 → O5 sob token DB) → I4 → I5 → PC (check + db:test completos, `EXECUCAO-ONDA0.md`, L33 ✔, limpeza).
Cada integração: merge `--no-ff --no-commit` → manifests pelo S → gates → marcador = parent → commit → V.

**Kill-switch:** 2 integrações vermelhas consecutivas → congelar e escalar ao humano. Operador fora do escopo →
branch descartado (`ops/onda0-<slug>-orphan`) e re-execução com prompt corrigido.

**Painel:** `EXECUCAO-ONDA0.md` (append-only, mantido pelo S): op, branch, SHA, item, gates, veredito V, evidência, tempo.

## 7. Critério de aceite da Onda 0

7 itens com teste/evidência verificável e ponteiros corretos; zero dependência nova; `AGENTS.md` atualizado pelos
dois gates novos; `m02:state:check` verde em todos os commits; develop local verde; nenhum push.

## 8. Fatias (evidência bruta)

| Parte | Escopo                                           | Arquivo                     |
| ----- | ------------------------------------------------ | --------------------------- |
| 1     | Serviços/repositórios/tool execution/T2/BFF      | `part-1-arquitetura.md`     |
| 2     | Banco/CI: §27, §28, §32, §35                     | `part-2-banco-ci.md`        |
| 3     | Observabilidade/SLO: §16.7, §19, §17.8, §29, §30 | `part-3-observabilidade.md` |
| 4     | Segurança/UX/baseline: §20.1, §20.5, §18, F0-04  | `part-4-seguranca-ux.md`    |
| 5     | Neon/Auth: §12.4–§12.6, §13.6–§13.7, AUTH-005    | `part-5-neon-auth.md`       |
