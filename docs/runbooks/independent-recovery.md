# Recuperação independente — preparação e prova

ADR-039 autoriza S3 em conta segregada, Versioning e Object Lock Compliance
por pelo menos 35 dias. Esta ferramenta prepara custódia criptográfica; nenhum
status dela fecha BAK-01/DBT-75 ou aprova produção. A criação/contratação da conta,
bucket e entrada/submissão das credenciais e chaves ficam com o humano Via A.

## Pré-condições

Usar Node24 e AWS CLI v2 oficial, PostgreSQL17 `pg_dump`/`pg_restore`/`psql`
e bancada de restore isolada. Ferramenta ausente é precondição, nunca prova.
AWS CLI e clientes PostgreSQL não estavam disponíveis na estação em2026-10-03;
nenhuma instalação, upload ou dump real foi realizado por esta implementação.
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

Fontes primárias:
[pg_dump17](https://www.postgresql.org/docs/17/app-pgdump.html),
[S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html),
[PUT condicional/checksum/retention](https://docs.aws.amazon.com/cli/latest/reference/s3api/put-object.html),
[HEAD por versão](https://docs.aws.amazon.com/cli/latest/reference/s3api/head-object.html).
