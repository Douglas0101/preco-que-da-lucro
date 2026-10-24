# Auditoria SDD — estabilidade do deploy Vercel (2026-10-23)

## Resultado executivo

O deployment Vercel está **READY** e saudável no alias Vercel; porém o prompt parte de uma premissa **incorreta**: `diretrizprecifica.com` **não** aponta para este deployment. O domínio canônico é um site **Hostinger AI Builder/Horizons**, com `server: hcdn` e `x-powered-by: Hostinger Horizons`. O app Vercel vive em `preco-que-da-lucro-sage.vercel.app` e demais aliases do projeto.

| Fase                          | Resultado                  | Observação                                                                                              |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0 — Deployment/aliases/health | **PARTIAL**                | Vercel READY, aliases e health 200; domínio canônico não é Vercel                                       |
| 1 — Health/versionamento      | **FAIL**                   | read-only e live/ready separados; sem `version`/`commit`/`timestamp` na resposta                        |
| 2 — Promoção/rollback         | **PARTIAL / UNVERIFIED**   | promoção real do `dpl_HfDw` com health 200; drill de rollback não executado                             |
| 3 — Env/Neon                  | **PARTIAL**                | nomes presentes; valores mascarados; pooling não verificável sem segredo; `select 1` OK                 |
| 4 — Observabilidade           | **PARTIAL**                | 0 runtime errors e logs de health; trace lookup 404; CSP sem registros na janela                        |
| 5 — Chat em produção          | **NOT EXECUTED / PARTIAL** | rota responde shell 200 sem sessão; nenhum produto criado; E2E de release cobre o chat em banco efêmero |
| 6 — Workflow Neon             | **PASS (diagnóstico)**     | causa raiz confirmada; dívida proposta, não registrada/commitada                                        |
| 7 — Relatório                 | **PASS (local)**           | pacote selado; sem commit/push                                                                          |

## Fase 0 — deployment, aliases e domínio

- `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4` — `READY`, target `production`, SHA `cf910bf`.
- Aliases `sage`, projeto e `git-main` → `dpl_HfDw` (verificado por `get_alias`).
- Health no deployment e no alias `sage`: **200**, `{"status":"ready","dependencies":{"postgres":"ok"}}`.
- `GET /` no alias Vercel: 200 (via fetch autenticado da Vercel).
- `GET /novo-produto` no alias: 200, mas apenas o shell; sem sessão autenticada não há chat funcional.
- **`diretrizprecifica.com`**: 200 HTML, `x-powered-by: Hostinger Horizons`, `server: hcdn`; `/api/health/ready` devolve HTML, não JSON. **Não é o app Vercel.**

## Fase 1 — health e identidade

- `/api/health/live` → `{"status":"ok"}`, `cache-control: no-store`.
- `/api/health/ready` → `select 1`; 200 `{"status":"ready","dependencies":{"postgres":"ok"}}`; 503 genérico em falha.
- Sem mutação; live e ready separados; nenhuma credencial/tenant/stack trace na resposta.
- **Lacuna:** a resposta de sucesso não inclui `deploymentId`, `commitSha` nem timestamp RFC 3339. `deploymentIdentity()` existe, mas é usado apenas no log de falha. A aceitação “versionamento presente” **não é atendida**.

## Fase 2 — promoção e rollback

- O `dpl_HfDw` foi promovido durante o release; aliases e health 200.
- Candidato staged: `dpl_CoCB...` (`main@2f18bdd`), READY, **não promovido**.
- Produção anterior/rollback: `dpl_AYh...` (`main@21a6089`).
- **Não foi executado rollback ao vivo.** A promessa de “zero downtime observado” não pode ser provada sem uma janela autorizada; a documentação oficial da Vercel (via Context7) confirma `promote`/`rollback` por deployment, mas a auditoria read-only não move aliases.

## Fase 3 — env e Neon

- Envs de produção presentes (nomes): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_DRIVER`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`, `OTEL_*`, `CSP_ENFORCE`.
- Valores são Secret/Config mascarados; **não foram lidos nem impressos**. Portanto “não vazios” e “host pooled” não são provados por esta auditoria.
- O app usa `neon-serverless` por default (`src/db/client.server.ts`); o driver efetivo de produção é um secret. A doc Neon (Context7) recomenda pooled para serverless clássico e TCP+pool para Fluid Compute; a exigência genérica de `-pooler` do prompt não é universal.
- `select 1` no Neon produção: **1**; health ready: `postgres: ok`; sem erro de conexão nos logs.

## Fase 4 — observabilidade

- Runtime errors (1h): **0**.
- Runtime logs: health live 200 (2 ms), health ready 200 (17/75 ms), `/api/vitals` 204, RUM FCP 1200 ms `good`.
- Trace lookup para os request IDs de health: **404 `trace_not_found`**; tracing de produção não provado.
- CSP: header **report-only**; consulta `csp.violation` na janela do deployment: **nenhum registro**. Isso não prova console limpo no chat autenticado.

## Fase 5 — chat sob CSP

- A rota `/novo-produto` responde 200 no alias, mas sem sessão autenticada não há thread; o teste autenticado não foi executado.
- **Nenhum produto foi criado no Neon de produção.** Teste de escrita em produção é proibido pelo contrato do repositório; a evidência de chat é o `verify-release` (Chromium/Firefox/WebKit/mobile) contra banco efêmero.
- CSP permanece report-only, sem `unsafe-inline`; o `MessageScroller` tem style attribute dinâmico. A aceitação “zero violações no console em produção” é **UNVERIFIED**.

## Fase 6 — workflow Neon

Causa raiz confirmada:

- Job `Branch efêmera...` tem `timeout-minutes: 30` (`neon-pr-branch.yml:95`).
- O passo E2E executa `npx playwright install --with-deps chromium firefox webkit` (`:367`) dentro do job, sem reutilizar o kit/cache do UI stack.
- Log do #66: `apt` preso/retentando `libavcodec62`; job cancelado em 30 min; cleanup `always()` passou e provou a deleção.
- O #67 reexecutou o Neon PR e passou em 9m35, confirmando que não era falha de código.

Proposta de dívida (não registrada/commitada): **DBT-173** — reutilizar o `prepare-browsers`/cache e a atestação do UI stack no workflow Neon; closure test = PR Neon com cache hit, E2E executado e cleanup 404, mais controle negativo de cache miss. Não aumentar o timeout silenciosamente.

## Evidências

- `captures/deployment.txt`
- `captures/health.txt`
- `captures/canonical-domain.txt`
- `captures/env-names.txt`
- `captures/runtime.txt`
- `captures/neon.txt`
- `captures/neon-workflow.txt`
- `MANIFEST.sha256`

## Limites

Nenhum commit/push foi feito. Nenhum código de produção foi alterado. Nenhum segredo foi lido. Nenhum produto foi persistido em produção. O drill de rollback e o teste autenticado do chat em produção ficam pendentes de autorização/janela e de um tenant de teste segregado.
