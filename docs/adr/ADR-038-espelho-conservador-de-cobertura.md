# ADR-038 — Espelho conservador de cobertura e sequência de promoção

- **Estado:** ACEITA para execução do Ciclo 26 por autorização do plano. A ponte continua sujeita à prova por unidade; aceitação da arquitetura não fecha DBT-64.
- **Data:** 2026-10-01.
- **Owner:** MAESTRO.
- **Dívida:** DBT-64; dependências DBT-57, DBT-61 e DBT-68.
- **Perímetro C26:** repositório, GitHub Actions/API Sonar e painéis delegados GitHub, Neon, Vercel e Hostinger, conforme autorização humana posterior à ADR-036. Via A continua obrigatória; credenciais entram/submetem-se pelo humano e não pelo agente. Contratação de PITR exige ação humana.

## Reconciliação ratificada no Ciclo 26

O MAESTRO escolheu publicar manualmente em Vercel **e** Hostinger, suspender toda
integração Git Vercel (incluindo previews), rotacionar as seis credenciais expostas
antes da release e contratar PITR gerenciado de sete dias. O plano foi autorizado
para implementação em 2026-10-02. As seções seguintes conservam a evidência do C25;
seus limites temporais são históricos e não equivalem a estado atual.

A sequência corrigida exige suspensão observada de **todos** os receptores automáticos,
checks atuais da PR com contexto exclusivo da matriz completa, espelho por unidade e
precondições de banco/runtime/segredos. Somente então o MAESTRO abre uma janela explícita
de até 30 minutos para remover **apenas** `update` do ruleset 24333849, mantendo PR,
base atualizada, required checks e bypass vazio. Merge por merge commit; recolocar
`update` imediatamente. A confirmação da alteração de segurança ocorre na ação.

O push de main com wait=true precisa produzir gate real >=80, denominador >= piso
e unidades pagas contra M1. Comparar projeção com real: erro >2 p.p. exige ERRATA
e suspensão. Gate real vermelho impede publicação em ambos os provedores, mesmo
se o espelho tiver aprovado. Publicação manual usa a revisão imutável aprovada;
main volta imediatamente para develop por merge, sem rebase/squash/force push.

Esta ordem remove a circularidade de V3 sem afirmar que o gate da PR mede main.
A defesa de publicação é a suspensão observada mais autorização da revisão real;
deploy-no-workflow continua evolução futura, sem credenciais novas improvisadas.
L404/L406 observam suspensão do projeto Vercel conhecido e Hostinger; DBT-70
continua aberta enquanto o receptor da outra equipe não for reconciliado.

## Problema observado

O gate da PR #60 aprovou sem condição de cobertura, enquanto o gate de main continuou ERROR 63,2. Portanto um required check do scanner da PR não impõe o recorte de main. O Ciclo 24 acrescentou update ao ruleset 24333849 com bypass vazio e observou recusa de push/merge; esse congelamento impede qualquer promoção.

O Ciclo 25 ratificou a arquitetura A: leitura fresca do denominador de main e projeção conservadora da cobertura do candidato, como required check. A ratificação não torna equivalente o lcov local ao recorte Sonar. Ela também não concede bypass, acesso à UI Vercel ou thaw antes da precondição V3.

## Controle que exige corrigir o contrato

A especificação E1 agrega delta em arquivos pertencentes ao recorte new de main. Controle em memória executado: o arquivo contém 100 linhas new, das quais 60 cobertas; o candidato cobre mais 20 linhas antigas do mesmo arquivo. O delta do arquivo é 20, floor mantém 20, e a projeção alcança 80%. No conjunto das unidades new a cobertura real continua 60%. Excluir arquivos de teste e arredondar para baixo não impede esse falso positivo.

Isso refuta a suficiência do agregado por arquivo; não afirma que um job já implantado produziu tal resultado no projeto. O espelho não foi construído ou promovido a required check.

## Requisitos para a ponte

1. Snapshot main com SHA, analysisId, período, exclusões, unidades totais/cobertas e cobertura coerente; reconfirmar a identidade antes de emitir o check. Ausência, ambiguidade, denominador vazio e mudança de base são precondições, nunca verde.
2. Identidade **por unidade**, não apenas por arquivo: linhas elegíveis e condições do recorte new de main; exclusão de teste não exclui linha antiga em arquivo misto. Descoberta vazia ou unidade não reconciliada reprova.
3. Baseline e candidato de lcov comparáveis, com mesma fonte/instrumentação e mapeamento verificável de linha/condição. Não somar ganhos locais overall a um numerador remoto new. Código de aplicação, lockfile, recorte ou instrumentação alterados exigem nova reconciliação, não contagem presumida.
4. Calcular apenas o ganho líquido nas unidades elegíveis, incluindo perdas; floor não substitui identidade. Produzir lista auditável de unidades pagas, baseline, candidato e gap; todo ganho desconhecido deve ser recusado, não estimado como crédito.
5. Required check exclusivo e vinculado à revisão atual. Negativo de linhas antigas do mesmo arquivo deve continuar vermelho; testes, condições não mapeadas, perda de cobertura, baseline velha, denominador abaixo do piso e erro de leitura não podem aprovar.
6. Após promoção autorizada, comparar projeção ao gate real de main no mesmo SHA e recorte; erro >2 p.p. gera ERRATA. Mesmo erro menor não permite aceitar real <80. DBT-57 também exige piso de denominador e unidades pagas contra M1; janela rolando não paga dívida.

