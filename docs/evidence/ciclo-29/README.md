# C29 — correções DBT-86 a DBT-89, qualificação local

## 1. Resultado e revisão

Continuação autorizada das FASES 3 e 4 na bancada `/tmp/pqd-develop`, parent
`55f3ddfb51fe4617d4b4dbc5fde023ab07979f11`, sobre develop publicado
`e3a5507cf5d0a7beb10d383a9f44c1e1537aa05c`. F0/F1/F2 têm recibos anteriores
privados; F1 já está no commit55f3ddf. F2 entra no marco F4, preservando o
histórico e os hooks. A retomada não contorna a negativa anterior do Mimosa.

F3 está LOCAL-VERIFIED: check integral131suítes/1785PASS18skips condicionais,
cadeia completa18etapas de banco, quatro casos de margem nomeados sem skips,
db:check e validação UI3.4. Matriz local60/60 em Chromium/Firefox/mobile, zero
skips/flaky; WebKit não cria página local na precondição. O veredito local
não cobre a matriz de quatro projetos. F4 concluiu instalação/check no principal (§9), push develop e matriz completa
atual (§10). O suplemento remoto está em custódia documental local pós-push;
o bloqueio de release do mirror continua ativo.

Custódia do principal: zero tracked modificados e928untracked, com inventário
SHA256 privado60-principal-custody.json. SPEC registra o write-set. Fingerprints
dos37arquivos de código/config/teste estão em `captures/source-fingerprints.txt`.
Capturas versionadas são derivadas sanitizadas; originais e seus hashes estão
em `captures/origins.json`. Os33arquivos visuais da validação3.4 são bytes
redigidos antes da persistência, conferidos por `MANIFEST.visual.sha256`.

## 2. Mudanças e evidência de fechamento

| dívida | comportamento corrigido                                                                                                                | prova atual e controle                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DBT-86 | Envelopes de erro e resumos parciais não entram como dados válidos no cache;401 redireciona a autenticação, erro recuperável tem retry | `session-gate.json`:dois fluxos em contexto fresco; `live-margin.json`:A→B→A, identidadeB presente/A ausente e503→retry; zero pageerror. Baseline anterior conserva o crash em `session-baseline.json`; testes de envelope/shape no check                        |
| DBT-87 | Quatro gatilhos exibem o nome pela associação ID→nome do Base UI; payload conserva UUID                                                | `select-identity.json`:26asserções originais de init/troca/reload/wire/contenção, mais quatro resets de premissas de Diagnóstico/Simulações por identidade, desktop/mobile;30/30. Nome longo continua acessível nas opções; não foi removido para conter largura |
| DBT-88 | Margem ponderada pela receita registrada nos itens e pelos custos/taxas atuais; empty/incomplete/ok explícitos                         | `database-full.txt`:4casos exatosPASS0skip; `live-margin.json`:12cenários exatosPASS; `margin-red.txt`:três falhas com a fórmula antiga; `margin-green.txt`:33PASS. E2E de vendas verifica90% com preço25 versus catálogo20                                      |
| DBT-89 | Cabeçalho do MetricCard permite quebra; seletor e filhos do form podem encolher sem expandir a grade                                   | `geometry-frontiers.json`:nove páginas×1350/390/767/768px=36PASS,zero offenders; `select-identity.json`:nome longo no form móvel,scrollWidth308=clientWidth308. `geometry-baseline.json` conserva RED desktop/móvel                                              |

DBT86–89 recebem FECHADA por esses closure tests locais; registry canônico em
`docs/evidence/agent-state/DEBTS.md`. Esse registro não promove placar, S6 ou release.
As dívidas anteriores preservam sua custódia e classificação.

A conta independente para o caso principal é: duas unidades vendidas a40,
custo11por unidade e taxa10% sobre80 de receita =>80−22−8=50;50/80=62,50%.
Catálogo25 não entra no numerador. Venda a5 nas mesmas condições resulta em
−130%, preservada na UI. Receita zero, custo desconhecido e divergência entre
líquido e itens geram indisponibilidade com motivo verdadeiro. Períodos Mês/Ano
e tenant estrangeiro são exercitados com valores distintos, não apenas contagens.

