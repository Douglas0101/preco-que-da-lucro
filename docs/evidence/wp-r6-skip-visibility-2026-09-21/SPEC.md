# SPEC — WP-R6 `F-skip-visibility`

**Data:** 2026-09-21 · **Branch:** `mission/r6-skip-visibility` · **Base:** `eb2f498`
**Autor:** MAESTRO · **S6:** lane adversarial de contexto limpo

---

## 1. Fato-fonte

| fato                                              | ponteiro                                                                                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Endurecimento exigido antes da ratificação do R0b | análise avançada de 2026-09-20 §6.1 ("skip é o primo do N3 um nível acima — teste que não roda e não reprova"; "cada skip precisa de motivo nomeado, mapeamento para precondição de ambiente (item 17) ou DBT, e visibilidade no selo") |
| Medição que originou o E2 local                   | `QUEUE.md` §Ciclo 5, correção S0 (F-C6-2): "o buraco real é o **E2 local** (`npm run check` ⇒ `5 passed \| 4 skipped`)"                                                                                                                 |
| Os 13 skips                                       | `npm run check`: `952 passed \| 13 skipped` — `src/test/product-contracts.test.ts` (9) e `src/test/products-fk-conflict.test.ts` (4)                                                                                                    |
| Regra do item 17 (já no contrato)                 | `AGENTS.md` §Work packages: precondição de ambiente declarada e verificada em runtime, falhando **fechado**                                                                                                                             |

## 2. Problema (medido nas quatro configurações, com a linha `Test Files`)

A precondição era a mesma expressão duplicada nos dois arquivos:

```ts
function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return true; // <-- ausente passa como se fosse loopback
  ...
}
const dbEnabled =
  Boolean(adminUrl) && isLoopbackUrl(adminUrl) &&
  isLoopbackUrl(process.env.DATABASE_URL) && isLoopbackUrl(process.env.DATABASE_URL_UNPOOLED);
const dbDescribe = dbEnabled ? describe : describe.skip;
```

Medição direta (`npx vitest run src/test/product-contracts.test.ts`):

| configuração do ambiente         | `isLoopbackUrl` antigo | `dbEnabled` | `Test Files` | leitura                                                                       |
| -------------------------------- | ---------------------- | ----------- | ------------ | ----------------------------------------------------------------------------- |
| nenhuma das 3 URLs               | —                      | `false`     | **1 passed** | skip legítimo, mas **invisível**: nada diz por quê                            |
| **3 URLs remotas**               | `false`                | `false`     | **1 passed** | **FAIL-OPEN** — o ambiente _declara_ banco e a suíte fica verde sem prova     |
| **só `DATABASE_URL` remota**     | `false`                | `false`     | **1 passed** | **FAIL-OPEN** (mesma classe; achada ao medir a anterior)                      |
| só `DATABASE_ADMIN_URL` loopback | `true` (ausente)       | `true`      | 1 failed     | falha, mas por **ECONNREFUSED** — fail-closed _por acidente_, não por desenho |

**Alcance honesto do defeito:** o `env-guard` já bloqueia URL remota no caminho `npm` (`DENY_SET` contém
`test`, `db:test`; medido: exit 3 com `DATABASE_URL` remota). O fail-open só é alcançável **contornando
o script npm** — `npx vitest run <arquivo>`, que é o fluxo de trabalho usado o tempo todo neste
programa. A camada 1 cobre o caminho npm; a camada 2 (a suíte) não cobria nada.

**Agravo:** a decisão de pular era um **booleano sem motivo**. Um ambiente meio configurado e um
ambiente deliberadamente sem banco produziam o mesmo `1 passed` — indistinguíveis.

## 3. Contrato (invariantes falsificáveis)