A disponibilidade do mapeamento por unidade na API e a conversão LCOV/Sonar ainda não foram demonstradas. O catálogo público de project_analyses/search não tem parâmetro de PR; nenhuma consulta deve tratar um parâmetro ignorado como análise de PR. No estado atual, which-analysis é principal-only e DBT-61 permanece ABERTA.

## Dependência circular da sequência

V3 autoriza levantar o freeze somente com gate real de main verde. A nova análise de main dependeria do merge de #60; o update rule com bypass vazio impede esse merge. Remover a regra para poder medir violaria a ordem literal autorizada. Nenhum bypass ou thaw será executado para esconder essa dependência.

A decisão de sequência precisa anteceder E2.2: definir uma forma de verificar o candidato no recorte de release antes da promoção, e definir explicitamente quando update poderá ser retirado. D0 A não resolve essa ordem por si só. Até a reconciliação, update permanece ativo e a janela de ADR-037 não renova/removerá proteção automaticamente.

## Limite residual e Via B pendente

Na Via A, um falso positivo do espelho pode permitir merge e a publicação automática pode ocorrer antes do gate de push; wait=true no push dá o veredito real depois da submissão e não impõe a ordem do integrador externo. Este resíduo permanece sob DBT-64 ABERTA, sem declarar imposição completa.

Via B (deploy dentro do workflow com needs verify/sonar/espelho) é **evolução pendente** de DBT-64. Depende de configuração Vercel por humano ou extensão explícita de ADR-036; nenhuma emenda, configuração ou deploy job foi executado pelo agente. A disponibilidade da Via B não é licença para alterar o perímetro atual.

## Infraestrutura e evidência

DBT-68: ui-stack já cacheia ms-playwright por lockfile e o run cancelado teve hit/restauração. Log completo mostra APT baixando dependências de sistema até a interrupção por 12 min. Duplicar cache não corrige esse estado; não houve redução de navegadores, testes ou limite. A causa de lentidão além do download APT permanece não identificada e V foi suspensa.

Neon 422 e preview FAILURE têm hipótese de cascata, ainda não comprovada por vínculo/configuração/logs. Preview failure foi registrada antes do erro de criação no run C24; correlação após um futuro retry não bastará para afirmar causalidade. Nenhuma criação, exclusão ou redeploy foi executada para esta proposta.

Evidência: docs/evidence/ciclo-25/README.md, fase-b.manifest.sha256 e fase-adr.manifest.sha256 por revisão. Nenhum S6, closure de DBT-64, check espelho ou publicação verde é declarado.

Fontes: [Qualidade e recortes do Sonar](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates), [Definições de métricas](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/metric-definitions), [Web API Sonar](https://docs.sonarsource.com/sonarqube-cloud/appendices/web-api), [Regras do GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## Marco C26 de implementação e limites atuais

C03 mantém doze minutos no verify e acrescenta preparação de navegadores/pacotes
Linux em job próprio de doze minutos. Os dois tempos contam no custo total. O kit
verifica SHA de checkout, lockfile, Playwright e ImageOS/ImageVersion, hashes e
presença/versão dos pacotes instalados. O contexto da matriz completa é verify-release;
verify de push não o substitui. A evidência remota ainda será medida no SHA publicado.

C04 implementa motor de unidades e controles contra o falso positivo de linhas
antigas do mesmo arquivo, perdas e mappings desconhecidos. O job main-coverage-mirror
emite NO-VERDICT enquanto o adapter autenticado por unidade não for demonstrado.
Métricas agregadas frescas produzem gap/piso, mas não identidade de condição. O
catálogo API consultado expõe sources raw/scm/show, sem prova de uma superfície de
cobertura por unidade; consultas públicas404 não provam ausência de análise. A fase
E de imposição de cobertura permanece interrompida por essa precondição, DBT-64 aberta.
Aceitar um snapshot por hash também não valida a origem de seu mapeamento.

Vercel conhecida teve Git desconectado e Hostinger auto-deployment desativado.
Segundo receptor Vercel segue sem acesso delegado. Neon teve uma terceira cópia
persistente criada por vercel e novamente reconciliada para duas permanentes; a
prevenção dessa criação permanece aberta. Não há claim de suspensão global.

Os probes de rotação agora distinguem identidade protegida, status bruto e
NO-VERDICT. A emissão de tokens é no provedor humano, não geração arbitrária de
API keys. Dois autotestes reais travaram no clipboard; somente os cinco refs
fictícios novos foram eliminados, preservando os cinco operacionais. DBT-36 e DBT-76
bloqueiam release. PITR sete dias e restore isolado continuam pendentes de contratação.

A antiga referência de vulnerabilidade TanStack não foi confirmada por fonte
primária; o piso corrigido e a recusa do provedor são fatos distintos da identificação
CVE/GHSA. Nenhum congelamento foi levantado e nenhum deploy executado no C26.
