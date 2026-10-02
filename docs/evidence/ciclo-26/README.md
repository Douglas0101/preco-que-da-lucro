# Ciclo 26 — engenharia de infraestrutura e publicação condicionada

Estado do marco: **LOCAL-VERIFIED parcial, REMOTE-OBSERVED nas suspensões conhecidas;
NO-GO para release**. O plano está em implementação. Não há thaw, merge de #60,
back-merge, publicação verde, restore ou rotação real concluídos.

## Decisão e custódia

O MAESTRO autorizou implementação, publicação manual Vercel+Hostinger, suspensão
Git Vercel inclusive previews, seis rotações antes de release e PITR gerenciado7d
por contratação humana. Trabalhos de engenharia entram em develop; main recebe
somente develop→main ao final do circuito verde. Duas Git e duas Neon permanentes;
CI Neon é recurso temporário TTL24h, descarte por identidade e GET404 independente.

Bancada reutilizada: ciclo-24-gates. C25 snapshot13/13 preservado em
`/home/douglas-souza/.codex/artifacts/ciclo-26/checkpoint-c25/` antes dos sucessores.
WIP original permanece fora do write-set, salvo AGENTS explicitamente autorizado.
Teto C26 treze commits, incluindo release/backmerge/docfinal; C01–C05 locais e C06
este marco. Commits e byte manifests ficam em `.../ciclo-26/seals/`, sem substituir
o selo C25. A presença de hash não declara closure operacional ou S6 do ciclo.

## Mudanças e evidência

| Frente                  | Implementado/observado                                                                                             | Limite de closure                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Publicação              | Vercel conhecida Git removido; Hostinger auto-deployment off, journalL404/L406                                     | Segundo receptor Vercel sem acesso, DBT-70; nenhuma suspensão global afirmada                    |
| Neon                    | Terceira cópia vercel surgida apóscleanup removida por ordem humana; GET404+API/UI duas identidades                | Prevenção da recriação DBT-72 ainda aberta                                                       |
| Vulnerabilidade esbuild | C02 override sócore-utils→0.28.2,23entradas antigas removidas, npmci11.14.1/audit0                                 | Produção mantém main antigo; exploração via fluxo normal app não demonstrada                     |
| Toolchain/banco         | Drizzle0.31.10 mantido,defineConfig20migrations,17dbsuítes PG17isolado PASS; container removido                    | Não prova migração/role/env do runtime remoto                                                    |
| CI navegadores          | C03 prerequisite12min, kit SHA/lock/Playwright/ImageOS/ImageVersion/hashes; verify12min offlineAPT+matriz completa | Execução remota atual ainda pendente; tempo total inclui ambos jobs                              |
| Cobertura               | C04 motor porunidade e negativos; baseline linhas+conditions+gap+piso                                              | Adapter autenticado de unidades não demonstrado; check operacional NO-VERDICT, DBT-57/64 abertas |
| Credenciais             | C05 probes protegidos seisprovedores, corpo descartado,rawstatus+identidade+NO-VERDICT                             | Dois selftests reais wl-paste5s falharam; zero chaves reais rotacionadas, DBT-36/76              |
| Alertas/dependências    | AlertasGitHub PUT/GET204; securityupdates disabled; limitesversionPR0 no candidato                                 | Configdefaultmain sómuda na release; rulesetduasbranches impede criação agora                    |
| Runtime/PITR            | Hostingerready503/session500/authenticationfailed medidos; PITRFree6h, modalplano parahumano                       | DATABASE_URL ViaA,7dcontratados/observados e restoreisolado pendentes                            |

C02 final check:119suítes/1426PASS/14skipped; os17dbtests rodaram separadamente sem
skip contraPG17efêmero. C03 check:120suítes/1441PASS/14skipped. C04 foco49PASS;
C05 foco13PASS/typecheckPASS. O gate final do conjunto e o run@SHA serão anexados
após observação; estes números não são aprovação de produção.

Esbuild: prova antiga0.18.20 concediaACAO* a Origin arbitrária/null. Instalada0.28.2
não concedeACAO; Host estrangeiro403 sem sentinela, localhost200 legítimo; transforms
sync/async e mapas preservados. Revisão independente única:0bypass/regressões
confirmados no candidato. Isso não é S6 de todo o ciclo. Relatório gerenciado:
`/home/douglas-souza/.codex/state/plugins/codex-security/scans/preco-que-d-main/artifacts-a6d37a05884a2a5e9c7954a344b670404c3565289ec5eaf057a2f6ed1ec95bdd/artifacts/validation/esbuild-fix-verification.md`.

