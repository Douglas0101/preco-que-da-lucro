# Ciclo 26 — engenharia de infraestrutura e publicação condicionada

Estado do marco: **LOCAL-VERIFIED e REMOTE-OBSERVED para as correções indicadas;
NO-GO para release**. A implantação autorizada continua parcial. Nenhum thaw,
merge de #60, back-merge, deploy manual, restore ou rotação real foi concluído.

## Decisão, revisão e custódia

O MAESTRO autorizou publicação manual em Vercel e Hostinger, suspensão do Git
Vercel inclusive previews, seis rotações antes de release e PITR gerenciado de
sete dias mediante contratação humana. Develop é o único canal de engenharia;
main recebe o PR final develop→main após o circuito completo verde. Existem
somente duas branches Git publicadas e duas Neon permanentes. Uma cópia Neon de
CI é recurso temporário com identidade do run, TTL24h e descarte comprovado.

Bancada reutilizada: ciclo-24-gates. C25 terminou13/13; sua custódia anterior de
13 arquivos foi preservada em `/home/douglas-souza/.codex/artifacts/ciclo-26/checkpoint-c25/`.
WIP original48ffb6b, 932paths, permanece fora do write-set salvo AGENTS autorizado.
C01–C09 estão publicados em develop b8d9734; C10 local85b6980 corrigiu a semântica
do probe. C11 é este marco documental, levando o ciclo a11/13 antes do próximo
pushlote. Há duas vagas restantes; se o circuito final não couber, escalar e
manter main congelada. Manifests por commit em `.../ciclo-26/seals/` são selos de
bytes; não substituem C25, uma closure operacional nem S6 de todo o ciclo.

## Mudanças e evidência observada

| Frente                 | Implementado ou observado                                                                                                                                          | Limite restante                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publicação             | Projeto Vercel conhecido desconectado do Git; Hostinger auto-deployment desligado, L404/L406                                                                       | Outro receptor Vercel publicou develop depois, DBT-70. Instalação GitHub97893523 aguarda reautenticação humana e inspeção de escopo. Não há suspensão global comprovada |
| Neon temporário        | Run37018305032 SUCCESS em criação, integração/RLS e cleanup; br-frosty-block-ayght1pp GET404 independente; inventário só develop/production                        | DBT-72 prevenção de cópias persistentes por integração Vercel ainda aberta                                                                                              |
| Neon permanente        | Production neondb tem app_runtime LOGIN sem superuser/bypassRLS e sete tabelas com RLS habilitado                                                                  | Develop neondb consultado não tem app_runtime nem tabelas public/drizzle da aplicação: DBT-77. Metadados não provam grants efetivos nem comportamento por tenant        |
| Esbuild                | C02 override restrito core-utils→0.28.2; Drizzle0.31.10 preservado; CORS negativo/legítimo e17suítesPG17 locais; CI descendente verde, DBT-74 fechada para tooling | Produção permanece main antigo. Exploração pelo fluxo normal da aplicação não demonstrada                                                                               |
| CI navegadores         | Kit por SHA/lock/Playwright/imagem/hashes, aquisiçãoAPT no cache após verificação; PR atual com quatro projetos/76E2E PASS dentro12min, DBT-68 fechada             | Não fecha login intermitente DBT-63 nem aprova cobertura/main                                                                                                           |
| Cobertura              | Motor por unidade com máscaras/identidades e negativos; baseline autoritativa total2995/cobertas1894                                                               | Gap502/piso1498/63,2387ERROR. Sources/show dá identidade de linha, sem crédito por agregado; leitura autenticada do diagnóstico C10 ainda pendente. Espelho NO-VERDICT  |
| Imposição              | Ruleset24333849 exige verify-release, scan + cobertura e main-coverage-mirror; readback preservou freeze/update, PR, base atualizada e bypass vazio                | Falta ponte validada no ponto de decisão e publicação manual dos dois receptores; DBT-64 aberta                                                                         |
| Credenciais            | Probes protegidos dos seis provedores com status bruto/identidade e corpo descartado; runbook ViaA alinhado                                                        | Dois selftests de clipboard falharam; nenhuma chave real rotacionada ou revogada, DBT-36/76                                                                             |
| Dependências e alertas | Alertas GitHub ativados; configuração candidata limita a zero novos PRs npm/actions preservando famílias acopladas                                                 | Configuração defaultmain muda somente na release; regras de duas branches já contêm criação agora                                                                       |
| Runtime e recuperação  | Vercel live/ready/session200-null; Hostinger live200/ready503/session500; PITRFree6h e modal de plano para humano                                                  | Conexão Hostinger/app_runtime, login real, PITR7d e restore isolado pendentes; DBT-73/75                                                                                |

UI PR37018305026@b8d9734e6798f2e82f0d7e7e5955981ef4785385: preparo143s e
verify-release326s, 469s de runner/472s de parede. Cachehit foi observado. Logs
confirmam chromium, firefox, webkit e mobile e76E2E PASS. Identidade do kit e
pacotes instalados PASS; artefato PR deriva do checkout merge ed5aa103, preservando
a identidade entre preparo e consumidor. Sonar37018305542: scanner/CE de PR
SUCCESS sem condição de coverage; main-coverage-mirror FAILURE/NO-VERDICT esperado.
O CE de PR verde não satisfaz cobertura de main.

