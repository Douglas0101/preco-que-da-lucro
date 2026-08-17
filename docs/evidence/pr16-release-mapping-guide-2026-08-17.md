# PR #16 — mapa de release e guia operacional

**Data da evidência:** 2026-08-17<br>
**PR:** [#16](https://github.com/Douglas0101/preco-que-da-lucro/pull/16)<br>
**Head auditado:** `fb78847e9d8404e768d9626b0faf24c3a419c65a`<br>
**Base auditada:** `develop` em `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`<br>
**Estado:** aberto, draft, `mergeable=true`, `mergeStateStatus=UNSTABLE`<br>
**Escopo desta evidência:** mapeamento de release, critérios de aceite e runbook; não autoriza merge, aplicação de migração ou cutover.

## 1. Resumo executivo

O PR #16 contém o lote P1 de performance financeira e a documentação de segurança/credenciais adicionada até o head final `fb78847`. O clone de validação utilizado foi `/tmp/preco-pr16-head-20260816-v2`, limpo e separado do checkout principal. O checkout principal `/home/douglas-souza/preco-que-d-main` continua sujo em `codex/local-dev-postgres`, no commit `71b0dc1`, e não foi usado como base nem alterado.

O código funcional P1 não mudou depois do último head com checks verdes (`83fb89d`). O delta posterior é restrito a:

- `.gitignore`, com cobertura para artefatos dotenv gerados e `.neon`;
- `docs/evidence/db-credentials-gitignore-review-2026-08-17.md`, com o mapeamento das camadas de credenciais.

Essa separação reduz a hipótese de regressão funcional, mas não substitui a validação do head final. A evidência corrente do head `fb78847` é:

| Check no head `fb78847`         | Resultado                                                              | Evidência                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| UI Stack / `verify`             | **FALHOU** em `npm run format:check`; passos seguintes foram pulados   | [run 31996484009](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/31996484009), job `95288940903` |
| Migration preview / `migration` | **FALHOU** ao criar branch efêmera; o pai `develop` não foi encontrado | [run 31996484016](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/31996484016), job `95288941335` |
| SonarCloud Code Analysis        | **PASSOU**                                                             | [check 95288987909](https://github.com/Douglas0101/preco-que-da-lucro/runs/95288987909)                          |

Conclusão de release: o PR permanece draft. O release ainda não é elegível para merge porque o head publicado não está verde e porque os gates Neon/migração/cutover permanecem fora de escopo ou bloqueados.

## 2. Identidade e integridade do release

| Item                         | Valor verificado                                           |
| ---------------------------- | ---------------------------------------------------------- |
| Repositório                  | `Douglas0101/preco-que-da-lucro`                           |
| PR                           | `#16`                                                      |
| Branch de trabalho publicada | `codex/p1-tanstack-query`                                  |
| Head publicado               | `fb78847e9d8404e768d9626b0faf24c3a419c65a`                 |
| Base                         | `develop` / `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`     |
| Arquivos alterados           | 19                                                         |
| Commits no PR                | 13                                                         |
| Estatística do diff          | 1.387 adições / 273 remoções                               |
| Mergeabilidade               | `MERGEABLE`, mas estado instável por checks falhos         |
| Estado administrativo        | `OPEN`, `DRAFT`                                            |
| Checkout principal           | preservado, sujo, não usado na validação                   |
| Clone de validação           | `/tmp/preco-pr16-head-20260816-v2`, limpo antes da análise |

O head atual é a fonte de verdade para a decisão de release. Runs verdes associados a `83fb89d` ou a qualquer SHA anterior são evidência histórica e não promovem `fb78847` a verde.

## 3. Mapa plano → implementação → evidência → aceite

| Frente                        | Implementação/marcação no PR                                                                                                               | Evidência disponível                                                                                     | Estado de aceite                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Centralização TanStack Query  | `src/lib/query-options.ts` concentra `queryKeys`, factories e política autenticada; as rotas usam as factories                             | `src/test/query-performance.test.ts`; `docs/evidence/pr16-p1-validation-2026-08-16.md`                   | **PARCIAL**: prova local anterior existe; a suíte completa do head final foi interrompida pelo `format:check`                       |
| Seleção de produto            | `src/lib/product-selection.ts` remove derivação duplicada; integrado em `diagnostico.tsx`, `ponto-equilibrio.tsx` e `simulacoes.tsx`       | `src/test/query-performance.test.ts`; `src/test/finance.boundaries.test.ts`                              | **PARCIAL**: helper e testes focados estão no patch; falta validar o head final por todos os gates                                  |
| Read model de produtos        | `src/lib/products.functions.ts` mantém a leitura batch existente                                                                           | `src/test/query-performance.test.ts` fixa 5 queries para 1 e 3 produtos                                  | **PARCIAL**: contagem determinística local registrada; latência/`EXPLAIN` por rota autenticada ainda pendentes                      |
| Dashboard set-based           | `src/server/repositories/dashboard.repository.ts` permanece coberto pelo teste de contagem fixa                                            | `src/test/query-performance.test.ts` fixa 6 queries para 1 e 3 produtos                                  | **PARCIAL**: prova de contagem local; não confundir com medição de produção                                                         |
| Chaves e invalidação seletiva | `queryKeys` centraliza as chaves; teste verifica cache e invalidação de produtos sem invalidar simulação                                   | `src/test/query-performance.test.ts`                                                                     | **PARCIAL**: teste está no patch; ainda depende da suíte completa no head final                                                     |
| Inputs controlados            | `simulacoes.tsx` mantém estado local para inputs; dados derivados vêm das queries e do helper                                              | `src/routes/_authenticated/simulacoes.tsx`; fronteiras financeiras                                       | **PARCIAL**: revisão estática e testes existentes; não é aceite de UX de produção                                                   |
| Segurança de artefatos locais | `.gitignore` adiciona `*.env`, negação `!*.env.example`, `.neon` e `.worktree-*/`                                                          | `docs/evidence/db-credentials-gitignore-review-2026-08-17.md`; verificação `git check-ignore` registrada | **PARCIAL**: branch publicada contém o hardening; checkout principal continua com WIP não rastreado e não deve receber `git add -A` |
| Camadas de conexão            | runtime pooled em `src/db/client.server.ts`; admin/direct em `drizzle.config.ts` e `scripts/db/migrate.ts`; fonte legada somente read-only | `docs/evidence/db-credentials-gitignore-review-2026-08-17.md`                                            | **DOCUMENTADO, não provado contra Neon**: nenhuma conexão, migração ou smoke externo ocorreu neste ciclo                            |
| Observabilidade e hardening   | matriz de lacunas e limites registrada em `docs/evidence/observability-hardening-2026-08-16.md`                                            | evidência documental                                                                                     | **PARCIAL**: ausência de exporter/Neon não foi convertida em autorização operacional                                                |
| CI/Sonar                      | Sonar passou; UI Stack e migration falharam no head atual                                                                                  | runs 31995648389, 31995648382 e Quality Gate 95286769093                                                 | **FALHOU** no conjunto obrigatório                                                                                                  |
| Neon readiness                | workflow de preview depende de project/branch/configuração protegida e exige major 17                                                      | `docs/evidence/neon-readiness-2026-08-17.md`                                                             | **BLOQUEADO**: falha antes da criação da branch; projeto documentado como PostgreSQL 18, incompatível com o gate major 17           |
| Migração e reconciliação      | ainda não há snapshot, restore, `different: 0`, órfãos ou rollback comprovados                                                             | `docs/evidence/migration-cutover-gates-2026-08-17.md`                                                    | **BLOQUEADO**                                                                                                                       |
| Cutover                       | depende de G0–G4, freeze, smoke, observabilidade e aprovação explícita                                                                     | `docs/evidence/migration-cutover-gates-2026-08-17.md`                                                    | **NÃO AUTORIZADO**                                                                                                                  |

## 4. Inventário do patch funcional e documental

### 4.1 Superfícies funcionais

- `src/lib/query-options.ts`: chaves e factories para produtos com métricas, despesas, dashboard, preços de compra, histórico, ponto de equilíbrio e simulação financeira. A política compartilhada define `staleTime` e retry para o conjunto autenticado.
- `src/lib/product-selection.ts`: helper puro para derivar produtos, seleção válida e detalhe selecionado a partir do read model.
- `src/routes/_authenticated/diagnostico.tsx`: usa `useQueries` com factories centralizadas e não recalcula seleção em estado duplicado.
- `src/routes/_authenticated/ponto-equilibrio.tsx`: usa factories para dados comuns e query parametrizada de ponto de equilíbrio.
- `src/routes/_authenticated/simulacoes.tsx`: inclui a query parametrizada da simulação nas factories, preserva estado local somente para inputs e usa o helper de seleção.
- `src/test/query-performance.test.ts`: cobre o helper, estabilidade das chaves, isolamento do cache/invalidação seletiva e contagem fixa dos read models.
- `src/test/finance.boundaries.test.ts`: mantém as fronteiras estáticas que impedem retorno a padrões incompatíveis com o contrato financeiro.

O lote não deve ser descrito como uma otimização genérica de todos os endpoints. A prova específica é: dashboard set-based com contagem fixa de 6 queries e read model de produtos batch com contagem fixa de 5 queries, comparando 1 e 3 produtos.

### 4.2 Superfícies documentais e de segurança

- `docs/evidence/g0-git-baseline-2026-08-16.md`: baseline e isolamento do checkout.
- `docs/evidence/local-post-pr15-tanstack-query-2026-08-15.md`: matriz local pós-PR #15.
- `docs/evidence/pr16-p1-validation-2026-08-16.md`: validação local do lote P1/helper.
- `docs/evidence/pr16-ci-sonar-2026-08-16.md`: evidência histórica de CI/Sonar; deve ser lida com o SHA anotado.
- `docs/evidence/observability-hardening-2026-08-16.md`: lacunas de observabilidade, métricas e hardening.
- `docs/evidence/neon-readiness-2026-08-16.md` e `docs/evidence/neon-readiness-2026-08-17.md`: readiness, bloqueios e separação entre fresh provision e migração legada.
- `docs/evidence/migration-cutover-gates-2026-08-16.md` e `docs/evidence/migration-cutover-gates-2026-08-17.md`: requisitos de backup/restore, reconciliação, rollback e cutover.
- `docs/evidence/db-credentials-gitignore-review-2026-08-17.md`: revisão do `.gitignore`, ausência de rastreamento dos artefatos gerados e camadas pooled/direct.

## 5. Leitura dos checks atuais

### UI Stack / `verify`

O job alcançou `npm ci --ignore-scripts`, `check:ui-stack` e `check:no-supabase-runtime`. O primeiro gate substantivo que falhou foi `npm run format:check`. Typecheck, lint, testes, banco, build, bundle, audit, instalação dos navegadores e E2E ficaram pulados por causa da falha anterior.

O arquivo que precisa ser identificado/corrigido no próximo ciclo é o documento de credenciais adicionado no head atual. A correção deve ser limitada à formatação documentada e validada localmente antes do commit. Não é válido usar o run anterior verde para cobrir os passos pulados no head `fb78847`.

### Migration preview

O job chegou à detecção nominal de configuração e tentou criar a branch Neon efêmera. A falha reportada foi:

```text
Failed to create branch. Error: Parent branch develop not found
```

Não há evidência de branch criada/removida, conexão direct/pooled, migration, `db:test`, `db:check`, RLS ou smoke nesse run.

Há duas questões de configuração que devem ser resolvidas separadamente e sem adivinhação:

1. descobrir o nome real do branch-pai no projeto Neon e configurar `NEON_PARENT_BRANCH` por canal protegido;
2. revisar a guarda do workflow `neon-readiness.yml`, que não deve ser disparado como se estivesse disponível no default branch quando existe apenas no branch do PR e contém uma condição específica para `develop`.

Além disso, o projeto Neon auditado anteriormente foi registrado como PostgreSQL 18, enquanto o gate do plano exige PostgreSQL major 17. Isso é um bloqueio de compatibilidade, não algo a ser resolvido relaxando `EXPECTED_POSTGRES_MAJOR`.

### SonarCloud

O Quality Gate do head `fb78847` passou. Essa aprovação não cobre o UI Stack, o preview Neon, a suíte completa, a migração, o backup/restore ou o cutover.

## 6. Guia de estabilização antes do próximo push

Esta sequência é o próximo lote autorizado para revisão. Ela não inclui merge, criação de projeto Neon, aplicação de migration ou alteração de produção.

### Fase A — documento e baseline

Executar no clone isolado, nunca no checkout sujo:

```bash
cd /tmp/preco-pr16-head-20260816-v2
git status --short
git rev-parse HEAD
npm run format:check
```

Se houver correção, aplicar somente a formatação do arquivo identificado pelo check, verificar o diff e registrar o SHA novo. Não usar `git add -A`; a lista de arquivos deve ser explícita.

### Fase B — gates locais do head final

Depois de o formato passar, executar a matriz equivalente ao `ui-stack` sem declarar sucesso parcial como sucesso total:

```bash
npm ci --ignore-scripts
npm run check:ui-stack
npm run check:no-supabase-runtime
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run db:up
npm run db:test
npm run db:check
npm run build
npm run check:bundle
npm audit --audit-level=high
npm run test:e2e
```

O resultado deve registrar SHA, Node/npm, major do PostgreSQL local, duração, saída resumida e artifacts. Um skip substantivo deixa o gate em `PARCIAL` ou `BLOQUEADO`.

### Fase C — CI externo

Após push do SHA final, acompanhar os próprios runs do SHA, sem rerun arbitrário para mascarar falha:

```bash
gh pr checks 16 --repo Douglas0101/preco-que-da-lucro
gh run list --repo Douglas0101/preco-que-da-lucro \
  --workflow ui-stack.yml --branch codex/p1-tanstack-query --limit 5
gh run list --repo Douglas0101/preco-que-da-lucro \
  --workflow neon-preview.yml --branch codex/p1-tanstack-query --limit 5
```

O aceite de G2 exige UI Stack, migration preview e Sonar verdes no mesmo head. A presença nominal de secrets/variables não prova validade, conectividade, branch-pai, database, role ou major do PostgreSQL.

### Fase D — Neon readiness em dry-run

Somente após a configuração ser corrigida e revisada, usar secrets/variables protegidos. Nenhum valor deve ser colado no chat, armazenado no repositório, impresso em logs ou incorporado ao artifact.

Pré-condições:

- credencial anteriormente exposta rotacionada;
- `NEON_API_KEY` configurada como secret protegido;
- `NEON_PROJECT_ID` configurado como variável não sensível;
- branch-pai real confirmado;
- destino compatível com o gate PostgreSQL major 17;
- URL direct reservada para administração/migration/dump/restore;
- URL pooled separada para runtime;
- fonte legada read-only somente se existir de fato;
- workflow publicado no ref permitido e com cleanup em caso de falha.

O primeiro ciclo deve permanecer em `dry-run`, sem `MIGRATION_APPLY`, e precisa provar branch descartável criada/removida, direct e pooled distintas, conexão, migrations, `db:test`, `db:check`, RLS/privilégios e smoke autenticado. Sem fonte legada, o relatório deve dizer `fresh provision path`; não pode alegar reconciliação de dados.

### Fase E — G4 e G5

Não começar G4 apenas porque o dry-run conecta. G4 requer snapshot/backup, restore isolado, reconciliação com `different: 0`, ausência de órfãos, invariantes financeiras e rollback testado. G5 somente após G0–G4, source freeze, smoke pós-migração, observabilidade mínima, janela operacional, aprovação explícita e plano de reversão.

## 7. Regras de credenciais e segurança

- Não repetir, armazenar ou testar qualquer URL de conexão que tenha sido colada em conversa.
- Rotacionar imediatamente a senha que foi exposta antes de qualquer novo acesso.
- Não colocar secrets em `.env`, `.neon`, prompts, artifacts, comentários de PR ou logs.
- Runtime usa credencial pooled de privilégio mínimo; admin/migration usa direct separada.
- `NEON_API_KEY` só deve ser entregue pelo secret store protegido; nunca como argumento ou texto de shell gravado.
- O `.gitignore` do PR cobre `*.env`, preserva `*.env.example`, cobre `.neon` e `.worktree-*/`.
- O hardening está no branch do PR. O checkout principal não foi alterado; seus artefatos locais continuam fora do escopo e não devem ser adicionados em massa.
- `git ls-files` e o histórico consultado não indicam que `neon-storage.env` ou `.neon` tenham sido commitados. Isso é uma constatação de higiene Git, não prova de que a credencial exposta continue válida ou segura.

## 8. Critérios de aceite do release

O PR só pode sair de draft quando todos os itens abaixo estiverem evidenciados no head final:

1. clone limpo e SHA da validação coincidente com o SHA publicado;
2. `format:check`, typecheck, lint, testes, banco local PG17, build, bundle, audit e os quatro projetos Playwright sem skips substantivos;
3. migration preview externo verde, incluindo cleanup da branch efêmera;
4. SonarCloud verde no mesmo head;
5. teste de contagem fixa do dashboard em 6 queries para 1/3 produtos;
6. teste de contagem fixa do read model batch em 5 queries para 1/3 produtos;
7. cache e invalidação seletiva provados, sem invalidar a simulação ao invalidar produtos;
8. latência e `EXPLAIN` por rota autenticada registrados quando o ambiente permitir;
9. G3 Neon dry-run com conexão direct/pooled, major compatível, migrations, `db:test`, `db:check`, RLS, privilégios e smoke;
10. G4 com backup/restore, reconciliação `different: 0`, órfãos zero e rollback comprovado;
11. nenhuma URL completa, senha, API key, token, PII ou segredo em evidência;
12. PR ainda sem merge até aprovação explícita posterior.

O item 9 não é satisfeito pelo login local do CLI, pela existência nominal de `NEON_API_KEY`, por um projeto Neon criado ou por um run histórico verde. O item 10 não é satisfeito por `db:check` isolado.

## 9. Decisão atual e próximos responsáveis

| Responsável             | Próxima ação                                                                                    | Saída exigida                               |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Wegener / código P1     | revisar apenas a formatação e, se necessário, confirmar a prova local do head final             | diff mínimo, testes e SHA                   |
| Bohr / Git-CI-Neon      | corrigir a configuração do parent branch e a disponibilidade/ref do workflow, sem expor secrets | run CI completo e relatório Neon sanitizado |
| Boyle / observabilidade | manter a matriz de spans, métricas financeiras, redaction, exporter indisponível e hardening    | critérios de aceite do ciclo seguinte       |
| Orquestrador            | atualizar status G0–G5 com evidências do mesmo SHA                                              | release note e decisão go/no-go             |

**Decisão:** `G0` está concluído com escopo de isolamento; `G1` está parcial; `G2` falhou no head atual; `G3` está bloqueado; `G4` está bloqueado; `G5` não está autorizado. O PR #16 permanece draft. Nenhum merge, rerun, aplicação Neon, migração de dados, alteração de produção ou cutover foi autorizado por este documento.
