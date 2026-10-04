# C28 — correções implementadas, release bloqueada

## 1. Resultado e revisão

Bancada `/tmp/pqd-develop`, sobre develop `66898f0d738717ecbf52cda1384017a0cc23e859`.
Checkout principal mantém `48ffb6bb8106c78781416ffd49fa8a906985f174`, cinco tracked
modificados e929 untracked: comparação SHA256 de934arquivos encontrou zero mudanças,
adições ou ausências. Custódia do parser/journals: cinco entradas estritamente
conferidas em `.codex/artifacts/ciclo-28/custody/MANIFEST.sha256`.

Na implementação inicial, `npm run check` integral PASS:128arquivos de teste,1636PASS14skips existentes,
1650total; suíte160.56s. Guards/formato/lint/tipos/build/bundle verdes. Captura
`captures/check-full.txt`; hashes de código/config/testes em `captures/code-hashes.txt`.
Sem ampliar timeout, orçamento, exclusões ou skips. Main remoto permanece
`d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`. C27continua11/13 com duas reservas;
C28teto13, três reservados. Autor propõe correções, sem promover placar ou release.

## 2. Mudanças e evidência por fase

| Fase | mudança                                                                                                                                                                                                  | evidência e limite                                                                                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP0  | Custódia, namespaces dos journals, parent66898f0 e bancada reconciliados                                                                                                                                 | Manifest privado cinco entradas PASS; state check PASS; captures/custody-recheck.txt                                                                                                                                                                                                       |
| WP1  | Serialização local compartilhada test/coverage; CItrue/1 conserva paralelismo. Node24.21.0 e workflow Sonar pela .nvmrc                                                                                  | Três execuções completas anteriores126arquivos1599PASS14skip cada,0falhas,130.339–131.007s. Gate final acima mede os bytes atuais. Causa dos crashes indeterminada; mitigação não é diagnóstico causal ou estabilidade CI                                                                  |
| WP2  | Triagem individual63ocorrências Mimosa, sem dedup ou PoC nessa fase                                                                                                                                      | 62not_actionable para alegações fornecidas,1needs_review (triage037, alvo arbitrário do CLI legado),0confirmed. Input inconclusive/partial sem SHA não virou gate verde. Artefatos geridos Codex Security, captures/security-triage.txt                                                    |
| WP3  | Transporte sanitizado por origem fixa; fallback somente400/404/405, catálogo opcional não suprime probe. Baseline PR antes do scanner e main após CE; revisão fornecida pelo provedor                    | Negativos401/403/429/5xx/payload/transporte/revisão/PR/branch/ordem. Checkout e runner SHA separados. Auth/metadata insuficientes => NO-VERDICT; fonte/token não persistidos                                                                                                               |
| WP4  | Checkpoint antes de create, adoption por ownership independente de DB_URL/TTL, expiry24h e endpoint nominal; cleanup por ID e inventário paginado                                                        | 33testes locais e gate final PASS. Readiness/exercise-provisioning usam6.4.0 pinada; permanente/reuse/parent errado/ambiguidade recusados. Perda de output/URL/TTL conserva custódia. Drill remoto37152161806 na fonte482e577: ver seção8 e limites; operações legadas não reclassificadas |
| WP5  | Adapter descobre todas as páginas/linhas e concilia unidades/condições com LCOV original do analysisId de main. Provenance inclui sensor/fonte/instrumentação/período/hashes. CLI recebe artefatos reais | Bare Node CLI em Git fixture própria PASS0/FAIL1/NO-VERDICT2; gain/loss/old-line, origem, período, hash e freshness30min negativos. Mapping autenticado atual e pagamento do gap main NÃO comprovados; original ausente mantém NO-VERDICT                                                  |
| WP6  | Namespace aleatório do selftest, cleanup nominal, preservação de ref homônima e recusa de PASS quando cleanup falha                                                                                      | Cinco cenários fictícios PASS em memória e Secret Service/clipboard reais; Hello/ListNames Node/nativo concordam. Captures/sidecar-cofre.txt. Nenhuma chave real emitida, ativada ou revogada                                                                                              |
| WP7  | Consulta contextual e retomada na equipe correta; banco privado de metadados                                                                                                                             | Equipe proprietária Vercel404/ausente no seletor; AWS exige IAM Sign-in. Equipe informada pelo operador; conta/bucket/região/custo não inventados. SQLite privado sem credenciais; runbook c28-contextual-operations                                                                       |
| WP8  | Collector real em dois clusters PG17 novos, arquivo custom restaurado e inventário integral conciliado                                                                                                   | LOCAL-FIXTURE-PASS5701ms, seis tabelas/sete superfícies iguais; source4produtos/archive3 após writer. Identidade/SELECT recusados antes do dump e ACL alterada detectada. Containers e rede próprios ausentes. Sem AWS/login real/chave independente/timer/RPO-RTO operacional             |

