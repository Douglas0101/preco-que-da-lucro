# PLANO — Ondas 3 e 4 (segurança/UX e Neon/Auth)

**Fonte:** `docs/evidence/plan-partials-2026-09-13/part-4-seguranca-ux.md` (Onda 3) e `part-5-neon-auth.md` (Onda 4), ambos escritos contra `develop @ 83efb16`.
**Base real desta execução:** `develop @ 2382636` (fim da Onda 2). **Atenção:** as referências de linha das fatias **derraparam** — os operadores localizam por **símbolo**, nunca por linha.

## 1. Estado de partida verificado (não presumido)

| Item                                 | Já fechado?                                                                                    | Evidência                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **F0-04** (baseline re-derivável)    | **SIM** — fechado na Onda 0                                                                    | ledger: "F0-04 baseline controlado + `ai.model_attempt`" |
| **AUTH-005 A+B**                     | **SIM** — fechado na Onda 0                                                                    | ledger: "§32 fixação + AUTH-005 A+B"                     |
| 18.5 Skeleton                        | não — as 4 rotas têm **0** ocorrências de `Skeleton`                                           | recon direto                                             |
| 18.1 estado `estimated`              | não — `volumeSource` fixo em `"manual_simulation"`                                             | recon direto                                             |
| 18.3 explain                         | parcial — `MetricCard` usado em `inicio.tsx`, falta o slot `explain`                           | recon direto                                             |
| 20.5 rate limits (chat/tool/exports) | não — só buckets de **auth**; chat por contagem **com corrida**                                | recon direto                                             |
| 20.1 CSP enforcement                 | não — sempre `report-only`; **sem** `report-uri`/`Reporting-Endpoints`; sem endpoint de coleta | recon direto                                             |
| §12.5 schema diff                    | não — `compare_schema` = **0** no workflow                                                     | recon direto                                             |
| §12.4 parent/política                | não — parent = production                                                                      | fatia                                                    |
| §13.7 PITR memo/check                | não — sem `scripts/m02-pitr-check.mjs`                                                         | recon direto                                             |
| §12.6 spending scaffolding           | não — sem `scripts/m02-neon-spend.mjs`                                                         | recon direto                                             |
| §13.6 preparação de cutover          | não                                                                                            | fatia                                                    |

## 2. Propriedade de arquivo (o que evita colisão de escrita)

O plano ordena `18.5 → 18.1 → 18.3 → 20.5 → 20.1`, mas **18.1 e 18.3 disputam `simulacoes.tsx`**, e **18.5 e 18.3 disputam `inicio.tsx`**. A ordem do plano, portanto, coincide com a ordem de desbloqueio de arquivo — o que é conveniente. O que o plano **não** diz é que a Onda 4 é disjunta da Onda 3 (workflows/scripts/docs vs `src/**`), então as duas podem correr em paralelo.

| Operador | Item                              | Arquivos exclusivos                                                                                                     | Não pode tocar                                                                        |
| -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| O19      | 18.5 skeletons                    | `src/routes/_authenticated/{inicio,produtos,ponto-equilibrio,diagnostico}.tsx`                                          | `simulacoes.tsx` (18.1/18.3)                                                          |
| O20      | 20.5 rate limits                  | `src/server/auth/rate-limit-{rules,storage}.server.ts`, `src/lib/chat-execution.server.ts`, `src/lib/ai/tool-runner.ts` | `chat.functions.ts` (F2C-1), `security-headers.ts`/`start.ts` (20.1), `src/routes/**` |
| O21      | 18.1 estimated                    | `src/routes/_authenticated/simulacoes.tsx`, `src/server/services/simulation.service.ts`                                 | `inicio.tsx` (18.5/18.3)                                                              |
| O22      | 18.3 explain                      | `src/components/**` (explainer), `inicio.tsx`, `simulacoes.tsx`                                                         | — (só depois de O19 e O21)                                                            |
| O23      | 20.1 CSP                          | `src/lib/security-headers.ts`, `src/start.ts`, `src/routes/api/csp-report.ts`, `e2e/ui-stack.spec.ts`                   | `src/server/auth/**` (20.5)                                                           |
| O24      | §12.5 + §12.4                     | `.github/workflows/neon-pr-branch.yml`, `scripts/m02-v2b.mjs`, docs de evidência Neon                                   | `src/**`, `scripts/db/**`, `ui-stack.yml`, `ci-light.yml`                             |
| O25      | §13.7 + §12.6                     | `scripts/m02-pitr-check.mjs`, `scripts/m02-neon-spend.mjs`, `.github/workflows/neon-drill-ops.yml`, memo v3             | `src/**`                                                                              |
| O26      | §13.6                             | `src/server/auth/auth-policy.ts` (preflight por nome/estado), runbook de cutover                                        | —                                                                                     |
| O27      | **F2C-1** (safe-record sistêmico) | `src/lib/observability/**` (helper novo) + os **11 sítios** de `record`                                                 | feito **por último** (toca arquivos de 20.5/20.1)                                     |

## 3. Ondas de execução

**Wave A (em voo)** — 3 superfícies disjuntas: **O19** (18.5) · **O20** (20.5) · **O24** (§12.5+§12.4).

