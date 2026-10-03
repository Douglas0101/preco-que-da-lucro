# C27 — implementação, evidência e promoção pendente

Estado: **NO-GO para merge/publicação**. O merge final develop → main foi
expressamente autorizado pelo MAESTRO **após** resolver as operações e os gates.
Esta autorização preserva o circuito de ADR-017/038/039, o freeze e os checks.
Nenhuma promoção, contratação, rotação ou configuração de credencial é inferida
da entrega do código.

## Revisões e custódia

Último código publicado em develop: ec2785d0d0dee7de9b5b00d56ab8c1e3aecd0670.
Main permanece d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9. PR #60 aberta e BLOCKED.
Somente develop/main estão publicados no GitHub; rulesets24333849/24347682 mantidos.
O checkout original48ffb6b e seu WIP foram preservados. Selos C01–C05 são custódia
de bytes Git, não aprovação S6 ou readiness de produção.

| Lote | Commit                                   | Resultado implementado                                                              |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| C01  | 78bae0e7415e68ba093a7d71ca910edaf1cdfc9b | ADR039: Hostinger principal, Vercel manual e recuperação S3 independente            |
| C02  | 1b1754d645d3cbfde6b46bc55478163c8e606f5e | Cache do kit completo de browsers/debs com identidade e atestação nova por execução |
| C03  | ccef6e55eb44e6db7bb09682526d00d2fb2f55d2 | Readiness Neon com identidade, TTL24h e descarte404/ausência independente           |
| C04  | 57889d762f45a61397e38c6e24acfa4d93db8160 | Probes exigem JSON real; monitor retém incidentes; HTML200 reprova                  |
| C05  | ec2785d0d0dee7de9b5b00d56ab8c1e3aecd0670 | Backup AES256GCM, validação de versão/checksum/retenção S3 e recibos de falha       |

C01–C05 somam cinco commits publicados. Esta consolidação é o lote documental
C06, que contará somente após commit e publicação observados. Teto C27:13,
incluindo três reservados para merge/back-merge/fechamento. C26 ficou13/13.
Placar humano150D/29P/8NS/0UNV de187 inalterado; S6 C27 NOT-STARTED.

## CI e banco observados

O check local C05 passou:125 suítes,1545 testes aprovados,14 skipped.
Os controles específicos somam73 para o kit,27 para Neon,14 para runtime e27 para
backup. Os skipped locais não substituem testes de banco ou a matriz de release.

Na PR #60, UI run37084295303/attempt1 avaliou o head ec2785d0 e o checkout de
merge51792c5e57775d72f262222f3e12450bc42fdb39: produtor67s, verify-release414s,
ambos SUCCESS. O artifact registra76 E2E em chromium/firefox/webkit/mobile,
zero skipped/unexpected/flaky. Estes dois SHAs têm papéis diferentes.
Cache hit exato do kitv2 foi observado no run anterior37082909883, com produtor88s
e verify419s; não houve redução de navegadores, testes ou timeout12min.

Neon PR run37084295335 SUCCESS: integração/RLS/E2E e cleanup SUCCESS. Depois do
terminal, a cópia br-withered-mode-ayjjp017 respondeu GET404 e não apareceu no
inventário independente. O readiness dispatch37080532930, no SHA ccef6e55,
exercitou17 suítes DB numa **cópia de develop**; cleanup também teve404 e ausência
por ID/nome. O legado ficou skipped por falta de origem configurada, não quitado.
Esses positivos não preparam, por inferência, a develop permanente.

ERRATA C27-Neon: a integração Vercel criou br-snowy-term-ay5634m3 às00:24:52Z,
uma preview Dependabot sem TTL. A branch foi excluída sob a autorização humana
anterior de manter apenas develop/production. DELETE null não foi aceito como
prova: GET404 e listagem completa confirmaram ausência por ID/nome e preservação
de production/default br-snowy-violet-aymcvvvv e develop br-small-hill-aymcu14y.
A prevenção de recriação continua aberta em DBT-72.

A instalação Vercel icfg_eDeLFTSX3j7fPem6tn88RkGS possui acesso All Projects e
webhooks de Deployments/Projects. A edição de acesso foi cancelada sem salvar.
Seu formulário de remoção exige reconhecimento dos termos de encerramento e
remoção da conta conectada, e informa zero recursos Neon instalados. Nenhum aceite
ou remoção de integração foi feito. A segunda equipe permanece sem acesso
verificado; a origem de todos os receptores ainda não foi reconciliada.
O aviso Neon sobre Disconnect declara efeito limitado às variáveis automáticas;
a documentação descreve parada de previews. Essa diferença é um limite nomeado,
não prova de suspensão global. Painéis mantidos para handoff humano.

## Cobertura e produção

Leitura do runner em2026-10-03T01:02:21Z: main analysis
1dc2baf9-b289-42f4-b2ca-dd7b662b3679,2995 unidades/1894 cobertas,
63,2387%, gap502, piso1498. Gate ERROR apenas em new_coverage<80.
O CE da PR5853ff89-2868-483a-8763-285ecc4c17d5 retornou OK **sem condição de
cobertura**. Main-coverage-mirror permanece NO-VERDICT: identidade por unidade
não disponível no probe autenticado. E8 mantém duas implementações sem prova
suficiente; uma terceira exige nova evidência primária. Sem crédito por agregado,
sem redução do escopo, sem gate artificialmente verde.

