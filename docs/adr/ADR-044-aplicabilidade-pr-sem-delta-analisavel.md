# ADR-044 — Aplicabilidade do gate em PR sem delta analisável

- Status: ACEITA para implementação local — em 2026-10-12 o dono autorizou corrigir DBT-104/105/106 e delegou a escolha entre as alternativas descritas. Escolhida a alternativa NOT_APPLICABLE sob prova de ausência de arquivos alterados no escopo. Isso não autoriza push, merge ou publicação.
- Data: 2026-10-12.
- Escopo: decisão de aplicabilidade **exclusivamente** da PR develop → main, mantendo o scanner e os controles não numéricos obrigatórios.
- Complementa ADR-042 §§1 e 4 apenas no caso abaixo; não muda seu mínimo60 nem sua decisão obrigatória do CE real de main. ADR-034/035 e o limite de escopo continuam intactos.
- Evidência: `docs/evidence/pr62-root-causes-2026-10-12/REPORT.md`; run 38197746621; implementação/testes em `docs/evidence/pr62-root-causes-2026-10-12/corrections/`.

## Contexto

O PR #62 mudou scripts, testes e documentação, mas nenhum arquivo sob `src` fora de `src/test/**`. O scanner usa exatamente esse recorte. A análise real do CE (`ca31e0f1-aca3-4431-9bbd-6a314159c532`, revisão de merge `8d5daf49767dd6f2761e0b0bb5c687e7e53e4f9d`) declarou OK com ratings/hotspots, sem condições de new_coverage e new_duplicated_lines_density. O validador ADR-042 recusou corretamente a evidência que sua política exigia. Isso não mediu cobertura zero nem demonstrou cobertura abaixo60.

Repetir o run não muda o delta. Expandir o scanner para scripts enfrentaria a cota declarada em ADR-035 e mudaria a definição do recorte. Acrescentar fonte artificial para satisfazer um denominador seria fraude. Manter o bloqueio até haver mudança de aplicação misturaria correção de infraestrutura com mudança funcional sem necessidade.

## Decisão

