# G1-001R — Reprodutibilidade local e diagnóstico do PR #16

- **Data:** 2026-08-17
- **Task ID:** G1-001R
- **Head validado:** `3f0a0dd7693f696de12186a8c55eb0cb91df623a`
- **Branch:** `codex/p1-tanstack-query`
- **Clone:** `/tmp/preco-pr16-g1-20260817`
- **PR:** #16, ainda draft
- **Implementação:** Agent Código / Orquestrador
- **Revisão especializada:** G1-001F aprovada por Segurança/Documentação e Git/CI/Evidência
- **Estado:** `BLOCKED_FOR_EXTERNAL_GATES`

## Escopo e limites

Esta etapa reproduziu a qualidade local e diagnosticou os checks externos sem
alterar código funcional, workflow, Sonar, thresholds, Neon, produção ou Git
publicado. O clone permaneceu sem commit; a única alteração local é a
formatação do documento `docs/evidence/db-credentials-gitignore-review-2026-08-17.md`.

Nenhuma credencial, token, URL privada ou conteúdo de artefato sensível foi
registrado nesta evidência.

## Baseline atual

O head remoto foi confirmado com `git ls-remote` e coincide com o clone:

```text
3f0a0dd7693f696de12186a8c55eb0cb91df623a refs/heads/codex/p1-tanstack-query
```

A base histórica usada para comparar o PR é `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`.
O diff atual contém o helper puro `src/lib/product-selection.ts`, as
factories/chaves de `src/lib/query-options.ts`, a migração das três rotas
financeiras para queries/estado derivado e os testes de fronteira e
performance.

## Validação local

| Comando                                                                                    | Resultado observado | Observação                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`                                                                  | PASS                | 612 pacotes instalados                                                           |
| `npm test -- --run src/test/finance.boundaries.test.ts src/test/query-performance.test.ts` | PASS                | 2 arquivos, 25 testes                                                            |
| `npm run typecheck`                                                                        | PASS                | sem saída de erro                                                                |
| `npm run lint`                                                                             | PASS                | sem saída de erro                                                                |
| `npm run format:check` antes da correção documental                                        | FAIL                | somente `docs/evidence/db-credentials-gitignore-review-2026-08-17.md` divergente |
| Prettier no documento acima                                                                | PASS                | alteração mecânica no arquivo único                                              |
| `git diff --check` após a correção                                                         | PASS                | sem erro de whitespace                                                           |
| `npm run format:check` após a correção                                                     | PASS                | todos os arquivos usam o estilo configurado                                      |

Não existe `node_modules/.bin/jscpd` no clone e não foi feita medição local
de Sonar/jscpd. Portanto, não há número local atual de duplicação para
atribuir a um arquivo ou hunk. O teste de performance confirmou as invariantes
já implementadas: 6 queries fixas no read model do dashboard e 5 queries fixas
no read model batch de produtos, independentes de 1 ou 3 produtos; também
confirmou chaves, cache e invalidação seletiva da simulação.

## Checks externos observados

| Check               |            Run | Resultado | Diagnóstico sanitizado                                                                                                                        |
| ------------------- | -------------: | --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `migration`         |  `31996604399` | FAILURE   | criação da branch Neon abortou porque a branch-pai `develop` não foi encontrada no projeto configurado                                        |
| `verify` / UI stack |  `31996604412` | FAILURE   | `format:check` abortou no mesmo documento de evidência; o upload posterior não encontrou artefatos porque o job não avançou até essa produção |
| SonarCloud          | head `3f0a0dd` | SUCCESS   | não substitui a validação completa nem prova o gate Neon                                                                                      |

O erro de `migration` é de configuração/estado externo do projeto Neon, não
foi corrigido nesta etapa e não autoriza criar ou alterar branches Neon. O
`verify` ainda não foi rerun após a correção documental; portanto a correção
local está aprovada, mas não publicada nem validada externamente.

## Duplicação do PR #16

O histórico de evidência `docs/evidence/pr16-p1-validation-2026-08-16.md`
registra que, em um head anterior, o Sonar acusou 5,2% de duplicação contra o
limite de 3% e que a derivação de seleção de produto foi centralizada no
helper. Esse número é histórico e não deve ser reapresentado como medição do
head atual. No head atual, SonarCloud está `SUCCESS`, mas a ausência de uma
medição local reproduzível impede declarar o G1 completo antes da matriz
completa e do CI verde.

## Decisão e próximos gates

`G1-001R` permanece bloqueado para conclusão porque:

- `migration` externo falhou por branch-pai Neon inexistente;
- `verify` externo falhou e ainda não foi rerun após a correção formatada;
- não há medição local atual de duplicação/jscpd;
- build, bundle, audit, banco e E2E completos ainda não foram executados
  nesta reprodução.

Não há patch funcional aprovado ou necessário com base nesta evidência. A
próxima TaskSpec deve separar:

1. publicar a correção documental somente após autorização de commit/push e
   repetir o CI aplicável;
2. corrigir a configuração da branch-pai Neon somente com configuração
   autorizada e evidência segura;
3. executar a matriz local completa, incluindo PostgreSQL 17 descartável,
   build, bundle, audit e os quatro projetos Playwright;
4. só então decidir se existe algum patch funcional residual para o PR #16.

Não houve commit, push, merge, rerun, alteração de Neon ou produção nesta
etapa.
