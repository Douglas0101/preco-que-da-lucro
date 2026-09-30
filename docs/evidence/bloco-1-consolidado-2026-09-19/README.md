# RELATÓRIO SDD CONSOLIDADO — Bloco 1 (trilhos A, B e C)

Rodada de **2026-09-19**. Fechamento do **Bloco 1** do prompt
`PRÓXIMOS PASSOS COM NAVEGAÇÃO AUTÔNOMA E MCPs DE INFRA` — os três trilhos
de código/medição, em série, sob a regra-mãe declarada: evidência
reproduzível, fail-closed, sem autoaprovação, sem toque em produção.

Regra de leitura deste documento: ele **aponta** para a evidência, não a
substitui. Cada afirmação tem um selo versionado por trás, com
`MANIFEST.sha256` conferível por `git show <sha>:<path>`.

## 1. Estado

| trilho | WP                      | base      | head publicada | CI `UI stack` | CI `CI light` |
| ------ | ----------------------- | --------- | -------------- | ------------- | ------------- |
| A      | `F-D2-runner-failopen`  | `9e22a67` | `f06c6d8`      | `35461588021` | `35461588003` |
| B      | `F-B-reconcile-unknown` | `f06c6d8` | `d9e58a2`      | `35465899382` | `35465899399` |
| C      | `F-D2-recompute-36-40`  | `d9e58a2` | `6c2113b`      | `35468216009` | `35468216002` |
| fecho  | registro documental     | `6c2113b` | `b4d68fc`      | `35469764628` | `35469764626` |

Os oito runs acima foram **consultados via `gh run list` nesta rodada**, não
citados de memória, e todos estão `completed / success`.

- `develop` = `origin/develop` = `b4d68fc58a613c2dbe035793ddcdfdd5508818cb` (o commit de
  fecho documental; a cadeia do Bloco 1 propriamente dita termina em `6c2113b`).
- **Regra de parada declarada, não omitida:** este artefato registra a CI de
  todos os commits substantivos, **inclusive** a do commit de fecho `b4d68fc`
  (run `35469764628`) — que já era fato quando estas linhas foram escritas. O
  que ele **não** afirma é o resultado da execução do commit que carrega este
  próprio arquivo: essa é conferível por `gh run list` para o seu sha e não
  pode ser escrita aqui sem auto-referência. A parada é declarada, não um
  buraco silencioso.
- `origin/main` = `9724d2c73b269d0a0199ea305308f3237b38fa09` — **intocado em
  toda a rodada**, verificado antes e depois de cada push.
- **16 commits** entre `9e22a67` e `6c2113b`.
- **MCPs: 0 de 7 disponíveis.** `MCP_DOCKER`, `playwright`, `context7`,
  `github`, `chrome-devtools` e `linear` responderam _not listening_;
  `mcp({ connect })` falhou em `playwright`, `github` e `chrome-devtools`; o
  `neon` só devolveu tools de cache. **O trilho I (infra) foi parqueado por
  inexequibilidade**, não por escolha — e não contornado.
- Sessões Playwright: **nenhuma**. Containers efêmeros usados:
  `trk-a-pg` (`127.0.0.1:5433`), `trk-b-pg` (`:5434`), `trk-land-pg`
  (`:5435`). A porta **`:5432` (H-9) nunca foi tocada** — medido
  `0 listeners` em toda bateria.

## 2. Entrega por trilho

### 2.1 TRILHO A — `F-D2-runner-failopen` (CI)

**Problema.** A cadeia `db:test` podia passar verde sem a prova de banco ter
rodado, e um dos dois arquivos de prova **nunca teve runner nenhum**.

**O que foi medido, contra o que o ledger dizia.**