DBT81(lifecycle) e DBT82(refs do selftest) estão EM_TRATAMENTO com provas locais e
propostas para MAESTRO. DBT36/76/80 receberam evidência atual; nenhuma closure
externa inventada. Os37 testes adicionados estão no gate final. O grupo
Sonar/coverage teve ainda120 testes focados em fase anterior.

## 3. Correções do autor e REDs

Gate r1 parou em no-unsafe-finally; r2 teve somente registry fora da tabela
(descobertos65/validados63); r3 passou depois das correções, conservando os controles.
Capturas check-red-lint.txt/check-red-registry.txt. Logs detalhados das demais fases
em `.codex/artifacts/ciclo-28/`.

Oito achados nesta rodada: ciclo de import bare Node; expectativa antiga do path
YAML; tipos do transporte/paging; comparação Buffer/Uint8Array no novo teste;
throw em finally; registry fora da tabela; Unix socket incompatível com Docker
Desktop; porta ausente na rede internal e cleanup acoplado à precondição funcional.
Corrigidos antes do S6, com precondições/saídas e ausência da bancada preservadas.
KPI desta rodada: **8capturados pelo autor /8achados conhecidos**. Total final e
densidade S6 não medidos. Esses itens não recebem CORR/N do S6, nem se confundem
com as63ocorrências estáticas recebidas.

## 4. Riscos e bloqueios observados

Release NO-GO. Em2026-10-03T19:55Z: Vercel live/ready/session200 com contrato JSON;
Hostinger live200/ready503/session500; domínio canônico entrega HTML nas três APIs
apesar de200. Captures/runtime-current.txt registra escalares/hash, sem body.
Esses GETs anônimos não provam login/tenant/revisão publicada.

Seis rotações Via A, contratos protegidos Context7/DeepSeek, integração no projeto
Vercel proprietário e branch residual br-snowy-cake-ayyl3tdt pendentes. Neon
Disconnect somente interrompe sincronização de env, não remove integração inteira.
Conta principal/custódia, bucket, região e orçamento aprovado AWS não observados.
SQLite local privado conserva null e origem/classificação; não é cofre ou banco Neon.
PITR observado anteriormente6h: sem prova nova de7d/histórico retroativo. S3/VM/timer,
Auth/login, RPO/RTO e perda de conta/provedor exigem qualificação externa ADR039/040.

Mapping Sonar autenticado e LCOV original do analysisId são indispensáveis para
crédito main. PR100% ou gate verde sem condição coverage, agregado e fixture não
substituem. A seção8 reconcilia CI/DB/RLS/matriz PR da fonte6fcba0d e o drill6.4.0 da fonte482e577.
Mapping main, runtime operacional e S6 integral seguem pendentes de promoção. Somente develop/main publicados e dois Neon permanentes;
cópias CI são recursos efêmeros com expiry24h e ausência nominal comprovada.

## 5. Checklist anti-vacuoso demonstrado pelo autor