Checks locais: C02 integral119suítes1426PASS/14skipped, com17dbsuítes PG17 isolado
executadas separadamente sem skips; C09 integral122suítes1471PASS/14skipped; C10
integral122suítes1472PASS/14skipped. O container PG17 de prova foi removido. Os
skips da suíte unitária não são remoção da cadeia de banco executada à parte.
C11 documental exige formato/guardas e check integral antes do push combinado.

Esbuild: resolução antiga0.18.20 concedia ACAO* para Origin arbitrária/null; a
nova0.28.2 não concede ACAO, recusa Host estrangeiro403 sem sentinela e preserva
localhost200. Transformações sync/async, mapas e rejeição de sintaxe foram
exercidos pelo consumidor real. Revisão independente limitada ao finding:
zero bypasses/regressões confirmados. Isso não é S6 do ciclo inteiro. Relatório
suplementar gerenciado atualizado pelo plugin Codex Security:
`/home/douglas-souza/.codex/state/plugins/codex-security/scans/preco-que-d-main/artifacts-a6d37a05884a2a5e9c7954a344b670404c3565289ec5eaf057a2f6ed1ec95bdd/artifacts/validation/esbuild-fix-verification.md`,
sha256 e5818d519301305a20b25e3c9d0b6370c2d81a7be2883739b0ab997712234e85.

## Medição de DBT-68 (sete campos)

- hypothesis: cache de binários não cobre instalação APT; preparar pacotes e adquirir os arquivos verificados no cache APT elimina a espera de rede no verify.
- metric: duração de preparo, verify e instalação offline, identidade do kit e resultados dos quatro projetos, por run@SHA.
- before: PR60job110591560363 cancelou no limite12min; install21:27:39–21:37:19, 580s, com cachehit e E2E não iniciado. O primeiro kit C07 validou identidade, mas APT saiu100.
- change: preparo com limite12min; kit por imagem/revisão/lock e hashes; copiar debs verificados ao cacheAPT antes --no-download/--no-remove; verify mantém12min e a matriz integral.
- after: C09PR37018305026@b8d9734: preparo143sSUCCESS, verify326sSUCCESS, instalação offline23s e E2E119s; cachehit, kitidentity/installedPASS, quatro projetos e76E2E PASS. Total469s de runner/472s de parede, inferior720s.
- result: negativo remotoAPT100 e reprodução Ubuntu24.04 100→0 explicam aquisição fora do cache; positivo remoto comprova solução com orçamento e matriz preservados. DBT-68 FECHADA neste marco.
- decision: manter todos os testes, três browsers/quatro projetos e limites; qualquer preparo/identidade/instalação inconclusivos continuam bloqueando o gate de release.

## ERRATA e bloqueios

- E1: variáveis auth estavam na página2 Hostinger; adição duplicada cancelada sem salvar. Presença não prova valor aplicado.
- E2: referência GHSA-qx66-fv34-fjm8/CVE-2026-102989 não confirmada em fonte primária404; removida do motivo da política, sem alterar pisos. Achado do provedor e referência bibliográfica são evidências distintas.
- E3: integração Vercel recriou terceira cópia persistente Neon após cleanup. Remoção e inventário2 não provam prevenção.
- E4: L431 transcreveu1462 testes; log mede1460, errataL432 preserva o journal anterior.
- E5: transportar debs não basta a --no-download. APT precisa adquirir os arquivos no cache; controle100→0 e CI C09 verificaram a correção.
- E6: sources/show retornou tuplas válidas de identidade de linha que o parser inicial recusou. C10 normaliza e descarta source; ausência de campos de new-code/coverage não vira zero nem prova impossibilidade de todas as APIs. Nova leitura autenticada ainda pendente.
- E7: CI Neon clona production; seu verde não demonstra o banco permanente develop preparado. Catálogo developneondb consultado não tem runtime/schema da aplicação. Não chamar toda branch vazia por uma consulta. Fase de conexão develop suspensa, DBT-77 aberta.

Baseline autenticada2026-10-02T13:54:18Z, repetida no run C09:
main d4b9395/análise1dc2baf9-b289-42f4-b2ca-dd7b662b3679; 1904linhas−690descobertas
+1091condições−411descobertas =2995total/1894cobertas/63,2387%ERROR,
502unidades de déficit/piso1498. Nenhuma unidade paga contra M1 foi validada.
Agregado por arquivo pode atribuir crédito a linhas antigas; o motor recusa isso.
O adapter por identidade ainda falta; DBT-57/64 ficam abertas e não há controle
positivo de merge/erro do espelho declarado.

