# C28 — correções pendentes e liberação condicionada

## 1. Objetivo e contrato

Implementar o plano aprovado sobre develop, preservando WIP/C27. Resultados locais,
remotos, históricos e bloqueados são separados. Main e produção não recebem testes.
Teto13 commits, três reservados; não ampliar cota, timeout, exclusões ou trust boundary.

## 2. Write-set e fases

- WP0: PROGRESS, EXECUTION-STATE-PROGRAM, pacote C28 e custódia privada.
- WP1: vitest.config.ts, .nvmrc, runtime declarado nos workflows e evidência dos workers.
- WP2: triagem estática de 63 ocorrências Mimosa; artefato suplementar via Codex Security.
- WP3: scripts/sonar, testes correspondentes, sonar.yml e guardas contratuais de CI.
- WP4: scripts/ci/neon-resource.ts, neon-drill-ops.yml e testes de custódia/cleanup.
- WP5: adapter unitário autenticado, contratos/projeção/CLI, testes reais de cobertura.
- WP6–8: sidecar/collector, runbooks e evidência contextual. Valores de credenciais Via A;
  contratação/segurança/cutover requerem ação humana no ponto material.

## 3. Checklist anti-vacuoso pré-registrado

| #   | item                        | demonstração planejada                                                                                                       |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo           | Executar defeitos originais em fixtures e negativos de identidade, transporte, coverage e cleanup; registrar caso e sintoma. |
| 2   | Fronteira nas duas direções | Demonstrar limites 80%, freshness30min, TTL24h, payload e identidade em ambos os lados sem alterar orçamentos.               |
| 3   | Identidade                  | Registrar head/base/árvore/run/analysisId e IDs Neon; cardinalidade isolada nunca decide ausência ou crédito.                |
| 4   | Sintoma e exit              | Capturas nomeiam os cenários e resultados; PASS exige dados coerentes e zero sintomas, não apenas exit0.                     |
| 5   | Sincronização               | Aguardar status observável de job/CE/recurso; sleeps fixos não produzem aprovação.                                           |
| 6   | Valores não degenerados     | Usar fixtures com identificadores distintos, condições cobertas/descobertas e source hashes diferentes.                      |
| 7   | Estado compartilhado        | Cada ensaio confirma revisão, dependências e isolamento; banco usa novo container PG17, nunca o :5432 existente.             |
| 8   | Sentinela real              | Fixtures introduzem recursos e unidades identificáveis; negativos demonstram a alteração e a queda correspondente.           |
| 9   | Fingerprint                 | Capturar git tree/diff SHA256, fonte, toolchain e manifest; repetição só vale para os mesmos bytes.                          |
| 10  | Descoberta completa         | Enumerar todas as páginas/linhas/unidades; checked===discovered e vazio/incompleto falham fechado.                           |
| 11  | Contexto limpo S6           | Revisão independente em contexto limpo permanece NOT-STARTED até recibo; autor não declara S6 por auto-review.               |
| 12  | Falha alta                  | Separar exit1 de veredito e exit2 de precondição; timeout/auth/ambiguidade nunca viram sucesso.                              |
| 13  | Bancada                     | Custódia original e bancada isolada identificadas; fixtures de repo criadas pelos testes e limpeza restrita por ID.          |
| 14  | Capturas                    | Todo gate registra comando, caso, revisão, saída e resultado sanitizados sob captures ou artefato privado.                   |
| 15  | CI por revisão              | Somente run atual com checks aplicáveis aprova; checkout virtual e head são registrados separadamente.                       |
| 16  | Multi-sítio                 | Descobrir workflows, fontes Sonar e receptores; sítio novo não declarado bloqueia por padrão.                                |
| 17  | Ambiente                    | Verificar deps/git/profundidade/rede/credenciais nominais; falta é precondição, nunca ausência comprovada.                   |

## 4. Gates e stop conditions

Local check integral; DB PG17 isolado; matriz4 browsers PR atual; CE por revision;
mirror com origem unitária e freshness30min; operações e recuperação externas;
S6 0REJECTED. Mapping não demonstrado ou acesso ausente => NO-VERDICT/BLOCKED.
Sem bypass do aprovador; positivo local não autoriza merge/deploy/rotação.

## 5. Entregáveis

README, captures, MANIFEST.sha256 e handoff por fase. Custódia externa original
em /home/douglas-souza/.codex/artifacts/ciclo-28/custody; base dos selos declarada.
CORR e N nomeados separadamente; registry/placar sob autoridade do MAESTRO.

## 6. Fato-fonte, problema e adendo do write-set

Plano autorizado em2026-10-03; parser/journal staged da bancada66898f0, attachment
do operador e fila PROGRESS/DEBTS constituem intake. Attachment é relato histórico;
claims de todos os findings serem falsos positivos ou uso de no-verify não recebem
autoridade de execução. Sintomas medidos: workers variáveis, mapping main
inconclusivo, cleanup dependente de output funcional, selftest sem isolamento
e collector sem precondição de topologia demonstrada.

Adendo dos checks: WP4 também escreve neon-readiness.yml; WP6 exige namespace e
cleanup com negativo; WP8 usa bridge própria/loopback aleatório para Node no host
Docker Desktop. DEBTS/runbooks recebem evidência atual e dívidas declaradas. A
invariante operacional não muda: origem nominal, READ ONLY/TLS e qualificação
independente exigidas pelo ADR040. SPEC pré-registrada preservada na custódia privada.

DoD local: check integral verde, CLI real/identidade, cinco cenários fictícios no
cofre disponível, arquivo PG17 restaurado com inventário integral igual/negativos,
custódia original íntegra e manifest estrito. DoD externo: CI/CE/mapping/matriz/
runtime/rotações/recuperação e S6 independentes. Rollback por commit novo em develop;
WIP e receipts conservados. Não creditar coverage main sem LCOV/provider unitário
original e selos de revisão/fonte/instrumentação/período.
