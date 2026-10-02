# Publicação manual condicionada — Vercel e Hostinger

ADR-017/038 e autorização C26: develop é engenharia, main releasefinal. Este
runbook descreve o circuito executável; no marco atual a decisão é NO-GO. A revisão
exibida por um painel e a conclusão de build não substituem o veredito do CE.

## 1. Precondições do candidato

Guardar SHA atual da PR60, base main e evidências aplicáveis: gate local, PG17/RLS,
verify-release PR comquatro projetos, SonarCE e espelho confiável porunidade. Comparar
head/base novamente antespromoção; resultado antigo, missing/cancelled/NO-VERDICT
bloqueia. Alertas ativos; dependências corrigidas e lockfile sincronizado emdevelop.

Todos os receptores automáticos precisam estar suspensos e identificados. Projeto
Vercel conhecido desconectado, Hostingerautooff observados; equipeadicional ainda
não reconciliada, portanto esta precondição não está cumprida globalmente.

Concluir seis rotações ViaA+consumidores+identidades+revogações e PITRgerenciado7d
observado+restoreisolado descartado com404. ConfiguraçãoDB runtime pooled app_runtime,
admin direta fora web; produção não recebe testes ou fixtures. Corrigir envcomhumano
sem valores em log/chat/artefato. Reparar processo existente não prova releaseverde.

## 2. Thaw e promoção

Com todos os gates atuais verdes e mapping confiável, MAESTRO assina janela30min
cominício/fim/owner/justificativa. Remover somente update do ruleset24333849;
preservarPR,strictbase,checks e bypass[]/noforce/nodeletion. Ação de redução de
proteção via browser requer confirmação no momento. Expiração não autoriza release.

Confirmarchecksexatos no SHA atual, mergecommit develop→main, registrar mainSHA.
Recolocar update imediatamente e reler ruleset. Qualquer erro interrompe; nunca
manterproteção reduzida para forçarverde.

## 3. Veredito real e publicação

Observar push main: verify aplicável e scanner wait=true. Ler CEanalysisId/revision,
gate>=80 e denominador>=50%M1 com unidadespagas contraM1. Comparar espelho/real;
erro>2p.p. geraERRATA/suspensão. Mesmoerropequeno não aceita real<80. Na dúvida NO-GO.

Selecionar somente o SHA imutável aprovado para publicação manual **em ambos**.
Vercel Git continua desligado; Hostingerautooff. Registrar project/deploymentid,
revisão, build/runtime e domíniosobservados, semsecretvalues. Nunca publicar tipmovente.
ConfirmarDBready/session e login/tenant aplicáveis semfixtures emprodução. HTTP200
público/sessionnull não são login nem garantia de conexão/isolamento.

## 4. Pós-promoção e recuperação

Mainàfrente exige merge main→develop imediato, sem rebase/squash/forcepush.
Observar CI/refs atuais e retenção Neonduaspermanentes, cleanup404 independente dos
recursostemporários. Selar artefatos,registryeHANDOFF comrun@SHA e limites nomeados.

Rollback de aplicação seleciona revisão anteriormente aprovada e configuração
compatível. Migrationcontractdown/higiene não rodam em produção como teste; recovery
segue restoreisolado/PITR e gate humano de dados, mantendo produção/default estáveis.
