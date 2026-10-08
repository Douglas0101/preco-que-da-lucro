# README — base vazia permanente `ci-fixture-base` e fixture de PR `parent-data` (2026-10-07)

**Estado:** mecanismo final implementado e verde no gate local em bancada limpa; **aceitação no CI
real PENDENTE** — o CI corrente (PR #60) precisa criar o filho `parent-data`, aplicar as
migrations, rodar as 18 suítes/RLS/matriz Playwright e confirmar o GET 404 de cleanup;
`DBT-96` permanece ABERTA.

## Sumário

O provedor recusa **toda cópia de schema** deste projeto: `init_source: "schema-only"` (ROOT) e
`init_source: "parent-schema"` (CHILD) respondem HTTP 412 (runs `37556250921`, `37634147956`,
`37700582228`; request de console `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`). O `parent-data` é
aceito. O dono autorizou uma base permanente e vazia — `ci-fixture-base`
(`br-wandering-sky-ayxm5e5s`), filha `parent-data` de `production`, criada uma vez e esvaziada uma
vez (BEFORE 15 tabelas / 162 linhas → AFTER 0 / 0, 0 grandes objetos, prova in-band
`neon.branch_id`) — e cada PR passa a criar um filho `parent-data` de zero linhas dessa base. O id
da base entra em **todos** os guardas e relatórios de permanentes: é impossível tratá-la como
recurso descartável e o cleanup nunca pode apagá-la. `init_source`, pai, payload, guardas e
relatórios foram atualizados em RED→GREEN; o gate completo foi medido em bancada limpa.

## Arquivos e sha256 (pós-edição)

| arquivo                                            | sha256 (prefixo; completo em `captures/source-hashes.txt`)  |
| -------------------------------------------------- | ----------------------------------------------------------- |
| scripts/ci/neon-resource.ts                        | `51a2030b1a2a44922515bf204d9798eb10771367ab13b7a5b57c5ca…`  |
| scripts/ci/provision-neon-fixture.ts               | `5f66cb5ab10386f59e532a26b45bb30eadedb0448338d9f4c8743cb4…` |
| scripts/ci/prepare-neon-fixture.ts                 | `cffd6cfdeea62cf778cf0805cfb47798d1c2c80688991aa277838657…` |
| .github/workflows/neon-pr-branch.yml               | `e10520ffb4a03a8dbaf7838c7c39ca54e04c41d01e582bf842a3973…`  |
| AGENTS.md                                          | `a0e83878e80d2b5179fc4782953dff6b85c108741bb6636dfa98225e…` |
| docs/adr/ADR-042-cobertura-minima-60-publicacao.md | `fa828a6a1a7fca5e5893a36f9bf5f51e187cd1b80ae0a9386147869…`  |
| src/test/neon-resource.test.ts                     | `1e30b306596d09dd0999304bd442e2137eb86d1331cbed165f47d7f0…` |
| src/test/neon-fixture.test.ts                      | `5d8155ecb764fa6597984d3f0bdf6eb8fc6f953a65f312f27d5a6d4…`  |
| src/test/neon-fixture-provision.test.ts            | `02f07363cf86036c3e04f10ad235ef2130900ea5daaf83b17e1b431b…` |

`captures/source-hashes.txt` traz os sha256 completos **antes** (blob do HEAD `f986fb05`, o
controle negativo) e **depois** (worktree) de cada arquivo.

## Evidência por fase

| fase                              | comando / artefato                                                                                                                                                                       | resultado medido                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falsificação `parent-schema` (CI) | run real `37700582228` (PR #60, head `f986fb05`)                                                                                                                                         | POST HTTP 412 / code=UNCLASSIFIED, **nenhuma branch criada**; artefato fase `creating`/NO-VERDICT sem `branchId` — `docs/evidence/neon-parent-schema-2026-10-07/captures/ci-observed.txt` |
| Base: criação                     | console `POST /api/v2/projects/damp-forest-57346541/branches` (`parent-data`)                                                                                                            | HTTP 201; branch `br-wandering-sky-ayxm5e5s`, endpoint `ep-delicate-sky-ayivte12` — `captures/baseline-create.json`                                                                       |
| Base: esvaziamento único          | console SQL editor na própria base (BEFORE → truncate → AFTER; `neon.branch_id` in-band)                                                                                                 | BEFORE 15 tabelas / 162 linhas → AFTER 0 / 0, 0 grandes objetos — `captures/baseline-emptiness-before.txt`, `captures/baseline-emptiness-after.txt`                                       |
| Base: inventário pós-operação     | console `GET /api/v2/projects/damp-forest-57346541/branches`                                                                                                                             | 3 branches: develop, production (default) e a base; nenhuma outra — `captures/baseline-inventory-before.json`, `captures/baseline-inventory-after.json`                                   |
| RED (controle negativo)           | `npx vitest run src/test/neon-resource.test.ts src/test/neon-fixture.test.ts src/test/neon-fixture-provision.test.ts` com as expectativas finais sobre os bytes de implementação do HEAD | **14 falhas / 95 passam** em 109, exit 1 — `captures/focused-tests-red.txt`                                                                                                               |
| GREEN                             | mesmo comando sobre a implementação nova (bytes finais)                                                                                                                                  | **109/109 passam**, exit 0 — `captures/focused-tests-green.txt`                                                                                                                           |
| Inventário de sítios (RS-16)      | grep por `FIXTURE_BASE_ID`, `[DEVELOP_ID, PRODUCTION_ID, …]`, `init_source`, `parent-schema`, ids da base                                                                                | todos os sítios vivos enumerados — `captures/site-inventory.txt`                                                                                                                          |
| Matriz M-02                       | `npm run m02:matrix:check`                                                                                                                                                               | determinística, sem regeneração — `captures/matrix-check.txt`                                                                                                                             |
| Gate local (bancada limpa)        | `npm run check` em worktree destacada com exatamente os bytes do commit                                                                                                                  | **exit 0**; contagens e bundle id na saída bruta — `captures/check-local.txt`                                                                                                             |
| Aceitação do provedor/CI corrente | run real do workflow após o push (`neon-pr-branch.yml`)                                                                                                                                  | **PENDENTE** — nenhum run destes bytes existe; nenhum selo de run é emitido (limite declarado)                                                                                            |

## Checklist anti-vacuoso (17 itens — demonstração honesta)

| #   | item                                   | como foi satisfeito (local × pendente)                                                                                                                                                                                                                                             |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | As expectativas finais rodaram contra os bytes de implementação do HEAD `f986fb05`: 14 falhas capturadas; blobs pré-edição fingerprintados em `source-hashes.txt`. **Local.**                                                                                                      |
| 2   | Fronteira nas duas direções            | Aceita `parent-data` + `parent_id: FIXTURE_BASE_ID`; reprova `parent_id` `null`/`PRODUCTION_ID`/`DEVELOP_ID`, `init_source` `schema-only`/`parent-schema`, base ausente/mal-nomeada/mal-defaultada/duplicada, e ids permanentes (develop, production, base) no cleanup. **Local.** |
| 3   | Identidade, não cardinalidade          | `fixtureIdentity` ancora id/nome/projeto/pai/init_source/endpoint ao run; `assertPermanentInventory` confere nome/default/projeto de cada permanente (base incluída) — nenhuma decisão por contagem. **Local**; a identidade real da fixture só o CI prova.                        |
| 4   | Proibido exit-code-only                | O GREEN assere payload do POST (`init_source`/`parent_id`), `initSource` do relatório, `permanentIds` com a base e ausência de saída em recusa — não só exit 0. **Local.**                                                                                                         |
| 5   | Proibido sleep fixo                    | O poll de readiness usa deadline; o mock avança o relógio determinístico. Não alterado por esta mudança. **Local.**                                                                                                                                                                |
| 6   | Sem valor degenerado                   | Comparações com strings distintas (`parent-data`, ids de branch); a recusa 412 preserva status/código explícitos; nenhuma asserção serializa para `undefined`/constante. **Local.**                                                                                                |
| 7   | Precondição de estado compartilhado    | O teste assere que o `branch_id` entra no `GITHUB_OUTPUT` antes da primeira leitura de readiness. **Local.**                                                                                                                                                                       |
| 8   | Sentinela real por cenário             | Fixtures nomeadas por run (`pr-60-123-2`, `br-fixture-example`, `ci-fixture-base`) no harness hermético; o dado remoto real (filho da base) é **pendente do CI**.                                                                                                                  |
| 9   | Fingerprint de revisão                 | SHA256 pré/pós por arquivo em `source-hashes.txt`; o RED rodou os bytes do HEAD e o GREEN os bytes finais. **Local.**                                                                                                                                                              |
| 10  | `checked === discovered`               | `MANIFEST.sha256` cobre todos os arquivos do pacote (conjunto não vazio), conferido por `sha256sum -c` na raiz do repositório (saída e exit 0 relatados no recibo da sessão; o manifesto não pode conter a própria prova sem se invalidar). **Local.**                             |
| 11  | S6 adversarial de contexto limpo       | **NÃO EXECUTADO** nesta sessão; sem número de CORR/N. Declarado — não conta como verificado.                                                                                                                                                                                       |
| 12  | Falha alta (fail-closed)               | Identidade/precondições lançam; `resetEmptyFixture` faz rollback; o provisionador retorna NO-VERDICT/exit 2; a guarda de id permanente reprova antes de qualquer DELETE. **Local.**                                                                                                |
| 13  | Isolamento de bancada assertado        | Os testes focados usam fake-DB e mock de rede; o gate rodou em worktree limpa sem banco remoto; a operação remota desta linhagem tocou **somente** a base autorizada (`br-wandering-sky-ayxm5e5s`). **Local** (por construção, não por medição de container).                      |
| 14  | Todo check impresso tem gate e captura | Cada linha da tabela de fases aponta comando e arquivo em `captures/`. **Local.**                                                                                                                                                                                                  |
| 15  | Run de CI atado ao commit selado       | **PENDENTE**: ainda não existe run destes bytes; o push em `develop` re-dispara o PR #60 e a evidência de aceitação virá dele. Sem selo de run inexistente.                                                                                                                        |
| 16  | Descoberta multi-sítio                 | Inventário por grep em `src/`, `scripts/`, `.github/`, `AGENTS.md` e ADR (`captures/site-inventory.txt`); todos os sítios de `FIXTURE_BASE_ID`/`init_source`/guardas de permanentes foram enumerados e os vivos atualizados. **Local.**                                            |
| 17  | Precondição de estado ambiente         | Os scripts verificam CI context (`GITHUB_BASE_REF`, `BRANCH_CREATED`, runner temp, projeto) e saem 2 quando ausente; esta execução rodou com deps instaladas e worktree contendo apenas as custódias alheias declaradas. **Local.**                                                |

**Auto-verificação pré-S6 / KPI:** não houve lane S6 nesta execução, então o KPI
`capturados pelo autor / total` é **N/A (denominador inexistente)** — os itens 11 e 15 ficam
declarados como não cobertos, nunca como verdes.

## Riscos e limites declarados

- **Aceitação do provedor não provada localmente.** O `parent-data` é o único mecanismo que o
  provedor aceitou para esta linhagem (a própria base foi criada com ele), mas a fixture de PR
  completa (migrations, 18 suítes, RLS, matriz, GET 404) só é provada por um run real; até lá,
  `DBT-96` permanece ABERTA.
- **Base é recurso remoto novo.** A prova de vazio é a operação de console de 2026-10-07
  (`captures/baseline-emptiness-*`); nenhum teste local substitui essa prova. O id está em todas
  as guardas de permanentes e o cleanup nunca o inclui.
- **`neon_auth`/`pgrst` no inventário.** O filho `parent-data` da base copia os cinco schemas
  (`app_private`, `drizzle`, `neon_auth`, `pgrst`, `public`); a suíte local cobre a
  aceitação/rejeição no fake-DB, mas o inventário real de tabelas (vazio, kinds suportados) só
  aparece no CI.
- **Fechamento de `DBT-96` inalterado:** exige CI atual com 18 suítes, RLS, matriz Playwright
  completa, GET 404 de cleanup e inventário independente somente `develop`/`production` (mais a
  base permanente autorizada).
- Nenhuma branch permanente existente, credencial, deployment, ruleset ou dado de produção foi
  tocado; a única mutação remota desta linhagem foi a criação e o esvaziamento único da base
  autorizada.

## S6 ADVERSARIAL

Lane independente de contexto limpo **não executada** nesta sessão (fora do escopo desta
execução). Claims deste pacote são auto-verificadas e estão marcadas item a item quanto a local ×
pendente; nenhuma claim remota é declarada aceita.

## MANIFEST

`MANIFEST.sha256` lista todos os arquivos do pacote exceto ele mesmo; gerado com caminhos
relativos à raiz do repositório e conferido com `sha256sum -c MANIFEST.sha256` na raiz (saída e
exit 0 relatados no recibo da sessão).
