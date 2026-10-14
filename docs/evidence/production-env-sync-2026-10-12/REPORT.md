# Sincronização Neon → Vercel Production e publicação de main

**Produção promovida e verificada.** A entrada manual de `DATABASE_URL` que bloqueava
a integração foi removida após confirmação humana. A integração Neon existente
reinjetou `DATABASE_URL` em Production. O novo deployment do mesmo SHA aprovado
foi qualificado e promovido para Sage, o alias do time e git-main. Os nove pares
alias × probe responderam HTTP 200 na sessão autenticada do deployment publicado.
O Sage público respondeu 200 nos três probes anônimos; os aliases protegidos do
time e git-main conservaram 401 sem autenticação.

As capturas usam UTC; a sincronização e promoção ocorreram na noite de
**12 de outubro de 2026** no horário de Bahia. A qualificação documental continuou
na madrugada do dia13. Nenhum valor de variável de ambiente foi transcrito nas capturas.

## Identidade e release

| Superfície          | Identidade                                                    |
| ------------------- | ------------------------------------------------------------- |
| Projeto Vercel      | `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q` / `preco-que-da-lucro`     |
| Time                | `team_2NnkSYjw5NRHAFnQFEPSHGmW`                               |
| SHA publicado, main | `5d6049b9badf067b804bdc3062c922bab72c46d0`                    |
| Release de origem   | PR #63, merge em 2026-10-12T22:41:44Z                         |
| Deployment novo     | `dpl_9v4ni1MyeWA6GhnoE7m3p5mpZRZM`                            |
| URL imutável        | `https://preco-que-da-lucro-3ideu7io0.vercel.app`             |
| Build               | READY, 43 s, cache desmarcado no formulário de redeploy       |
| Neon                | `damp-forest-57346541`, production `br-snowy-violet-aymcvvvv` |
| Compute de produção | `ep-long-violet-aye9g0bn`                                     |
| Integração          | `icfg_eDeLFTSX3j7fPem6tn88RkGS`                               |
| Rollback existente  | `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`                            |

O remoto foi reconfirmado antes da promoção: main continuava no SHA acima,
ancestral do develop `ca60eb92dda3fad708d46d6ccc1f74c38c3706c6`. O conteúdo de
aplicação não mudou nesta operação.

O head `cbd1bac75da95d73b799f482d25498ac010821a9` do PR #63 tem `verify-release`,
`scan + cobertura`, integração/RLS/Neon e cleanup em success. O push real de main
tem `verify` e `scan + cobertura` em success. O CE da run `38318115587` foi baixado
novamente: checkout, runner e revisão do provedor coincidem com o SHA publicado;
superfície main, PR null, análise `009c844c-e260-4a15-9fa6-0d85f37b48c3`.

**ADR-042: releasePolicy OK, new_coverage 74.1%, mínimo 60%.** O veredito bruto do
provedor continua ERROR no preset de 80%; ele está preservado no artefato. Todos
os demais controles do readout são OK, sem veto. O espelho de main foi skipped
por escopo e não foi usado como crédito de release. Os recibos originais estão em
`captures/c25-gate-readout.json` e `captures/c24-main-baseline.json`. As leituras
dos checks por SHA estão em `captures/main-checks.json` e
`captures/pr63-head-checks.json`.

## Correção do ambiente

Antes da intervenção, o painel confirmou exatamente a entrada manual Secret
`DATABASE_URL`, apenas Production, editada em Oct 6, id conhecido
`LQTKQMUeLWmQnHkM`. A entrada recente era Preview/develop. A integração Neon já
apontava sua Production branch para `br-snowy-violet-aymcvvvv`; Settings mantinha
`DATABASE_URL` e `DATABASE_URL_UNPOOLED` selecionadas, database `neondb`, role
`neondb_owner`.

A renomeação reversível não era oferecida: a chave da Secret estava bloqueada.
A tentativa de retirar o target sem excluir a entrada foi recusada pela API com
`Please specify at least one Environment for your Environment Variable` e foi
cancelada. Nenhum desses dois caminhos mudou a configuração persistida.

O usuário confirmou a exclusão no momento da ação. O diálogo identificou
`DATABASE_URL` e **somente Production**; o painel confirmou a remoção. Em Neon
Settings, um ciclo de desmarcar/salvar DATABASE_URL e remarcar/salvar forçou o
resync. Entre os dois Saves, o drawer foi recarregado para ler o false realmente
persistido: o formulário não atualiza sua referência de dirty state após salvar.
Depois do segundo Save, Vercel mostrou **DATABASE_URL da integração, Production,
Added just now**, substituindo a colisão manual.