## 3. Gates e processos reprodutíveis

`captures/quality-gates.txt` aponta os comandos e resultados. `check-fase3.txt`
conserva check integral; `database-full.txt`/`database-check.txt` conservam a
cadeia18etapas e paridade de migrações no PG17 próprio/38173. Não houve migration
nova. O script de pacote mudou apenas para encadear o runner de margem; a
regeneração do lockfile produziu bytes idênticos, sem mudança de dependências.

`matrix-local.json` registra identidade, status e duração dos60casos; os quatro
projetos permanecem configurados. `browser-preconditions.json` registra a falha
local de newPage do WebKit e sentinelas reais de Chromium/Firefox. Nenhum teste,
timeout, orçamento, retry ou limiar foi afrouxado. A execução local de três
projetos é explicitamente parcial; a matriz completa atual é exigida no PR.

O harness de margem deve ser empacotado sem nomes de função injetados antes de
serializar o adaptador DOM para o browser:

```bash
npx --no-install esbuild scripts/qa/consolidated-margin-gate.mjs --bundle --platform=node --packages=external --format=esm --outfile=.artifacts/c29-margin-gate.mjs
node .artifacts/c29-margin-gate.mjs http://127.0.0.1:4173 /caminho/privado/evidencia
node scripts/qa/product-select-gate.mjs http://127.0.0.1:4173 /caminho/privado/selecao
node scripts/qa/geometry-gate.mjs http://127.0.0.1:4173 /caminho/privado/geometria
rm -- .artifacts/c29-margin-gate.mjs
```

O último comando remove somente o bundle gerado por esta execução, após o gate:
arquivos temporários próprios não permanecem sob a descoberta do lint.
O bundle e o config privado da matriz desta rodada foram movidos, com hashes
iguais, para custódia65. `quality-red-lint.txt` conserva o RED antes da correção;
nenhuma regra de ignore ou verificação foi alterada.

Esses comandos exigem a bancada sintética qualificada e não aceitam alvo remoto.
O harness confere loopback e identidade do banco runtime/admin antes do SQL.
Senhas são geradas em memória ou lidas da fixture; nenhum body/cookie de auth
ou valor de env entra nas capturas. A/B novos foram removidos com leitura de
ausência. Dois tenants bootstrap órfãos da primeira tentativa também foram
reconciliados por ID, tempo e ausência de todas as tabelas tenant-scoped antes
do descarte; `bootstrap-cleanup.json` conserva a prova.

## 4. Riscos e limites

ADR041 está PROPOSTA, com ratificação pendente. Custos/taxas atuais não são
histórico contábil; a aplicação não armazena custo histórico por venda.
Descontos/ajustes líquidos sem alocação por item não suportam uma margem
fiscal reconciliada e permanecem indisponíveis. Produto arquivado sem custo
calculável também não autoriza margem parcial.

Release NO-GO: main congelada, mirror/main coverage e pendências operacionais
C28 continuam separadas. CI de outra revisão, gate de PR sem condição coverage,
GET anônimo, fixture e green local não autorizam main, deploy, credencial,
produção, DNS ou cutover. Nenhum serviço externo foi publicado nesta retomada.
WebKit local é uma precondição declarada, não um PASS. S6 formal NOT-STARTED.

## 5. Auto-verificação pré-S6

