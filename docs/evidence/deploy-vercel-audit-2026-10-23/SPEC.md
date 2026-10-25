# SPEC — Auditoria SDD de estabilidade do deploy Vercel (2026-10-23)

## Fato-fonte

- Prompt de auditoria SDD recebido em 2026-10-23; deploy `main@cf910bf4754b0097c7bdae653d476cbd9422cdc4`.
- Deployment `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4`, target `production`, READY.
- CE da main: run `40028082462`, análise `2580598b-7591-4545-9aa2-45c602aa1169`, `new_coverage=82.2`.
- Alegação do prompt a verificar: `diretrizprecifica.com` aponta para esse deployment.

## Problema

Auditar a estabilidade sem alterar código de produção. O prompt assume que o domínio canônico é o destino Vercel e que o health expõe commit/versão/timestamp; ambas as premissas precisam ser medidas, não presumidas. Também pede teste de chat com persistência de produto e uma drills de promoção/rollback; são mutações de produção que exigem autorização e dados de teste segregados.

## Contrato

- Auditoria read-only para deployment, aliases, env names, logs, traces, health e Neon.
- Nenhum código de produção alterado; nenhum push/commit.
- Nenhum segredo lido, impresso ou persistido; env values permanecem mascarados.
- Nenhum produto criado no banco de produção; nenhum alias movido para drill de rollback.
- Resultado declarado como PASS, PARTIAL, FAIL, UNVERIFIED ou NOT EXECUTED; ausência de prova não vira verde.

## Mudanças

- Nenhuma mudança de aplicação, migration, DNS ou Vercel.
- Apenas este pacote de evidência local (não commitado).

## DoD

- [x] Deployment/aliases/health inspecionados.
- [x] Readiness e liveness separados; resposta pública inspecionada.
- [x] Estado do deployment anterior e do candidato staged registrado.
- [x] Nomes das envs de produção auditados sem valores.
- [x] Runtime errors/logs/CSP e traces consultados.
- [x] Neon produção consultado (read-only).
- [x] Workflow Neon diagnosticado por log e linhas do YAML.
- [ ] Teste autenticado do chat em produção com persistência — **NÃO EXECUTADO** (dado de produção).
- [ ] Drill de rollback ao vivo — **NÃO EXECUTADO** (exige janela/aprovação).
- [x] Relatório selado; commit/push aguardam aprovação humana.

## Testes

- Vercel MCP: deployment, aliases, runtime errors, runtime logs, trace lookup.
- HTTP: health live/ready no deployment e no alias; headers do domínio canônico.
- Neon MCP: `select 1` e contagem de migrations na produção.
- GitHub: checks/CE do merge.
- Código local: health handlers, `deployment-identity.server.ts`, `client.server.ts`, workflow Neon.

## Riscos

- `diretrizprecifica.com` é Hostinger AI Builder, não o deployment Vercel; um check de landing/health nesse domínio é falso verde para o app.
- O health de sucesso não inclui commit/versão/timestamp; a identidade existe em logs de falha, não na resposta.
- Trace lookup retornou `trace_not_found`; tracing de produção não está provado.
- O teste do chat em produção e a persistência de produto não foram executados; a evidência de chat é o `verify-release` contra banco efêmero.
- O workflow Neon tem timeout de 30 min e baixa browsers com `--with-deps`; é dívida de infraestrutura separada.

## Rollback

O deployment anterior conhecido é `dpl_AYh62JKPhjjrixJgEGbe4MuTTkzE` (`main@21a6089`). O candidato `dpl_CoCB7gRSUTmwtbuDZ9N6FuTSCSrm` (`main@2f18bdd`) está READY e não promovido. Nenhum rollback ao vivo foi executado nesta auditoria.
