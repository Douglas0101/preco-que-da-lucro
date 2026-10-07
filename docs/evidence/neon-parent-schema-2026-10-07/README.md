# README — fixture Neon de PR como child `parent-schema` (2026-10-07)

**Estado:** implementação local concluída e verde no gate; **aceitação do provedor e fechamento de
`DBT-96` pendentes do CI real após o push** (limite declarado — nenhuma prova remota é inventada).

## Sumário

O provisionador da fixture de PR do Neon pedia `init_source: "schema-only"` (branch ROOT), recusado
pelo provedor com HTTP 412 neste projeto porque ele carrega papéis SQL-created "legacy web access"
(`app_runtime`). A correção troca o pedido por `init_source: "parent-schema"` (CHILD de pai
explícito — `production` para base `main`, `develop` nos demais — schema copiado sem linhas) e
endurece a verificação de identidade no preparador: base ref exatamente `main`/`develop`, pai exato
por base e `init_source === "parent-schema"`. O schema gerenciado `neon_auth`, presente na cópia da
`develop`, passa a ser aceito na reconstrução somente após verificação de vazio, como qualquer
outro schema copiado.

## Arquivos e sha256 (pós-edição)

| arquivo                                            | sha256 (captures/post-edit-fingerprints.txt) |
| -------------------------------------------------- | -------------------------------------------- |
| scripts/ci/provision-neon-fixture.ts               | 6aad527d173c34f0acf028fd486ad01d156a29e0…    |
| scripts/ci/prepare-neon-fixture.ts                 | 61552ffed98eea2b4b14a069d7291609761947fd…    |
| src/test/neon-fixture.test.ts                      | 14c0a01b094905c01934a88376c0ed7d26a70f39…    |
| src/test/neon-fixture-provision.test.ts            | 429a554f97cd64ff80ccb24a63015d082eb3148b…    |
| .github/workflows/neon-pr-branch.yml               | 619430f9efde42f1e7dfa40c1de68615d128097d…    |
| AGENTS.md                                          | 1195c3a18c34fad830a53dcab4b62ba9de391089…    |
| docs/adr/ADR-042-cobertura-minima-60-publicacao.md | 4f51953d4b3a805e639440384fac73f9817821fe…    |

Os hashes completos e os pré-edição estão em `captures/pre-edit-fingerprints.txt` e
`captures/post-edit-fingerprints.txt`.

## Evidência por fase

| fase                                | comando / artefato                                                                                                             | resultado medido                                                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED (controle negativo)             | `npx vitest run src/test/neon-fixture.test.ts src/test/neon-fixture-provision.test.ts` sobre os bytes do HEAD                  | **5 falhas / 70 passam** — `captures/red-focused-tests.txt`                                                                                                                                                                                                         |
| GREEN                               | mesmo comando sobre a implementação nova                                                                                       | **75/75 passam**, exit 0 — `captures/green-focused-tests.txt`                                                                                                                                                                                                       |
| Assinatura da causa                 | derivação da mensagem de 93 caracteres + estado read-only dado                                                                 | `captures/root-cause-signature.txt`                                                                                                                                                                                                                                 |
| Inventário de sítios (RS-16)        | `grep -rn` por `init_source`/`schema-only` nas superfícies vivas                                                               | `captures/site-inventory.txt`                                                                                                                                                                                                                                       |
| Matriz M-02                         | `npm run m02:matrix:check`                                                                                                     | `captures/matrix-check.txt`                                                                                                                                                                                                                                         |
| Gate local (bancada limpa)          | `npm run check` em worktree destacada no commit pai com **exatamente** os arquivos do commit (sem a custódia untracked alheia) | **exit 0**: 135 suítes passed/1 skipped, **1992 testes passed**/18 skipped, lint/typecheck/build PASS, bundle `0822615921bd` inalterado — `captures/check-final.txt`                                                                                                |     |
| Gate local (worktree compartilhada) | `npm run check` na worktree principal                                                                                          | vermelho **somente** no `format:check`, por 45 arquivos untracked de custódia alheia (`docs/evidence/pr-60-publication-2026-10-07/**`), todos fora do write-set — `captures/check-main-worktree.txt`; classificado, não corrigido por não pertencer a esta custódia |
| Aceitação do provedor               | run real do workflow após o push                                                                                               | **PENDENTE — só o CI pode provar**                                                                                                                                                                                                                                  |

## Checklist anti-vacuoso (17 itens — demonstração honesta)

