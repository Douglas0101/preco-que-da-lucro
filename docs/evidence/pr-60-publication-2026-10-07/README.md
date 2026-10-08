# PR #60 — publicação condicionada à evidência real

## Estado observado

Boot em 2026-10-07: PR #60 aberta, develop `1ff8a7749c05854bafe0c62cb6dd2e07b0be724c`, main `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`; os três checks antigos continuam falhos. Nenhum push ou merge foi realizado neste marco. O plano de execução e as condições de bloqueio estão em `SPEC.md`.

A reconciliação encontrou o ruleset `24333849` ainda com `update` e `main-coverage-mirror` obrigatório. A ADR-042 aceita autoriza remover exclusivamente essas exigências antigas; os checks obrigatórios reais e as demais proteções permanecem. Essa divergência não autoriza bypass.

Vercel MCP recusou autenticação HTTP401; CLI não instalada; WebBridge saudável. A API autenticada atual confirmou projeto `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`, repo correto, branch de produção main e `autoAssignCustomDomains=false` (`captures/vercel-publication-current.json`). A descoberta de projetos da equipe retornou exatamente um projeto, sem próxima página; GitHub não tem webhooks externos cadastrados. Nenhuma configuração Vercel foi alterada. Custódia ciclo-29/local-ci/.zcodeignore preservada em `captures/custody-before.json`; candidatos de código serão integrados com paths explícitos.

## Evidência por fase

O gate local anterior e os smokes isolados permanecem em `../ci-check-remediation-2026-10-07/`, sem transferência para o CI da revisão ainda não publicada. Este pacote registra separadamente os resultados observados da publicação, da PR e de main. Uma fase pendente nunca é apresentada como aprovada.

### Qualificação antes do push

Gate completo anterior ao achado C3 preservado em `captures/check.txt` (18910 linhas/845556 bytes; hashes em `source-hashes.txt`). Gate final **após** a correção de ownership: 135 arquivos passaram/1 pulado, 1985 testes passaram/18 pulados, lint/typecheck/build/bundle aprovados; `captures/check-final.txt` contém 18957 linhas/847502 bytes. Os 24 hashes de `captures/source-hashes-final.txt` permaneceram iguais após o gate. Os 18 pulados não são apresentados como prova de banco.

Inventário Neon completo somente leitura: production/develop preservadas, PG17; secrets presentes por nome, sem valores. `captures/neon-before.json` não atribui causa ao HTTP412 antigo. Threads da PR: duas, ambas resolvidas. R3 Sonar C5–C8 ACCEPTED/sem achados; R3 Neon C1/C2/C4 ACCEPTED e C3 REJECTED, com achado de ownership e precondição de index. Veredictos originais preservados em `captures/review-{sonar,neon}-r3.txt`; nenhum resultado remoto atual antecipado.

### Correção exigida pela revisão independente

Readiness agora usa `NeonResources.connections/resourcePlan`, identidade adotada e checkpoint/TTL, sem duplicar validação de API. O GET de branch/endpoints precede a criação do pg.Client e o export; `connection-contract.json` inclui a prova `connection-identity-verified`. RED: par de endpoint estrangeiro alcançava duas conexões e três exports sem qualquer GET de ownership. GREEN: par próprio confirma dois GET antes das conexões; endpoint estrangeiro/API503/query de destino recusam sem conexão nem export; PG16 recusa export. Capturas `readiness-ownership-before.txt` e `readiness-ownership-after.txt`, com driver real e transportes isolados, não banco remoto.

O primeiro harness GREEN omitiu Content-Type JSON na Response simulada; o cliente compartilhado corretamente recusou antes do SQL. `readiness-harness-first-attempt.txt` preserva esse erro do harness, corrigido sem relaxar o produto. O index foi atualizado por paths explícitos e seu conjunto/bytes assertados (`index-precondition.json`); fingerprints históricos dos pacotes anteriores não foram reescritos. Confirmação independente atual em `review-neon-r3-closure.txt`: C1–C4 ACCEPTED, ambos os achados fechados, nenhum finding aberto; C5–C8 permanecem ACCEPTED na lane Sonar. Nota de precisão: a formulação geral do revisor sobre falhas não é tomada como runtime; o caso PG16 conecta antes de verificar a versão e recusa o export, conforme o smoke.

### Auto-verificação e checklist anti-vacuoso

O KPI autoral de correção de fonte permanece 9/10 no pacote anterior; não é recalculado como selo desta publicação. CORR/N da nova revisão serão registrados por veredito, sem converter limite externo em prova.

| Item                        | Evidência ou limite desta fase                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Controle negativo        | RED/GREEN e corrupção/ausência nas capturas do pacote ci-check-remediation; não reexecutar falhas históricas para confirmá-las.                 |
| 2. Fronteira nos dois lados | Cleanup404/200/403/000/semID; CE abaixo/acima60; ausência histórica versus corrupção exercitados no pacote de código.                           |
| 3. Identidade               | SHA publicado/run/attempt/branch_id e relatórios vinculados; nunca somente quantidade de checks.                                                |
| 4. Não exit-only            | Ler etapas, conteúdo do CE, matriz, identidade/ausência e recibos; check success isolado não encerra release.                                   |
| 5. Sem sleep fixo           | `gh run watch` aguarda estado observado; API/artefatos confirmam conteúdo depois do término.                                                    |
| 6. Não degenerado           | IDs permanentes distintos da cópia, SHA256 de fontes/relatórios e revisão completa.                                                             |
| 7. Estado compartilhado     | npm local e secrets por nome presentes; inventário conhecido antes do CI; dependências instaladas pelo workflow antes do TSX.                   |
| 8. Sentinela                | Execução remota deve identificar cópia do próprio run, fixture vazia, matriz e GET404; ainda não obtida antes do push.                          |
| 9. Fingerprint              | 24 hashes comparados ao gate atual; HEAD e refs reconciliados antes da publicação.                                                              |
| 10. Conjuntos               | Manifesto confere todos os arquivos do pacote, não vazio, excluindo somente a si; catálogo de projetos completo, uma entrada/nextnull.          |
| 11. Contexto limpo          | Lanes R3 novas não consomem veredictos anteriores; revisão de fonte não é selo formal do worktree derivado.                                     |
| 12. Fail-closed             | Pending/cancelled/inconclusivo/erro bloqueia merge; nenhuma permissão por bypass.                                                               |
| 13. Isolamento              | Nenhum banco permanente é testado; cópia CI deve provar schema-only/TTL/identidade; custódia fora do commit fingerprintada.                     |
| 14. Gate e captura          | Gate bruto, preflight e fingerprints capturados; runs futuros só serão citados depois de existir evidência.                                     |
| 15. CI por revisão          | Ainda pendente antes do push; runs antigos não aprovam o novo candidato.                                                                        |
| 16. Multi-sítio             | Consumidores PR/readiness/drill e workflows descobertos no pacote de correção; todos os projetos Vercel da equipe enumerados.                   |
| 17. Ambiente                | Worktree derivado preservado impede selo formal; commit usa paths explícitos, hooks não ignorados, GitHub/rede autenticados por chamadas reais. |

## Identidade e integridade

Capturas não contêm valores de credenciais. O manifesto cobre os arquivos deste pacote por identidade e SHA256, excluindo somente a si. A revisão R3 é independente de contexto sobre fonte; não substitui selo formal nem os testes remotos. O histórico e os selos dos pacotes anteriores permanecem intactos.
