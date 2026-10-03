# Recuperação independente — preparação e prova

ADR-039 autoriza S3 em conta segregada, Versioning e Object Lock Compliance
por pelo menos 35 dias. Esta ferramenta prepara custódia criptográfica; nenhum
status dela fecha BAK-01/DBT-75 ou aprova produção. A criação/contratação da conta,
bucket e entrada/submissão das credenciais e chaves ficam com o humano Via A.

## Pré-condições

Usar Node24 e AWS CLI v2 oficial, PostgreSQL17 `pg_dump`/`pg_restore`/`psql`
e bancada de restore isolada. Ferramenta ausente é precondição, nunca prova.
AWS CLI e clientes PostgreSQL não estavam disponíveis como executáveis da estação
em2026-10-03. O ensaio local abaixo usou clientes de uma imagem Docker PG17
oficial com digest fixado; nenhum upload ou dump de dados reais foi executado.
O candidato deve passar `npm run check` antes de execução operacional.

O JSON de configuração contém somente `bucket`, `region`, `primaryAccountId`,
`recoveryAccountId` e `prefix`. Os dois IDs AWS de12dígitos precisam ser distintos;
o perfil AWS ativo é o da conta de recuperação. O teste de STS e todos os pedidos
S3 usam identidade explícita/expected-owner e endpoint oficial com TLS.
Não inventar IDs quando a identidade da conta principal ainda não estiver reconciliada.

O bucket deve ter Versioning Enabled, default fixed Compliance>=35dias,
BlockPublicAccess completo, BucketOwnerEnforced e SSE-S3 AES256. Além desta
criptografia do S3, há AES256GCM local com chave aleatória32bytes em cofre
independente da conta principal. SSE-KMS exige caminho de custódia/recuperação
de chave separado e não é aceito silenciosamente por este primeiro adaptador.
Quem escreve backups não precisa de DeleteObject/DeleteObjectVersion nem de
BypassGovernanceRetention. A ferramenta não concede permissões, muda bucket
ou encurta retenção. A política IAM/bucket efetiva e a independência do cofre
precisam de evidência externa; STS não as demonstra.

## Snapshot e criptografia

O operador obtém um dump custom PostgreSQL17 por conexão **direta**, com senha
em `PGPASSFILE` privado/credencial injetada, sem URL em argumento/log. A leitura
do snapshot é autorizada e não executa migrations/testes/fixtures na produção.
Guardar timestamp do snapshot/export, revisão e inventário na própria captura.
`pg_dump` inclui ownership/ACL; não usar `--no-owner`/`--no-privileges` para
disfarçar uma divergência. Roles globais não pertencem ao dump do database:
obter catálogo/definições sem passwords, revisar roles de serviço Neon e preparar
papéis compatíveis somente no restore isolado. Incluir schemas de Auth e ledger
de exclusões conforme a origem; a comparação existente public/drizzle, sozinha,
não comprova esses schemas adicionais.

O arquivo custom começa por PGDMP; reconhecer esse magic **não** prova snapshot
válido. `metadata.json` contém exatamente schema=`independent-backup/1`,
backupId UUIDv4, sourceRevision SHA40 real, snapshotAt UTC ISO e keyId nominal.
Nenhum segredo, row/PII ou password entra neste JSON. Diretórios de saída devem
ser novos; dumps/chaves/arquivos precisam ser regulares, próprios e privados.

```bash
node scripts/ci/independent-backup.ts seal --input /private/snapshot.pgc --key-file /private/recovery-key --metadata /private/metadata.json --directory /private/sealed-new
node scripts/ci/independent-backup.ts preflight --config /private/recovery-config.json --directory /private/preflight-new
node scripts/ci/independent-backup.ts upload --input /private/sealed-new/backup.pqdl --config /private/recovery-config.json --directory /private/upload-new
```

