# Guardrails de gasto na Neon (§12.6) — o que é preparável hoje e o que depende de H-4

**Rodada:** Onda 4 · operador O25 · base `6132325` · branch `ops/onda4-pitr-spend` · 2026-09-14
**Escopo:** `docs/evidence/plan-partials-2026-09-13/part-5-neon-auth.md` §12.6 (scaffolding de guardrails de gasto),
executado junto de §13.7 (`docs/evidence/neon-pitr-memo-2026-09-12.md` §12).
**Limite desta rodada:** **não existe `NEON_API_KEY` neste ambiente** (H-2). Toda a lógica de rede foi provada com
`fetch` mockado e o caminho de skip foi executado de verdade; **nenhuma chamada live foi feita** — ver §5.

---

## 1. Enunciado honesto (não vender guardrail forte)

| Fato                                                                           | Consequência operacional                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O canal de alerta da Neon é **SOMENTE e-mail** e **não suspende compute**      | Um pico de custo consome antes de qualquer reação humana. **Não** é teto de gasto, **não** contém custo e **não** pode ser citado como mitigação de risco de custo. |
| `spending_limit` exige plano pago                                              | **Não** configurável hoje (H-4); nenhum PATCH/PUT é emitido por este trabalho.                                                                                      |
| Métricas de consumption v2 exigem plano pago + chave com escopo de organização | **Não** medidas hoje; não há número de consumo por projeto/branch nesta rodada. O ambiente aqui tem chave de escopo de projeto (quando existir).                    |
| O que existe hoje com garantia                                                 | Dump externo verificado (`m02:snapshot` + `m02:backup-verify`) e snapshot/PITR como camada de recuperação — **não** são guardrails de gasto.                        |

Nota do plano (§12.6, verbatim): “alerta é e-mail-only (não suspende compute) — não vender como guardrail forte”.
Essa frase é a redação vigente; qualquer artefato futuro que trate alerta de e-mail como controle precisa contradizê-la explicitamente.

## 2. Preparável hoje (entregue nesta rodada)

| Artefato                                                | Papel                                                                                                                                       | Somente leitura                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `scripts/m02-neon-spend.mjs`                            | Inventário **local**: `GET /projects/{id}` → `history_retention_seconds`; `GET /projects/{id}/branches` → contagem e campos confirmados.    | **Sim** (2 GET; nenhum PATCH/PUT) |
| `.github/workflows/neon-drill-ops.yml` → `spend-status` | Operação manual que roda o script com `NEON_API_KEY` só em GitHub Secrets, publica `spend-status.json` como artefato e uma linha no resumo. | **Sim**                           |
| `scripts/m02-pitr-check.mjs` + `pitr-status`            | §13.7: janela de histórico medida contra SDD §16.6 (≥ 7 d) — o insumo que H-4 usa para decidir e para fechar BAK-01b.                       | **Sim**                           |

### 2.1 Norma de saída (o plano é explícito: só hostnames)

- A saída do inventário **não** contém URL de conexão, chave, token nem id de projeto/branch/organização.
- O payload bruto da API **nunca** é ecoado: o script projeta campos e extrai hostnames por redução
  (`toHostname`/`hostnamesOnly`), com teste de regressão que injeta
  `postgresql://app:<segredo>@<host>/neondb` no payload e exige `<segredo>` **ausente** da saída serializada.
- Campos de consumo por branch (`compute_time_seconds`, `active_time_seconds`, `written_data_bytes`,
  `data_transfer_bytes`) são lidos **se presentes** e o relatório **declara** quais ficaram ausentes
  (`usage_fields_to_confirm`). A presença desses nomes na resposta **não** é confirmada neste ambiente — é **TO-CONFIRM**.

## 3. O que depende de H-4 (decisão humana — plano pago)

