# D3 · Gates humanos — status consolidado (2026-09-19)

**Briefing informativo.** Nenhum destes itens bloqueia a fila de engenharia (Stream C/C3): a regra
operacional do enxame é _"enquanto qualquer Tier C pende, sempre existe trilha desbloqueada"_.

## Fila aberta

| id       | o que é                                                                                                                   | bloqueia                                                                   | custo  | status / ponteiro                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H-6**  | redeploy hPanel + env de auth (Turnstile impede automação)                                                                | tráfego real, séries `OBSERVED`, e2e de CSP, via live de `12.5`            | ~2 min | **aberto** — briefing dedicado: [D2](D2-H-6-deteccao.md) · prazo ≈ 2026-09-21T03:37Z                                                                |
| **H-4**  | PITR ≥ 7 d (Launch) **ou** exceção P9 assinada                                                                            | `13.7`, `GATE-42`, **dia-D** e o release dos 263 commits                   | ~5 min | **aberto** — briefing dedicado: [D1](D1-H-4-release.md)                                                                                             |
| **H-5**  | assinatura do go-live                                                                                                     | `CP-G3` / dia-D                                                            | ~1 min | **aberto** (runbook do dia-D) — só faz sentido depois de H-4/H-6                                                                                    |
| **H-9**  | destino do container local `:5432` (tem dado **não-fixture**: 2 contas, 8 usuários fora do marcador `@preco-que-da.test`) | higiene local / `db:test` no container padrão                              | ~2 min | **aberto** — opções: dump→reset (**C**) ou manter e seguir em efêmero (**B**). **Nota:** o daemon Docker está **inacessível** hoje ⇒ efeito latente |
| **H-2**  | token Vercel + `NEON_API_KEY`                                                                                             | baterias Neon live (`12.5`/`13.7`/`ORD-28`), visibilidade do repo (`25.6`) | ~1 min | **aberto** — a sessão Vercel autenticada cai em error boundary do SPA ⇒ não automatizável                                                           |
| **H-8**  | ratificação do **ADR-029** (migration 0013 + CAS + lock ordering **já mergeados**)                                        | governança §21/§29                                                         | ~1 min | **aberto** — último ADR **aceito** é o ADR-026; ADR-027/028/029 seguem `PROPOSTA`                                                                   |
| **H-11** | reconexão MCP Linear/Neon (credenciais expiradas)                                                                         | nada (conveniência)                                                        | ~3 min | **aberto** — nenhuma trilha depende dele                                                                                                            |

## Fechados em 2026-09-19 (ver Stream A)

| id       | desfecho                                                                                                         | prova                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **H-10** | **fechado** — push `8df3fe3..3c0f62c` (215 commits) → CI vermelho em `test:e2e` → correção → **26/26 verde**     | run `35237829581`; `de8c232` verde (run `35305314936`) |
| **H-12** | **atendido** — TTL por camada persistida (L1–L5) + escopo do `export`; recomendação **A** implementada no MEM-D4 | `f3c56db` (briefe) · `6b38580` (land)                  |

## Ratificações pendentes que não são gates de trilha (mas são dívida de governança)

- **`F-B-mem-policies`** — `ai_memory_policies` é global, sem RLS, com `INSERT` para `app_runtime` e **nenhum escritor de código**: ratificar ou revogar (dono do gate §43 + SQUAD-DB).
- **`SD-C3-12`** — `DELETE` para `app_runtime` em `ai_memory_versions`/`ai_memory_conflicts` é **expansão real de privilégio**; a imutabilidade segue garantida pela negação do `UPDATE` (medido).
- **`F-D1-raw-sha`** — lição de método (o manifesto sela o sha da **entrega**, não do pai) — em curso pelo MAESTRO.

## Regras

- Briefe respondido **fora** das opções oferecidas ⇒ o MAESTRO emite um **novo** briefe (nunca improvisa).
- Sem resposta ⇒ o enxame segue nas trilhas desbloqueadas; cada tick sem resposta é **registrado**, não silenciado.
- Fila canônica: `docs/evidence/agent-state/DECISIONS-PENDING/REGISTRO-H.md`.
