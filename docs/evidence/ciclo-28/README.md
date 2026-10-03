# C28 — correções implementadas, release bloqueada

## 1. Resultado e revisão

Bancada `/tmp/pqd-develop`, sobre develop `66898f0d738717ecbf52cda1384017a0cc23e859`.
Checkout principal mantém `48ffb6bb8106c78781416ffd49fa8a906985f174`, cinco tracked
modificados e929 untracked: comparação SHA256 de934arquivos encontrou zero mudanças,
adições ou ausências. Custódia do parser/journals: cinco entradas estritamente
conferidas em `.codex/artifacts/ciclo-28/custody/MANIFEST.sha256`.

`npm run check` integral PASS:128arquivos de teste,1636PASS14skips existentes,
1650total; suíte160.56s. Guards/formato/lint/tipos/build/bundle verdes. Captura
`captures/check-full.txt`; hashes de código/config/testes em `captures/code-hashes.txt`.
Sem ampliar timeout, orçamento, exclusões ou skips. Main remoto permanece
`d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`. C27continua11/13 com duas reservas;
C28teto13, três reservados. Autor propõe correções, sem promover placar ou release.

## 2. Mudanças e evidência por fase

| Fase | mudança                                                                                                                                                                                                  | evidência e limite                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP0  | Custódia, namespaces dos journals, parent66898f0 e bancada reconciliados                                                                                                                                 | Manifest privado cinco entradas PASS; state check PASS; captures/custody-recheck.txt                                                                                                                                                                                           |
| WP1  | Serialização local compartilhada test/coverage; CItrue/1 conserva paralelismo. Node24.21.0 e workflow Sonar pela .nvmrc                                                                                  | Três execuções completas anteriores126arquivos1599PASS14skip cada,0falhas,130.339–131.007s. Gate final acima mede os bytes atuais. Causa dos crashes indeterminada; mitigação não é diagnóstico causal ou estabilidade CI                                                      |
| WP2  | Triagem individual63ocorrências Mimosa, sem dedup ou PoC nessa fase                                                                                                                                      | 62not_actionable para alegações fornecidas,1needs_review (triage037, alvo arbitrário do CLI legado),0confirmed. Input inconclusive/partial sem SHA não virou gate verde. Artefatos geridos Codex Security, captures/security-triage.txt                                        |
| WP3  | Transporte sanitizado por origem fixa; fallback somente400/404/405, catálogo opcional não suprime probe. Baseline PR antes do scanner e main após CE; revisão fornecida pelo provedor                    | Negativos401/403/429/5xx/payload/transporte/revisão/PR/branch/ordem. Checkout e runner SHA separados. Auth/metadata insuficientes => NO-VERDICT; fonte/token não persistidos                                                                                                   |
| WP4  | Checkpoint antes de create, adoption por ownership independente de DB_URL/TTL, expiry24h e endpoint nominal; cleanup por ID e inventário paginado                                                        | 33testes locais e gate final PASS. Readiness/exercise-provisioning usam6.4.0 pinada; permanente/reuse/parent errado/ambiguidade recusados. Perda de output/URL/TTL conserva custódia. Exercício remoto do SHA novo PENDENTE; operações legadas não reclassificadas             |
| WP5  | Adapter descobre todas as páginas/linhas e concilia unidades/condições com LCOV original do analysisId de main. Provenance inclui sensor/fonte/instrumentação/período/hashes. CLI recebe artefatos reais | Bare Node CLI em Git fixture própria PASS0/FAIL1/NO-VERDICT2; gain/loss/old-line, origem, período, hash e freshness30min negativos. Mapping autenticado atual e pagamento do gap main NÃO comprovados; original ausente mantém NO-VERDICT                                      |
| WP6  | Namespace aleatório do selftest, cleanup nominal, preservação de ref homônima e recusa de PASS quando cleanup falha                                                                                      | Cinco cenários fictícios PASS em memória e Secret Service/clipboard reais; Hello/ListNames Node/nativo concordam. Captures/sidecar-cofre.txt. Nenhuma chave real emitida, ativada ou revogada                                                                                  |
| WP7  | Consulta contextual e retomada na equipe correta; banco privado de metadados                                                                                                                             | Equipe proprietária Vercel404/ausente no seletor; AWS exige IAM Sign-in. Equipe informada pelo operador; conta/bucket/região/custo não inventados. SQLite privado sem credenciais; runbook c28-contextual-operations                                                           |
| WP8  | Collector real em dois clusters PG17 novos, arquivo custom restaurado e inventário integral conciliado                                                                                                   | LOCAL-FIXTURE-PASS5701ms, seis tabelas/sete superfícies iguais; source4produtos/archive3 após writer. Identidade/SELECT recusados antes do dump e ACL alterada detectada. Containers e rede próprios ausentes. Sem AWS/login real/chave independente/timer/RPO-RTO operacional |

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
substituem. CI do patch novo, exercício6.4.0, DB/RLS/matriz PR atual, runtime e S6
seguem pendentes de promoção. Somente develop/main publicados e dois Neon permanentes;
cópias CI são recursos efêmeros com expiry24h e ausência nominal comprovada.