PUT é condicional (`If-None-Match:*`), tem SHA256 e retenção explícita35dias+1min.
A confirmação exige `VersionId`, HEAD com checksum/tamanho/encryption e leitura
da retenção **dessa versão**. Não usar ETag ou existência de um objeto como prova.
Recibos append-only distinguem INTENT, UPLOADED-UNVERIFIED e
LOCKED-CIPHERTEXT-VERIFIED. Falha preserva o recibo para reconciliar o key/version
antes de repetir; não há retry automático nem descarte de objeto remoto.
Limite desta rota: PUT único até4GiB; multipart requer validação própria.

## Restore e métricas

Na conta/cofre de recuperação, recuperar a **versão registrada**, com expected
owner, conferir retenção/encryption e SHA256 do ciphertext. Credencial de leitura
e acesso à chave devem funcionar no cenário de perda da conta principal.
Descriptografar localmente antes de qualquer SQL:

```bash
node scripts/ci/independent-backup.ts open --input /private/downloaded-version.pqdl --key-file /private/recovery-key --directory /private/opened-new
```

GCM autentica header/conteúdo; corrupção/chave errada recusa e remove o arquivo
parcial. `verified.pgc` só aparece depois da autenticação. Isso ainda não prova
restore: rodar pg_restore17 com `--exit-on-error`, owner/grants preservados, em
PG17 efêmero identificado e vazio. Nunca production/develop como alvo de teste.
Conferir dados, todos os schemas necessários/Auth, journal por hash, ownership,
grants, RLS/tenant e reaplicar ledger de exclusões. A ferramenta
`scripts/db/backup-verify.ts` pode comparar public/drizzle, declarando o limite;
as demais superfícies e login precisam de seus próprios controles positivos/negativos.

Medir RPO pela última escrita recuperável versus incidente e RTO do início do
incidente até serviço restaurado validado. Exigir RPO<=15min e RTO<=4h por cenário.
Backup diário35dias oferece outra cadência; não demonstra RPO15min nem substitui
PITR7d observado. Agendar a coleta diária na conta segregada apenas após primeiro
dump+upload+restore completos e alertar backup ausente. Repetir teste de perda da
conta principal/chave recuperada sem dependência dela. Sem agendamento ou drill
observado, registrar NOT-STARTED/BLOCKED, não DONE.

## Executor frequente — preparação ADR-040

O plano de 2026-10-03 adiciona snapshots de cinco minutos ao diário. A VM deve
estar na conta AWS segregada e região do bucket, com Ubuntu24.04 x86, disco
cifrado, um executor e Session Manager sem inbound SSH. t3.small é capacidade
inicial sujeita a custo aprovado e benchmark; não há VM ou bucket identificado
nesta sessão. Não usar object storage interno do Neon como recuperação independente.

A implementação C08 será executada somente após qualificação externa atual.
Não instalar timer a partir do ensaio sintético abaixo. Exigir Node24, AWS CLIv2
oficial e clientes PG17 com versões capturadas. O ciclo usa conexão direta,
papel nominal de backup, PGPASSFILE privado e TLS verify-full; env/recibos só
carregam nomes e identidades. DATABASE_ADMIN_URL permanece fora do processo web.

Antes da qualificação, executar a cadeia manual ADR-039 e recuperar as versões
registradas; comparar também schemas Auth/ledger e roles/memberships sem passwords.
O comparador public/drizzle não satisfaz descoberta completa. Medir o ciclo
até ambos os uploads verificados <300s, impacto/egress/custo de 288 snapshots/dia,
RPO<=15min e RTO<=4h em cada cenário, incluindo perda da conta principal e login.
A chave precisa de custódia própria recuperável e a conta não depende do Neon.

O timer preparado não será habilitado automaticamente. Kalender de cinco minutos,
oneshot e lock exclusivo recusam overlap; Persistent=false não acumula eventos
perdidos. Diretório/recibos são privados, append-only e exclusivos por backupId.
Upload incerto preserva INTENT/versão, exige reconciliação, nunca retry cego.
O primeiro par durável de cada data UTC ancora também o diário de35dias.

