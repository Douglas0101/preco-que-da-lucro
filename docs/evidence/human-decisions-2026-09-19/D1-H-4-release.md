# D1 · H-4 — a decisão que trava o dia-D (e 263 commits de trabalho)

**Briefing para decisão humana — 2026-09-19.** O MAESTRO **não decide billing**; apresenta as opções e o risco.

## 1. O fato

| campo                       | valor medido em 2026-09-19                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` (release)     | `9724d2c` — **2026-09-13**, intocado                                                                                                                     |
| `origin/develop` (trabalho) | `de8c232` — **2026-09-18**                                                                                                                               |
| Distância                   | **263 commits** de trabalho verificado que **nunca chegaram à linha de release**                                                                         |
| CI                          | verde no tip publicado (`de8c232`, run `35305314936`)                                                                                                    |
| Alvo canônico               | `darkgray-pony-545965.hostingersite.com` ⇒ **placeholder PHP** (`GET /` = 200 "Página padrão", `x-powered-by: PHP/8.3.33`; `/ready` e `/live` = **404**) |
| PITR (Neon)                 | projeto no **plano Free** ⇒ `History retention = 6 hours` (**21600 s**)                                                                                  |
| Exigido                     | **604800 s** (7 dias) — `scripts/m02-pitr-check.mjs:39` (`MIN_RETENTION_SECONDS`), requisito **SDD §16.6**                                               |

## 2. A cadeia real (com uma correção de premissa declarada)

> **Correção de precisão (integridade > velocidade):** a formulação corrente de que _"`develop → main` exige §42"_ **não é exata**. Conforme o **ADR-017** (§19/§21), o **PR `develop → main`** exige **CI verde** — e isso **já está satisfeito** em `de8c232`. O **§42** é o _"Gate antes de Neon production"_ (10 condições), e o requisito de PITR ≥ 7 d **não está no §42**: vem do **SDD §16.6**. A cadeia precisa é:

```text
PR develop → main ............. exige CI verde .................. ✅ satisfeito (de8c232)
deploy de produção (Vercel) ... exige o merge em main ............ ⛔ depende do PR acima (ato deliberado)
cutover / dia-D / tráfego ..... exige §42 + SDD §16.6 (PITR) ..... ⛔ H-4 (PITR 6 h < 7 d) + condições artefato-only
                                exige H-5 (assinatura go-live) ... ⛔ aberto
                                exige H-6 (redeploy + env auth) .. ⛔ aberto
```

**Consequência:** H-4 é o item que **impede fechar o §42** e, com ele, o **cutover para tráfego real**. O PR de release em si não está tecnicamente bloqueado — mas liberar produção sem PITR ≥ 7 d e sem os smoke tests assinados é exatamente o risco que o §42 existe para evitar.

## 3. Opções (escolher uma)

| opção                       | o que é                                             | custo                          | fecha o §42?                            | risco residual                                                                                                                                                      |
| --------------------------- | --------------------------------------------------- | ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Upgrade para Launch** | plano Neon com PITR ≥ 7 d                           | ~US$ 1–3/mês (billing do dono) | ✅ sim, sem exceção                     | custo recorrente                                                                                                                                                    |
| **(b) Exceção P9 assinada** | aceitar formalmente PITR de 6 h e registrar o risco | zero                           | ⚠️ só com exceção **datada e assinada** | **perda de até 6 h de dados** de produção em incidente; o rollback pós-tráfego do projeto é snapshot/PITR (`13.7`) — a janela de 6 h é o único mecanismo disponível |

## 4. Recomendação registrada

- **Sem H-4 decidido, o trabalho acumulado não chega à produção.** Qualquer que seja a escolha, ela precisa ser **explícita** — o silêncio mantém o dia-D parado e a distância `develop`→`main` crescendo.
- Tecnicamente, **(a)** é a única que satisfaz o SDD §16.6 sem exceção. Se o custo for inaceitável, **(b)** é legítima **desde que** a exceção seja assinada e a janela de 6 h seja declarada como risco aceito no runbook do dia-D.
- **Fora do escopo do MAESTRO:** decidir billing. Este briefing apresenta; não decide.

## 5. O que muda quando H-4 for resolvido

- `13.7` (rollback/PITR) e `GATE-42` (6 das 10 condições hoje verificáveis → fecha com a via live).
- O carimbo de tráfego do dia-D e, por consequência, **todas as séries `OBSERVED`** que hoje não existem (`17.8`, `29.*`, `30`).
- A possibilidade de abrir o PR `develop → main` com a proteção de produção em vigor.

## 6. Ponteiros

- Memo de origem: `docs/evidence/neon-pitr-memo-2026-09-12.md` · leitura do plano Free: `docs/evidence/infra-recon-2026-09-17/`
- Check executável: `scripts/m02-pitr-check.mjs` (`--min-sec` default `604800`)
- Registro da fila: `docs/evidence/agent-state/DECISIONS-PENDING/REGISTRO-H.md`
