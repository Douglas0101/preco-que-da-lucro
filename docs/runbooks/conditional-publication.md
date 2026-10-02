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

O `vercel.json` da revisão candidata define `git.deploymentEnabled: false` para
impedir deployments automáticos de qualquer branch deste repositório. A
[configuração oficial](https://vercel.com/docs/project-configuration/git-configuration)
preserva a
[publicação manual por CLI](https://vercel.com/kb/guide/can-you-deploy-based-on-tags-releases-on-vercel).
Validar o controle no SHA publicado: aguardar os checks aplicáveis terminarem,
consultar os deployments desse SHA e comparar com um push anterior que produziu
Preview. Ausência numa consulta intermediária não fecha a dívida. Até a promoção,
main conserva a revisão anterior sob freeze. A configuração no repo não demonstra
desconexão da outra equipe, suspensão da integração Neon ou recuperação do runtime;
esses controles mantêm evidências e estados próprios. Não suspender a instalação
GitHub global que abrange outros repositórios.

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
Preservar `git.deploymentEnabled: false` na revisão publicada e o projeto conhecido
desconectado; Hostingerautooff. Registrar project/deploymentid,
revisão, build/runtime e domíniosobservados, semsecretvalues. Nunca publicar tipmovente.
ConfirmarDBready/session e login/tenant aplicáveis semfixtures emprodução. HTTP200
público/sessionnull não são login nem garantia de conexão/isolamento.

Conferir também o domínio aprovado por identidade de projeto e revisão. As rotas
`/api/health/live`, `/api/health/ready` e `/api/auth/get-session` precisam responder
JSON do backend; readiness exige banco disponível. HTML com status200, sobretudo
quando idêntico ao home, bloqueia esse gate de runtime (DBT-78). Não alterar DNS
nem atribuir a causa a um provedor antes de reconciliar o destino e a autoridade de
cutover. Sessão anônima JSONnull continua separada de login autenticado e isolamento.

## 4. Pós-promoção e recuperação

Mainàfrente exige merge main→develop imediato, sem rebase/squash/forcepush.
Observar CI/refs atuais e retenção Neonduaspermanentes, cleanup404 independente dos
recursostemporários. Selar artefatos,registryeHANDOFF comrun@SHA e limites nomeados.

Rollback de aplicação seleciona revisão anteriormente aprovada e configuração
compatível. Migrationcontractdown/higiene não rodam em produção como teste; recovery
segue restoreisolado/PITR e gate humano de dados, mantendo produção/default estáveis.