Alertar pela idade do snapshot recuperável, não pela idade do job: WARN>=600s,
INCIDENT>900s. Sem recibo durável ou com clock rollback, UNKNOWN/BLOCKED. Ao
registrar incidente, manter sua disposição mesmo após um snapshot saudável.
Um monitor independente deve observar falha de timer/VM; não depender do executor
que deixou de funcionar para anunciar sua própria ausência.

PITR7d foi solicitado autonomamente em2026-10-03. A API recusou HTTP400:
requested604800/max21600. A retenção continua seis horas; plano permitido e custo
são precondições. A configuração nova, quando possível, não cria histórico retroativo.

## Ensaio local medido C27

Custódia privada em .codex/artifacts/ciclo-27/local-recovery-qualified/result.json.
Dois containers novos PG17, network=none e sem portas publicadas, tinham dados
sintéticos em seis tabelas public/drizzle/neon_auth. Dumpcustom real da fixture,
GCM/open com bytes iguais e pg_restore--exit-on-error passaram; ownership/grants,
journal, hashes, roles/policies e isolamentoRLS foram comparados. TenantA/B
positivo/negativo, leituraAuth negada ao runtime e REVOKESELECT detectado/reposto
passaram. Os dois IDs foram descartados e sua ausência conferida.

ERRATA do harness: a primeira comparação usava databases source e restore e
serializava table_catalog dos grants. Diagnóstico separado preservou o diff:
43 diferenças só nesse campo. A revisão usou database fixture nos dois clusters
distintos, sem excluir campo nem afrouxar o comparador. Recibos anteriores
permanecem preservados, incluindo a primeira falha de precondição e a revisão
que não capturou o inventário antes de falhar.

LOCAL-FIXTURE-PASS: validação3,064s, ensaio8,162s. Esses tempos não são RTO de
produção. Não houve escrita durante o dump; não há medição RPO de produção.
Este positivo não cobre BetterAuth real, restore do S3, PITR7d, custódia da
chave no cofre segregado, agendamento diário ou cenário de perda do provedor.
DBT-75/80 e BAK-01 continuam abertas até esses controles observados.

