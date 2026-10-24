# Preparação de release com gate humano — 2026-10-23/24

**Veredito geral: PREPARADO e, após autorização total do dono, PUBLICADO.** As seções 1–13 registram o estado **pré-autorização** (nenhuma ação real). O adendo abaixo e a §14 registram a execução posterior: PR #68 mergeado em `b8bc52e`, CE real da main OK (82.2%), Vercel `dpl_BtH` READY e aliases movidos; `dpl_HfDw` preservado como rollback.

> **Adendo 2026-10-24T05:10Z — executado sob autorização total.** O health identity (G2), o teste do chat no staging (G4) e qualquer ação Hostinger (G5) continuam deferidos. O pacote de auditoria (G3) foi commitado em `develop` após a publicação.

## 1. Resultado executivo

| Fase | Spec                                                   | Resultado                           | O que foi executado                               | O que aguarda aprovação                                  |
| ---- | ------------------------------------------------------ | ----------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 0    | Produção/staging/Neon saudáveis, identidade rastreável | **PASS** (com premissas corrigidas) | Vercel MCP, HTTP, Neon read-only                  | —                                                        |
| 1    | Diagnosticar e propor fix do DBT-100 sem aplicar       | **PASS (diagnóstico)**              | Leitura de logs reais, Context7, catálogo de tags | Reexecução completa do workflow (não é patch)            |
| 2    | Preparar health identity sem merge                     | **PREPARED / POLICY-BLOCKED**       | Diff + teste isolado 8/8 + typecheck              | Decidir re-land em `develop` (branch próprio é proibido) |
| 3    | Preparar commit do relatório de auditoria              | **PREPARED (staged)**               | `git add` seletivo do pacote selado               | Commit                                                   |
| 4    | Testar chat no staging com branch Neon efêmera         | **BLOCKED**                         | Nada foi criado/alterado                          | Autorização explícita da branch + teste                  |
| 5    | Documentar transição Hostinger                         | **DOCUMENTED (read-only)**          | DNS zone e VPS list lidos; plano escrito          | Comprar VPS / mudar DNS (fora desta janela)              |
| 6    | Relatório verificável selado                           | **PASS (local)**                    | Este pacote + `MANIFEST.sha256`                   | Commit (junto com a Fase 3)                              |

## 2. Premissas do prompt × estado medido

| #   | Premissa                                                             | Medição                                                                                                                                                               | Veredito                                                                                                      |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Produção `main@cf910bf` READY                                        | `dpl_HfDw` READY, target `production`, SHA `cf910bf`; `sage` health 200 `postgres: ok`                                                                                | **CONFIRMADA**                                                                                                |
| 2   | Staging com `commit=12de0bf`, `deployment=dpl_7cdy…`, `postgres: ok` | `web_fetch_vercel_url` 200: `{"status":"ready","commit":"12de0bf…","deployment":"dpl_7cdy…","timestamp":"2026-10-24T02:44:59.309Z","dependencies":{"postgres":"ok"}}` | **CONFIRMADA**, mas o alias é SSO-protegido (anônimo = 302) e `dpl_7cdy` é anterior ao HEAD atual             |
| 3   | `diretrizprecifica.com` serve o deployment Vercel                    | Apex = Hostinger Horizons (`server: hcdn`, `x-powered-by: Hostinger Horizons`); `/api/health/ready` devolve HTML 200, não JSON                                        | **FALSA** (falso verde documentado na auditoria)                                                              |
| 4   | Árvore limpa                                                         | 73 entradas em `git status --porcelain`; WIP alheio extenso (front, e2e, docs, workflows)                                                                             | **FALSA** (WIP preservado, não descartado)                                                                    |
| 5   | PR #68 com falha de runner, não de código                            | `verify` e `verify-release` falham em **`Verify kit identity and install Linux packages offline`** com `precondition: kit identity mismatch: imageVersion` (DBT-100)  | **PARCIALMENTE FALSA**: não é falha genérica; é a condição de imagem do DBT-100, e bloqueia o gate de release |
| 6   | Fix = pinar `mcr.microsoft.com/playwright:v1.53.1-noble`             | Não há imagem Docker de Playwright em nenhum workflow; o projeto usa `@playwright/test` **1.62.1** e instala browsers com `npx playwright install` + kit atestado     | **INAPLICÁVEL**; a tag `v1.53.1` está errada para este projeto                                                |
| 7   | Neon com 20 migrations                                               | `select count(*)` read-only em `drizzle.__drizzle_migrations` = **20**                                                                                                | **CONFIRMADA**                                                                                                |
| 8   | Pacote de auditoria selado                                           | `sha256sum -c MANIFEST.sha256` = 9/9 OK                                                                                                                               | **CONFIRMADA**                                                                                                |
| 9   | Criar `feat/health-identity-main` e PR draft                         | Ruleset `24347682` (“Only develop and main branches”) proíbe qualquer outro branch publicado                                                                          | **CONFLITO DE POLÍTICA** — não executado                                                                      |