| #   | item                                   | como foi satisfeito (local × pendente)                                                                                                                                                                                                                                     |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | Novo teste contra bytes antigos: 5 falhas capturadas; os bytes do pai estão fingerprintados em `pre-edit-fingerprints.txt`. **Local.**                                                                                                                                     |
| 2   | Fronteira nas duas direções            | Base `main` aceita só `PRODUCTION_ID`; base `develop` aceita só `DEVELOP_ID`; pares trocados, `null`, `schema-only`, `parent-data` e `GITHUB_BASE_REF` vazio/inválido/ausente reprovam. **Local.**                                                                         |
| 3   | Identidade, não cardinalidade          | `fixtureIdentity` ancora id/nome/projeto/pai/init_source/endpoint ao run; nenhuma decisão por contagem. **Local**; a identidade real da fixture só o CI prova.                                                                                                             |
| 4   | Proibido exit-code-only                | O GREEN assere payload do POST, `initSource` do relatório e ausência de saída em recusa, não só exit 0. **Local.**                                                                                                                                                         |
| 5   | Proibido sleep fixo                    | O poll de readiness já usa deadline; o mock avança o relógio determinístico. Não alterado por esta mudança. **Local.**                                                                                                                                                     |
| 6   | Sem valor degenerado                   | Comparações com strings distintas (`parent-schema`, ids de base); recusa 412 preserva status/código explícitos. **Local.**                                                                                                                                                 |
| 7   | Precondição de estado compartilhado    | O teste assere que o `branch_id` entra no `GITHUB_OUTPUT` antes da primeira leitura de readiness. **Local.**                                                                                                                                                               |
| 8   | Sentinela real por cenário             | Fixtures nomeadas por run (`pr-60-123-2`, `br-fixture-example`) no harness hermético; dado remoto real é **pendente do CI**.                                                                                                                                               |
| 9   | Fingerprint de revisão                 | SHA256 pré/pós-edição capturados; o RED rodou os bytes do HEAD. **Local.**                                                                                                                                                                                                 |
| 10  | `checked === discovered`               | `MANIFEST.sha256` cobre todos os arquivos do pacote (conjunto não vazio), conferido por `sha256sum -c`. **Local.**                                                                                                                                                         |
| 11  | S6 adversarial de contexto limpo       | **NÃO EXECUTADO** nesta sessão; sem número de CORR/N. Declarado — não conta como verificado.                                                                                                                                                                               |
| 12  | Falha alta (fail-closed)               | Identidade/precondições lançam; `resetEmptyFixture` faz rollback; provisionador retorna NO-VERDICT/exit 2. **Local.**                                                                                                                                                      |
| 13  | Isolamento de bancada assertado        | Nenhum banco/Docker remoto ou local tocado nesta execução: o harness dos testes é fake-DB e mock de rede. **Local** (por construção, não por medição de container).                                                                                                        |
| 14  | Todo check impresso tem gate e captura | Cada linha da tabela de fases aponta o comando e o arquivo em `captures/`. **Local.**                                                                                                                                                                                      |
| 15  | Run de CI atado ao commit selado       | **PENDENTE**: ainda não existe run destes bytes; o push em `develop` re-dispara o PR #60 e a evidência de aceitação virá dele. Sem selo de run inexistente.                                                                                                                |
| 16  | Descoberta multi-sítio                 | Inventário por grep em `src/`, `scripts/`, `.github/`, `AGENTS.md` (`captures/site-inventory.txt`); todos os sítios de `init_source`/`schema-only` foram enumerados e os vivos atualizados. **Local.**                                                                     |
| 17  | Precondição de estado ambiente         | Os scripts verificam CI context (`GITHUB_BASE_REF`, `BRANCH_CREATED`, runner temp) e saem 2 quando ausente; esta execução rodou com deps instaladas e worktree contendo apenas as custódias alheias declaradas. **Local**; não há ferramenta de evidência nova versionada. |

**Auto-verificação pré-S6 / KPI:** não houve lane S6 nesta execução, então o KPI
`capturados pelo autor / total` é **N/A (denominador inexistente)** — os itens 11 e 15 ficam
declarados como não cobertos, nunca como verdes.

## Riscos e limites declarados

- **Aceitação do provedor não provada localmente.** `init_source: "parent-schema"` só é provado
  aceito por um run real; até lá, `DBT-96` permanece ABERTA.
- **`neon_auth` no inventário.** A cópia `parent-schema` da `develop` inclui o schema gerenciado;
  a suíte local cobre a aceitação/rejeição no fake-DB, mas o inventário real (tabelas vazias,
  kinds suportados) só aparece no CI.
- **Fechamento de `DBT-96` inalterado:** exige CI atual com 18 suítes, RLS, matriz Playwright
  completa e GET 404 de cleanup, mais inventário independente somente `develop`/`production`.
- **A worktree compartilhada está vermelha no `format:check` por custódia alheia**: os 45 arquivos que o
  prettier aponta são untracked de outra sessão (capturas brutas em
  `docs/evidence/pr-60-publication-2026-10-07/**`); reformatá-los violaria a custódia e o `ci-light` não os
  verá porque não entram no commit. O gate do commit foi medido em bancada limpa (`captures/check-final.txt`).
- Nenhuma branch, credencial, deployment, ruleset ou dado de produção foi tocado.

## S6 ADVERSARIAL

Lane independente de contexto limpo **não executada** nesta sessão (fora do escopo desta
execução). Claims deste pacote são auto-verificadas e estão marcadas item a item quanto a
local × pendente; nenhuma claim remota é declarada aceita.

## MANIFEST

`MANIFEST.sha256` lista todos os arquivos do pacote exceto ele mesmo; gerado com
caminhos relativos à raiz do repositório e conferido com `sha256sum -c MANIFEST.sha256` na raiz
(mesma convenção do pacote `ci-check-remediation-2026-10-07`).
