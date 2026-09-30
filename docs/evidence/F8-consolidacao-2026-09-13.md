# F8 · Consolidação da rodada de 2026-09-13 (fases J · 1 · 2 · 3 · 4 · 5)

**Refs finais:** `main` = **`9724d2c`** (SHA do dia-D, substitui `ef2110e7`) · `develop` = `0734ed9` · WIP `codex/p0-closeout` = `49eaf2b` (preservado)
**Produção (Vercel):** deployment de `9724d2c` em `main` = **Ready em 15 s** · probes da interina `-sage` **200/200/200** (2026-09-13T03:22:10Z) · canônico `preco-que-da-lucro.vercel.app` = 404 (sem target, esperado)

## 1. Fases — estado, artefato, veredito

| Fase                            | Estado     | Artefato                                                                                      | Prova                                                                                                                                                                                                                                                                |
| ------------------------------- | ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **J — PROGRESS-JOURNAL**        | ✅         | `docs/evidence/agent-state/PROGRESS.md` · regra de boot em `AGENTS.md` · `AGENT-ENV-NOTES.md` | **Caso real de escrita/retomada:** colisão de escrita (agente no mesmo worktree; M1 caiu no branch dele) → steer + cherry-pick de volta (`L22`–`L24`); **podagem** falhas 322%→6% e projeto 497%→12% (backup em `~/.local/share/pi-fronts/memory-prune-2026-09-13/`) |
| **1 — Contrato duplo de build** | ✅         | `docs/evidence/build-contract-2026-09-13.md`                                                  | `.output/server/index.mjs` (21.443 B) **e** `.vercel/output/*` (366 B), ambos exit 0 → sem regressão cruzada; achado: `.vercel/` fora do `.gitignore` (corrigido)                                                                                                    |
| **2 — Port do lote P0**         | ✅ (23/24) | `docs/evidence/p0-port-2026-09-13.md` §9                                                      | PR **#46** com 5 commits por propósito; gate local 47 arquivos/429 testes; **ciclo SSR** resolvido (`4bd4a76`); `verify` verde                                                                                                                                       |
| **3 — CI leve seletivo**        | ✅         | `docs/evidence/ci-path-filter-2026-09-13.md` §8                                               | PR **#45**; **Prova A** `455ea7f` (só docs) ⇒ apenas leve; **Prova B** `36e9c63` (misto) ⇒ pesado                                                                                                                                                                    |
| **4 — Dormentes**               | ⏳         | `SESSION-LIMIT.md` · artefatos Vercel/Neon                                                    | Watchers ativos; aguardam **H-6** (hPanel) e **H-2** (token)                                                                                                                                                                                                         |
| **5 — Consolidação**            | ✅         | este artefato + journal `L28` + ledger                                                        | —                                                                                                                                                                                                                                                                    |

## 2. Supervisão e limites

- **S-TEC** (FASE 1/3): veredito na rodada anterior (P1 do probe de auth corrigido); nesta rodada o contrato duplo foi **provado por execução**, não por parecer.
- **Colisão de escrita:** registrada como caso real da técnica J2; lição operacional incorporada — _agente que muta repositório recebe worktree próprio_ (a partir daí o port usou `.worktree-p0-port`, isolado, com zero colisão).
- **Gaps declarados (não mascarados):** `chat.functions.ts` (limites de bytes/cardinalidade, janela de histórico e lock de rate-limit), margem negativa de break-even (`invalid` vs `unreachable`) e testes de `model-gateway` — frente dedicada.

## 3. Fila humana (inalterada)

| ID      | Ação                                                                                               | Destrava                       |
| ------- | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| **H-6** | Firefox: `NPM_CONFIG_ENGINE_STRICT=false` → Reimplantar → `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` | 11/12 + dia-D no alvo canônico |
| **H-4** | PITR ≥ 7 d (Launch ~US$1–3/mês) **ou** exceção assinada (P9)                                       | carimbo de tráfego (§16.6)     |
| **H-5** | Assinatura do go-live                                                                              | CP-G3                          |
| **H-2** | (opcional) token Vercel                                                                            | inventário de config/drift     |

## 4. ESTADO DO SUBSTRATO (2026-09-13T03:2xZ)

- **Tráfego de aplicação:** continua **NÃO EXISTE** (só probes). O primeiro acesso real continua dependendo do 11/12 + domínio (H-6).
- **Neon:** produção 12/12 migrações; RLS 26 tabelas/30 políticas; PITR **6 h (BAK-01b aberto, H-4)**.
- **GitHub:** `main` = `9724d2c` · `develop` = `0734ed9` · CI verde nos dois tips (release #47 e port #46); CI leve ativo para `docs/evidence/**`.
- **Vercel:** produção `9724d2c` Ready; interina 200/200/200; canônico 404 (sem target).
- **hPanel:** preview criado, build **FAIL** no item 1 (EBADENGINE) — aguarda H-6; sessão bloqueada intermitentemente por Cloudflare (limite declarado).
- **Agente:** memória podada e journal no ar (handoff de ~30 s).

## 5. Top-3 riscos

1. **BAK-01b (PITR 6 h)** — se o tráfego começar sem ≥7 d, viola §16.6. Custo de fechar: ~US$1–3/mês (H-4).
2. **H-6 (sessão/alvo hPanel)** — ponto único humano: sem ele o 11/12 não fecha e o dia-D não abre; o build do alvo segue FAIL.
3. **Rollback sem commit no hPanel** — R3 do runbook é o elo fraco; validar `git revert`+push no preview antes do dia-D.

**Residual declarado:** o port deixou o `chat.functions.ts` fora (maior arquivo do lote) — não descrever o port como "lote completo".