Fontes primárias:
[pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html),
[S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html),
[PUT condicional/checksum/retention](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-object.html),
[HEAD por versão](https://docs.aws.amazon.com/cli/latest/reference/s3api/head-object.html).

## Ciclo implementado e units preparadas — C09

`node scripts/ci/backup-cycle.ts run --config /etc/pqdl-backup/config.json` executa
um ciclo qualificado. `status` com o mesmo argumento avalia a idade do recibo;
`units` prepara arquivos em `<stateDirectory>/units`, sem instalar/habilitar timer.
Não executar `run` na estação com credencial de produção nem inventar qualificação.

Configuração privada `backup-cycle-config/1`: `recovery` segue ADR039; `source`
contém `projectId`, `branchId`, `endpointId`, `database`, `role`, `revision`,
`keyId`, `requiredSchemas` e `exclusionLedger` nominal. Exigir public/drizzle/neon_auth,
ledger realmente descoberto e papel dedicado de backup (app_runtime/admin recusados).
Paths absolutos normalizados: `keyFile`, `qualificationFile`, `stateDirectory`,
`codeDirectory`, `nodeExecutable`, `environmentFile`. Instalar o código aprovado em
/opt, fora de /home; criar usuário pqdl-backup e diretórios privados700, arquivos600.
As units recusam caminhos em /home, /root, /tmp, /var/tmp e /run/user: ProtectHome
e PrivateTmp tornam esses locais incompatíveis com a execução isolada do serviço.
Nenhuma contratação, usuário IAM ou grant SQL é criado pelo script.

No EnvironmentFile privado, o operador configura somente PGHOST direto, PGUSER
nominal de backup, PGDATABASE, PGPORT5432 e PGPASSFILE privado. Senha não é argumento;
PGPASSWORD é recusado. A origem deve conferir neon.project_id/branch_id/endpoint_id,
PG17 e transação READ ONLY. pg_dump17 conserva owners/ACL e compartilha o snapshot
exportado com o inventário. Node usa TLS com validação; libpq usa verify-full.
Role administrativa e DATABASE_ADMIN_URL continuam fora do processo web.

A descoberta inclui todos os schemas não internos, tabelas/materialized views,
catálogo de roles/memberships sem passwords, ownership/ACL direto do pg_catalog,
colunas, tipos, policies, constraints, índices, functions, triggers e journal.
A ACL direta evita depender da visão filtrada por papel de information_schema.
Valores de sequence pertencem ao dump; foreign tables/large objects são recusados
por falta de inventário qualificado específico. Banco restaurado precisa do mesmo
nome para comparar campos de catálogo, em cluster/branch isolado distinto.
Roles/database grants globais e serviço Auth exigem custódia e ensaio próprios.

Qualificação privada `backup-qualification/1`: phase=EXTERNAL-RESTORE-VERIFIED,
`source` e `recovery` idênticos ao config; completedAt UTC de no máximo30dias,
evidenceSha256 do conjunto de evidências; cycleSeconds>0 e<300; `versions`
com os dois recibos LOCKED-CIPHERTEXT-VERIFIED. `scenarios.providerLoss` e
`scenarios.mainAccountLoss` exigem restoreTarget isolado, rpoSeconds0–900,
rtoSeconds>0–14400, e checks PASS: inventory/authLogin/journal/ownership/grants/
rls/exclusionLedger/independentKey/revision. Esses campos são resultados de um
ensaio externo observado, não uma autorização fabricável por fixture local.
O runner revalida conta/bucket e as versões do ensaio antes de coletar.
`restoreTarget` identifica a VM do ensaio por ARN EC2, na conta de recuperação e
região aprovadas. Outra branch Neon, conta principal, região diferente ou ID de
VM ausente são recusados. O ARN não prova o ensaio sozinho: isolamento do banco,
inventário, Auth e perda de acesso precisam das evidências externas completas.

Dump é enviado/verificado primeiro; o inventário cifrado inclui o recibo dessa
versão e o hash do plaintext, para reconstruir o par após perder a VM. Somente
após verificar também o inventário surge DURABLE/latest.json. Recibos são fsync
append-only; latest é pointer atômico. Após sucesso, remover somente os quatro
arquivos temporários gerados, mantendo recibos. Falha preserva lock/custódia;
não apagar lock/repetir upload até reconciliar INTENT, key e VersionId.

A primeira coleta durável de cada data UTC ancora o diário. Instalação/ativação
systemd e alarme fora da VM são etapas operacionais pendentes. `status` retorna
0 HEALTHY,1 WARN,2 INCIDENT/UNKNOWN e conserva eventos em incidents.jsonl;
um positivo posterior não remove eventos nem resolve o incidente. Conectar
esse contrato ao monitor independente e verificar falha da VM/timer nesse monitor.

Ensaio do collector nativo C09: duas tentativas interrompidas antes do dump por
precondições da bancada Docker (porta não anunciada e criação de database recusada).
Todos os recursos efetivamente criados foram descartados e a ausência conferida;
a segunda tentativa criou apenas um dos dois containers previstos. A causa SQL
exata não foi preservada, portanto continua NO-VERDICT. O ensaio está escalado:
testes de ciclo/GCM/S3-fixture não comprovam a execução do collector PG17 com
escrita concorrente. Não ativar rotina contínua com essa lacuna. Capturas privadas
snapshot-drill-precondition-r1.json e snapshot-drill-cleanup-r1.json/cleanup.json
em .codex/artifacts/ciclo-27/continuation-2026-10-03/captures.