## 3. Fase 0 — estado medido (read-only)

### Produção Vercel

- Projeto: `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q` (`preco-que-da-lucro`).
- Deployment de produção: `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4`, `READY`, SHA `cf910bf4754b0097c7bdae653d476cbd9422cdc4`.
- Aliases para `dpl_HfDw`: `preco-que-da-lucro-sage.vercel.app`, alias do projeto e `git-main`.
- `GET https://preco-que-da-lucro-sage.vercel.app/api/health/ready` → **200** `{"status":"ready","dependencies":{"postgres":"ok"}}`.
- O deployment direto e o alias `git-main` respondem **302** para Vercel Authentication (proteção preservada).

### Staging

- Alias `staging.diretrizprecifica.com` → `dpl_7cdyMc7xmiwGQR4goQ1ru8Soy2GK` (`preview`, `develop@12de0bf`), criado em `2026-10-23T22:59:15Z`.
- Acesso anônimo: **302** para `vercel.com/sso-api` (Vercel Authentication).
- Acesso autenticado via MCP: **200** com `commit`, `deployment`, `timestamp` e `postgres: ok`.
- `develop` avançou depois disso: `109e1fb` (undici 8.12.3) e `228589e` (revert do health identity). **O staging não representa o HEAD de `develop`.**

### Neon

- Projeto `damp-forest-57346541`, branch `br-snowy-violet-aymcvvvv` (`production`).
- Consulta read-only: `applied = 20`, `latest_created_at = 1789698474294`.
- Nenhuma escrita, migration, fixture ou leitura de credencial.

### Domínio canônico

- `diretrizprecifica.com` → ALIAS `diretrizprecifica.com.cdn.hstgr.net` (Hostinger), TTL 300.
- `www` → CNAME `www.diretrizprecifica.com.cdn.hstgr.net`.
- `staging` → CNAME `b4a80935dc1e33a0.vercel-dns-017.com` (Vercel), TTL 300.
- `GET /api/health/ready` no apex devolve **HTML 200** do Hostinger AI Builder, não o JSON do app.

## 4. Fase 1 — DBT-100: causa raiz real

**Não é tag Docker mutável.** Não existe `mcr.microsoft.com/playwright` em `.github/workflows/*.yml`; a única `image:` é `postgres:17-alpine`. O pipeline usa `ubuntu-24.04` + `npx playwright install --with-deps` + kit de browsers empacotado e atestado.

Falha medida nas duas execuções do PR #68:

| Run                  | Job              | Step                                                     | Mensagem                                                     |
| -------------------- | ---------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `40046519246` (push) | `verify`         | `Verify kit identity and install Linux packages offline` | `precondition: kit identity mismatch: imageVersion` (exit 2) |
| `40046525035` (PR)   | `verify-release` | idem                                                     | idem                                                         |

A atestação do kit (`scripts/ci/playwright-kit.ts`) vincula `lockSha256`, `imageOS`, **`imageVersion`**, `architecture` e `playwrightVersion`. Quando `prepare-browsers` e `verify` caem em `ImageVersion` diferentes de `ubuntu-24.04` (janela de rollout), a verificação reprova **por precondição** — antes de instalar ou rodar Playwright. É exatamente o DBT-100 já aberto no registry.

**Remediação medida (DBT-100):** uma **reexecução completa do workflow** (novo `runAttempt`, `prepare` + `verify` no mesmo attempt/imagem). `gh run rerun --failed` **não** serve: a atestação vincula `runAttempt` e o job de prepare não é reexecutado. Não foi executada nesta janela.

**Sobre a tag `v1.53.1-noble`:** além de não ser usada, ela não corresponde à versão instalada (`1.62.1`). O catálogo MCR tem `v1.62.1-noble`; uma migração para container exigiria essa tag/digest e uma decisão de arquitetura (o job usa `services: postgres` em `127.0.0.1`, que não funciona sem rework de rede em container jobs). Ver `captures/02-dbt100-remediation.md`.

## 5. Fase 2 — health identity preparado, não aplicado

O diff proposto é o replay de `12de0bf` sobre `228589e`:

