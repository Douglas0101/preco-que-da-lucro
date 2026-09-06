# Recuperação pré-A4 — evidência e correção BAK-01 (2026-09-05)

## Fato, decisão e impacto

O drill histórico do PR #32 restaurava em outro database da mesma branch, omitindo ownership/grants. A duração do dump (26s) não é RPO. A cadência semanal não cumpre RPO de 15 minutos. O SHA-256 era calculado após recodificação do binário em string, não sobre os bytes originais. Essas conclusões ficam substituídas; BAK-01 permanece aberta para recuperação operacional integral.

A nova interface `m02:backup-verify` é estritamente read-only e exige IDs explícitos e dois endpoints direct diferentes. Criação/restore/cleanup são operações separadas, autorizadas e registradas. Nenhum banco é criado ou removido dentro de production. TLS verifica o certificado.

## Prova nativa

- Snapshot `snap-tiny-smoke-ayc382ji`, criado em 2026-09-05T22:37:46Z, origem `br-snowy-violet-aymcvvvv`, validade até 2026-10-10T23:59:59Z.
- `restore_snapshot(..., name=pre-a4-restore-20260905, finalize=false)` em 2026-09-05T22:38:20.709Z → 22:38:23.906Z. Branch nova `br-floral-pond-ayltjy2t`; sem troca de computes da origem. API concluída em 3,197s; esse tempo NÃO é RTO completo.
- SELECT na branch restaurada bem-sucedido em 22:38:41.542Z (4 accounts); disponibilidade comprovada até 20,833s após início, incluindo intervalo entre chamadas.
- Comparação 22:40:26.545Z → 22:40:43.930Z: **PASS**, 27 tabelas com contagens e checksums SHA-256 iguais, journal **11/11**, catálogo de tabelas/policies/constraints/indexes/grants e roles igual. Artefato: `native-restore-verify.json`.
- Cada inventário usa transação REPEATABLE READ READ ONLY e UTC; a comparação exige origem sem escritas. A igualdade dos checksums comprova ausência de diferença no conteúdo comparado nesta janela, não um RPO contínuo.
- `app_runtime`: sem superuser, sem BYPASSRLS, sem ownership indevido no catálogo comparado. Prova comportamental de RLS/Auth é uma etapa distinta.

Comando reproduzível (credenciais injetadas em memória, nunca registradas):

```sh
npm run m02:backup-verify -- --snapshot-id snap-tiny-smoke-ayc382ji --source-branch br-snowy-violet-aymcvvvv --restore-branch br-floral-pond-ayltjy2t
```

Variáveis: `DATABASE_ADMIN_URL` direct da origem; `DATABASE_RESTORE_URL` direct da branch restaurada. A ferramenta não busca, persiste ou imprime essas URLs.

## Veredito

- Snapshot/restore nativo com reconciliação estrutural e de dados: **CONFORME no escopo medido**; rede de segurança pré-purge estabelecida.
- §42 completo + SDD NFR-RES-003..005 / §16.6: **VIOLAÇÃO / BAK-01 ABERTA** até PITR >=7d, backup externo criptografado/imutável/independente, custódia de recuperação, RPO/RTO operacional, Auth e RLS exercitados.
- Plano Free dispõe de snapshot manual: a ausência prévia de snapshots não provava indisponibilidade. Referência oficial: https://neon.com/docs/ai/ai-database-versioning .
- Não restaurar o snapshot com fixtures sobre um destino promovido sem reaplicar o manifesto DB-01. Pós-tráfego, escolher ponto de recuperação conforme incidente/RPO; snapshot pré-deploy não autoriza perda indiscriminada de escritas.

## ESTADO DO SUBSTRATO

| Dimensão | Estado                                                        |
| -------- | ------------------------------------------------------------- |
| Tráfego  | Nenhum deploy registrado; hPanel pendente                     |
| Neon     | production preservada; snapshot e restore isolado comprovados |
| Paridade | DESCONHECIDO; G1 pendente                                     |
| Blockers | BAK-01 operacional; DB-01; DB-02/SEC-01; G1/G2; hPanel; Sonar |