1. **NOT_APPLICABLE não é cobertura, não é NO-VERDICT e não é aprovação de main.** É uma decisão explícita de domínio: não há nenhum arquivo alterado no recorte analisado desta PR. Os campos numéricos ficam `actual: null`, nunca0/100. O limite60 permanece declarado, não medido.
2. A decisão exige o **mesmo CE real**, concluído, com projeto, task, analysisId, revisão e superfície verificados. Scanner submission, comentário verde do provedor, LCOV local ou lista de arquivos fornecida pelo candidato não são prova.
3. O runtime obtém a lista completa diretamente de objetos Git imutáveis, comparando base SHA → head SHA com `--name-status -z --no-renames --no-ext-diff --no-textconv`. Renomeações viram exclusão + adição: nenhum caminho de origem se perde. Todo caminho sob `src` fora de `src/test/`, inclusive CSS, exclusões, alterações de tipo e fronteiras como `src/testish.ts`, é conservadoramente elegível. Não há lista de extensões que possa excluir silenciosamente uma fonte.
4. O evento deve ser `pull_request`, do repositório `Douglas0101/preco-que-da-lucro`, sem fork, base main/head develop. Número, base/head/merge SHAs, GITHUB_SHA, checkout e identidade do CE precisam coincidir. O checkout é o merge de exatamente esses dois pais e tem a árvore do head; base é ancestral de head. Clone raso, objetos ausentes, grafts, skip-worktree/assume-unchanged, worktree sujo, fontes ignoradas não versionadas, lista vazia/ilegível ou mudança durante a prova recusam. A prova Git tem orçamento absoluto10s, sem rede ou sleeps.
5. O **scannerContext autenticado do próprio task** deve declarar uma única vez `sonar.sources=src` e `sonar.exclusions=src/test/**`. Fonte, exclusão ou duplicidade diferente/ausente é NO-VERDICT. O contexto bruto nunca é persistido. A prova registra escopo, identidade, todos os caminhos/statuses, conjunto elegível e fingerprint SHA256. Ela é construída no processo, congelada e vinculada ao CE; JSON reimportado/cópia mutável/prova de outra análise não autorizam dispensa.
6. Somente se o conjunto elegível estiver vazio **e ambas as condições numéricas estiverem omitidas**, cobertura e duplicação de novo código recebem explicitamente `NOT_APPLICABLE`. A mesma ausência de delta fundamenta os dois controles: não se inventa percentual nem se dispensa uma duplicação medida. Condição numérica presente contradiz este caso e permanece NO-VERDICT, inclusive se declarar0; ausência parcial também não recebe dispensa.
7. Os quatro controles restantes continuam conferidos, com os mesmos comparadores/limites/valores: ratings de segurança, confiabilidade e manutenibilidade A e hotspots100%. Condições duplicadas, ignoradas, inconsistentes, ausentes ou ilegíveis são NO-VERDICT. Qualquer controle ERROR continua veto, incluindo condições adicionais do provedor. Raw status, thresholds e condições são preservados; o relatório nomeia `releasePolicy.policy=ADR-044/pr-no-analyzed-delta` e `releasePolicy.status=NOT_APPLICABLE` apenas sem veto. O exit0 nesse caso significa aplicabilidade validada pela política, **não** cobertura aprovada.
8. Com **qualquer** arquivo elegível, ADR-042 continua estrita: new_coverage>=60%, duplicação<=3%, ratings/hotspots e demais controles. Ausência/ignorado/erro de precondição continuam NO-VERDICT; não há exceção para menos20 linhas. Main nunca recebe NOT_APPLICABLE, mesmo num merge só de infraestrutura: sua análise real da revisão continua obrigatória antes de publicar.
9. Baseline e mirror conservam a natureza observacional (ADR-042 §5). Modos `observe-main` e `post-ce-main` não aprovam main; selar IDs preservados de um NO-VERDICT conserva identidade, não reclassifica release. Matriz Playwright, banco/RLS, audit, budgets, gates locais, rulesets e a separação merge/publicação permanecem.

## Alternativas e justificativa

- **Escolhida:** domínio inaplicável provado por ausência de arquivos do recorte. Resolve o caso sem ampliar cota nem contaminar o PR com fonte fictícia; sua prova negativa é exigente e auditável.
- Ampliar o escopo: não escolhida. A cota/recorte é uma decisão própria de ADR-035, sem autorização para mudança indiscriminada; testes não viram produção.
- Bloquear até acrescentar código elegível: não escolhida. Preserva a recusa antiga, mas incentiva mistura funcional para reparar CI e não cria cobertura significativa. Continua sendo o resultado quando a prova desta decisão não puder ser estabelecida.

## Validação e limites

Os testes constroem seus próprios repositórios/eventos e executam o CLI real. Positivos: script/test/docs com quatro controles e artefato completo, fonte elegível nos dois lados60, main real sem dispensa. Negativos: fontes modificadas/adicionadas/excluídas/renomeadas, CSS e prefixos; evento/checkout/ref/escopo/estado divergente; shallow/grafts/flags/fontes ocultas; lista vazia; provas forjadas, CE diferente e mutação; métricas presentes, ignoradas, ratings/hotspots e veto adicional; API inacessível. O relatório NO-VERDICT continua preservando a observação validada já obtida.

A fixture não prova a disponibilidade do scannerContext no próximo run. Se não houver esse contexto no serviço real, o gate recusa e a dívida continua aberta; não há fallback para flags presumidas. O aceite remoto exige um novo CI na revisão publicada, após autorização. O pacote declara os limites CI/S6; testes locais não fecham dívidas remotas nem autorizam publicação.

## Rollback

Reverter em develop por commit ordinário, preservando artefatos e apontando errata. ADR-042 estrita volta a recusar PRs sem métricas. Nunca reescrever história, alterar fonte artificialmente, suprimir teste, afrouxar orçamento ou publicar main para contornar recusa.
