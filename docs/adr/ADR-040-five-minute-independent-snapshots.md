# ADR-040 — Snapshots independentes a cada cinco minutos

- Estado: ACEITA para preparação pelo plano autorizado em 2026-10-03; ativação condicionada às provas abaixo.
- Owner: MAESTRO.
- Dependências: ADR-039, DBT-75/80 e BAK-01. Complementa o backup diário.

## Decisão

O executor será uma VM Ubuntu 24.04 x86 na conta AWS de recuperação, na região
do bucket, inicialmente t3.small e disco cifrado. Administração por Session
Manager, sem portas de entrada. Contratação, custo e custódia da identidade/chave
continuam precondições humanas; infraestrutura AWS interna do Neon não é essa conta.

Uma execução a cada cinco minutos exporta um snapshot PostgreSQL 17 READ ONLY,
usa esse mesmo snapshot no inventário e em pg_dump custom, preservando schemas,
ownership e ACL. Descoberta inclui todos os schemas não internos, especialmente
Auth e ledger de exclusões; roles e memberships são inventariadas sem passwords.
O dump não contém roles globais. Se identidade, permissões ou superfícies exigidas
não forem comprovadas, a execução falha antes de publicar recibo durável.

Dump e inventário terão envelopes GCM distintos e autenticados, vinculados pelo
backupId, timestamp, revisão e hash do dump. Os dois objetos precisam de versões,
checksum e retenção Compliance >=35 dias verificados, usando o adapter ADR-039.
Somente o par verificado avança o último snapshot durável. O inventário cifrado
permanece recuperável fora da VM e não aparece nos recibos públicos.

O timer systemd usa calendário de cinco minutos, Persistent=false e serviço
oneshot, sem fila nem retry automático. Um lock exclusivo recusa execução
concorrente; falha/crash preserva custódia para reconciliação, sem roubar lock.
O ciclo inteiro deve durar menos de 300 segundos; PUT único limita cada envelope
a 4 GiB. Falha/timeout/upload incerto não recebe sucesso nem retry cego.

A primeira execução durável de cada data UTC também é a âncora diária, com a
mesma retenção. Não criar um segundo dump concorrente para cumprir o diário.
Monitor independente consulta a idade pelo snapshotAt recuperável: WARN em
600 segundos e INCIDENT acima de 900. Ausência, relógio regressivo e estado
incompleto são UNKNOWN/BLOCKED, nunca idade zero. Sucesso posterior não apaga
incidente registrado.

## Gate de ativação

Antes de instalar/ativar o timer, exigir uma qualificação nominal e atual do
mesmo projeto, branch, papel, revisão, conta, bucket e região. Ela aponta para
versões S3 verificadas e demonstra dump-upload-download-restore isolado, inventário
completo, Auth/login, journal, ownership/grants, RLS, ledger e custódia da chave
na perda da conta principal. Exigir ciclo <300s, RPO <=900s e RTO <=14400s por
cenário. Ensaio sintético local não produz essa qualificação operacional.

Não conceder IAM ou BYPASSRLS por esta ferramenta; preparar papel de backup
somente leitura e acesso completo pelo operador, sem ampliar app_runtime.
Produção pode ser origem autorizada de backup READ ONLY, nunca alvo de testes,
restore ou migrations. Os guards existentes permanecem intactos.

## Limites e rollback

Código/units preparados não comprovam VM contratada, S3 real, restore externo,
PITR de sete dias ou RPO/RTO em produção. Mudança de sourceRevision/identidade
invalida a qualificação. Desabilitar timer interrompe coleta futura; versões
Compliance já produzidas não são removidas. Publicação permanece bloqueada.

Fontes primárias: [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html),
[snapshot exportado](https://www.postgresql.org/docs/17/functions-admin.html),
[Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html),
[Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html).
