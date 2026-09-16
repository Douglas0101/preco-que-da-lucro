# REGISTRO-H — fila humana consolidada (NAS-2)

> **Escritor único: MAESTRO.** Uma linha por item; o humano tem **uma** caixa de entrada: os briefes em `DECISIONS-PENDING/`. Squad nunca fala com o humano.
> Regra: "enquanto qualquer Tier C pende, sempre existe trilha desbloqueada" — o enxame **não** espera ocioso.

| id       | título                                             | tier | briefe                                              | recomendação                         | estado              | desde      | destrava                                                                  |
| -------- | -------------------------------------------------- | ---- | --------------------------------------------------- | ------------------------------------ | ------------------- | ---------- | ------------------------------------------------------------------------- |
| **H-10** | push + CI do HEAD local (153 commits)              | C    | `H-10.md`                                           | **A — push agora**                   | aguardando resposta | 2026-09-15 | `GATE-41` (CI verde), deploy, PR `develop→main`                           |
| **H-11** | reconexão MCP Linear/Neon                          | C    | `H-11.md`                                           | **B — quando necessário**            | aguardando resposta | 2026-09-16 | governança Linear / probes Neon (conveniência)                            |
| **H-9**  | destino do banco local `:5432` (dado não-fixture)  | C    | `H-9.md`                                            | **C** (dump→reset) ou **B** (manter) | aguardando resposta | 2026-09-15 | `db:test` no container padrão; BATERIA-5432                               |
| **H-6**  | homologação hPanel: redeploy + env de auth         | C    | `H-6.md`                                            | **A — executar agora**               | aguardando resposta | 2026-09-12 | tráfego real, séries `OBSERVED`, e2e CSP, `12.5` live                     |
| H-4      | PITR ≥ 7 d (Launch) ou exceção assinada            | C    | (memo `docs/evidence/neon-pitr-memo-2026-09-12.md`) | assinar                              | aguardando resposta | 2026-09-12 | `13.7`/`GATE-42`, carimbo do dia-D                                        |
| H-5      | assinatura do go-live                              | C    | (runbook do dia-D)                                  | assinar                              | aguardando          | 2026-09-12 | dia-D                                                                     |
| H-2      | token Vercel + `NEON_API_KEY`                      | C    | (docmap Vercel/Neon)                                | fornecer                             | aguardando          | 2026-09-12 | bateria Neon live (`12.5`/`13.7`/`ORD-28`), visibilidade do repo (`25.6`) |
| H-8      | ratificação do ADR-029 (implementação já mergeada) | A/B  | —                                                   | ratificar                            | aguardando          | 2026-09-14 | governança §21/§29                                                        |

## Prioridade recomendada (impacto × custo)

1. **H-10** — 1 min; fecha o critério de CI do `GATE-41` e libera deploy/PR.
2. **H-6** — 2 min; maior destravamento múltiplo (tráfego + 4 frentes).
3. **H-9** — 1–3 min; remove uma fonte de atrito operacional.
4. **H-11** — 3 min; conveniência (nada bloqueia sem ele).

## Regras de operação

- Briefe respondido **fora** das opções oferecidas ⇒ o MAESTRO emite um **novo** briefe (nunca improvisa).
- Resposta aceita ⇒ MAESTRO executa o runbook (despachando ao squad apropriado quando for código), registra em `SUPERVISION-LOG.md` e atualiza este registro.
- Sem resposta ⇒ o enxame segue nas trilhas desbloqueadas; cada tick sem resposta é registrado, não silenciado.