**Wave B** — **O21** (18.1, destrava `simulacoes.tsx`) + **O23** (20.1, CSP por último na ordem do plano) + **O25** (§13.7+§12.6, disjunto).

**Wave C** — **O22** (18.3, precisa de 18.5 **e** 18.1 no `develop`) + **O26** (§13.6).

**Wave D** — **O27** (F2C-1), explicitamente por último, porque sua superfície é a união de várias anteriores.

Cada integração: `git merge --no-ff --no-commit` → manifests do supervisor → gates → marcador parent-pinned → commit → **verificador adversarial** (V19…) com contexto _fresh_.

## 3.1 Disciplina do token DB (lição gravada em execução)

O token (`flock /tmp/opencode/onda2-db.lock`) serializa **operações curtas** de banco. **Nunca** se inicia processo **longevo** (preview server, dev server, watcher, daemon) **dentro** do lock: ele segura o token indefinidamente e **todos** os pares que precisam de DB passam a falhar (`flock -w 15` desiste em 15 s). Servidores sobem **fora** do token, ou não sobem.

Corolário de diagnóstico: quando **dois ou mais** children travam **ao mesmo tempo**, a hipótese primária é **recurso compartilhado** (token, porta, DB, disco), não dois defeitos independentes — e a correção é **libertar o recurso**, nunca _steer_ (que aborta a ferramenta em vôo).

## 4. Verificação por item (o que o V adversarial vai tentar falsificar)

| Item  | Alvo da falsificação                                                                                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18.5  | o skeleton **não** é genérico (espelha a geometria real); o anúncio a11y existe e é lido; `role="status"` + `sr-only` conferem; e **CLS/LCP/TTFB medidos ou declaradamente não-mensuráveis** — nunca números inventados                                               |
| 18.1  | o seletor `manual_simulation` × `forecast` é acessível; o badge e a origem do volume **não mentem**; salvar fica **desabilitado** para forecast; e a persistência **continua** rejeitando forecast (v1 não persistе — a UI não pode prometer o que o servidor recusa) |
| 18.3  | o explainer **não** expõe fórmula divergente de `finance.ts`; teclado/foco/axe; e o explainer da simulação usa a **origem do volume** correta                                                                                                                         |
| 20.5  | o bucket é **atômico** (burst distribuído com exatamente `max` permitidos); a ordem Zod→AuthZ→**rate→idempotência**; 429 é `RATE_LIMIT`; e não sobraram **dois limitadores concorrentes**                                                                             |
| 20.1  | a CSP **report-only** não foi afrouxada; o endpoint de coleta tem cap de payload e devolve 204; o assert do e2e foi ajustado **sem** relaxar; e `CSP_ENFORCE` é o único caminho de enforcement (rollback por env)                                                     |
| §12.5 | o diff é **vazio** quando o PR não mexe em `drizzle/**`; o skip sem chave é **explícito**, não silencioso; nenhum id/segredo hardcoded                                                                                                                                |
| §12.4 | a expressão de parent dá `production` para `main` e `develop` para o resto (provado por simulação); a política de dados registra a **caveat** do schema-only (`__drizzle_migrations` não é copiado)                                                                   |
| §13.7 | o memo usa os **endpoints oficiais**; o script só lê; e o drill **não toca produção** (PITR sobrescreve a branch raiz)                                                                                                                                                |
| §13.6 | o preflight de env é por **nome/estado**, sem valor; o probe de auth **não** é o `get-session` isolado (probe fraco, `dia-d:202-210`)                                                                                                                                 |
| F2C-1 | **helper único**, não 11 `try/catch`; os 11 sítios migrados; e comportamento inalterado no caminho saudável (args de `record` byte-idênticos)                                                                                                                         |

## 5. Dependências humanas (não bloqueiam as ondas, bloqueiam o dia-D)

- **H-6** (tráfego real) — bloqueia §13.6 de ponta a ponta e qualquer SLO real (§29/§30). Detector de desfecho **armado e vivo** (`app-live-watch`, 7 d; 660 polls, 404 consistente, **zero falso positivo**).
- **H-4 / P9** (PITR ≥ 7 d) — bloqueia §13.7 além do memo/check e é a única exigência pré-tráfego do plano.
- **H-2** (token Vercel/Neon) — bloqueia a validação **ao vivo** de §12.5/§12.4/§12.6; a implementação segue por construção.
- **H-8** (ADR-029) — governança, novo desta rodada.

## 6. Residuais declarados de partida

1. **Sem `NEON_API_KEY`** neste ambiente → §12.5/§12.4/§12.6 são entregues por construção + skip explícito, com a chamada ao vivo marcada como **não verificável**.
2. **Sem preview do Vercel** (H-2) → o enforcement do 20.1 fica validável só estaticamente + no e2e local; a validação em preview é residual declarado.
3. **Sem tráfego** (H-6) → nenhuma medição de performance pode ser rotulada como produção; qualquer número é CONTROLADO (mock/local), como já decidido para §29.
4. **Placar oficial segue não remedido** (`part-E` = 77,8%) — as projeções por delta subdeclaram ~0,27–0,53pp.