| #   | item                     | demonstração/status                                                                                                                    | origem                                                         |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Controle negativo        | Baseline/identidade/cleanup antigos reprovam; CLI distingue gain/loss/unidade antiga; collector recusa identidade/SELECT e detecta ACL | Testes adapter/resource/api/readout/ci-coverage; collector.txt |
| 2   | Fronteira nos dois lados | Piso80%,freshness30min,TTL24h e identidades válidas/divergentes; ciclo permanece<300s                                                  | Testes mirror/resource; collector5701ms                        |
| 3   | Identidade               | Git/analysis/task/fonte/instrumentação/PR/branch/run/attempt/parent e IDs permanentes exigidos; contagem não decide cleanup            | Contratos/negativos; atestação remota37152161806 na seção8     |
| 4   | Sintoma e exit           | Unidades conciliadas/paridade real;0/1/2 CLI;200HTML reprovado; IDs próprios ausentes                                                  | Bare Node test e runtime-current/collector.txt                 |
| 5   | Sincronização            | PID1=postgres e pg_isready, status/provider observados; sem sleep fixo como prova                                                      | Harness e CE/resource; sessão externa ausente bloqueia         |
| 6   | Não degenerado           | Tenants A/B, três produtos, writer real e hashes distintos; ausência não paga coverage                                                 | Git/source fixtures e collector                                |
| 7   | Estado compartilhado     | Imagem/revisão/database/role conferidos, duas portas distintas fora5432, labels/rede antes de conectar                                 | Collector e custódia934arquivos                                |
| 8   | Sentinela real           | Source4/archive3, REVOKE gera delta, marca fictícia plantada derruba audit, ref homônima preservada                                    | Collector/sidecar e testes                                     |
| 9   | Fingerprint              | Hash dos arquivos de código/config/teste e capturas; run antigo não aprova patch novo                                                  | code-hashes.txt e MANIFEST.sha256                              |
| 10  | Descoberta completa      | Paginação e vazio/dup/truncamento negativos; todas seis tabelas e17itens; manifest não vazio                                           | Testes provider/inventário PG17/conferência estrita            |
| 11  | Contexto limpo S6        | S6 integral NOT-STARTED; reviews independentes limitados declarados na seção8                                                          | Seção7/journal; bloqueio de promoção                           |
| 12  | Fail-closed              | Auth/transport/ambiguidade/LCOV unknown/drift/cleanup falho não viram verde                                                            | Testes negativos e CLI0/1/2                                    |
| 13  | Bancada                  | WIP íntegro, Git fixtures próprias/PG17 novos; cleanup independente de porta/TTL/DB_URL                                                | custody-recheck/collector-r3-cleanup/collector                 |
| 14  | Gate e captura           | Fullcheck/REDs/workers/cofre/collector/runtime/triagem têm origem e captura                                                            | Captures/artefatos privados; números por fase                  |
| 15  | CI por revisão           | Fonte6fcba0d vinculada aos runs da seção8; mirror NO-VERDICT e SHA documental separado                                                 | Handoff publicação/CI; não há promoção                         |
| 16  | Multi-sítio              | Todos workflows auditados, arquivos/linhas provider paginados, schemas/tabelas não internos descobertos                                | m02-ci-coverage/collectMetadata/postgresSnapshot/runbook       |
| 17  | Ambiente                 | Auth ausente precondição; Git/deps/fingerprint/daemon/imagem/ownership conferidos; teste Git cria fixture própria                      | APIs/provenance/runner/resource/harness                        |

## 6. Rollback e retomada

Rollback por commit novo em develop com gate local, sem reescrever histórico ou
limpar WIP. Bancadas removem apenas IDs próprios; falha preserva receipts. Main e
produção não foram alvos de teste/restore. Não apagar lock real/repetir upload incerto.
Retomar PROGRESS/state check e reconciliar refs/CI/painéis antes de agir. Metadados
privados não autorizam compra, credencial, grant, purge, DNS, merge ou cutover.

## 7. S6 ADVERSARIAL

NOT-STARTED para o C28 integral. CORR não medido; N não medido; densidade não medida.
Os reviews limitados descritos na seção8 não produzem um veredito S6 integral.
Bloqueios operacionais e de cobertura impedem encerramento/release. O item15 teve
delta remoto na retomada, por revisão e por gate, sem transformar mirror em verde.

## 8. Retomada operacional e repair do readout

