# Publicação manual condicionada — Vercel e Hostinger

ADR-017/038 e autorização C26: develop é engenharia, main releasefinal. Este
runbook descreve o circuito executável; no marco atual a decisão é NO-GO. A revisão
exibida por um painel e a conclusão de build não substituem o veredito do CE.

## 1. Precondições do candidato

Guardar SHA atual da PR60, base main e evidências aplicáveis: gate local, PG17/RLS,
verify-release PR comquatro projetos e SonarCE (decisão real do CE). O espelho de
cobertura é **informativo**, não crédito: a ADR-042 §5 (linha 18) tornou baseline e
main-coverage-mirror observacionais e o ruleset deixou de exigir o espelho — logo
não há "espelho confiável por unidade" a guardar. Comparar
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

Observar push main: verify aplicável e scanner wait=true. Ler CEanalysisId/revision e
aplicar a ADR-042 §1 (linha 14): a condição obrigatória é **new_coverage >= 60%** sobre
a análise real do CE da revisão e a superfície esperada; cobertura abaixo de 60% bloqueia
e valor ausente, estado pendente, timeout, identidade divergente ou condição ignorada
são NO-VERDICT e bloqueiam. O limiar de 80% foi substituído (ADR-042, linha 6) e o
espelho deixou de ser exigido pelo ruleset: baseline e main-coverage-mirror são
**informativos** e não projetam aprovação de main (ADR-042 §5, linha 18) — não há mais
denominador/unidades pagas contra M1 a exigir. O status bruto do provedor é preservado:
se o preset ainda exigir 80%, um ERROR de cobertura entre 60% e 80% pode coexistir com
releasePolicy.status=OK (ADR-042 §3, linha 16). O caminho **ADR-044 `NOT_APPLICABLE`**
(linhas 17, 22 e 24) vale **somente em PR**, com conjunto elegível vazio provado e os
dois campos numéricos omitidos — `actual: null`, nunca 0/100 — e **não** é cobertura,
**não** é NO-VERDICT e **não** é aprovação de main; `main` **nunca** recebe
NOT_APPLICABLE e sua análise real da revisão continua obrigatória antes de publicar
(ADR-042 §6, linha 19; ADR-044, linha 24). Comparar espelho/real é leitura
informativa: erro>2p.p. gera ERRATA/suspensão sem, sozinho, reprovar o gate. Na dúvida
NO-GO.

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

## 5. C27 — destino principal e recuperação

ADR039: Hostinger é o destino principal; Vercel permanece publicação manual do
mesmo SHA aprovado. Reconciliar o site atual do domínio e o runtime Node antes
de alterar roteamento. APIsHTML200 reprovam; live,ready,sessionJSON e login/tenant
são evidências distintas. Reparar configuração existente não é uma nova release.

S3 independente em conta segregada, criptografia, versionamento e ObjectLock
Compliance35dias; o humano configura credenciais/contratação. PITR7d observado
e restoreisolado/RPO15min/RTO4h medidos continuam gates; backupdiário sozinho
não demonstra RPO15min. Primeiro backup/restore precedem promoção; rotina diária
usa revisão aprovada e monitora ausência de backup.

Merge final expressamente autorizado após operações resolvidas. Preserve a
janela humana30min da seção2 e registre resultados atuais por SHA. Novo ciclo
limita13commits com três reservados; não se acrescenta commit14 ao C26.