| #   | item                     | como demonstrado/status                                                                                          | origem                                            |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Controle negativo        | Três oráculos independentes reprovam a fórmula de catálogo; baselines conservam crash/overflow/UUID              | margin-red.txt; session/geometry-baseline; QA C28 |
| 2   | Fronteira nos dois lados | Receita positiva/zero, margem positiva/negativa, custo conhecido/desconhecido e largura767/768                   | live-margin.json; geometry-frontiers.json         |
| 3   | Identidade               | Nomes exatos dos12cenários e4casos DB; A/B e produtos com UUID; preço40 distinto catálogo25                      | harness; database-full.txt; live-margin.json      |
| 4   | Sintoma além do exit     | Texto62,50%/−130%, badge, quantidade e receita; erro503 recuperado, ausência de fixtures por ID                  | live-margin.json; bootstrap-cleanup.json          |
| 5   | Sincronização observável | Lookup de sessão do novo documento, resposta sign-in e marcadores UI; nenhum sleep fixo nos gates                | bench-lib/repro/select/geometry/margin            |
| 6   | Não degenerado           | A receita80 difere da B1000; custo11, imposto8, item de outro período10 e produto incompleto                     | live-margin.json; dashboard DB test               |
| 7   | Estado compartilhado     | SQL somente em PG17local qualificado; identidades runtime/admin iguais; matriz em banco próprio                  | harness; recursos54/60 privados                   |
| 8   | Sentinela real           | Request real mantém product_id/UUID; premissas83,17/47,23 e777,12/123 ausentes após troca                        | select-identity.json; select harness              |
| 9   | Fingerprint              | Fontes/config/testes, originais privados e capturas/trios conferidos por SHA256                                  | source-fingerprints/origins; manifests            |
| 10  | Descoberta completa      | Nove rotas×quatro larguras e quatro seletores×dois viewports; descoberta vazia não sustentaria os nomes exigidos | geometry/select source; captures                  |
| 11  | Contexto limpo S6        | NOT-STARTED; auto-verificação do autor não recebe veredito adversarial nem promove placar                        | §7; PROGRESS                                      |
| 12  | Fail-closed              | Resumo parcial/envelope inválido não vira sucesso; ajuste desconhecido e zero não inventam margem                | shape/envelope/dashboard tests                    |
| 13  | Bancada isolada          | 928untracked preservados; PG38173 próprio, produção/5432 fora do alvo; A/B novos e órfãos ausentes               | custody60 privado; bootstrap-cleanup/live-margin  |
| 14  | Gate e captura           | Comando e conteúdo observável separados por gate; RED e tentativas incompletas conservados                       | quality-gates; origins; logs privados             |
| 15  | CI por revisão           | PENDENTE no checkpoint local; run anterior não aprova patch atual, fullPR matriz obrigatória                     | complemento F4; PROGRESS                          |
| 16  | Multi-sítio              | Quatro seletores de produto enumerados e hash dos consumidores de envelope; matriz SQL regenerada114/52          | source-fingerprints; matrix.generated.yaml        |
| 17  | Ambiente                 | WebKit sem página não vira verde; env/role/loopback/IDs e readiness são precondições explícitas                  | browser-preconditions; harness; runtime54         |

Dez correções conhecidas antes do S6 nesta retomada: fórmula de catálogo,
fixtures calc-explainer antigas, ajustes líquidos sem conciliação, badge empty,
identidade dos casos DB, signup/cleanup bootstrap, e-mail maiúsculo da fixture,
serialização DOM sob tsx, oráculo numérico fora do locale e temporários próprios
descobertos pelo lint. KPI da rodada:
**10capturados pelo autor/10achados conhecidos**. Denominador total adversarial e
densidade S6 não medidos; esses itens não recebem CORR/N de um S6 inexistente.

## 6. Rollback e retomada

Reverter por commit novo em develop após gate; preservar55f3ddf e WIP.
Nunca reset/clean/rebase/amend/force push. Descartar recursos novos somente
por identidade qualificada; preservar a fixture de revisão em41921/4173.
Retomar PROGRESS/state-check e reconciliar refs/CI pelo SHA antes de atuar.

## 7. S6 ADVERSARIAL

NOT-STARTED. CORR não medido, N não medido. Esta retomada conclui as provas de
engenharia locais e prepara integração; não afirma contexto limpo independente,
selo formal ou elegibilidade de release.

## 8. Complemento F4 — integração local

Check66 integral GREEN após a custódia dos dois temporários próprios:131arquivos
PASS,1785testesPASS18skips condicionais,build e bundlePASS.
`captures/integration-check.txt` conserva comando, hash do log e readout real.
`captures/source-fingerprints.txt` conferido37/37 sem diferença; os gates
funcionais e60casos E2E permanecem ligados a esses mesmos bytes de aplicação.
O principal será avançado apenas por fast-forward e ainda exige npmci/check
antes do push. CI atual e veredito S6 continuam pendentes neste marco.

## 9. F4 — instalação e circuito do principal