## 5. Checklist anti-vacuoso demonstrado pelo autor

| #   | item                     | demonstração/status                                                                                                                    | origem                                                         |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Controle negativo        | Baseline/identidade/cleanup antigos reprovam; CLI distingue gain/loss/unidade antiga; collector recusa identidade/SELECT e detecta ACL | Testes adapter/resource/api/readout/ci-coverage; collector.txt |
| 2   | Fronteira nos dois lados | Piso80%,freshness30min,TTL24h e identidades válidas/divergentes; ciclo permanece<300s                                                  | Testes mirror/resource; collector5701ms                        |
| 3   | Identidade               | Git/analysis/task/fonte/instrumentação/PR/branch/run/attempt/parent e IDs permanentes exigidos; contagem não decide cleanup            | Contratos/negativos; exercício remoto atual PENDENTE           |
| 4   | Sintoma e exit           | Unidades conciliadas/paridade real;0/1/2 CLI;200HTML reprovado; IDs próprios ausentes                                                  | Bare Node test e runtime-current/collector.txt                 |
| 5   | Sincronização            | PID1=postgres e pg_isready, status/provider observados; sem sleep fixo como prova                                                      | Harness e CE/resource; sessão externa ausente bloqueia         |
| 6   | Não degenerado           | Tenants A/B, três produtos, writer real e hashes distintos; ausência não paga coverage                                                 | Git/source fixtures e collector                                |
| 7   | Estado compartilhado     | Imagem/revisão/database/role conferidos, duas portas distintas fora5432, labels/rede antes de conectar                                 | Collector e custódia934arquivos                                |
| 8   | Sentinela real           | Source4/archive3, REVOKE gera delta, marca fictícia plantada derruba audit, ref homônima preservada                                    | Collector/sidecar e testes                                     |
| 9   | Fingerprint              | Hash dos arquivos de código/config/teste e capturas; run antigo não aprova patch novo                                                  | code-hashes.txt e MANIFEST.sha256                              |
| 10  | Descoberta completa      | Paginação e vazio/dup/truncamento negativos; todas seis tabelas e17itens; manifest não vazio                                           | Testes provider/inventário PG17/conferência estrita            |
| 11  | Contexto limpo S6        | NOT-STARTED, ausência declarada; autor não declara revisão independente                                                                | Seção7/journal; bloqueio de promoção                           |
| 12  | Fail-closed              | Auth/transport/ambiguidade/LCOV unknown/drift/cleanup falho não viram verde                                                            | Testes negativos e CLI0/1/2                                    |
| 13  | Bancada                  | WIP íntegro, Git fixtures próprias/PG17 novos; cleanup independente de porta/TTL/DB_URL                                                | custody-recheck/collector-r3-cleanup/collector                 |
| 14  | Gate e captura           | Fullcheck/REDs/workers/cofre/collector/runtime/triagem têm origem e captura                                                            | Captures/artefatos privados; números por fase                  |
| 15  | CI por revisão           | PENDENTE: nenhum run anterior atribuído ao patch atual                                                                                 | Handoff publicação/CI; não há promoção                         |
| 16  | Multi-sítio              | Todos workflows auditados, arquivos/linhas provider paginados, schemas/tabelas não internos descobertos                                | m02-ci-coverage/collectMetadata/postgresSnapshot/runbook       |
| 17  | Ambiente                 | Auth ausente precondição; Git/deps/fingerprint/daemon/imagem/ownership conferidos; teste Git cria fixture própria                      | APIs/provenance/runner/resource/harness                        |

## 6. Rollback e retomada

Rollback por commit novo em develop com gate local, sem reescrever histórico ou
limpar WIP. Bancadas removem apenas IDs próprios; falha preserva receipts. Main e
produção não foram alvos de teste/restore. Não apagar lock real/repetir upload incerto.
Retomar PROGRESS/state check e reconciliar refs/CI/painéis antes de agir. Metadados
privados não autorizam compra, credencial, grant, purge, DNS, merge ou cutover.

## 7. S6 ADVERSARIAL

NOT-STARTED. CORR não medido; N não medido; densidade não medida. Nenhum0REJECTED
ou VERIFIED independente inventado. Itens11/15 e bloqueios operacionais impedem
encerramento/release.
