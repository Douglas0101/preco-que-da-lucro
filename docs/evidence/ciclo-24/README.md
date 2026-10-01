# Ciclo 24 — Imposição, base e cobertura

D0: Opção A ratificada pelo prompt do MAESTRO em 2026-10-01.

Semântica de nulo declarada antes dos próximos gates: resposta ausente, inacessível ou campo omitido = `NO-VERDICT`/precondição, nunca zero ou aprovação. CE pendente e gate NONE = sem aprovação. Check ausente, cancelado ou skipped = sem prova aplicável. Linha zero de new code não autoriza inferir 100%. API 404 de proteção = ausência somente após identidade/autorização verificadas.

ERRATA E0: o registry vivo tem 50 dívidas (42 ABERTA, 7 FECHADA, 1 EM_TRATAMENTO), não 49. Corrige a contagem do estado inicial; precondições operacionais ainda em medição, nenhuma closure promovida.

B1: a bancada é a worktree isolada `ciclo-24-gates`, baseada em origin/develop. A política mantém drizzle-kit 0.31.0–0.31.99 e a versão publicada 0.31.10. O downgrade 0.18.1 na árvore original permanece em custódia (wip-custody.json); a guarda não será afrouxada. Nenhum pacote do WIP original será escrito.

Orçamento: 0/13 commits; 0 novos runs CI.

## B — base local e gates

B1 PASS: npm ci --ignore-scripts instalou drizzle-kit 0.31.10 a partir do lockfile publicado; npm run check exit 0, 116 suítes, 1397 passed/14 skipped, build e bundle PASS. A versão publicada satisfaz defineConfig e a política 0.31.x. Não houve update nem estreitamento da guarda. A árvore original continua em 0.18.1 por preservação de WIP; seus controles negativos retornaram exit 1 nas três guardas. A bancada green é a worktree isolada, não a árvore original.

B2.1: handoff commitado como 0d332500720ae0841aa001be2a1273f7e8afc829 (5 arquivos; fase-b1.manifest.sha256 conferido antes do commit). O selo B1 se aplica aos blobs dessa revisão; journal futuro é aditivo e não deve ser conferido contra um selo anterior sem selecionar a revisão git. B2.2: merge local de main em de82dc99941fe8fa4c5d3617716581f321b3c6be; origin/main é ancestral e o merge não alterou arquivos. O avanço de develop contém trabalho documental posterior, não uma linha de release divergente. Não houve push nem run CI.

### B3 — registry verdadeiro

DBT-62: auditWorkflowDiscovery executado no código real. Identidades: ci-light.yml, sonar.yml, ui-stack.yml, neon-drill-ops.yml, neon-pr-branch.yml, neon-preview.yml, neon-readiness.yml. Positivo: findings=[]. Novo new-undeclared.yml: finding nomeando workflow sem cobertura. Remover sonar.yml: finding nomeando workflow ausente. Descoberta vazia: 7 findings, um por identidade declarada. Esses controles satisfazem a closure de descoberta, independentemente da lacuna estrutural da DBT-66. Status FECHADA.

DBT-61: which-analysis tem detector puro positivo/negativo de desvio, e o workflow tem push só main e flags de PR. A closure escrita exige análise de develop acessível via API; o plano vigente documenta 403 e o scanner não roda em push develop. Detector não equivale à closure operacional. ERRATA E1: a premissa “closure existe no código” é insuficiente para fechar DBT-61. Permanece ABERTA, conforme a exceção explícita B3.1 do prompt. Não houve scanner local, leitura de token nem chamada autenticada de which-analysis.

§1 de PROGRESS foi reconciliada; a história append-only permaneceu íntegra. Placar ratificado 150 D, 29 P, 8 NS, 0 UNV / 187, sem promoção do agente.

B3 é o terceiro commit local do ciclo. Registry: 50 (41 ABERTA, 8 FECHADA, 1 EM_TRATAMENTO). D1 80%, D2 gatilho 45k LOC, D3 develop→main, D4 Via A, D5 toggle desconhecido não bloqueante e ADR-036 preservados.

ERRATA E2: o check explícito de Prettier no commit B3 retornou 1; o comando de lote não interrompeu o commit. O gate completo B1 precedeu esse delta documental. Corrigido em commit novo, sem amend: somente padding das linhas alteradas DBT-61/62 e tabela criada neste ciclo; pares e texto do journal não foram reescritos. Rechecagem de formatação obrigatória antes de push.

## Au — DBT-66

Commit da8d8b67d3b6f99ede54ce720aa203d366753c85; 34 testes focados PASS. Remover somente o bloco condicional em memória preserva flag e upload, mas auditSonarPipeline devolve “recusa lcov ausente ou vazio”. Fixtures shell observadas: ausente exit 1, vazio exit 1, válido exit 0. As seis guardas atuais têm remoção individual, incluindo espera do CE. DBT-66 FECHADA; selo Au por revisão.

## P — preparação independente de promoção

Grupos de version updates React/react-dom/types e TanStack Router/Start/plugin, target develop. Nenhum manifest ou lockfile da aplicação mudou.

P2 reutiliza o workflow_dispatch de neon-drill-ops, com operação exercise-provisioning e confirm=true. O código versionado de develop executará o pin 6.4.0 do PR #52; outputs branch_id/db_url são checados sem exibir valores, identidade é conferida por GET (nome exclusivo run/attempt, parent não nulo, não primary/default), expires-at +24h, cleanup always do ID validado e pós-delete GET 404. Ref aceita apenas main/develop. Não foi disparado: exercício com secrets e integração do PR #52 seguem para Ciclo 25. Rerun de Dependabot não substitui esse canal.

DBT-65 e DBT-67 permanecem ABERTAS; preparação de infraestrutura não é closure dos PRs vermelhos nem prova de provisionamento remoto.
