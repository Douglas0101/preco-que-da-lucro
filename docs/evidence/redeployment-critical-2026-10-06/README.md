# Redeployment crítico — execução e limites

A investigação distinguiu o bloqueio TanStack da captura, já corrigido em develop, do novo audit crítico de shell-quote. A correção deste pacote troca somente a entrada transitiva 1.10.0→1.11.0. A versão mínima e a falha foram verificadas na fonte primária e no registry npm.

Fontes: [TanStack](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8), [shell-quote](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), [Vercel deployments](https://vercel.com/docs/deployments).

## Evidência e resultado por fase

| Fase               | Resultado                                                              | Evidência                                                                     |
| ------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TanStack           | develop resolve Start 1.168.60/core 1.169.39; main continua em d4b9395 | package-lock.json; captures/remote-baseline.json                              |
| Audit RED          | 1 crítica: shell-quote 1.10.0                                          | captures/npm-audit-red.json                                                   |
| Controle RED       | quatro terminadores após comment são aceitos; shell não executado      | captures/shell-quote-red.json                                                 |
| Audit GREEN        | zero vulnerabilidades                                                  | captures/npm-audit-green.json                                                 |
| Controle GREEN     | quatro terminadores recusados com TypeError; quoting normal PASS       | captures/shell-quote-green.json                                               |
| Gate local         | PASS: exit 0; 133 suítes / 1873 testes; 18 skips DB condicionais       | captures/check-r4.result.json e check-r4.log.txt                              |
| Publicação develop | gate local PASS; integração e push pendentes                           | journal L733/L734                                                             |
| Preview            | revisão anterior 38bd376 READY; novo deployment pendente               | captura Vercel e journal L732                                                 |
| Release            | NO-GO                                                                  | PR #60: verify-release, Neon CI e main-coverage-mirror reprovados no baseline |

## Passos corretivos, dependências e critérios

1. **Correção de dependências em develop.** Aplicar esta entrada do lockfile, executar npm ci --ignore-scripts, npm audit --audit-level=high e npm run check. Integrar por commit normal somente após o gate local. O mecanismo de bypass TanStack mostrado pela plataforma não corrige a vulnerabilidade e não faz parte da operação.
2. **Novo preview manual da revisão corrigida.** Confirmar equipe team_2NnkSYjw5NRHAFnQFEPSHGmW, projeto prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q e alvo Preview/develop. Confirmar install reproduzível, preset Nitro vercel e ausência de override perigoso. Observar o SHA no painel, o fim do build e READY.
3. **Runtime e Neon.** O contrato de Preview/develop aponta para br-small-hill-aymcu14y/ep-wandering-glitter-ayzrgv28; os valores efetivos das variáveis não foram revelados; produção tem identidade distinta br-snowy-violet-aymcvvvv/ep-long-violet-aye9g0bn. Inventário atual tem duas branches permanentes. Leitura develop: server_version_num 170011, 37 tabelas em public, 20 migrations com hashes distintos. DATABASE_URL de runtime usa a ligação pooled; DATABASE_ADMIN_URL direta é apenas admin/migration e não entra no processo web. Confirmar scopes por nomes, sem revelar valores. Repetir live, ready e sessão; um health 200 não prova autenticação ou isolamento de tenant. Não reexecutar migrations já aplicadas por causa do bloqueio de build.
4. **Reparar DBT-96 na bancada do teste.** O erro é rollback 0010 com uma conta herdada da cópia de production. Manter o guard de rollback. A suíte de up/down precisa de PG17 efêmero com dados fixture; a validação da cópia Neon deve preservar os dados herdados e executar os contratos aplicáveis. A decisão de isolamento e sua regressão exigem um write-set próprio. Não pular casos para declarar a integração verde. Toda branch temporária exige expiry de 24 h e cleanup com GET 404 e confirmação independente.
5. **Resolver o espelho de cobertura DBT-64.** O run baseline observa main 63,2387%, 2995 unidades e gap 502 até 80%; adapter NO-VERDICT sem proveniência completa do LCOV original do scanner. O run 36879749754 foi reconfirmado (push/main/d4b9395, success); o artefato disponível tem apenas lcov.info, sem lcov-provenance.json. Recuperar o relatório original pelo run/SHA, sua instrumentação e os mappings de linhas/condições; reconciliar perdas e ganhos do candidato. Proibir crédito agregado por arquivo ou coverage de PR como substituto. Preservar denominador/piso e controles negativos.
6. **Completar a PR develop→main.** Exigir verify-release com quatro projetos Playwright, DB/RLS aplicáveis, scan+CE e mirror atuais no candidato. Confirmar os demais pré-requisitos de ADR-038 (receptores de deploy reconciliados, ViaA, banco/runtime e recovery). Pending/cancelled/ausente é bloqueio. O ruleset 24333849 mantém update ativo, required checks e bypass vazio.
7. **Operação de release após os gates.** MAESTRO abre a janela explícita de até 30 min de ADR-038. A mudança de segurança exige confirmação na ação. Remover apenas update, realizar merge commit e recolocar update imediatamente. O gate real de main precisa de >=80%, piso de denominador e unidades pagas. Fazer back-merge imediato de main em develop.
8. **Publicação manual e verificação final.** Construir e publicar o SHA aprovado de main na Vercel e Hostinger; reconciliar domínios, health JSON, sessão/login, tenant e smoke de aplicação. Credenciais são inseridas/submetidas pelo humano na ViaA. Registrar erros do runtime e mecanismo de retorno antes de liberar o resultado como produção pronta.

## Auto-verificação pré-S6

| #   | Item                 | Demonstração                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------------ |
| 1   | Controle negativo    | quatro terminações aceitas no pacote 1.10.0 e recusadas no 1.11.0 instalado    |
| 2   | Fronteira            | input normal passa nos dois; quatro entradas hostis diferenciam as versões     |
| 3   | Identidade           | advisory GHSA-pqg4-j6r4-53mv e node_modules/shell-quote nomeados no audit      |
| 4   | Sintoma              | GREEN exige zero vulnerabilidades e quatro TypeError, além do exit             |
| 5   | Sincronização        | aguardar conclusão dos processos/build pelo estado; nenhum sleep fixo          |
| 6   | Identidade distinta  | versões 1.10.0/1.11.0 e SHA base completo registrados                          |
| 7   | Estado compartilhado | custódia inicial e HEAD da bancada conhecidos; WIP principal excluído          |
| 8   | Sentinela            | normalQuoting e quatro variantes no JSON; nenhuma execução de shell            |
| 9   | Fingerprint          | lockfile e capturas enumerados no manifesto; custódia anterior conferida       |
| 10  | Descoberta           | igualdade das chaves do lockfile; somente a entrada shell-quote muda           |
| 11  | S6 contexto limpo    | NOT-STARTED; não há selo de fechamento SDD ou claim de release                 |
| 12  | Fail-closed          | audit crítico bloqueia; mirror e rollback continuam com seu veredito           |
| 13  | Isolamento           | worktree gerenciado destacado, sem env de runtime nem dado de produção         |
| 14  | Gates/capturas       | RED/GREEN nominados; check registrado com saída e resultado                    |
| 15  | CI por SHA           | pendente de push; o run anterior é baseline, nunca prova do novo commit        |
| 16  | Multi-sítio          | lockfile/package.json/família TanStack conferidos; diff precisa ser única      |
| 17  | Ambiente             | npm ci real na bancada; deep clone, ausência de .env e hash do pai verificados |

KPI do autor: três bloqueios encontrados antes de qualquer publicação de produção (audit, DBT-96, mirror); O check também capturou e corrigiu uma linha de registry fora da tabela canônica antes da integração. S6 NOT-STARTED e total de achados adversariais ainda não medido. Esta contagem não constitui closure.

## S6 ADVERSARIAL

NOT-STARTED. Correção operacional pontual; nenhum fechamento de fase ou da release declarado. DBT-99 permanece aberta até a validação remota exigida.

## Riscos e limites declarados

Preview READY e observação de schema são evidências parciais. Não há autorização para contornar os gates, remover dados herdados, afrouxar rollback, transmitir credenciais ou publicar main vermelho. O conector Vercel retornou403 para a equipe; o navegador já autenticado é a superfície disponível para a operação manual solicitada. O plano detalha a mudança de produção antes de qualquer eventual confirmação final.