- A premissa do `ERRATA-1` ("os testes de banco skippam silenciosamente na
  CI") é **falsa**: `isLoopbackUrl` começa por `if (!value) return true;`, logo
  a ausência da variável **não** fecha o gate; só uma URL definida e fora de
  loopback o fecha (kill-switch anti-credencial-de-produção).
- Duas afirmações correlatas do ledger também caíram: `isLoopbackUrl(undefined)`
  devolve `true`, e `env -u DATABASE_URL_UNPOOLED` (o padrão dos ciclos 3–5)
  satisfaz o gate — medido, 13/13.
- Os dois fail-opens **reais** estavam em outro lugar:
  1. **deleção silenciosa de prova** — um arquivo com **1 caso** que passa
     disparava a checagem de cardinalidade e o runner saía 1; mas um arquivo com
     **0 casos** faz o vitest sair 1 por outro caminho. O caso perigoso é o
     **arquivo reduzido**, não o vazio;
  2. **prova sem assertor** — `src/test/product-contracts.test.ts` tinha 9 casos
     gated e **nenhum** script na cadeia `db:test` que os executasse.

**Correção.** `DATABASE_URL_UNPOOLED` passa a ser definida como loopback no
bloco `env:` do job; novo runner `scripts/db/test-product-contracts.ts`; piso de
cardinalidade (`MIN_TOTAL_TESTS = 13`) antes do assert de falhas; `AGENTS.md`
atualizado (cadeia 15 → 16).

**Head:** `5fba8e7` (fix) → `1a11ee2` (selo + ERRATA-5 + incidente de deriva) →
`f06c6d8` (fecho, com a CI verde e o registro do gate flaky).

### 2.2 TRILHO B — `F-B-reconcile-unknown` (reconciliação de `ai_usage`)

**Problema.** Eventos com `outcome = 'usage_unknown'` ficavam retidos
indefinidamente em `ai_daily_budgets.tokens_reserved`, sem caminho de
resolução — risco declarado do `INV-006` / P0-17 (OWASP API4).

**Decisões humanas que fixaram o desenho (não reabrir).**

1. A reserva retida **não é liberada** pelo job: o job marca
   `reconciliation_failed`, emite métrica e alarme, e **não toca na reserva**.
   A liberação é comando humano separado, com `--confirm`.
2. Gatilho = **script npm + cron documentado**, sem rota HTTP nova.

**Fato que definiu o resto.** Reconciliar junto ao gateway é
**estruturalmente impossível**: `src/lib/chat.functions.ts:243` é
`/v1/chat/completions` sem retrieval por id, e `ai_usage` não guarda payload.
Logo **100% dos eventos terminam em `reconciliation_failed` persistido** — que
é o desfecho honesto, não uma falha de implementação.

**Entrega.** `reconcileUnknownUsage` / `releaseUnknownReservation` em
`src/lib/ai/budget-ledger.server.ts` (CAS por `usage_id` + `status` + `outcome`,
`INV-009`); contadores e gauge em `src/instrumentation/telemetry.ts`;
`scripts/db/reconcile-ai-usage.ts` e `scripts/db/release-unknown-reservations.ts`;
teste de banco de 6 casos na cadeia `db:test` (16 → 17); runbook
`docs/runbooks/reconcile-ai-usage.md`.

**Deviation declarada.** O rótulo da liberação é `reservation_released` e
**não** `reconciled`: nada foi reconciliado, `real_tokens` continua `NULL`.
Gravar `reconciled` afirmaria um fato falso.

### 2.3 TRILHO C — `F-D2-recompute-36-40` (camada §36–§40)

**Problema.** A camada §36–§40 (89 itens) foi medida contra `724594c` e
carregava aviso literal de **CAMADA OBSOLETA**; a árvore recebeu depois o
outbox, a escada de memória D1–D4, o runner de backfill, o coletor de
`pg_stat_statements` e os trilhos A e B.

**Entrega.** Camada recomputada item a item contra `d9e58a2`, com verificação
mecânica das afirmações falsificáveis e verificação adversarial de contexto
limpo. Inventário: 89 → 89 linhas (`checked === discovered`), status
**67 D · 10 P · 11 NS · 1 NA → 68 D · 11 P · 9 NS · 1 NA**.

Três deltas de status, 16 correções de evidência, um defeito sistemático de
medição e uma falsificação do S6 — todos detalhados no selo do trilho C e no
ledger. O achado mais desconfortável: **a primeira versão promoveu `P2-02`
(outbox) a DONE herdando o placar sem re-verificar**; o S6 mostrou que
`new OutboxWorker` só aparece em `scripts/db/test-outbox.ts`, não há agendador,
runbook nem métrica de backlog — em produção a tabela só cresce e nada
percebe. Rebaixado a PARTIAL.

**Head:** `9502b41` → `3e818da` → `f3e56fc` → `6c2113b`.

## 3. Evidência selada

| selo                                                   | tamanho | arquivos | manifesto |
| ------------------------------------------------------ | ------- | -------- | --------- |
| `docs/evidence/trilho-a-runner-failopen-2026-09-19/`   | 632K    | 51       | 50        |
| `docs/evidence/trilho-b-reconcile-unknown-2026-09-19/` | 344K    | 17       | —         |
| `docs/evidence/trilho-b-land-2026-09-19/`              | 232K    | 7        | 6         |
| `docs/evidence/trilho-c-recompute-36-40-2026-09-19/`   | 432K    | 25       | 24        |
| `docs/evidence/incidents/2026-09-19-dependency-drift/` | 152K    | 3        | —         |

Convenção adotada nos três selos: **`captures/` + `*.log.txt`**, nunca `raw/`
nem `*.log`. Motivo medido: `.gitignore:107` ignora `docs/evidence/**/raw/` e
`.gitignore:3` ignora `*.log` — com essas extensões o manifesto seria
verdadeiro localmente e **inverificável em clone**. A prova de
clone-verificabilidade usada foi `git archive <sha> <selo> | tar -x` seguido de
`LC_ALL=C sha256sum -c`.

## 4. Gates

| gate       | exigência                               | resultado                                                     |
| ---------- | --------------------------------------- | ------------------------------------------------------------- |
| **Gate A** | `db:test` verde + prova em PG17 efêmero | ✅ 17 suítes, 0 skipped, container virgem por trilho          |
| **Gate B** | B1 concluído, sem contenção             | ✅ ciclo 6 reconciliado; contenção A×B medida ∅               |
| **Gate C** | aprovação do supervisor                 | ✅ concedido três vezes, uma por trilho                       |
| **Gate I** | trilho I não landa decisão humana       | ✅ trilho parqueado; nenhuma decisão humana tomada por agente |

As três provas de banco que fecham o Gate A aparecem em texto em cada bateria:
`13 passed (13), 0 skipped` (products-fk-conflict), `14 passed (14), 0 skipped`
(product-contracts) e `TRILHO-B: prova de banco da reconciliação concluída
(6 casos)`.

## 5. Decisões humanas tomadas nesta rodada (vigentes — não reabrir)

1. **Preservar o patch** da mutação não registrada de dependências; restaurar
   a árvore e preservar o artefato.
2. **Escopo = apenas o Bloco 1**; trilho I **parqueado**.
3. **Symlink `deepseek-harness`: reportar, não tocar.** `git add -A` permanece
   proibido.
4. **TRILHO B não libera a reserva retida**; comando humano separado.
5. **D7 tratado em WP próprio** (`F-otel-provider-order`, exige ADR), não
   dentro do TRILHO B — respeita o _"no 'while I'm here' changes bundled into a
   fix"_ do `AGENTS.md`.
6. **D7 registrado como achado de produção de alta prioridade**, sem tocar em
   produção.
7. **Placar preservado**; a divergência da camada em `23.1`/`23.2` fica
   **declarada**, não resolvida pelo agente.
8. **`GATE-43` mantido PARTIAL.**
9. **Gate C autorizado** para publicar o TRILHO C.

## 6. Riscos e follow-ups declarados

| item                                                        | estado                                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D7 — métricas de aplicação inertes**                      | `telemetry.ts:12` obtém o meter em module scope, antes de qualquer provider. **102 sítios, 20+ arquivos.** WP `F-otel-provider-order`, exige ADR + collector OTLP real                   |
| **Outbox sem metade operacional**                           | nada executa o `OutboxWorker` em produção; sem runbook, sem cron, sem métrica de backlog. Divergência com o placar declarada                                                             |
| **Memória sem entrada de runtime**                          | `memory.service.ts`, `memory.repository.ts` e `outbox.worker.ts` têm 0 importadores de runtime. Controle negativo: a trilha de tool funciona por outro caminho, então `P0-15` segue DONE |
| **Asserção e2e de storage cega ao valor**                   | `e2e/ui-stack.spec.ts:236` filtra só **nomes** de chave e passa vacuosamente com storage vazio; não é ela que sustenta a condição 8 do §41                                               |
| **Gate flaky do npm audit**                                 | falha transitória `503 ... security/advisories/bulk`; reprovou um push sem relação com o commit. Rerun verde                                                                             |
| **7 linhas de journal malformadas + 2 ids `L90`**           | dívida declarada, não corrigida em silêncio: o journal é append-only e a correção exigiria reescrever linha publicada                                                                    |
| **Symlink `deepseek-harness` não rastreado e não ignorado** | risco de commit acidental; decisão humana = reportar, não tocar. `git check-ignore` ⇒ NÃO ignorado                                                                                       |

## 7. Placar

**Inalterado: 150 D · 23 P · 12 NS · 2 UNV / 187 = 86,36% parcial · 80,21%
crua.** Nenhum dos três trilhos move o denominador: o TRILHO A e o TRILHO B
corrigem defeitos de infraestrutura fora dele, e a camada §36–§40 tem
**overlap declarado** e **não é somada** aos 187.

## 8. Próximo despacho

- **Bloco 2 (trilho I, infra):** parqueado — inexequível com MCPs 0/7.
  Reabre quando os MCPs estiverem saudáveis.
- **Bloco 3 (trilho D):** **não autorizado**. Fila em
  `docs/evidence/agent-state/QUEUE.md`: `F-D1-scanner-borders` +
  `F-D1-gate-ux` → `F-D2-depth-pin` → `F-B-mem-purge` → `F-B1-e2e`.
- **WP já aberto e não iniciado:** `F-otel-provider-order` (D7).
- **Decisões de régua ainda abertas:** a divergência `registry × placar` do
  `9.1` (o registry M-02 declara os 10/10 serviços `implemented`; o placar
  mantém o item PARTIAL).

## 9. Como reproduzir

```bash
git log --oneline --reverse 9e22a67..6c2113b      # a cadeia do Bloco 1
git show <sha>:<path> | sha256sum                 # contra cada MANIFEST.sha256
LC_ALL=C sha256sum -c MANIFEST.sha256             # da raiz do repositório
npm run db:test                                   # contra container PG17 efêmero
```

O `LC_ALL=C` não é decorativo: em locale pt-BR o `sha256sum -c` imprime
`SUCESSO` e não `OK`, e um grep por `OK` reporta zero conferidos.
