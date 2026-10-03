# ADR-039 — Runtime principal e recuperação independente

- Estado: ACEITA para execução pelo plano autorizado em2026-10-02.
- Owner: MAESTRO.
- Dependências: ADR-017/038; DBT-57/64/70/73/75/76/77/78/79 e BAK-01.

## Decisão

Hostinger Node/Nitro será o destino principal de diretrizprecifica.com após
validar revisão, banco, autenticação e todo o circuito de release. Vercel será
o segundo destino de publicação manual do mesmo SHA aprovado. A seleção não
comprova readiness nem autoriza conectar o domínio a um runtime503.

Recuperação independente usa S3 em conta segregada: criptografia, versionamento
e Object Lock Compliance35dias. Custódia das chaves e teste de decriptação são
independentes da conta principal. Contratação e entrada/submissão de novas
credenciais são humanas (ViaA), sem valores em chat/log/evidência pública.

PITR gerenciado7d permanece obrigatório. Drill não sobrescreve production ou
develop; métricas RPO<=15min/RTO<=4h são medidas por cenário. Backup diário35d
não é por si controleRPO15min. Restore reaplica ledger de exclusões e confere
dados, Auth, schema, journals, ownership/grants e RLS.

## Imposição e rollout

Preservar freeze24333849 e bypass vazio. Adapter unitário Sonar deve ter nova
prova primária antes de implementação adicional; NO-VERDICT não pode virar
verde por agregado. Required checks atuais: verify-release, scan + cobertura,
main-coverage-mirror. GatePR semcoverage não é prova do recorte main.

Com precondições cumpridas, MAESTRO abre janela explícita de até30min; remover
somente update, mergecommit develop→main, refreeze imediato. Main precisa CE
real>=80, denominador>=piso e unidadespagas antes de qualquer publicação manual.
Erro do espelho>2pp suspende. Depois da release, back-merge imediato semrewrite.

## Estabilidade e limites

Observar24h: probesJSON60s, três falhas consecutivas abrem incidente. Isolamento,
integridade financeira ou exposição de segredo exigem intervenção imediata.
Preservar SLOs candidatos/M06DRAFT, piso de amostra e orçamento de testes.
Rollback escolhe artifact e configuração anteriores compatíveis; dados seguem
restoreisolado e gatehumano. Nenhuma aprovação de produção decorre deste ADR.

Fontes: SDD§16.6; ADR038; plano ratificado e decisões Hostinger/S3 nesta sessão.
