# Evidência — Verificação hPanel Hostinger Cloud Startup

Data do registro: 2026-08-23

## Limite da evidência

Este checklist só pode ser marcado `PASS` com valor observado no hPanel ou em
ambiente equivalente. Nenhum item é promovido por suposição, documentação de
terceiros ou analogia com o smoke local. Cada linha exige a evidência concreta
(captura de tela, log ou saída de comando) referenciada na coluna própria.

**Bloqueio atual (2026-08-23):** o plano Hostinger Cloud Startup ainda **não
foi adquirido**. O ambiente local/runbook está pré-preparado para o momento da
compra (`docs/runbooks/hostinger-cloud-node.md`,
`docs/evidence/hostinger-runtime-readiness-2026-08-23.md`), mas nenhum item
pode sair de `BLOCKED` até que a conta exista e a sessão assistida seja
executada. A justificativa vale para os 11 itens e não precisa ser repetida
por linha.

Referências: `docs/runbooks/hostinger-cloud-node.md`,
`docs/evidence/hostinger-runtime-readiness-2026-08-23.md`, Plano Mestre §20
(hardening de produção) e §42 (gate antes de Neon production).

## Checklist de verificação

| #   | Item                         | Critério de PASS                                                                                          | Valor observado | Evidência | Status    |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- | --------- | --------- |
| 1   | Versão do Node no hPanel     | `node --version` ≥ `24.15.0` (`.nvmrc`/engines)                                                           | —               | —         | `BLOCKED` |
| 2   | Comando de start customizado | hPanel aceita `npm run start` ou `node .output/server/index.mjs`                                          | —               | —         | `BLOCKED` |
| 3   | Injeção de porta             | Plataforma injeta `PORT` (ou aceita `NITRO_PORT`) e o valor chega ao processo                             | —               | —         | `BLOCKED` |
| 4   | Host de bind                 | `HOST`/`NITRO_HOST` compatível com o proxy da plataforma                                                  | —               | —         | `BLOCKED` |
| 5   | Processo persistente         | Processo Node permanece ativo após o deploy, sem sleep por inatividade                                    | —               | —         | `BLOCKED` |
| 6   | Reinício automático          | Processo é reiniciado após saída não zero ou falha                                                        | —               | —         | `BLOCKED` |
| 7   | Logs stdout/stderr           | Logs consultáveis, com retenção, sem secrets                                                              | —               | —         | `BLOCKED` |
| 8   | Timeout de proxy             | Timeout efetivo do proxy > 60 s, compatível com o chat (`AI_REQUEST_TIMEOUT_MS`)                          | —               | —         | `BLOCKED` |
| 9   | Saída TLS externa            | Egress HTTPS para Neon, Resend e gateway de IA sem bloqueio                                               | —               | —         | `BLOCKED` |
| 10  | Health checks HTTP           | `GET /api/health/live` → 200 e `GET /api/health/ready` → 200 via URL pública                              | —               | —         | `BLOCKED` |
| 11  | Credenciais e privilégios    | Variáveis secretas por ambiente; `DATABASE_ADMIN_URL` ausente do runtime web; limites da conta conhecidos | —               | —         | `BLOCKED` |

## Procedimento de verificação

1. Confirmar no hPanel a versão do Node disponível e o mecanismo de seleção
   (item 1). Se o máximo oferecido for inferior a `24.15.0`, registrar `FAIL`
   e interromper: o `engines` do projeto exige Node ≥ 24.15.0.
2. Configurar o comando de start (item 2) e as variáveis do runbook
   (`DATABASE_URL`, `DATABASE_DRIVER=node-postgres`, `BETTER_AUTH_URL`,
   `BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS`; nunca `DATABASE_ADMIN_URL`).
3. Subir o processo e observar os logs (item 7) para confirmar a porta/host
   efetivos (itens 3 e 4) e a persistência/restart (itens 5 e 6).
4. Executar `curl -i https://<dominio>/api/health/live` e
   `curl -i https://<dominio>/api/health/ready` (item 10). `ready=200` exige
   PostgreSQL externo já migrado; `ready=503` indica aplicação viva com banco
   indisponível.
5. Medir o timeout de proxy com uma requisição de chat controlada (item 8).
   Se ≤ 60 s, registrar `FAIL` e avaliar ajuste de `AI_REQUEST_TIMEOUT_MS` ou
   mudança de plano.
6. Validar a saída TLS (item 9) com chamadas reais aos três serviços
   externos a partir do ambiente.
7. Revisar variáveis e permissões (item 11) diretamente no painel.

## Resultado

- Itens em `PASS`: 0/11
- Decisão: **Hostinger não aprovada** até 11/11 `PASS` com evidência.