Probes anônimos somente GET, em2026-10-03T01:33Z:

| Alvo                                   | live     | ready               | sessão anônima | Veredito limitado                                                 |
| -------------------------------------- | -------- | ------------------- | -------------- | ----------------------------------------------------------------- |
| preco-que-da-lucro-sage.vercel.app     | 200 JSON | 200 JSON/Postgresok | 200 JSONnull   | Saúde das três rotas observada; login/tenant/revisão não provados |
| darkgray-pony-545965.hostingersite.com | 200 JSON | 503 JSON            | 500 HTML       | Runtime ativo, conexão/autenticação falhando                      |
| diretrizprecifica.com                  | 200 HTML | 200 HTML            | 200 HTML       | Rotas da API não chegam ao contrato JSON                          |

No canônico os três corpos têm7956bytes e o mesmo SHA256
b3546636a9de3e90f7fdaa557617d7ae6c43ef677a2ad33741035850e321ec6c.
Os logs Hostinger mostram password authentication failed para neondb_owner;
a causa imediata é autenticação. Endpoint/senha efetivamente configurados e o
nexo com a exclusão anterior não foram provados. DATABASE_URL pooled/production/
app_runtime aguarda entrada e submissão humanas ViaA; DATABASE_ADMIN_URL fica
fora do processo web. Nenhum segredo, POST de login, fixture ou DDL foi enviado
à produção. Catálogo read-only confirma app_runtime LOGIN sem super/bypassRLS;
existência do papel não prova que o runtime o usa.

Nenhum DNS/cutover foi feito; observação24h não começou e nenhuma amostra isolada
substitui esse período. As três falhas para abrir incidente são consecutivas na
mesma observação persistida, não uma contagem retrospectiva de probes avulsos.

## Recuperação: alcance e ERRATA do ensaio

Ferramentas C05: GCM autenticado, arquivos privados, recusa a corrupção/chave
errada, conta S3 distinta, Versioning/Compliance35d, HEAD/checksum e retenção da
versão retornada. Testes de S3 são mocks; nenhum bucket/STS/upload real foi usado.
PUT único até4GiB é limite declarado, não suporte multipart implícito.

O ensaio inicial falhou antes do SQL; sua revisão chegou ao restore mas falhou
na comparação sem preservar o diff. Esses recibos ficaram imutáveis. Um diagnóstico
separado preservou os inventários e mediu43 diferenças exclusivamente em
grants.table_catalog, pois origem e destino tinham nomes de banco diferentes.
PostgreSQL define table_catalog como o database corrente; o comparador estava
comparando identidades intencionalmente distintas.

A revisão qualificada usou o mesmo nome fixture em **dois clusters distintos**,
sem remover campos do comparador: dumpcustomPG17→sealGCM→open autenticado→
pg_restore--exit-on-error, seis tabelas em public/drizzle/neon_auth e respectivos
hashes, journals, ownership, grants, roles/policies preservados. TenantA/B positivo
e negativo cruzado passaram; runtime não leu tabelaAuth sem grant. REVOKESELECT
foi detectado no inventário; a reposição voltou ao estado original. Ambos os
containers foram removidos e sua ausência conferida. LOCAL-FIXTURE-PASS,
validação3,064s/ensaio8,162s; RPO/RTO de produção continuam null.

Isto não demonstra login BetterAuth real, dados/catálogo de produção, PITR,
restauração a partir do S3, custódia independente da chave ou perda da conta
principal. Backup diário não prova RPO15min. DBT-75/80 e BAK-01 permanecem abertas.

## Próximos gates, em ordem

1. Humano recupera a conexão Hostinger ViaA; medir ready/session e depois
   login/isolamento da revisão existente, sem fixtures de produção.
2. Reconciliar a equipe adicional e o efeito efetivo da integração antes de
   aceitar encerramento/remover receptores. Exigir prova de não recriação.
3. Completar seis rotações, PITR7d humano e S3 segregado; primeiro
   dump/upload/restore com RPO/RTO e custódia independentes observados.
4. Preparar develop permanente após ensaio e preservação de neon_auth; a cópia
   temporária verde não autoriza reset nem afirma esse gate concluído.
5. Obter mapping unitário Sonar com evidência primária; pagar unidades até80,
   observar bloqueio e positivo do espelho, com erro<=2pp e piso1498.
6. Com todos os checks atuais e operações verdes, MAESTRO abre janela30min,
   mergecommit develop→main, refreeze imediato, CE real main>=80, publicação
   manual do SHA aprovado nos dois destinos e back-merge main→develop.
7. Conferir canônico por projeto/revisão e JSON, login/tenant, recuperação e
   estabilidade24h; produzir o fechamento com evidência de cada superfície.

Ponteiros: receipts.json, docs/runbooks/neon-readiness.md,
docs/runbooks/independent-recovery.md, docs/runbooks/conditional-publication.md e
PROGRESS L486–L519. Custódia privada: .codex/artifacts/ciclo-27/; contém fixtures
e chaves sintéticas privadas, que não pertencem ao commit.

Fontes primárias:
[PostgreSQL17 role_table_grants](https://www.postgresql.org/docs/17/infoschema-role-table-grants.html),
[Neon Previews Integration](https://neon.com/docs/guides/neon-managed-vercel-integration),
[Vercel permissions/access](https://vercel.com/docs/integrations/install-an-integration/manage-integrations-reference).