## Medição de DBT-68 (sete campos)

- hypothesis: cache binário não evita timeout APT; preparar sistema antes libera orçamento de verify.
- metric: duração prep/verify/instalação offline e matriz de quatro projetos, por run@SHA.
- before: PR60job110591560363 install21:27:39–21:37:19/cancel12min; cache hit existiu, E2E não iniciou.
- change: job prepare-browsers12min; kit com identidade, hashes, pacotes e instalação offline no verify12min.
- after: pending — nenhum tempo remoto novo inventado; local120suítes/1441PASS é outra superfície.
- result: LOCAL-VERIFIED da estrutura/negativos, REMOTE-UNOBSERVED no marco.
- decision: manter orçamento, testes e três browsers/quatroprojetos; fechar somente por execução atual completa.

## ERRATA e bloqueios

- E1: variáveis auth estavam na segunda página Hostinger; adição duplicada cancelada. Presença não prova valor aplicado.
- E2: referência GHSA-qx66-fv34-fjm8/CVE-2026-102989 não confirmada por fonte primária404; achado do provedor e piso de versão são fatos distintos.
- E3: inventário Neon virou3, criação_sourcevercel; retornar2 não prova prevenção.
- Ponte: agregado porarquivo pode dar falsoverde cobrindo linhas antigas. Motor impede; falta adapter autenticado. Último M1histórico2995/1894/gap502/piso1498/63,2ERROR precisa leitura runner fresca.
- ViaA: cofre abriu com5refs operacionais, clipboard detectado não respondia. Dois exits1brutos por wl-paste5s; somente5refs fictícios gerados removidos por identidade. Não considerar saída vazia ou rotação concluída.

## Gate de promoção

Todos os receptores controlados; seisrotações e consumidores/identidades/revogação
observados; PITR7d e restoreisolado; conexão/auth aplicáveis; fullPR verify-release
atual, scannerCE e espelho confiável. Somente então janela humana30min remove só
update, preservando PR/base/checks/bypassempty; mergecommit, re-freeze imediato.
Mainwait produz CE>=80, denominador>=piso e unidadespagas; erroespelho>2p.p. interrompe.
Publicar manualmente o SHA exato em ambos; backmerge main→develop imediato.
Qualquer pending/cancelled/missing/NO-VERDICT mantém NO-GO.

## Checklist anti-vacuoso do marco (não é aprovação S6)

1. Negativos executados: CORS, kitcorrompido, antigas/unmapped/unidadesperdidas e HTTP200 público.
2. Fronteira dupla: probes legítimos e recusas; runtime remoto ainda pendente.
3. Identidade: SHA/lock/image/branchids; ausência independente Neon medida.
4. Veredito além de exit: ACAO/sentinela/Host, grants/RLS doPG17, status/provideridentity.
5. Sem sleep como prova: leitura/estado/timeout; nenhuma espera fixa declara success.
6. Valores não degenerados: sources/identidades/métricas vazias recusadas.
7. Estado compartilhado: PG17 isolado; fixtures clipboard falharam e faseinterrompida.
8. Sentinelas: pública sintética esbuild e IDs reais de recursos, semsegredo.
9. Revisão fingerprint: seals porcommit; CI atual pendente.
10. Descoberta completa: registry, workflows, kitpayload; vazios/mismatch recusados.
11. Contexto limpo: revisão sófindingC02; S6 do ciclo não realizado.
12. Falha alta: mapping/metadata/kit/clipboard não viram verde.
13. Isolamento: PG17 loopbackporta38743 sem volumes, removido; produção nunca fixture.
14. Capturas/gates: journal aponta logs/selos e escopo; não cite run novo inexistente.
15. Run@SHA: pendente até publicar e observar checks aplicáveis, cancelled não prova.
16. Multi-sítio: dois receptores Vercel descobertos; o inacessível bloqueia suspensão global.
17. Estado ambiente: lock==HEAD exige commitlocal antescheck; clipboardnão medido bloqueou rotação.

KPI autor/total não promovido: marco parcial, sem S6 do ciclo, sem claims operacionais
completas para contabilizar como aprovado. Registry59:47A/11F/1T; placar150D29P8NS0UNV/187
inalterado pelo agente. Handoff vivo: ../agent-state/PROGRESS.md.