O commit normal `8977ec514a00614a615c5155b193a973bf7b48cd` integra F2/F3 e a
migração documental do QA anterior; o principal develop recebeu55f3ddf e8977ec5
por fast-forward. Custódia928/928untracked preservada sem mudança de bytes.
`captures/principal-install.txt`:npmci621instalados/622auditados,zero vulnerabilidades.
`captures/principal-check.txt`:132suítes e1803/1803testesPASS,zero skips,build/bundle
PASS,contra fixture PG17própria com papel runtime separado. Env de produção
não foi alvo; o arquivo .env do principal permaneceu intacto e valores de
provedor não foram lidos/transmitidos.

O journal exigiu uma segunda passagem do mesmo Prettier3.9.6 para estabilizar
dois escapes Markdown após o append;74/75pararam no formatter,sem teste vermelho.
A igualdade byte a byte após reformatar foi assertada antes do check77GREEN.
Nenhum pin,teste,skip,limiar,budget ou regra foi alterado.

`captures/local-resource-cleanup.json` confirma término do runtime4174 e
ausência do PGpróprio38173 por inspeção nominal e inventário independente.
A bancada de revisão4173/41921 e150arquivos visuais em bytes originais
permanecem acessíveis. O estado de autenticação da matriz foi movido para
custódia privada com modo0600,fora da área de fonte. Publicação é somente
develop; main continua congelada. O source fingerprint37 é idêntico ao do
check77 e dos gates funcionais; alterações deste marco são documentação.
CI atual e S6 formal ainda são precondições separadas de release.

## 10. F4 — publicação e CI atuais, suplemento pós-push

**REMOTE-OBSERVED**, N1 Chrome, 2026-10-05. Develop publicado e confirmado por
Git ls-remote em `c940aef855c0c7e85381daf5fa3d58511d0131c0`; integra F1
`55f3ddfb51fe4617d4b4dbc5fde023ab07979f11`, código F2/F3 `8977ec514a00614a615c5155b193a973bf7b48cd`
e o marco documental do circuito principal. O checkout virtual usado na PR e
pelo CE é f70e01fa99bd0fac7702faa74e9b960b446b388b, distinto do head publicado.

- [UI stack push](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37259858323): SUCCESS.
- [UI stack PR](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37259860642): SUCCESS; preparação 1min09s com cache exato, verify-release 5min02s,
  ambos dentro de 12min; 18 etapas de banco e nova margem 4/4 sem skips;
  Playwright 80/80 em chromium/firefox/webkit/mobile. A precondição local do
  WebKit permanece descrita, e a matriz remota atual cobre esse projeto.
- [Neon PR CI](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37259860583): SUCCESS; RLS e integração aprovados, E2E 80/80,
  journals de 20 migrations iguais; cópia br-steep-bread-ayk12x97 descartada
  com GET 404. Console independente, pelo ID exato, respondeu "Request failed:
  branch not found". Inventário completo em duas leituras mostra production,
  develop (Archived branch) e preview/dependabot/npm_and_yarn/tailwind-merge-3.7.0.
  A terceira branch é drift externo pendente e foi preservada.
- [Sonar](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37259860751): scan + cobertura SUCCESS, CE 7997c5b8-f4bd-4bde-b249-17978168a89c
  OK, identidade PR60/develop/revisão virtual acima, new_coverage 81,8% ≥ 80%.
  O workflow termina FAILURE: main-coverage-mirror exit 2 / NO-VERDICT por
  mapeamento/proveniência completo indisponível ou inconsistente. PR60 apresenta
  11 checks verdes e 1 falho; merge bloqueado e main congelada.

A transcrição estruturada está em `captures/remote-ci-observed.json`. Digests
mostrados pelo provedor não equivalem a ZIPs revalidados localmente; esses ZIPs
não foram baixados. Este §10, captura, manifest e observações novas no PROGRESS
são WIP documental pós-push, mantido para o próximo marco sem criar um ciclo
extra apenas para publicar o resultado do próprio CI. O código e o registry
DBT86–89 estão publicados. F4 de implementação/qualificação/push concluída;
release NO-GO, ADR041 PROPOSTA e S6 formal NOT-STARTED permanecem separados.