O resync também retirou as duas entradas Development do inventário da integração.
Os seus valores anteriores não foram lidos, portanto o endpoint anterior não é
afirmado. A antiga `vercel-dev` está documentada no inventário de 2026-10-02 e não
existe mais no inventário atual. Não foi recriada: a política conserva somente
production, develop e ci-fixture-base; desenvolvimento local segue o PG17 Docker.
Preview/develop permaneceu presente. Nenhuma branch Neon nova foi criada.

Procedimento de referência do provedor:
[Neon-Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration#managing-the-integration).
A mudança de env exige novo deployment; deployments existentes mantêm o seu
snapshot, conforme [Vercel Environment Variables](https://vercel.com/docs/environment-variables).

## Qualificação do artefato e promoção

O redeploy partiu de `dpl_2TVJzq7cHqk7gKwQNriYGfn9cmTa`, main no mesmo SHA, com
Production selecionada e cache desmarcado. A configuração de auto-assignment
estava desativada: o candidato ficou staged durante a qualificação. O novo build
terminou READY em 43 s. O dashboard declarou **No checks configured** em Deployment
Checks; não há check adicional ali que possa ser presumido executado.

O cliente do navegador bloqueou a apresentação dos endpoints JSON. A prova de
HTTP veio da superfície primária autenticada do dashboard Vercel: linhas reais
de log com filtro exato `deploymentId:dpl_9v4ni1MyeWA6GhnoE7m3p5mpZRZM`, hostname,
method, pathname, timestamp e correlationId. O parser leu as células acessíveis
dos logs; `innerText` sozinho não contém todas as mensagens acessíveis. A primeira
coleta incompleta está preservada como precondição, com `allPassed: false`; não
foi usada para aprovar a promoção. A coleta completa passou os três probes
frescos em 2026-10-13T02:04:04–06Z.

O status HTTP 200 de ready é evidência da conexão real: o handler do SHA publicado
executa `select 1 as ready` antes de responder, usa `no-store` e retorna 503 na
falha. **Os corpos HTTP não foram observados**; não se declara leitura de um corpo
JSON nem sessão null a partir desses logs.

O smoke E2E no candidato passou: home carregada com HTTP 200 no servidor, auth
carregada com HTTP 200, submit vazio bloqueado pela validação do campo obrigatório
e `/inicio` redirecionado para `/auth?redirect=%2Finicio`. Capturas de tela estão
em `captures/candidate-{home,auth,protected-route}.jpg`. Login real, e-mail,
OAuth e conversa faturável não foram executados nesta verificação.

O diálogo Promote identificou o artefato e SHA corretos. Depois da promoção, o
dashboard recarregado mostrou **Current Domains**: Sage, alias do time sob
Assigned Domains (+1), git-main e a URL imutável. Não houve rebuild ao promover.
O SHA servido mantém `git.deploymentEnabled=false` em `vercel.json`; o fluxo de
publicação Git continua manual.

## Prova após a promoção

| Alias                                                                        | live | ready | get-session |
| ---------------------------------------------------------------------------- | ---- | ----- | ----------- |
| `preco-que-da-lucro-sage.vercel.app`                                         | 200  | 200   | 200         |
| `preco-que-da-lucro-douglasultimatesouza-5127s-projects.vercel.app`          | 200  | 200   | 200         |
| `preco-que-da-lucro-git-main-douglasultimatesouza-5127s-projects.vercel.app` | 200  | 200   | 200         |

Os nove probes autenticados foram solicitados entre 2026-10-13T02:28:09Z e 02:28:15Z. O
dashboard do deployment promovido registrou os nove status 200 com identidade de
host e requisição. `captures/public-alias-probes.json` exige todos os nove pares
e o filtro exato do deployment; `allPassed=true`. O bruto correspondente está em
`captures/post-promotion-server-logs.a11y.txt`. A homepage publicada de Sage foi
carregada e capturada em `captures/published-home.jpg`. Rollback não foi necessário.

A primeira tentativa de GET anônimo após a promoção não iniciou por timeout da
revisão automática. A única repetição permitida posteriormente executou: Sage
público retornou **200 nos três endpoints**, sem cookies, Authorization ou token
de bypass. Os aliases do time e git-main retornaram **401 anônimo** nos três
endpoints, preservando a proteção; os status200 desses aliases na tabela são da
sessão autenticada. O recibo `captures/public-anonymous-probes.json` conserva
`allPassed=false` para a hipótese de todos os nove GETs anônimos serem públicos;
essa hipótese não foi satisfeita e não foi convertida em prova de acesso público
aos aliases protegidos. Nenhum corpo HTTP foi armazenado.

**DBT-110: condição de fechamento satisfeita**, com a remoção/resync explicitamente
autorizada pelo usuário, novo deployment, ready 200, smoke E2E e probes após a
promoção. **DBT-109: condição restante satisfeita**, com build real de cache frio e
publicação saudável do SHA aprovado.

## Limites preservados

- O conector Vercel retornou HTTP 403 para o escopo do time, inclusive após o usuário
  informar a reautorização. A autorização específica para um link temporário foi
  recebida, mas as ferramentas de acesso não forneceram link. A validação foi
  concluída pela sessão autenticada normal do navegador e pelos logs primários.
  Esse limite está registrado como **DBT-111**, sem transformar 403 em saúde da app.
- Houve avisos `csp.violation` em modo `report`, com `sample:null`, nas navegações
  normais. A origem das violações não foi atribuída a app versus instrumentação
  do navegador nesta operação; **DBT-112** conserva esse diagnóstico pendente.
  Os controles de segurança do CE real permanecem OK; nenhum controle foi removido.
- O comando de probes anônimos depois da promoção não iniciou: a revisão automática
  excedeu seu prazo. A única repetição permitida depois executou, com Sage200 e
  os dois aliases protegidos401 anônimos. A primeira tentativa não é um veredito
  de segurança ou HTTP; o recibo posterior conserva os resultados reais.
- Nenhuma variável de ambiente foi decifrada ou transcrita, nenhum SQL
  administrativo/fixture foi executado em produção e não houve troca de senha.
  Os snapshots de banco permanentes e a história publicada de Git foram preservados.

## Gate local e entrega das evidências

O primeiro `npm run check` com tmpdir padrão saiu1: 145 suítes PASS, 1skip,
2 falhas / 2284 testes PASS / 18skips. As duas falhas são das premissas de
isolamento em `mcp-runtime-guard.test.ts`: `/tmp/.git` existe, portanto a guarda
reconhece corretamente as fixtures como dentro de uma árvore Git. O bruto está
preservado em `captures/local-check-default-tmp-failed.txt`.

A correção da bancada criou um diretório temporário próprio em `/var/tmp`, com
verificação de **todos os ancestrais**, nenhum `.git`; a identidade/precondição
está em `captures/local-temp-precondition.json`. Com esse `TMPDIR`, os 20 testes
MCP passaram sem alteração de teste ou guarda (`captures/mcp-guard-isolated-tmp.txt`).
O gate completo nessa bancada saiu1 por uma falha diferente: o smoke
`m02-cutover-t0.test.ts` fixa `/tmp/t0-unit`, fora do TEMP_ROOT selecionado, e o
produtor recusou corretamente essa saída. As outras 145 suítes passaram; o
registro completo está em `captures/local-check-isolated-tmp-failed.txt`, e o
smoke reproduzido em `captures/cutover-smoke-isolated-tmp.txt`. **DBT-114** conserva
o limite do caminho fixo. Nenhum teste, guarda, contrato ou fonte foi modificado.

A inspeção adicional do `/tmp/.git` revelou **ZERO entradas** e nenhum
HEAD/config/objects/index. Esse marcador vazio foi preservado por rename
reversível em diretório de custódia próprio, com identidade de dispositivo/inode
conservada e prova de ausência no root de `/tmp`; não havia bytes de Git ou WIP.
`captures/default-temp-custody.json` conserva o recibo. A pasta de visualizações
permaneceu intocada. O marcador vazio reapareceu entre invocações; origem/ator ainda não atribuídos.
A coleta `captures/default-temp-pair.txt` voltou a reprovar2 casos MCP. Uma rodada
completa iniciada antes de ler essa reprovação também saiu1 e está em
`captures/local-check-marker-reappeared-failed.txt`; não foi aprovação.

A execução conjunta de custódia reversível e duas suítes na **mesma invocação**
passou22/22, com ausência do marcador antes e depois: recibo
`captures/atomic-default-temp-pair.json` e bruto `.txt`. A próxima rodada completa
usa a mesma sequência conjunta, com comprovação de tmpdir padrão fora de Git
antes e depois do gate. **DBT-113 permanece ABERTA** por recriação entre comandos;
a tentativa de TMPDIR externo não foi um gate completo aprovado.

O gate conjunto completo terminou em **exit0**, de 2026-10-13T03:11:24Z a
03:15:05Z: **146 arquivos PASS +1skip, 2286 testes PASS +18skips**, build e
check:bundle PASS. Todos os scripts da cadeia rodaram. O bundle inicial permaneceu
`sha256=ffcafa3794f1` e o asset principal `sha256=30ca04baaa66`. O bruto está em
`captures/local-check.txt`; `captures/atomic-local-check.json` exige gate exit0 e
nenhum ancestral Git do tmpdir padrão antes/depois, com `qualified=true`.
Nenhuma fonte/teste/guarda foi alterada ou pulada para obter o resultado.

O commit/push documental fica restrito a develop, após esse gate e as guardas de
consistência/formatação da consolidação final. A publicação da aplicação acima usa
o mesmo artefato de main já aprovado; os commits desta operação são evidência e
handoff, sem mudança de aplicação ou publicação direta em main.
