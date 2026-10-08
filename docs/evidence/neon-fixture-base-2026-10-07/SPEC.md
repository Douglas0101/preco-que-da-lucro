# SPEC — base vazia permanente `ci-fixture-base` e fixture de PR `parent-data` (2026-10-07)

## Fato-fonte

- `docs/evidence/agent-state/DEBTS.md` — linha `DBT-96` (ABERTA): CI Neon de PR bloqueado por
  HTTP 412; cleanup exit 2 não prova ausência; fechamento exige o CI corrente com 18 suítes, RLS,
  matriz Playwright completa, GET 404 e inventário independente somente `develop`/`production`.
- `docs/evidence/agent-state/PROGRESS.md` — `L761` (diagnóstico de console recusado com HTTP 412,
  request `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`), `L767` (run `37700582228` recusou o
  `parent-schema`) e as linhas desta execução.
- Runs reais: `37556250921` (wrapper de action), `37634147956` (REST `schema-only`) e `37700582228`
  (REST `parent-schema`) — todos HTTP 412, nenhuma branch criada.
- `docs/evidence/neon-parent-schema-2026-10-07/` — hipótese `parent-schema` implementada e
  **falsificada** pelo CI real.

## Problema (medido)

O provedor recusa **toda cópia de schema** de `damp-forest-57346541`: `init_source: "schema-only"`
(ROOT) e `init_source: "parent-schema"` (CHILD) respondem HTTP 412 por causa de papéis SQL-created
de _legacy web access_ (`app_runtime`, criado pela migration 0001, além de `anonymous`/
`authenticated`). O `parent-data` funciona (foi o mecanismo da criação da própria base). Sem uma
fonte de zero linhas, o CI de PR não executa migrations, integração, RLS nem E2E.

## Contrato (falsificável)

1. Toda fixture de PR é criada por POST REST com `init_source: "parent-data"`, `parent_id` igual a
   `FIXTURE_BASE_ID` (`br-wandering-sky-ayxm5e5s`), `expires_at` de 24h no próprio POST e
   `endpoints: [{ type: "read_write" }]`; nenhum caminho faz retry ou fallback para cópia de dados.
2. `fixtureIdentity()` exige `branch.init_source === "parent-data"`, `branch.parent_id ===
FIXTURE_BASE_ID`, nome `pr-<n>-<run>-<attempt>`, projeto, `default`/`protected` falsos,
   freshness/expiry e endpoint `read_write` correspondente; qualquer divergência lança.
3. `FIXTURE_BASE_ID` é permanente em todos os guardas: inventário (`assertPermanentInventory` —
   nome `ci-fixture-base`, default false, projeto), recusa de identidade própria/descartável
   (`assertOwnedResource`, `discover`, cleanup) e relatórios `permanentIds`.
4. `resetEmptyFixture()` aceita os cinco schemas presentes e vazios na base (`app_private`,
   `drizzle`, `neon_auth`, `pgrst`, `public`), verifica cada tabela descoberta antes de qualquer
   SQL destrutivo e reconstrói apenas schemas copiados e vazios; schema desconhecido, linha
   herdada, grande objeto ou inventário incompleto abortam.
5. Todo o restante permanece: `branch_id` no `GITHUB_OUTPUT` antes de compute/URI,
   `::add-mask::` na chegada, redação de valores já conhecidos, porta 5432 + query somente-sslmode,
   exit 2 para precondição e cleanup `always()` com prova GET 404.

## Mudanças (lista fechada)

- `scripts/ci/neon-resource.ts` — `FIXTURE_BASE_ID`; inventário permanente com a base; guardas de
  identidade permanente e `permanentIds` dos relatórios com a base.
- `scripts/ci/provision-neon-fixture.ts` — pai sempre `FIXTURE_BASE_ID`; `init_source:
"parent-data"`; guarda do id criado inclui a base; relatório `initSource: "parent-data"`;
  `nextStep` do 412 (parent-data); comentários (base de zero linhas, esvaziamento único, proibição
  de canal de desenvolvimento).
- `scripts/ci/prepare-neon-fixture.ts` — identidade `parent-data` com pai `FIXTURE_BASE_ID`;
  guarda de id inclui a base; precondição `GITHUB_BASE_REF` removida da identidade (não há mais
  mapeamento base→pai); mensagem de erro atualizada.
- `.github/workflows/neon-pr-branch.yml` — somente comentários/nomes de passo/textos (nenhuma
  lógica); o schema diff segue com baseline `production`.
