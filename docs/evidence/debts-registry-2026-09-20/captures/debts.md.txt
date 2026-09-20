# DEBTS — registry de dívidas do programa

> **Para que serve:** dar ID, origem, classe, severidade e **closure test** a toda dívida declarada
> (defeito novo, limite latente, higiene ou conformidade) para que nenhuma dependa da memória de um
> agente. Dívida sem closure test entra como `NS` e **não** conta como fechável.
> **Escritor:** MAESTRO (como `QUEUE.md`); este arquivo vive sob `docs/evidence/**`, então edits caem
> no pipeline leve, e o guard `m02:debts-guard` roda em `npm run check`, no `verify` do `ui-stack` e
> no `ci-light` — o registry é coberto pela matriz de cobertura dos dois pipelines.
> **Regra dura (mecânica):** `node scripts/m02-debts-guard.mjs` reprova registry vazio (0 = 0 não
> passa), coluna obrigatória ausente, valor degenerado, ID fora do padrão/duplicado, classe,
> severidade ou status fora da taxonomia e closure test ausente com status ≠ `NS` — nas duas
> direções (closure presente com `NS` também reprova).

## Registry canônico

| id     | origem                                                    | classe       | severidade | closure test                                                                                                            | evidência                       | status |
| ------ | --------------------------------------------------------- | ------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------ |
| DBT-01 | WP4 N1 (`L122`); `15.2` em 6/9 (WP-R0); análise Fase 0 §5 | conformidade | alta       | purga por descoberta sobre `pg_catalog` com canário por store e fail-by-default na 7ª tabela; retenção×PITR/LGPD no doc | selo WP4 §4; selo WP-R0 §3      | ABERTA |
| DBT-02 | WP3 N2 (`L120`)                                           | robustez     | média      | piso do runner asserta a **existência** dos casos de banco, não só total ≥ 15 e 0 skipped                               | selo WP3 §4                     | ABERTA |
| DBT-03 | WP5 N6 (`L124`)                                           | robustez     | baixa      | e2e do gate analytics com auth+PG isolados do ambiente local                                                            | selo WP5 §4                     | ABERTA |
| DBT-04 | WP5 N8 (`L124`); análise Bloco 3 §3                       | robustez     | média      | invariante do gate medida nas **duas** direções + controle negativo pinado em CI permanente                             | selo WP5 §4; análise Bloco 3 §3 | ABERTA |
| DBT-05 | WP5 N9 (`L124`); WP-R3 N11                                | higiene      | baixa      | scratch de sonda versionado em `captures/*.txt` ou gerado em tmp pelo próprio teste                                     | selos WP5/WP-R3                 | ABERTA |
| DBT-06 | WP4 N7 (`L122`)                                           | higiene      | baixa      | assertar zero sobreviventes do RED no container efêmero antes do teardown                                               | selo WP4 §4                     | ABERTA |
| DBT-07 | WP-R0 `15.5` (README:57)                                  | robustez     | média      | FTS da memória (`tsvector`+GIN, config pt) com teste de retrieval                                                       | selo WP-R0 §3                   | ABERTA |
| DBT-08 | WP-R0 `22.4` (README:62)                                  | higiene      | baixa      | TTL/purge de `idempotency_records` com teste de expiração                                                               | selo WP-R0 §3                   | ABERTA |
| DBT-09 | TRILHO C `P2-02` (`L107`)                                 | conformidade | alta       | agendador do `OutboxWorker` + métrica de backlog (hoje nada executa o worker)                                           | selo TRILHO C; `L107`           | ABERTA |
| DBT-10 | TRILHO C colateral (`L107`)                               | conformidade | alta       | `memory.service`/`memory.repository` com importador de runtime (GATE-43 repousa em código não chamado)                  | `L107`; selo TRILHO C           | ABERTA |
| DBT-11 | WP1 N1/N2/N5 (`L118`)                                     | robustez     | baixa      | limites latentes do scanner (homônimo de método/campo, `var` function-scoped, import sem nome) com caso de falsificação | selo WP1 §4                     | ABERTA |
| DBT-12 | WP2 N2/N4 (`L118`)                                        | robustez     | baixa      | limites latentes do gate-ux (linha legada incondicional; `path:line` ruidoso) pinados em teste de contrato              | selo WP2 §5                     | ABERTA |

## Como adicionar uma dívida

1. Toda dívida nasce de um fato-fonte nomeado na coluna `origem` (`WP N`, `Lnn`, `§nn.n` ou
   arquivo:linha) — nunca "sabe-se lá".
2. `closure test` descreve o par que **reprova** com o defeito presente (controle negativo);
   dívida multi-sítio exige enumeração por **descoberta** (`catálogo`/`grep`) e `checked === discovered`.
3. Sem closure test, o status é `NS`: a dívida fica registrada, mas não conta como fechável.
4. O status só muda para `FECHADA` com o selo/WP que executou o closure; `EM_TRATAMENTO` é declaração
   do MAESTRO (convenção editorial, não enforçada por máquina).