| Item                                              | Depende de                                                     | Como fica verificável depois                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spending_limit` (teto de gasto)                  | Plano pago (H-4) + chave com **escopo de organização/billing** | Passo humano único; medir rejeição/aceitação e registrar o teto no artefato de fechamento (a forma do endpoint continua **TO-CONFIRM**: nenhum PATCH de billing existe no repo) |
| Consumption v2 (consumo por projeto/branch)       | Plano pago (H-4)                                               | Medir por projeto e por branch e **anexar** ao fechamento; hoje só há inventário, não consumo                                                                                   |
| Janela de PITR ≥ 7 d (BAK-01b, §13.7)             | Plano pago (H-4) + configurar a janela (default pago = 1 d)    | `pitr-status` verde (`history_retention_seconds ≥ 604800`) anexado ao fechamento                                                                                                |
| Alerta de gasto em canal que **suspenda** compute | Fora do que a Neon oferece hoje (e-mail-only)                  | Nenhum caminho conhecido; se H-4 quiser contenção de custo, o controle é contratual/observabilidade externa, não este alerta                                                    |

## 4. Provas locais desta rodada (comandos e contagens)

| Verificação                                             | Comando                                                                             | Resultado                                                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testes unitários (fetch mockado + skip real)            | `npx vitest run src/test/m02-pitr-check.test.ts src/test/m02-neon-spend.test.ts`    | **34 passed / 34** (2 arquivos)                                                                                                                                       |
| Skip sem chave (PITR)                                   | `node scripts/m02-pitr-check.mjs`                                                   | exit **0**, `result: "SKIP"`, `live_call: false`, `missing: [NEON_API_KEY, NEON_PROJECT_ID]`                                                                          |
| Skip sem chave (spend)                                  | `node scripts/m02-neon-spend.mjs`                                                   | exit **0**, `result: "SKIP"`, `live_call: false`                                                                                                                      |
| `--plan` com credencial presente (nenhuma rede)         | `node scripts/m02-pitr-check.mjs --plan` / `node scripts/m02-neon-spend.mjs --plan` | exit 0, `mode: "plan"`, `live_call: false`                                                                                                                            |
| Passo do workflow, caminho de skip                      | script do passo extraído do YAML e executado com `bash` (sem chave)                 | exit **0**, artefato `spend-status.json` escrito, resumo publicado                                                                                                    |
| Passo do workflow, caminho live (API **mockada local**) | servidor HTTP em `127.0.0.1` servindo o payload; `NEON_API_BASE` apontado para ele  | `pitr-status`: exit **1** (`FAIL`, 21600 s < 604800 s) · `spend-status`: exit **0** (`OK`, 2 branches, `hostnames=[…neon.tech]`) · log do mock mostra **somente GET** |
| Auditoria de segredos                                   | `npm run m02:secrets-audit`                                                         | `result: COMPLETE_WITH_LIMITS`, `failures: []`, `possible_secret_literals: []`                                                                                        |

Os testes exercitam: parse de argumentos (inclusive entrada inválida), preflight por **nome** de variável, leitura
tolerante do envelope, veredito PASS/FAIL/DESCONHECIDO, redação da chave em mensagens de erro, HTTP ≠ 200 →
INCOMPLETE (fail-closed), falha de rede, e a norma de saída (sem segredo/id/URL de conexão) — sempre com `fetch`
mockado; nenhuma rede externa é tocada pelos testes.

## 5. Residual declarado (não resolvido nesta rodada)

1. **Chamada live NÃO VERIFICADA:** sem `NEON_API_KEY` (H-2), a forma real da resposta de
   `GET /projects/{id}` e de `GET /projects/{id}/branches` — e portanto a presença de
   `history_retention_seconds` e dos campos de consumo — **não** foi observada. O que está provado é a lógica
   (testes com mock) e o skip rotulado.
2. **Escopo da chave:** uma chave de projeto pode **não** ser suficiente para `spending_limit` (escopo de
   organização/billing). Não foi possível verificar qual escopo o `NEON_API_KEY` atual tem.
3. **`spending_limit` não é configurável aqui** (plano pago — H-4); nenhum endpoint de billing foi exercitado
   nem citado por nome neste artefato.
4. **Alerta de e-mail só é conhecido por documentação de v2** (`neon-pitr-memo-2026-09-12.md` §6.13, residual);
   a existência/configuração do alerta na conta atual **não** foi medida — o que este artefato afirma é apenas
   que ele **não** suspende compute e não pode ser vendido como guardrail forte.
5. **Alias npm** (`m02:neon-spend` / `m02:pitr-check`) **não** foi adicionado a `package.json` (arquivo com dono
   declarado nesta onda); a invocação é direta: `node scripts/m02-neon-spend.mjs`.
6. **Retenção de snapshots e billing de snapshots** (memo v2 §6.8) continua **RESIDUAL**.

## 6. Próximo passo recomendado

1. H-4 decide o plano; em seguida configurar a **janela de histórico** (default pago = 1 d) e rodar `pitr-status`
   para medir (`history_retention_seconds` esperado `604800`) — é a prova de fechamento de BAK-01b.
2. Só depois, com chave de escopo de organização, configurar `spending_limit` e medir consumption v2 por
   projeto/branch; anexar ao fechamento **junto** da ressalva do alerta e-mail-only.
3. Enquanto não houver teto de gasto, tratar custo variável como risco **aceito e declarado** — não como risco mitigado.