- `AGENTS.md` (três permanentes; mecanismo final) e `docs/adr/ADR-042-cobertura-minima-60-publicacao.md`
  (Emenda 2 + ERRATA da Emenda 1).
- `src/test/neon-resource.test.ts`, `src/test/neon-fixture.test.ts`,
  `src/test/neon-fixture-provision.test.ts` — RED→GREEN.
- `docs/evidence/neon-fixture-base-2026-10-07/**`, ERRATA no pacote
  `neon-parent-schema-2026-10-07`, append no journal e delta `DBT-96`.

**Não muda:** thresholds de cobertura, rulesets, `resourcePlan`/drill-ops (o drill segue filho de
`production`), outros workflows, dados de produção, nenhuma credencial e nenhuma branch permanente
existente.

## DoD

| critério                                                       | prova                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Testes focados GREEN com os novos contratos                    | `captures/focused-tests-green.txt` (109/109, exit 0)         |
| Controle negativo: os mesmos testes reprovam nos bytes do HEAD | `captures/focused-tests-red.txt` (14 falhas / 95, exit 1)    |
| Gate local completo verde em bancada limpa                     | `captures/check-local.txt` (exit 0; contagens no arquivo)    |
| Fingerprints de revisão antes/depois                           | `captures/source-hashes.txt`                                 |
| Manifesto `checked === discovered`                             | `MANIFEST.sha256` + `sha256sum -c` exit 0 (recibo da sessão) |
| Matriz M-02 sem regeneração                                    | `npm run m02:matrix:check` (determinística, saída no README) |
| Aceitação do provedor/CI corrente                              | PENDENTE — somente o CI real após push (limite declarado)    |

## Testes (RED/GREEN)

- RED: expectativas atualizadas primeiro, rodadas contra os bytes do HEAD `f986fb05` — **14 falhas
  / 95 passam em 109** (`captures/focused-tests-red.txt`).
- GREEN: mesmos testes contra a implementação nova — **109/109**, exit 0
  (`captures/focused-tests-green.txt`).
- Falsificação: `parent_id` `null`/`PRODUCTION_ID`/`DEVELOP_ID`, `init_source`
  `schema-only`/`parent-schema`, base ausente/mal-nomeada/mal-defaultada/duplicada no inventário,
  id permanente (develop, production, base) no cleanup e payload/relatório divergentes reprovam.

## Riscos

- A aceitação real do `parent-data` pelo CI (criação, migrations, 18 suítes, RLS, matriz Playwright
  e GET 404) não é demonstrável localmente; `DBT-96` só fecha com o CI corrente.
- A base é um recurso remoto novo; a prova de vazio é a operação de console de 2026-10-07. Nenhum
  teste local substitui essa prova.

## Rollback

Reverter por commit ordinário: `git revert <sha>` restaura o mecanismo `parent-schema` (recusado
pelo provedor) e os testes anteriores. A base `ci-fixture-base` não é mutada por este commit; um
descarte da base seria ato humano separado (o id está em todas as guardas de permanentes).

---

## Errata — 2026-10-08

O run `37722430962` (head `2875382b`) levou o provisionamento e a identidade do filho `parent-data`
até `connection-verified`; a recusa seguinte ocorreu na preparação da fixture, 0,52 s após a
construção do `Client` (inferência declarada: falha em `connect()`). Refinamentos:

- Contrato 4 (reconstrução): o drop set é exatamente o subconjunto migracional (`app_private`,
  `drizzle`, `public`); `neon_auth`/`pgrst` permanecem copiados, verificados-vazios e devolvidos em
  `keptSchemas` — nunca derrubados.
- Contrato 5 acrescenta: o provisionador só lê URIs após branch **e** endpoint `read_write`
  conectável (`active`/`idle`; o enum de endpoint é `init`/`active`/`idle` e não tem `ready`); o
  `prepare` projeta `phase`/`code` sanitizados no refusal e grava artefato de falha quando
  inexistente.
- DoD: as capturas vigentes desta onda são `captures/endpoint-readiness-red.txt` (2 falhas / 36 em
  38), `captures/endpoint-readiness-green.txt` (38/38), `captures/prepare-refusal-red.txt` (16
  falhas / 37 em 53), `captures/prepare-refusal-green.txt` (53/53) e `captures/check-local.txt`
  renovada (exit 0). O restante do DoD (manifesto, matriz, aceitação do CI) permanece como
  declarado.