| id           | invariante                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-R6-a** | A precondição é **tudo ou nada**: nenhuma das três URLs definida ⇒ skip; **qualquer** uma definida ⇒ as três são exigidas e todas em loopback.                             |
| **INV-R6-b** | Violação da precondição é **erro de precondição** (falha alta, mensagem nomeando chave e problema), nunca skip silencioso.                                                 |
| **INV-R6-c** | O skip legítimo é **visível e nomeado** (`db-precondition: N/A-sem-DB: …`), não inferido de uma contagem.                                                                  |
| **INV-R6-d** | `isLoopbackUrl(undefined)` é **`false`** — ausente não é loopback. A decisão vive num único módulo (`src/test/helpers/db-precondition.ts`), não duplicada em cada arquivo. |

## 4. Mudanças (lista fechada)

| arquivo                                             | mudança                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `src/test/helpers/db-precondition.ts`               | **novo** — fonte única da precondição                        |
| `src/test/product-contracts.test.ts`                | usa o helper; `isLoopbackUrl` e `dbEnabled` locais removidos |
| `src/test/products-fk-conflict.test.ts`             | idem                                                         |
| `src/test/db-precondition.test.ts`                  | **novo** — 7 casos, incluindo o booleano invertido           |
| `docs/evidence/wp-r6-skip-visibility-2026-09-21/**` | SPEC, README, capturas, `MANIFEST.sha256`                    |

**Não muda:** nenhum código de runtime, nenhuma migration, `package.json` intocado, `:5432` intocado,
`origin/main` intocado. O comportamento no CI é **inalterado** (lá as três URLs são loopback ⇒
`enabled: true` ⇒ os 13 rodam como sempre).

## 5. DoD

| #   | critério                                                         | prova                                        |
| --- | ---------------------------------------------------------------- | -------------------------------------------- |
| 1   | sob a semântica antiga, as 4 configurações dão veredicto ambíguo | captura §mutação: A/B/C todas `1 passed`     |
| 2   | restaurado, B/C/D falham alto **nomeando** chave e problema      | captura §restaurado                          |
| 3   | A passa com skip **visível**                                     | linha `db-precondition: N/A-sem-DB`          |
| 4   | `isLoopbackUrl(undefined) === false` pinado por teste            | `db-precondition.test.ts`                    |
| 5   | os 13 skips rodam no CI como antes                               | E2 + `ui-stack` verdes; `db:test` inalterado |
| 6   | `npm run check` exit 0                                           | captura do gate                              |
| 7   | selo com `checked === discovered`                                | `m02-seal`                                   |
| 8   | CI verde no commit selado, `run@sha` com ≥ 1 check aplicável     | `gh run list` por SHA                        |

## 6. Testes — RED/GREEN e falsificação

| invariante | RED (defeito presente)              | GREEN (corrigido)                 | falsificação                                                                                                  |
| ---------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| INV-R6-a/b | 3 URLs remotas ⇒ **`1 passed`**     | ⇒ falha alta nomeando as 3 chaves | a mutação restaura a semântica antiga e o verde volta — o par discrimina o **estado do ambiente**, não o exit |
| INV-R6-c   | nada impresso no skip               | linha `db-precondition: …`        | remover a linha e ver a asserção de visibilidade cair                                                         |
| INV-R6-d   | `isLoopbackUrl(undefined) === true` | `=== false`                       | o caso unitário isola o booleano invertido dos dois lados                                                     |

## 7. Riscos

| risco                                                                   | disposição                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| O CI parar de rodar os 13 (URLs mal configuradas no job)                | é o comportamento pretendido: falha alta em vez de verde vazio. O job declara as 3 URLs em loopback (`ui-stack.yml`), então roda |
| `console.log` no topo de arquivo de teste poluir a saída                | é o ponto: visibilidade. A alternativa (`describe.skip` mudo) é o defeito                                                        |
| Desenvolvedor com `.env` parcial passar a ver erro onde antes via verde | pretendido; a mensagem diz exatamente o que configurar ou remover                                                                |
| Interação com `npm run db:test` (17 suítes)                             | nenhuma: o encadeamento define as três URLs; comportamento inalterado                                                            |

## 8. Rollback

`git checkout develop && git branch -D mission/r6-skip-visibility`. Sem migration, sem estado externo.