Fonte publicada: `6fcba0d1f0be3aec6683d738553deee7177bdc8b`, descendente de
`482e5771398506f261bace605e1b627aa7267147`. Commit e push normais foram aceitos
nesta execução, sem desativar ou contornar hook. O commit482e577 já incluía o
probe do parser. O repair corrige a consulta ao contexto para
`api/ce/task?additionalFields=scannerContext`, confere revisão/PR/branch e rejeita
contexto ausente, duplicado, conflitante ou contaminante. Somente a identidade
selecionada é persistida; o contexto bruto do scanner não é persistido. Main tem
atribuição explícita somente no ramo autorizado do workflow; PR conserva sua
atribuição própria. O texto confirm do drill acompanha a validação existente.

O gate integral do fork foi conferido nos bytes desta fonte:128suítes,
1640PASS/14skip/1654total, build e bundle PASS. SHA256 do log e hashes dos quatro
arquivos reparados estão em `captures/resume-quality-gate.txt` e
`captures/resume-source-hashes.txt`. Os reviews independentes de contexto limpo
verificaram o patch e a coerência da atestação de cleanup; seus handoffs e limites
estão em `captures/resume-reviews.txt`. Esses reviews não reexecutaram o circuito
nem constituem S6 integral.

| Gate da fonte6fcba0d             | observação N1                 | conclusão e limite                                                                                                                |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| UI push37159504312               | SUCCESS,5m9s                  | Chromium+mobile; tier DB pulado explicitamente por escopo                                                                         |
| UI PR37159506187                 | SUCCESS,7m20s                 | Matriz chromium/firefox/webkit/mobile; checkout de integração `ffcd0f89ebb517750a9a035ee080f5be646bb9ed` distinto do head         |
| Neon PR37159506174               | SUCCESS,6m32s                 | Migrations/integração/RLS/E2E na cópia; cleanup atesta GET404 de `br-morning-band-ay4xfzfz`                                       |
| CI lights37159504345/37159506170 | SUCCESS                       | Gates light, com escopo próprio; não substituem heavy                                                                             |
| Sonar37159506193 scan            | SUCCESS,3m13s                 | CE OK, analysisId `bcaf5573-af0d-4d18-8f02-b98b484ba736`, PR60/develop, revisão do checkoutffcd0f8; new_coverage100% da PR        |
| Sonar37159506193 mirror          | FAILURE,18s; exit2 NO-VERDICT | Downloads de LCOV/identidade candidato e LCOV original passaram; adapter/mirror sem mapping/provenance completo, sem crédito main |

O readout resolveu o404 e as cascatas de ausência dos artefatos candidatos. A
baseline main continua vinculada ao SHA `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`
e analysisId `1dc2baf9-b289-42f4-b2ca-dd7b662b3679`:1894/2995 unidades cobertas,
63.23873121869783%, déficit502 para80%. A definição de período continua30dias.
O workflow nesse SHA de main arquiva somente `coverage/lcov.info`; não gera
`coverage/lcov-provenance.json`, conforme blob Git conferido em
`captures/resume-main-producer.txt`. O download UI dos novos ZIPs não concluiu;
nenhum digest de ZIP foi declarado conferido localmente. O motivo específico
do catch do adapter não foi recuperado do artefato; a evidência direta é o
NO-VERDICT de mapping/provenance. Não há fallback por agregado.

O drill autorizado37152161806, na fonte482e577, tem atestação sanitizada coerente:
prepare→create/adopt→connections→cleanup, TTL final24h, ID
`br-sweet-bonus-ayf7s78f`, DELETE aceito, GET404 e ausência por ID/nome. O script
permite corrigir a expiração por PATCH; o recibo não prova TTL nativo da action6.4.0.
O inventário N1 após o Neon PR permanece com três branches: production(default),
develop e `preview/dependabot/npm_and_yarn/tailwind-merge-3.7.0`, ID
`br-snowy-cake-ayyl3tdt`, criada por Vercel. **ERRATA do handoff:** permanentIds do
cleanup é o conjunto obrigatório de permanentes, não o inventário completo;
o drill não deixou somente duas branches. Identidade e limites estão em
`captures/resume-provisioning.json`.