- `src/routes/api/health/ready.ts` — acrescenta `commit`, `deployment` e `timestamp` ao corpo 200, mantendo `cache-control: no-store` e a resposta 503 genérica.
- `src/test/health-readiness-logging.test.ts` — cobre sucesso com identidade, formato RFC 3339 e ausência de segredo; ajusta o mock para não lançar no caminho de sucesso.

Validação isolada (worktree detachado, sem branch e sem commit):

- `npx vitest run src/test/health-readiness-logging.test.ts` → **8/8 PASS**.
- `npx tsc --noEmit` → **exit 0**.
- `git apply --check` do diff contra o checkout principal → **PASS**.
- Worktree removido ao final.

**Bloqueios declarados:**

1. O commit existiu (`12de0bf`, 19:51 local) e foi **revertido** (`228589e`, 21:45 local) sem entrada no journal. O diff líquido contra `main` é **vazio** e o PR #68 não contém o health identity (`captures/03-health-identity-history.txt`). A intenção do revert é desconhecida; reaplicar sem confirmação seria sobrescrever uma decisão do dono.
2. O prompt manda criar `feat/health-identity-main` e abrir PR draft. O ruleset `24347682` e o `AGENTS.md` permitem apenas `develop` e `main`; o caminho correto é re-lander em `develop` e seguir o PR final `develop → main`.
3. `@openstatus/health-vercel` **não** está instalado. O repositório já tem `deploymentIdentity()` com validação de padrão; adicionar dependência para três campos violaria a disciplina de dependências. O diff usa o helper existente.
4. `projectId` (`VERCEL_PROJECT_ID`) não está no corpo; o aceite da Fase 2 pede `commitSha`, `deploymentId` e `timestamp`. Se o dono quiser `projectId`, é uma extensão separada do helper e dos testes.
5. Neste roteador (handler de servidor do TanStack Start) a rota não é pré-renderizada estaticamente; o contrato de não-cache é o header `cache-control: no-store`, já presente. Não há um `export const dynamic` equivalente a aplicar.

## 6. Fase 3 — pacote de auditoria staged

- `git add` seletivo de `docs/evidence/deploy-vercel-audit-2026-10-23/` (10 arquivos; 9 entradas seladas no `MANIFEST.sha256`, que não se auto-inclui).
- `sha256sum -c MANIFEST.sha256` → **9/9 OK**.
- Nenhum `git commit` executado.
- WIP alheio (`src/styles.css`, `e2e/ui-stack.spec.ts`, dezenas de outros arquivos) permanece intocado e fora do index.

## 7. Fase 4 — chat no staging: BLOCKED

Não executada. Faltam as autorizações explícitas exigidas pelo próprio prompt. Além disso:

- O staging está protegido por Vercel Authentication; o teste autenticado exige sessão humana (Via A) ou bypass.
- A branch Neon efêmera exigiria criação + apontamento de env do staging + redeploy do preview; nada disso foi feito.
- A premissa “MessageScroller aceita nonce” conflita com a **ADR-043 §Decisão 1**: a CSP é estática, **sem nonce** (`src/lib/security-headers.ts`, `src/test/security-headers.test.ts:93`). A política está em **report-only**; a experiência deve funcionar, mas a prova de zero violações não foi medida.
- Teste de escrita no banco de produção é proibido pelo contrato; a branch efêmera é o caminho correto, e ele não foi autorizado.

Plano de execução (quando aprovado) em `captures/04-chat-staging-blocked.md`.

## 8. Fase 5 — Hostinger

Plano completo em `PLANO-HOSTINGER.md`. Fatos medidos:

- `dns_records_list`: apex `ALIAS` → `diretrizprecifica.com.cdn.hstgr.net`; `www`/`staging`/mail/DKIM/SPF/MX/DMARC presentes; TTL 300–14400.
- `vps_virtual-machines_list`: **[]** (nenhum VPS comprado).
- Nenhuma chamada de escrita na Hostinger; nenhum DNS alterado.
- O apex atual é um site Hostinger Horizons, **não** o app Vercel. A troca de apex não é “Vercel → VPS”; é “site Horizons → app”.

## 9. Gates de aprovação humana

| Gate                     | Frase de autorização                                        | Efeito                                                                  |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| G1 — DBT-100             | “Aprovo a reexecução completa do workflow do PR #68”        | `gh run rerun` completo de `40046519246` e `40046525035` (novo attempt) |
| G2 — health identity     | “Aprovo re-lander o health identity em `develop`”           | Aplicar o diff em `develop`, rodar gate, push e PR normal               |
| G3 — commit da auditoria | “Aprovo o commit do relatório de auditoria”                 | `git commit` do pacote staged                                           |
| G4 — chat staging        | “Aprovo o teste do chat no staging com branch Neon efêmera” | Criar branch Neon, apontar preview, executar Playwright, deletar branch |
| G5 — Hostinger           | “Aprovo o plano Hostinger”                                  | Ainda assim, execução exige janela e autorização separada               |

