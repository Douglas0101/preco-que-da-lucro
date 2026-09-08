# 07 — MCP hPanel: tabela D1 publicada antes da execução (Fase D, 2026-09-08)

- **MCP Hostinger:** catálogo (`mcp-find`) expõe `hostinger-mcp-server`, que
  exige `api_token` — **não configurado**. Até o token mínimo existir, todo
  item abaixo é HUMAN-REQUIRED no painel.
- **Regra:** nenhum item sai de `BLOCKED` sem valor observado em preview;
  evidência por item em `docs/evidence/hpanel-homologacao-<AAAA-MM-DD>/01–11`;
  domínio canônico intocado até 11/11 + assinatura.

## D0 — pré-requisitos humanos (todos PENDENTES)

| Requisito                                                                                                     | Estado                                    |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| plano comprado (Cloud Startup ou superior, Node 24)                                                           | PENDENTE                                  |
| token API escopos mínimos + MCP configurado                                                                   | PENDENTE (servidor existe, token ausente) |
| domínio canônico decidido                                                                                     | PENDENTE                                  |
| **custódia do domínio VERIFICADA** (não registrada via Lovable/sócio — se estiver, transferir antes do dia-D) | A VERIFICAR                               |
| resposta Node (≥24.15; minor abaixo → ADR ou start custom, nunca silêncio)                                    | PENDENTE                                  |

## D1 — 11 itens → {ferramenta | HUMAN-REQUIRED}

| #   | Item (H)                         | Ferramenta/sonda                                              | Executor                     |
| --- | -------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| 1   | Node ≥24.15 (H-01)               | `node --version` em preview                                   | HUMAN (captura do painel)    |
| 2   | start custom (H-02)              | `npm run start` + `ps`                                        | HUMAN (config do painel)     |
| 3   | porta `PORT/NITRO_PORT` (H-02)   | env NOMES + boot log                                          | HUMAN                        |
| 4   | host bind (H-02)                 | env NOMES + preview roteia                                    | HUMAN                        |
| 5   | persistência 3×15min (H-03)      | `curl .../live` com timestamps                                | HUMAN (janela)               |
| 6   | restart ≤60s (H-03/H-08)         | kill + `ps`/`curl`                                            | HUMAN (operacional)          |
| 7   | logs sem secrets (H-09)          | `grep -Ei ... \| wc -l` = 0                                   | HUMAN (UI de logs)           |
| 8   | proxy >60s (H-04)                | `time curl POST .../api/chat --max-time 120`                  | HUMAN (medir + decidir)      |
| 9   | egress Neon/Resend/IA (H-05)     | 3 sondas HTTPS sem credenciais                                | HUMAN (a partir do ambiente) |
| 10  | live/ready 200 (H-10)            | `curl -i .../health/{live,ready}`                             | HUMAN                        |
| 11  | secrets por ambiente (H-11/H-14) | env diff só NOMES; `ADMIN/SUPABASE/MIGRATION` ausentes no web | HUMAN                        |

Contrato env (NOMES): presentes `DATABASE_URL` (pooled), `DATABASE_DRIVER`,
`BETTER_AUTH_*`, `AUTH_TRUSTED_ORIGINS`, `RESEND_*`, `AI_GATEWAY_*`;
proibidas no web `DATABASE_ADMIN_URL`, `SUPABASE_*`, `MIGRATION_*`,
`DATABASE_URL_UNPOOLED`.

## Portão canônico ARMADO

11/11 PASS em **preview** + `hostinger-hpanel-verification.md` atualizado +
assinatura/ledger do dia. Só então apontar o domínio e iniciar A4 (D4).
