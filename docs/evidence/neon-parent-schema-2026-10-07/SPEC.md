# SPEC — fixture Neon de PR como child `parent-schema` (2026-10-07)

## Fato-fonte

- `docs/evidence/agent-state/DEBTS.md` — linha `DBT-96` (ABERTA): o CI Neon de PR segue bloqueado
  por HTTP 412 na criação; cleanup exit 2 não prova ausência; a origem histórica estava preservada.
- `docs/evidence/agent-state/PROGRESS.md` — `L753` (intenção de remediação), `L759` (run
  `37634147956` recusado com HTTP 412/UNCLASSIFIED, sem branch_id) e `L761` (diagnóstico de console
  com HTTP 412 e request id `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`).
- Runs de CI reais: `37556250921` (wrapper de action) e `37634147956` (REST), ambos HTTP 412.

## Problema (medido)

`scripts/ci/provision-neon-fixture.ts` pedia `init_source: "schema-only"`, que cria uma branch
**ROOT** sem linhagem. O provedor recusa essa criação no projeto `damp-forest-57346541`: papéis
SQL-created "legacy web access" (como `app_runtime`) não são suportados em root schema-only. A
assinatura exata da recusa (93 caracteres; 82 + `len("app_runtime")` = 93, único papel que produz
93 entre `app_runtime`/`anonymous`/`authenticated`) está derivada em
`captures/root-cause-signature.txt`. A API do Neon documenta `init_source: "parent-schema"` — CHILD
de um pai explícito com o schema copiado sem linhas.

## Contrato (falsificável)

1. O POST de criação usa `init_source: "parent-schema"` com `parent_id` explícito
   (`production` para base `main`, `develop` nos demais), `expires_at` de 24h e
   `endpoints: [{ type: "read_write" }]`; nenhum caminho faz retry ou fallback para cópia de dados.
2. `fixtureIdentity()` exige `env.GITHUB_BASE_REF` exatamente `main` ou `develop` (fail-closed), e
   `branch.parent_id` igual ao pai do base (`PRODUCTION_ID` para main, `DEVELOP_ID` para develop) e
   `branch.init_source === "parent-schema"`; qualquer divergência lança.
3. `resetEmptyFixture()` aceita os schemas gerenciados `neon_auth` (Neon Auth) e `pgrst`
   (PostgREST, vazio nas duas permanentes — `captures/schema-inventory-permanent-branches.txt`),
   verifica que toda tabela descoberta está vazia e reconstrói apenas schemas copiados e vazios;
   schema desconhecido continua abortando antes de qualquer SQL destrutivo.
4. Todo o restante permanece byte-comportamental: TTL de 24h no POST, `branch_id` no
   `GITHUB_OUTPUT` antes de compute/URI, `::add-mask::` na chegada, redação de valores conhecidos,
   porta 5432 + query somente-sslmode, exit 2 para precondição.

## Mudanças (lista fechada)

- `scripts/ci/provision-neon-fixture.ts` — payload `init_source`, comentários, `initSource` do
  relatório, `nextStep` do HTTP 412.
- `scripts/ci/prepare-neon-fixture.ts` — precondição `GITHUB_BASE_REF`, identidade pai/filho,
  `allowedSchemas` com `neon_auth` e `pgrst` (correção pré-push), docstring e mensagem de erro.
- `.github/workflows/neon-pr-branch.yml` — somente nomes/comentários/rotulos (nenhuma lógica).
- `AGENTS.md`, `docs/adr/ADR-042-cobertura-minima-60-publicacao.md` — contrato e emenda.
- `src/test/neon-fixture.test.ts`, `src/test/neon-fixture-provision.test.ts` — testes RED→GREEN.
- `docs/evidence/neon-parent-schema-2026-10-07/**`, append ao journal e delta `DBT-96`.

**Não muda:** thresholds de cobertura, rulesets, outros workflows, schemas de produção, nenhuma
credencial, nenhuma branch permanente.

## DoD

| critério                                                          | prova                                                                                     |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Testes focados GREEN com os novos contratos                       | `captures/green-focused-tests.txt` (75/75)                                                |
| Controle negativo: os mesmos testes reprovam nos bytes anteriores | `captures/red-focused-tests.txt` (5 falhas / 70)                                          |
| Gate local completo verde                                         | `captures/check-final.txt` (exit 0)                                                       |
| Matriz M-02 inalterada ou regenerada                              | `captures/matrix-check.txt`                                                               |
| Fingerprints antes/depois                                         | `captures/pre-edit-fingerprints.txt`, `post-edit-fingerprints.txt`                        |
| `pgrst` vazio aceito e desconhecido ainda recusado                | `captures/pgrst-red-focused-tests.txt` (1 falha), `pgrst-green-focused-tests.txt` (76/76) |
| Inventário read-only das permanentes                              | `captures/schema-inventory-permanent-branches.txt`                                        |
| Aceitação do provedor                                             | PENDENTE — somente o CI real após push (limite declarado)                                 |

## Testes (RED/GREEN)

- RED: testes atualizados primeiro (`GITHUB_BASE_REF: "main"`, `init_source: "parent-schema"`,
  `parent_id: PRODUCTION_ID`, rejeições novas, `neon_auth` aceito), rodados contra a implementação
  inalterada — 5 falhas.
- GREEN: mesmos testes contra a implementação nova — 75/75.
- Correção pré-push do `pgrst`: RED 1 falha/75 contra a allowlist sem `pgrst`; GREEN 76/76 com a
  allowlist nova (`captures/pgrst-*`).
- Falsificação: aceitação continua exigindo pai exato por base (`parent_id: null`,
  `DEVELOP_ID` com base main, `schema-only`, `parent-data` reprovam) e `GITHUB_BASE_REF`
  ausente/inválido reprova; `resetEmptyFixture` continua recusando schema desconhecido.

## Riscos

- A aceitação de `parent-schema` pelo provedor não é demonstrável localmente; só o CI real após o
  push pode prová-la (limite declarado).
- A cópia `parent-schema` da `develop` inclui `neon_auth`; a suíte verifica cada tabela vazia
  antes de reconstruir, mas o comportamento real do provedor para esse schema só aparece no CI.
- Nenhum teste local prova as 18 suítes/RLS/Playwright/GET 404 remotos — isso é condição de
  fechamento de `DBT-96`, preservada no registry.

## Rollback

Reverter por commit ordinário: `git revert <sha>` restaura `init_source: "schema-only"` e os testes
anteriores. Nenhum dado, branch ou deployment é alterado por este commit; a branch de PR é
descartável e o cleanup `always()` permanece inalterado.