Runtime2026-10-02T14:06:33Z: Vercel live200/ready200/session200-null; Hostinger
live200/ready503/session500. O log anterior Hostinger nomeia falha de autenticação
neondb_owner; relação causal com a exclusão de previews não demonstrada. O runtime
web deve usar DATABASE_URL pooled/app_runtime e não DATABASE_ADMIN_URL. Humano
configura fora do contexto e confirma aplicação; ready/session/login/isolamento
precisam de observação própria. Sessão anônima null não prova login real.

ViaA: cofre abriu com cinco refs operacionais, mas wl-paste expirou em5s nos dois
backends. Somente cinco refs fictícios gerados foram removidos por identidade;
refs originais preservados. Valores de segredo nunca foram lidos pelo agente.
Humano restabelece clipboard e emite/submete credenciais; probes protegidos,
consumidores e revogação independente precedem closure. Nenhuma saída vazia foi
interpretada como sucesso. PITR7d depende contratação/configuração humana e de
restore em cópia isolada; aumentar retenção não cria histórico retroativo.

## Gate de promoção e retomada

O runbook `docs/runbooks/conditional-publication.md` define o circuito aprovado.
Todos os receptores controlados; seis rotações com consumidores/identidades e
revogação comprovadas; PITR7d e restore isolado; conexões/auth aplicáveis; fullPR
verify-release atual; scannerCE e espelho confiável. Somente então janela humana
30min remove só update, preserva PR/base/checks/bypass vazio e admite mergecommit.
Re-freeze imediato; mainwait deve produzir CE>=80 com denominador>=piso e unidades
pagas registradas. Erro do espelho>2p.p. interrompe. Publicar manualmente o SHA
exato em ambos e integrar main→develop imediatamente. Pending, cancelled,
missing ou NO-VERDICT mantêm NO-GO. A janela antiga vencida nunca removeu o freeze.

DBT-77 exige reconciliação de todos os databases/schemas develop, ensaio no PG17
isolado e numa cópia temporária de develop, aplicação de migrations aprovadas e
role runtime/grants/RLS sem reset ou descarte dos dados existentes. Guard de alvo
nega production incondicionalmente; qualquer alvo remoto não produtivo exige
ALLOW_REMOTE_DB com motivo não vazio. Não conectar usuário privilegiado ao web
para esconder falha de permissão. A ausência observada foi escalada, sem DDL. O workflow legado neon-readiness.yml não declara ALLOW_REMOTE_DB nos passos db:test/db:check nem TTL24h e GET404; não foi despachado. Esses limites da rota de ensaio integram DBT-77 e devem ser corrigidos antes de usá-la para bootstrap.

## Checklist anti-vacuoso do marco (não é aprovação S6)

1. Negativos observados: CORS, kitcorrompido, aquisiçãoAPT100, unidades antigas/não mapeadas/perdidas e HTTP200 público sem identidade.
2. Fronteira dupla: CORS/transform legítimos e recusas; conexão/runtime/restore permanecem pendentes.
3. Identidade: SHA/lock/image e branchids; GET404 e inventário Neon independente.
4. Veredito além de exit: ACAO/sentinela/Host, kitversions, resultados E2E, catálogo/RLS e provideridentity.
5. Nenhum sleep como prova: status, resultados e resposta de lookup; tempo decorrido não aprova.
6. Valores degenerados recusados: máscaras, sources, identidades e denominadores vazios não viram verde.
7. Estado compartilhado: PG17 isolado; clipboard falhou e fase de rotação foi interrompida.
8. Sentinelas: sintéticas no teste esbuild; IDs reais nos recursos, sem persistir credenciais.
9. Fingerprint de revisão: manifests por commit; C09 run vincula B8 e seu checkout PRmerge, sem transportar verde para outro SHA.
10. Descoberta completa: workflows, registry e kitpayload; vazio/mismatch reprovam.
11. Contexto limpo: revisão somente do finding C02; S6 de todo o ciclo não realizado.
12. Fail-closed: mapping, kit, clipboard e scope de instalação desconhecido bloqueiam operações dependentes.
13. Isolamento: PG17 loopback38743 sem volumes, removido; production nunca fixture.
14. Capturas/gates: operations.txt sanitizado e journal imediato; nenhum run inventado citado como prova.
15. Run@SHA: C09 UI/Neon/scanner aplicáveis observados; mirror bloqueado; C10 e C11 ainda não observados por CI neste marco.
16. Multi-sítio: segundo receptor Vercel encontrado; falta de acesso mantém DBT-70 e impede alegar suspensão completa.
17. Estado ambiente: WIP preservado, lock/image/kit explicitamente conferidos; clipboard e SUDO incompletos não são aprovação.

KPI autor/total não promovido: marco parcial sem S6 do ciclo nem claims operacionais
completas. Registry60:46ABERTA/13FECHADA/1EM_TRATAMENTO; DBT-68 e DBT-74 fecham
somente seus critérios nomeados. Placar150D29P8NS0UNV/187 inalterado pelo agente.
Handoff vivo: `../agent-state/PROGRESS.md`. MANIFEST.sha256 sela apenas SPEC,
README e captura deste marco, sem alterar os selos anteriores nem incluir a si.