Conta de custódia/região/bucket/orçamento continuam sem observação autorizada no
painel autenticado; valores null e origens permanecem no SQLite privado. As abas
da equipe Vercel proprietária e AWS aguardam entrada humana Via A. O procedimento
continua em `docs/runbooks/c28-contextual-operations.md`; esta seção é recibo de
operação, sem alterar o procedimento. Main permanece congelada, PR60 aberta e
release NO-GO. Esta retomada usa dois commits de engenharia e um marco documental
do teto13; reserva para promoção/back-merge permanece separada.

Os dois tópicos de review da PR60 (`2820999532`/`2820999536`) foram resolvidos
após conferência das correções e controles negativos na fonte6fcba0d. O painel
confirmou Show resolved em cada identidade; nenhuma mensagem/comentário foi enviado.
O merge continua bloqueado por mirror e protected ref. Recibo em
`captures/resume-review-threads.json`. Gate local desta consolidação:128suítes,
1640PASS14skip, exit0; `captures/resume-doc-quality-gate.txt`.

## 9. Lote 1 — publicação dos testes e ausência de DA

Base reconciliada desta fase: develop `ba9c2c2b5357a588bee0ea62f3886110b1d75f9d`,
main `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`, PR60 aberta. O lote preparado
acrescentou oito testes da superfície pública describeAuthEnv e um caso do adapter.
Os resultados anteriores de CI não são checks deste lote; nova execução é exigida
depois de publicar. C28 passa de3 para4/13 neste marco de engenharia; duas reservas
de promoção/back-merge permanecem disponíveis.

A revisão independente limitada rejeitou dois pontos do patch staged original:
o adapter aceitava uma linha Sonar não coberta sem DA, mas o mirror ainda recusava
essa unidade; e o mirror aceitava uma condição baseline não coberta sem BRDA no
candidato. O segundo caso produzia PASS80% com identidade incompleta. O controle
do autor reproduziu ambas as falhas antes da correção. A exceção foi restringida,
nos dois lados do mirror, a unidade de linha já declarada não coberta pela baseline.
DA ausente não gera ganho; pagamento exige hit medido. DA de unidade coberta
ausente, BRDA ausente e BRDA desconhecida continuam reprovando, e perda medida
continua subtraindo. Três novos casos do mirror e o caminho adapter→mirror cobrem
essa fronteira. Não houve alteração de limiar, freshness, fonte, instrumentação,
período, denominador, required check ou proteção de main.

O alvo deste lote é auth-policy.ts. A medição integral de cobertura passou:
128suítes,1652PASS/14skip/1666total. No arquivo overall,61/62DA e66/68BRDA
estão cobertos; esse conjunto inclui unidades antigas e não é o recorte new
do Sonar. Registro exato e hashes em `captures/payment-coverage.txt`. O relato do operador em L630 descreve
62/65 unidades locais e uma estimativa residual440; isso não é crédito validado
do espelho. O déficit autoritativo de main continua502 até mapping/provenance
completos e veredito atual. O bootstrap permanece decisão pendente do MAESTRO.

O primeiro ensaio integral de cobertura falhou em uma expectativa de fixture
do novo negativo e na construção de um pacote Debian: umask077 do agente criou
o diretório de controle com700. A expectativa foi corrigida preservando a unidade
baseline não coberta, e o ensaio seguinte usa umask022 com logs privados0600.
Nenhuma regra ou teste foi removido. O check integral passou nos bytes finais:
128suítes,1652PASS/14skip/1666total, build e bundle PASS. Comando e hash do log
em `captures/payment-quality-gate.txt`. A custódia principal conservou934arquivos
sem alteração, perda ou novo untracked; a bancada é o único checkout mutado.
Os controles e os reviews limitados estão em `captures/payment-negative-control.txt`,
`captures/payment-targeted.txt` e `captures/payment-reviews.txt`. Os hashes finais
de fonte estão em `captures/payment-source-hashes.txt`; S6 integral continua
NOT-STARTED. O inventário nominal N1 agora mostra somente production/develop
em `captures/payment-neon-inventory.txt`; isso não prova prevenção de recriação
ou os bytes da operação DELETE relatada por outra lane. L625–L633 são handoffs históricos preservados nesta fase;
observações do operador fora desta lane não recebem verificação remota implícita.