> Nenhuma frase acima foi recebida. O agente para aqui.

## 10. Idempotência — antes e depois

| Item                                 | Antes            | Depois                             |
| ------------------------------------ | ---------------- | ---------------------------------- |
| `HEAD`                               | `228589e`        | `228589e`                          |
| `origin/develop`                     | `228589e`        | `228589e`                          |
| `origin/main`                        | `cf910bf`        | `cf910bf`                          |
| Entradas em `git status --porcelain` | 73               | 83                                 |
| Index (`git diff --cached`)          | vazio            | 10 arquivos do pacote de auditoria |
| Deployment de produção               | `dpl_HfDw` READY | `dpl_HfDw` READY (intocado)        |
| Branch Neon de produção              | 20 migrations    | 20 migrations (read-only)          |
| Staging                              | `dpl_7cdy`       | `dpl_7cdy` (intocado)              |
| VPS Hostinger                        | `[]`             | `[]`                               |

## 11. O que foi preparado × executado × pendente

**Preparado:** diff de health identity; plano de teste do chat; plano Hostinger; stage do pacote de auditoria; este relatório selado.

**Executado:** toda a Fase 0 read-only; diagnóstico DBT-100 por log; validação isolada do diff; stage seletivo; leituras Hostinger.

**Pendente (gate):** reexecução do PR #68; re-land do health identity; commit; teste do chat com branch Neon; qualquer ação Hostinger.

## 12. Evidências

- `captures/00-preflight.txt`
- `captures/01-phase0-state.txt`
- `captures/02-dbt100-failures.txt`
- `captures/02-dbt100-remediation.md`
- `captures/03-health-identity.diff`
- `captures/03-health-identity-history.txt`
- `captures/03-health-identity-test.txt`
- `captures/04-chat-staging-blocked.md`
- `captures/05-hostinger-readonly.txt`
- `captures/06-phase3-stage.txt`
- `captures/07-final-state.txt`
- `captures/08-release-execution.txt`
- `PLANO-HOSTINGER.md`
- `MANIFEST.sha256`

## 13. Limites (estado pré-autorização)

Nenhum segredo foi lido ou persistido. Nenhuma escrita em produção, Neon, Vercel, DNS ou Hostinger foi executada **antes do adendo**. O WIP alheio foi preservado. A prova de zero violações de CSP no chat autenticado **não** existe nesta janela. O health identity **não** foi publicado nesta release. O DBT-100 foi endereçado pelo fix de identidade do kit e validado no PR run `40063365002`.

## 14. Execução pós-autorização (2026-10-24T05:10Z)

| Item                     | Resultado                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #68                   | **MERGED** em `2026-10-24T04:54:55Z`; merge commit `b8bc52e`                                                                                            |
| Checks do head `0ab2eba` | `verify-release`, `verify`, `scan + cobertura`, Neon, Sonar, docs-light, Fork-guard e main-coverage-mirror: **SUCCESS**                                 |
| Kilo Code Review         | `ACTION_REQUIRED` por **falta de créditos da conta**; não é gate obrigatório do ruleset `24333849` e o último review válido não achou defeito de código |
| Main CE                  | `status=OK`, `new_coverage=82.2`, ratings 1/1/1, duplicação 1.1, hotspots 100; `releasePolicy ADR-042/coverage-minimum-60` OK                           |
| Vercel                   | `dpl_BtH5YVqmd2QTKs5V2fNRGuomrAeB` **READY**, target production, SHA `b8bc52e`                                                                          |
| Aliases                  | `sage`, projeto e `git-main` → `dpl_BtH` (old `dpl_HfDw`)                                                                                               |
| Health                   | `ready` 200 `postgres: ok`; `live` 200; `get-session` 200 `null`                                                                                        |
| Runtime                  | 0 erros em 1h; 0 logs error/fatal no deployment em 30m                                                                                                  |
| Rollback                 | `dpl_HfDw` READY (`main@cf910bf`)                                                                                                                       |
| CI identity              | `0ab2eba` provado sob provisioners mistos no PR run `40063365002` (prepare antigo, verify novo)                                                         |
| Pendente                 | G2 health identity; G4 chat no staging; G5 Hostinger                                                                                                    |
