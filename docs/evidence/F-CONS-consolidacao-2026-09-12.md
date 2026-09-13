# F-CONS — Consolidação da rodada de produção (2026-09-12)

> Mandato: sincronizar Neon + hPanel + Vercel + GitHub para entrada em produção, com DOC-FIRST, um navegador por sistema, supervisão transversal e checkpoints globais. Esta é a consolidação de fechamento da rodada.

## 1. GitHub — CP-G1 executado

- PR `develop→main` criado e **mergeado às 2026-09-12T03:15:40Z**, somente após **checks verdes** (sem force, sem admin bypass, sem delete-branch).
- **`main` = `ef2110e7315e568348d083c944ea6cc65778f646`** — **SHA FINAL** (é o que o dia-D publica).
- CI verde nos 3 pushes da rodada (`34665381651`, `34668574247`, `34668707268`).
- `develop` = `c080586` + commit de evidências desta rodada.

## 2. Frentes — estado, artefatos e supervisão

| Frente     | Estado                                       | Artefatos principais                                  | Supervisor (veredito)                |
| ---------- | -------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| **F-GIT**  | ✅ CP-G1 concluído                           | ledger + PR #44                                       | —                                    |
| **F-VER**  | ⚠️ interino verde-evidenciado                | `vercel-docmap-2026-09-12.md`                         | S-TEC: SUPORTADO (1 parcial)         |
| **F-HP**   | ⚠️ n/12 (destrava com H-1)                   | `hpanel-docmap-2026-09-12.md`                         | S-TEC: PARCIAL; S-ALIN: P1 corrigido |
| **F-NEON** | ✅ 12/12 + snapshot pós-cutover              | `neon-pitr-memo-2026-09-12.md`, `cutover-2026-09-12/` | S-TEC: PARCIAL (P1 corrigido)        |
| **F-REPO** | ⚠️ limite declarado (causa não estabelecida) | `f-repo-archaeology-2026-09-12.md`                    | —                                    |
| **F-CONS** | ✅ este documento + G-VER-v2                 | `G-VER-v2-memo-2026-09-12.md`                         | S-SEC: CLEAN                         |

## 3. Supervisão transversal (docs/evidence/subagents/)

- **S-SEC — CLEAN.** Nenhum valor de secret/env/token/cookie/PII nos 10 artefatos varridos. P2 corrigido (host do endpoint Neon mascarado em `role-membership-t0.{md,json}`); P2 report-only (IDs de recurso do projeto).
- **S-TEC — OK com notas.** 404/200 e "sage verde" corroborados por evidência local independente; 302/SSO é fonte única (probe do orquestrador). P1: o Launch só cumpre SDD §16.6 **com a janela de histórico configurada em 7 dias** (default pago = 1 dia) — corrigido no memo. P2s: vínculo `f03gpvmth`↔`e6da247` marcado como inferência; citações paráfrase ajustadas.
- **S-ALIN — DESVIO parcial.** 2 P1 corrigidos: rótulo de fechamento dos GAP-DOCs (agora "PARCIALMENTE") e caminho do `hpanel-secrets.env` no README (agora `~/.config/`). P2: H-3/H-4/H-5 são gates de decisão sem detector automático (registrado).

## 4. Fila humana — instrução exata + detecção automática

| ID      | Instrução                                                                                                                                            | Detecção                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **H-1** | `cp ~/.config/hpanel-secrets.env.example ~/.config/hpanel-secrets.env && chmod 600 ~/.config/hpanel-secrets.env` → preencher valores                 | watcher `h1-watch.sh` (bg task) gera `~/.local/share/pi-fronts/H1-ready.txt` + inventário de NOMES |
| **H-2** | `npm i -g vercel && vercel login` **ou** gravar token em `~/.config/vercel-token` (chmod 600)                                                        | watcher `h2-watch.sh` → `H2-ready.txt`                                                             |
| **H-3** | Assinar `docs/evidence/G-VER-v2-memo-2026-09-12.md` §4                                                                                               | ação humana (sem detector)                                                                         |
| **H-4** | Decidir PITR: **Launch** (7 dias; usage-based, ~US$1–3/mês no uso atual) + configurar janela em 7 dias + re-medir `history_retention_seconds=604800` | verificação pós-contratação via Neon MCP (`history_retention_seconds`)                             |
| **H-5** | Assinatura do go-live (domínio + SSL + A5)                                                                                                           | ação humana (sem detector)                                                                         |

## 5. Estado do substrato

```yaml
Tráfego: NÃO EXISTE (ainda)
Neon: PRONTO — 12/12 migrations, smoke 7/7, readiness 8/8; snapshot pós-cutover sha256 a8d35646…; nativo válido até 2026-10-10
Vercel: interino — alias público sage 200/200/200 (evidência 2026-09-12T03:07–03:08Z); alias canônico 404; deployment sob SSO; inventário pendente de token (H-2)
hPanel: n/12 — aguarda H-1; preview Neon a recriar; domínio canônico em uso por outro app (decisão D-0)
PITR: 6h (BAK-01b aberto) — Launch com janela de 7d é o caminho (H-4)
GitHub: main = ef2110e7 (SHA final); develop = c080586 + evidências
dia-D: SEM DATA — pré-condições: 11/12 + G-VER-v2 assinada + snapshot <24h + assinatura do go-live
```

## 6. Top-3 riscos do go-live e mitigação

1. **Drift de lockfile recorrente** (2 episódios: 02:38:55Z e 02:58:54Z; causa não estabelecida, dono: Douglas): restaurar antes de cada gate/commit; **guard `m02:lockfile-guard` proposto** (F-REPO §2, não wired) + captura em flagrante (inotify/lsof) na próxima recorrência.
2. **hPanel sem rollback por commit** (GAP-DOC material): emenda obrigatória — rollback = `git revert`/reset + push, ou upload do archive anterior; validar o fluxo no preview **antes** do dia-D.
3. **Vercel out-of-repo** (alias canônico sem target; deployment sob SSO; env exige redeploy): fechar inventário com H-2; nenhuma correção de produção sem aprovação.

## 7. GAP-DOCs materiais registrados

- **Hostinger**: não há rollback por commit (doc oficial × runbook de rollback) — emenda antes do dia-D.
- **Neon**: a norma de 7 dias é **SDD §16.6**, não o §42 do plano mestre; Launch exige configurar a janela (default pago = 1 dia).
- **SDD §2411** afirma allowlist WARN-NITRO-001 até 01/09, enquanto `scripts/build.mjs:16` diz 06/10 — drift doc↔código.
- **DATABASE_DRIVER**: runbooks dizem `node-postgres`; `.env.example`/`client.server.ts` apontam `neon-serverless` como padrão de produção.
