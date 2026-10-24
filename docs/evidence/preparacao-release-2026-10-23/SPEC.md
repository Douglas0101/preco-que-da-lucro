# SPEC — Preparação autônoma com gate de aprovação humana (2026-10-23/24)

## Fato-fonte

- Prompt SDD recebido em 2026-10-23 (hora local), executado em 2026-10-24 UTC.
- `develop` local e `origin/develop` = `228589e1c2aea0cfaf6ac3c0e5109b0a560a417c` (revert do health identity).
- `origin/main` = `cf910bf4754b0097c7bdae653d476cbd9422cdc4`; produção Vercel = `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4` (`READY`, target `production`).
- Staging `staging.diretrizprecifica.com` → `dpl_7cdyMc7xmiwGQR4goQ1ru8Soy2GK` (`develop@12de0bf`).
- PR #68 aberto (`develop` → `main`), head `228589e`; `verify` e `verify-release` vermelhos.
- Pacote `docs/evidence/deploy-vercel-audit-2026-10-23/` não commitado, selado e verificado.

## Problema

O prompt parte de premissas que precisam ser medidas, não presumidas:

1. que `diretrizprecifica.com` serve o deployment Vercel;
2. que a árvore está limpa;
3. que o vermelho do PR #68 é uma falha genérica de runner;
4. que a correção é pinar uma tag Docker do Playwright (`v1.53.1-noble`);
5. que é permitido criar um branch `feat/health-identity-main` e um PR draft.

A execução read-only mostrou que (1) e (2) são falsas, (3) é parcialmente falsa, (4) é inaplicável e (5) conflita com o ruleset `24347682` do repositório (somente `develop` e `main`).

## Contrato

- Fase 0 estritamente read-only.
- Nenhum commit, push, merge, promoção de alias, alteração de DNS, criação de VPS ou branch Neon.
- Nenhum segredo lido, impresso ou persistido; somente nomes de variáveis e identificadores públicos.
- Nenhuma escrita no Neon de produção; a única consulta foi `SELECT` read-only.
- Nenhuma alteração em `main` nem no deployment `dpl_HfDw`.
- WIP alheio preservado; stage seletivo restrito ao pacote de auditoria.
- Veredito declarado como PASS, PARTIAL, BLOCKED ou NOT EXECUTED; ausência de prova não vira verde.
- Guards, budgets e testes não são afrouxados para obter verde.

## DoD

- [x] Fase 0: produção `READY`, staging com identidade, Neon com 20 migrations, sem escrita.
- [x] Fase 1: causa raiz do PR #68 medida por log real; remediação proposta; nenhum workflow alterado.
- [x] Fase 2: diff de health identity preparado e validado em worktree isolado; nenhum branch/PR criado.
- [x] Fase 3: pacote de auditoria staged seletivamente; nenhum commit.
- [ ] Fase 4: chat autenticado no staging com branch Neon efêmera — **BLOCKED** no gate humano.
- [x] Fase 5: plano Hostinger documentado; nenhuma escrita na Hostinger.
- [x] Fase 6: pacote selado com `MANIFEST.sha256`.

## Testes executados

- `sha256sum -c MANIFEST.sha256` no pacote de auditoria (9/9 OK).
- `curl` anônimo em staging (302 Vercel Authentication) e em `sage` (200 JSON).
- `web_fetch_vercel_url` autenticado em staging (200 JSON com identidade).
- `tools.vercel.list_deployments` / `get_alias` (deployment, SHA, alias).
- `tools.neon.run_sql` read-only (`count(*)` em `drizzle.__drizzle_migrations`).
- `gh run view --log-failed` / `gh api` (steps e jobs vermelhos do PR #68).
- `context7` (Playwright Docker/CI e Hostinger DNS/VPS).
- `tools.hostinger.execute` somente leituras (`dns_records_list`, `vps_virtual-machines_list`).
- Worktree isolado: `npx vitest run src/test/health-readiness-logging.test.ts` 8/8 PASS; `npx tsc --noEmit` exit 0; `git apply --check` do diff PASS.
- `npm run m02:state:check` exit 0 (marcador ancestral válido, folga 7/13).

## Riscos

- O domínio canônico é Hostinger Horizons, não o app Vercel: qualquer health check nele é falso verde.
- O staging está protegido por Vercel Authentication; probe anônimo recebe 302, não o JSON.
- `dpl_7cdy` é anterior ao revert `228589e`; o staging não representa o HEAD de `develop`.
- O health identity foi commitado (`12de0bf`) e revertido (`228589e`) sem entrada no journal; a intenção do revert é desconhecida e precisa ser confirmada antes de re-lander.
- O PR #68 não tem patch de código seguro para DBT-100; a remediação medida é reexecução completa do workflow.
- A Fase 4 exige autorização explícita e não foi executada; criação de branch Neon e mudança de env do staging são mutações reais.
- O plano Hostinger troca um site Hostinger Horizons existente; não é uma migração de aplicação Vercel para VPS.

## Rollback

- Nenhuma mutação de produção foi feita; não há rollback a executar.
- O stage do pacote de auditoria é reversível com `git restore --staged docs/evidence/deploy-vercel-audit-2026-10-23/`.
- O diff de health identity não foi aplicado ao checkout principal; o worktree isolado foi removido.

## Adendo 2026-10-24T05:10Z — execução autorizada

O contrato acima descreve a fase de preparação. Sob autorização total do dono, o PR #68 foi mergeado em `b8bc52e`, a `main` teve CE real OK (`new_coverage=82.2`, `releasePolicy ADR-042 OK`), a Vercel publicou `dpl_BtH5YVqmd2QTKs5V2fNRGuomrAeB` e os aliases `sage`/projeto/`git-main` foram movidos. Ver `README.md` §14 e `captures/08-release-execution.txt`. G2 (health identity), G4 (chat no staging) e G5 (Hostinger) permanecem deferidos.
