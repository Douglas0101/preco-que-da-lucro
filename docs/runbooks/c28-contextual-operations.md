# C28 — retomada das operações nos painéis

Estado observado nesta execução: a integração Neon/Vercel pertence à equipe
`douglas-dias-de-souzas-projects`, identificada pelo operador. O projeto dessa
equipe retorna404 na sessão Vercel atual e ela não aparece no seletor de equipes.
AWS abriu IAM Sign-in sem conta autenticada. Os identificadores permanecem
UNVERIFIED quando o painel não permite observá-los; a região do Neon e preços
públicos não definem uma conta de custódia nem um orçamento aprovado.

O banco privado de metadados está em
`/home/douglas-souza/.codex/artifacts/ciclo-28/context/operational-context.sqlite3`
(diretório700/arquivo600). Registra origem, recurso, campo, valor ou null, data,
classificação e evidência. Não recebe credenciais, cookies, connection strings,
queries OAuth, contato privado nem dados de aplicação. Não usa o banco Neon.

## Vercel e branch Neon residual

1. Operador entra na equipe proprietária pelo mesmo navegador; Via A mantém a
   entrada da credencial fora do agente. Confirmar o projeto nominal e a
   integração Neon antes de escrever. O projeto da outra equipe não é substituto.
2. Registrar o estado inicial sem valores de env: repo/ref/domínios e nomes das
   variáveis. Preparar a alteração e capturar a identidade exata.
3. A aba Disconnect do Neon explica que desconectar apenas interrompe a
   sincronização das env vars; não remove a integração Vercel inteira. Usar a
   configuração da integração no projeto proprietário para resolver o gerador
   de cópias. Se houver ampliação de permissões, parar no ponto material para
   confirmação, conforme a política do navegador.
4. Confirmar a identidade da branch residual `br-snowy-cake-ayyl3tdt`, parent,
   origem Vercel e ausência de uso. Preservar develop `br-small-hill-aymcu14y`
   e production `br-snowy-violet-aymcvvvv`. Exclusão irreversível exige confirmação
   do operador no ponto de exclusão; não resolver pela contagem de branches.
5. Após mutação: artefato imediato, GET404 do ID excluído e inventário completo
   com os dois IDs permanentes presentes e o ID temporário ausente. Retestar
   provisioning/readiness da revisão atual, expirando em24h e limpando com
   comprovação independente. Sonar/CI/preview/runtime seguem gates distintos.

## Custódia AWS e recuperação independente

1. Operador abre a sessão da conta de recuperação. Consultar accountId, região
   e bucket existentes pelo painel, com a origem registrada. Confirmar accountId
   diferente da conta principal e owner do bucket; um ARN não prova custódia.
2. Observar versão, retenção Compliance>=35dias e cifra conforme ADR039.
   Orçamento/custo precisa de aprovação explícita ou registro de aprovação já
   existente. Acesso ao billing ou um alerta AWS Budget não aprova contratação.
3. Se faltar recurso/configuração, preparar o change set e custo antes de
   qualquer compra, aceite contratual ou expansão IAM. Via A configura a chave
   e o papel dedicado; o agente não lê nem transporta esses valores.
4. Executar a qualificação externa do runbook independent-recovery, com dump
   PG17, upload/download por VersionId, decriptação e restore isolado. Exigir
   os nove checks do ADR040, RPO<=900s/RTO<=14400s em cada cenário, perda do
   provedor e perda da conta principal. A fixture C28 não preenche esse recibo.
5. Somente a qualificação EXTERNAL-RESTORE-VERIFIED permite preparar/ativar o
   ciclo real. Observar o par durável, duração<300s, timer e monitor independente
   WARN600s/INCIDENT>900s. Falha preserva lock/recibos para reconciliação.

## Credenciais e release

O autoteste com Secret Service e clipboard reais passou em cinco cenários
fictícios. O namespace é único e removido no fim; referências homônimas do
operador são preservadas por teste positivo/negativo. Isto não fecha DBT36:
seis rotações reais, consumidores, identidade/escopo, revogação e denylist
continuam Via A. Context7/DeepSeek precisam do contrato protegido de identidade,
com status bruto; página pública200 não o substitui. GitHub PAT fica por último.

Main continua bloqueada até o circuito atual completo: check local, testes DB/RLS,
matriz Playwright no PR, scanner/CE atado à revisão, mirror com unidades e LCOV
originais de main, runtime aplicável e S6 de contexto limpo. Não realizar merge,
deploy, DNS ou cutover por resultado da bancada.
