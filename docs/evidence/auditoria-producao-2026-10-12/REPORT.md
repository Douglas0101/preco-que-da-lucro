# Relatório de Auditoria Real de Produção — Preço Que Dá Lucro

**Data da sessão:** 2026-10-12 (UTC) · **Método:** Computer Use (navegador real), APIs de plataforma
(read-only), provas HTTP, inspeção SQL read-only, execução local isolada.
**Regra aplicada:** nenhuma escrita em produção, nenhum deployment, nenhum DNS, nenhum merge, nenhuma
credencial exposta. **Zero mutação em produção.**
**Evidências brutas:** `RAW-EVIDENCE-LOG.md`, `captures/http-probes.txt`, `captures/git-and-versions.txt`,
`captures/security-headers.txt`, `captures/local-verification.txt`, `MANIFEST.sha256`.

---

## 0. Sumário executivo

1. **A produção publicada está degradada.** O deployment atribuído a `production`
   (`fa456323…`, 2026-10-08) **não alcança o banco**: `/api/health/ready` devolve
   **503 `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}`** e
   `/api/auth/get-session` devolve **500**, de forma **determinística** (não intermitente).
2. **A única instância funcional é mais antiga e opera abaixo do piso de segurança.**
   `preco-que-da-lucro-sage.vercel.app` serve `d4b9395` (v1.0.1, 2026-10-01), que resolve
   **`@tanstack/react-start@1.168.49`** e **`@tanstack/start-server-core@1.169.31`** — abaixo do piso
   obrigatório (`>=1.168.60` / `>=1.169.39`, GHSA-qx66-fv34-fjm8 / CVE-2026-102989).
3. **O domínio canônico não serve o produto.** `diretrizprecifica.com` (e `www.`) entrega um site
   estático de builder (última modificação 2026-09-06) com **catch-all**: qualquer path responde 200
   `text/html`, inclusive `/api/health/ready`. Todo `200` medido ali mede o site, não a aplicação.
4. **`main` não está publicado.** `main` = `40c1a355` (PR #61 mergeado, 2026-10-11) sem registro de
   deployment de produção; o último registro de `production` é `fa45632` (2026-10-08).
5. **A infraestrutura de dados está íntegra** (RLS 35/37, menor privilégio, 20/20 migrations sem drift,
   write-path Vercel→Neon **provado** por linha de RUM da própria sessão), mas **a branch Neon `develop`
   está `archived` desde 2026-10-09T18:35:05Z** — relevante porque um `DATABASE_URL` apontando para um
   endpoint não-servido é exatamente a classe do 503 observado.
6. **A causa raiz do 503 não é isolável de fora** — e isso é um achado por si: a revisão publicada não
   carrega o discriminador de falha de banco que **já existe em `develop`**. Publicar uma revisão nova
   resolve simultaneamente o piso de segurança e a capacidade de diagnóstico.

**Veredito global: FAIL (produção não entrega o produto no destino declarado; BLOCKED nos fluxos
autenticados).**

---

## 1. Escopo, método e limites

**Fases executadas:** descoberta de ambiente, Computer Use em produção, provas HTTP, correlação
Vercel↔Neon, inspeção de banco read-only, verificação local isolada.
**Limites declarados (não são sucessos implícitos):**

| Limite                                               | Motivo                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Logs de runtime Vercel                               | MCP Vercel passou a **403** ("re-authenticate to this scope") na sessão |
| Env vars do projeto Vercel (só nomes, nunca valores) | idem — leitura de configuração indisponível                             |
| Fluxos autenticados em produção                      | sem identidade de teste autorizada                                      |
| Responsividade/zoom em produção                      | o navegador controlado não expõe viewport                               |
| Telemetria de queries lentas                         | `pg_stat_statements` não instalado em produção                          |
| Atribuição alias↔deployment por API                  | MCP 403; atribuição inferida por comportamento + identidade de asset    |

---

## 2. Estado real de produção (identidade)

```
Usuário
  └─ dirigido a:  diretrizprecifica.com  ──▶ site estático de builder (Wix) — NÃO é a aplicação
                  preco-que-da-lucro.vercel.app        ──▶ app, BANCO QUEBRADO (503/500)   [deployment production fa45632]
                  preco-que-da-lucro-sage.vercel.app   ──▶ app, banco OK, revisão d4b9395 (abaixo do piso)
                          ↓ edge gru1 (São Paulo) → função iad1 (Washington)
                        TanStack Start SSR + server functions + BFF
                          ↓ Drizzle ORM
                        Neon PostgreSQL 17.11 — projeto damp-forest-57346541
                          ├─ production (ready, default, vinculada "vercel production branch")
                          ├─ develop (ARCHIVED desde 2026-10-09T18:35:05Z)
                          └─ ci-fixture-base (ready, vazia, não é alvo de teste)
```

**Identidade do deployment de produção (GitHub Deployments API):** `fa45632391ad9ffe1d20d3bad5264a53b565638e`,
criado `2026-10-08T17:46:02Z` por `vercel[bot]`, environment `Production – preco-que-da-lucro`.
**Revisão servida pelo alias funcional:** `d4b9395` (v1.0.1, 2026-10-01) — confirmada por
correspondência de assets e por bundle/versões resolvidas.
**Quatro estados possíveis, medidos separadamente (missão §15):**

| Correção                                     | Implementado no repo     | Validado em CI | Presente no deployment                       | Comprovado em produção |
| -------------------------------------------- | ------------------------ | -------------- | -------------------------------------------- | ---------------------- |
| Cabeçalhos de segurança + CSP report-only    | sim                      | sim            | **sim**                                      | **sim** (medido)       |
| Classificador de falha de banco no readiness | sim (`ready.ts:22-26`)   | sim            | **não** (revisões publicadas são anteriores) | **não**                |
| Guarda de `DATABASE_URL` vazia (`readEnv`)   | sim (`client.server.ts`) | sim            | **não**                                      | **não**                |
| Piso TanStack ≥1.168.60/≥1.169.39            | sim                      | sim            | **não** na revisão funcional                 | **não**                |

---

## 3. Resultados por plataforma

### 3.1 GitHub

- Repositório conectado: `Douglas0101/preco-que-da-lucro`. Exatamente **2 refs publicadas**
  (`develop` = `182754f`, `main` = `40c1a355`).
- **PR #61 está mergeado em `main`** (`40c1a35`; `0807115` é ancestral) — mas **não publicado**.
- Registro de deployment de produção mais recente: `fa45632` (2026-10-08). Não existe registro para
  `40c1a355`. `vercel.json` contém `{"git":{"deploymentEnabled":false}}` → builds por Git desabilitados.
- **Defeito de documento (P3):** `PROGRESS.md` §1 ("Estado corrente") afirma
  `develop` publicado `c940aef…` e `main` `d4b9395…` "sem mudança" — **contradito pelo remoto no momento
  da leitura** (`develop` `182754f`, `main` `40c1a355`) e pela própria tabela do arquivo (L790/L793/L824/
  L825/L827). É prosa de handoff que induz o próximo boot ao erro sobre o estado da release.

### 3.2 Vercel

- Projeto `prj_aKcy1gnNKvcQzf…` (`preco-que-da-lucro`), framework `tanstack-start-lovable`, Node 24.x,
  `ssoProtection` habilitado (`all_except_custom_domains`), `autoAssignCustomDomains=false`.
- **Dois aliases, mesmo build, bancos diferentes** (10/10 rodadas determinísticas):
  `-sage` = readiness **200**, sessão **200 `null`**; alias canônico = readiness **503**, sessão **500**.
  Assets idênticos (15 hashes), `/` = 9891 b nos dois, `/auth` = 9063 b nos dois → **mesma revisão de
  código, configuração de ambiente divergente**.
- Falha **determinística e rápida** (0,22–0,34 s): descarta cold start, saturação de pool e flap de rede;
  aponta configuração/destino de conexão.
- `/_vercel/insights/script.js` difere entre os dois aliases (4550 b vs 2084 b) → reforça que **não** são o
  mesmo deployment.
- Logs de runtime: **não lidos** (403 do MCP).

### 3.3 Neon

- Projeto `damp-forest-57346541` (AWS us-east-1), PostgreSQL **17.11**.
- 37 tabelas em `public`, 9 em `neon_auth` (0 linhas — schema gerenciado não usado), ledger
  `drizzle.__drizzle_migrations` com **20 aplicadas = 20 em disco → sem drift**.
- **RLS em 35/37 tabelas**, 39 policies; sem RLS apenas `ai_memory_policies` e `rum_vitals` (por desenho:
  telemetria/telemetria de IA). `app_runtime`: LOGIN, `noinherit`, `nobypassrls`, **não é membro de
  `authenticated`** — INV-010 verificado. `neondb_owner` com BYPASSRLS (owner, esperado).
- Dados (agregados, sem PII): users 2, tenants 2, profiles 2, sessões 2, `rum_vitals` 127… e
  **0 produtos, 0 vendas, 0 simulações, 0 despesas** — não há dados operacionais de negócio em produção.
- **Write-path Vercel→Neon provado:** a última linha de `rum_vitals` (`2026-10-12T00:57:54.012294+00`) foi
  gravada pela navegação do próprio auditor no alias funcional.
- **Achado:** branch `develop` **`archived`** (`state_changed_at` 2026-10-09T18:35:05Z). Qualquer
  `DATABASE_URL` apontando para o endpoint dela falha ao conectar — mecanismo compatível com o 503 medido,
  ainda **não** confirmado (exige leitura de env ou log discriminante).
- `pg_stat_statements` ausente → sem telemetria de queries lentas.

### 3.4 Aplicação (Computer Use, navegador real)

| Página/ação                                                                                           | Resultado                                                                     |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/` (alias funcional)                                                                                 | 200, título correto, **0 erros de console**, 20 requisições estáticas OK      |
| `/auth`                                                                                               | 200, formulário completo (Google, e-mail/senha, cadastro, recuperação)        |
| `/inicio` sem sessão                                                                                  | redireciona para `/auth?redirect=%2Finicio` — **proteção de rota funciona**   |
| Server function de sessão pré-redirect                                                                | **401** visível no console (ruído; sem vazamento de detalhe)                  |
| Rotas autenticadas (produtos, preços, vendas, despesas, simulações, ponto de equilíbrio, diagnóstico) | **BLOCKED** — sem identidade de teste autorizada                              |
| Login com credencial inválida                                                                         | **NÃO EXECUTADO** — escreveria em `rate_limits` (produção); exige autorização |

### 3.5 Performance — RUM real de produção (`rum_vitals`, 7 dias, 2026-10-12)

| Métrica | n   | p75    | p95    | min   | max    |
| ------- | --- | ------ | ------ | ----- | ------ |
| CLS     | 20  | 0,000  | 0,000  | 0,000 | 0,064  |
| FCP     | 28  | 1216ms | 2716ms | 188ms | 3712ms |
| INP     | 22  | 104ms  | 176ms  | 8ms   | 408ms  |
| LCP     | 20  | 1664ms | 2716ms | 276ms | 3712ms |
| TTFB    | 33  | 220ms  | 1187ms | 1,8ms | 1306ms |

Leitura: p75 dentro do "bom" em CLS/INP/LCP/TTFB; p95 de FCP/LCP/TTFB em "precisa melhorar" (cauda de
cold start). **Amostra pequena (20–33), inclui a sessão do auditor, uma única região** — não é benchmark.

### 3.6 Verificação local isolada (bancada PG17 local, container `postgres:17-alpine`)

- `npm run db:test` (cadeia de 18 suítes de banco/RLS/concorrência/migrações), contra o container local: **18/18 PASS, `exit 0`, ~31 s**.
- `npm run check`: **20/21 passos** — os passos 1–15 passaram na cadeia e o passo 16 (`format:check`)
  reprovou **exclusivamente** pelos dois `.md` não-rastreados deste pacote de evidência (nenhum
  arquivo rastreado fora de formato; `PROGRESS.md` incluído). Os passos 17–21 foram reexecutados
  isoladamente e passaram: `lint` 14 s, `typecheck` 12 s, `test` 167 s (**143 arquivos, 2198 testes,
  0 falhas**), `build` 5 s, `check:bundle` 1 s.
- **Depois de formatar o pacote de evidência a cadeia completa passou (`exit 0`)** — registro em
  `captures/final-gate.txt`; detalhe em `captures/local-verification.txt`.
- Nada do código do repositório foi alterado por esta auditoria; as únicas mutações da árvore foram o
  journal (`PROGRESS.md`) e este pacote, ambos **não publicados** (sem commit, sem push).
- Limites desta bancada: **não** exercita `test:e2e`, `test:visual`, migrations remotas nem Playwright
  contra produção.

---

## 4. Matriz de testes (missão §18)

| ID  | Cenário                            | Ambiente             | Resultado observado                                       | Status         | Sev. |
| --- | ---------------------------------- | -------------------- | --------------------------------------------------------- | -------------- | ---- |
| A   | Aplicação abre corretamente        | produção (2 aliases) | OK no `-sage`; app abre mas banco falha no alias canônico | PASS/FAIL      | P1   |
| B   | Rotas públicas funcionam           | produção             | `/`, `/auth` 200 com render real                          | PASS           | —    |
| C   | Autenticação autorizada funciona   | produção             | sem identidade de teste                                   | BLOCKED        | —    |
| D   | Navegação protegida funciona       | produção             | redirect para `/auth?redirect=…` comprovado               | PASS (parcial) | —    |
| E   | Dashboard carrega                  | produção             | exige sessão                                              | BLOCKED        | —    |
| F   | Produtos exibidos corretamente     | produção             | exige sessão; 0 produtos em produção                      | BLOCKED        | —    |
| G   | Preços e cálculos consistentes     | produção             | exige sessão                                              | BLOCKED        | —    |
| H   | Simulações sem escrita funcionam   | produção             | exige sessão                                              | BLOCKED        | —    |
| I   | Despesas exibidas corretamente     | produção             | exige sessão                                              | BLOCKED        | —    |
| J   | Vendas exibidas corretamente       | produção             | exige sessão                                              | BLOCKED        | —    |
| K   | Ponto de equilíbrio consistente    | produção             | exige sessão                                              | BLOCKED        | —    |
| L   | Diagnóstico financeiro funciona    | produção             | exige sessão                                              | BLOCKED        | —    |
| M   | IA responde corretamente           | produção             | server function autenticada                               | BLOCKED        | —    |
| N   | Backend sem erros inesperados      | produção             | 503 readiness + 500 get-session no alias canônico         | **FAIL**       | P1   |
| O   | Vercel associada ao commit correto | produção + GitHub    | `main` (40c1a355) **não** publicado; prod = `fa45632`     | **FAIL**       | P1   |
| P   | Neon acessível pelo backend        | produção             | OK no `-sage`; **não** no alias canônico                  | PASS/FAIL      | P1   |
| Q   | Schema compatível                  | Neon (read-only)     | 20/20 migrations, sem drift, RLS íntegro                  | PASS           | —    |
| R   | Contratos de persistência          | local isolado        | 18/18 suítes de banco verdes                              | PASS (local)   | —    |
| S   | Vazamentos sensíveis               | produção             | corpo 503 genérico, sem stack/segredo; CSP+headers OK     | PASS           | —    |
| T   | Experiência mobile                 | produção             | sem controle de viewport                                  | NOT TESTED     | —    |

---

## 5. Matriz de falhas

| ID  | Problema                                                                   | Sev.      | Causa raiz (comprovada? )                                                                                      | Evidência                                         | Impacto                                                                   | Correção                                                          |
| --- | -------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| F1  | Deployment de `production` não alcança o Postgres (503/500 determinístico) | **P1**    | Falha de configuração/destino de conexão. **Causa raiz não isolada** (revisão publicada não tem discriminador) | `captures/http-probes.txt` 10/10, 8/8             | Usuário no alias canônico não autentica nem usa qualquer recurso de banco | Revisão nova + env correta; log discriminante (já em `develop`)   |
| F2  | Domínio canônico serve site estático de builder, não o produto             | **P1**    | Destino do domínio aponta para publicação antiga Hostinger/Wix                                                 | HTTP + `last-modified: 2026-09-06`                | Produto não existe no domínio declarado                                   | Reconciliar destino (Hostinger ADR-039 / Vercel) — decisão humana |
| F3  | Revisão funcional em produção abaixo do piso de segurança TanStack         | **P0/P1** | Revisão `d4b9395` precede o piso; fornecedor recusa reconstruí-la                                              | `captures/git-and-versions.txt`                   | Exposição a CVE-2026-102989 na única instância que funciona               | Publicar revisão ≥ `40c1a355`/`182754f`                           |
| F4  | Revisão publicada sem discriminador de falha de banco                      | P2        | `ready.ts` antigo registrava o `Error` cru (sem `cause`)                                                       | Código atual em `develop` vs evidência 2026-10-08 | 503 recorrente não classificável em `dns/connect/tls/auth/pool/query`     | Já corrigido em `develop`; efetivo só após deploy                 |
| F5  | `PROGRESS.md` §1 contradiz o remoto (develop/main)                         | P3        | Prosa de handoff mantida à mão, não derivada da medição                                                        | `git ls-remote` vs §1                             | Próximo boot erra o estado da release                                     | Corrigir §1 (ou torná-lo derivado)                                |
| F6  | Evidência da 1ª passada com falso-verde (200 do catch-all)                 | P3        | Medição de `status` sem `content-type`/corpo                                                                   | ERRATAs 2.8.1–2.8.3                               | Diagnóstico errado sobre readiness                                        | Corrigido como errata neste pacote                                |
| F7  | Páginas autenticadas exibem título de aba "Lovable App"                    | P4        | Shell sem `head` por rota                                                                                      | snapshot de `/inicio`                             | UX/identidade                                                             | Item de backlog                                                   |
| F8  | 401 no console durante redirect pré-sessão                                 | P4        | Prefetch de sessão antes do redirect                                                                           | console do navegador                              | Ruído para o usuário/observabilidade                                      | Item de backlog                                                   |
| F9  | Branch Neon `develop` arquivada                                            | P3        | Arquivamento em 2026-10-09T18:35:05Z                                                                           | `neon_list_branches`                              | Qualquer destino que a use falha ao conectar; canal de dev fora do ar     | Decisão humana: restaurar ou declarar o estado                    |

---

## 6. Correções

**Aplicadas nesta auditoria (documentação/evidência, sem tocar código):**

1. `RAW-EVIDENCE-LOG.md` reescrito com as **erratas** das medições refutadas (F6) e com as medições
   corrigidas (código **+** content-type **+** corpo).
2. `captures/` criado com as provas brutas reexecutadas nesta sessão e `MANIFEST.sha256` do pacote.
3. Este relatório.

**Já implementadas em `develop` (verificadas em leitura, não reimplementadas):**

- `src/routes/api/health/ready.ts` registra `classifyDatabaseFailure(error)` + identidade do deployment
  (fecha F4 na próxima publicação).
- `src/db/client.server.ts` usa `readEnv("DATABASE_URL")` — string vazia falha explícita em vez de cair
  silenciosamente em `localhost:5432`.
- Cabeçalhos de segurança/CSP congelados em `src/lib/security-headers.ts`, com promoção opcional por
  `CSP_ENFORCE=true` e teste que proíbe nonce (`src/test/security-headers.test.ts:92-93`).

**Nenhuma correção de código foi necessária para F1/F2/F3:** as três são de **publicação/configuração de
plataforma** e exigem decisão humana (abaixo). Escrever código para escondê-las seria trocar erro visível
por falha silenciosa.

---

## 7. Riscos e decisões humanas

| Risco                                                  | Consequência hoje                                      | Decisão necessária                                         |
| ------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------- |
| Alias canônico público servindo app com banco quebrado | Usuário entra em app inutilizável                      | Corrigir env de produção **ou** retirar o alias            |
| Revisão funcional abaixo do piso de segurança          | Exposição a CVE-2026-102989                            | Autorizar publicação de revisão nova                       |
| Domínio canônico entregando site de builder            | Produto inexistente no domínio declarado               | Escolher destino (ADR-039 Hostinger vs Vercel) e executar  |
| Env var de produção não inspecionável pelo agente      | 503 recorrente sem isolamento de causa                 | Leitura humana no painel (nomes/valores nunca no contexto) |
| Branch Neon `develop` arquivada                        | Canal de desenvolvimento/qualquer uso dela falha       | Restaurar ou documentar o estado                           |
| `main` mergeado e não publicado                        | Correções de segurança aprovadas não chegam ao usuário | Autorizar publicação manual do SHA aprovado                |

---

## 8. Veredito por componente

| Componente               | Veredito                            | Justificativa em uma linha                                                          |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| FRONTEND                 | **PASS (parcial)**                  | Render real, 0 erros de console na landing; telas autenticadas não testadas         |
| BACKEND                  | **FAIL**                            | Deployment de produção não alcança o banco (503/500 determinístico)                 |
| AUTENTICAÇÃO             | **BLOCKED**                         | Sem identidade de teste; proteção de rota e endpoint de sessão funcionam no `-sage` |
| MOTOR FINANCEIRO         | **BLOCKED** (produção) / PASS local | 18 suítes de banco + suíte unitária verdes em bancada isolada                       |
| IA                       | **BLOCKED**                         | Server function autenticada; sem identidade de teste                                |
| VERCEL                   | **FAIL**                            | Produção com banco quebrado; logs/env inacessíveis ao agente (403)                  |
| NEON                     | **PASS (com achado)**               | Integridade, RLS e migrations OK; branch `develop` arquivada                        |
| INTEGRAÇÃO VERCEL ↔ NEON | **FAIL (parcial)**                  | Write-path provado no `-sage`; falha no deployment de `production`                  |
| SEGURANÇA                | **FAIL**                            | Piso de dependência violado na única revisão funcional (controles medidos: OK)      |
| PERFORMANCE              | **PASS (com ressalvas)**            | RUM real: p75 bom; p95 de FCP/LCP/TTFB na cauda; amostra pequena                    |
| EXPERIÊNCIA DO USUÁRIO   | **PASS (parcial)**                  | Entrada e auth limpas; mobile não medido; app autenticado inacessível ao auditor    |

---

## 9. Próximas ações (sequência segura, sem execução autônoma)

1. **Humano, Via A (painel Vercel, sem copiar valores):** conferir em `Production` a variável de banco do
   app — presença, e se o host corresponde ao endpoint da branch Neon `production` (a `develop` está
   arquivada; um valor vazio/obsoleto é a classe do 503). Registrar nome da variável e veredito, nunca o
   valor.
2. **Humano:** decidir o destino de `diretrizprecifica.com` (ADR-039: Hostinger primário) e executar a
   publicação; hoje o domínio entrega site de builder.
3. **Publicação manual da revisão aprovada** (`40c1a355` em `main`, ou `182754f` em `develop`) **após** a
   decisão obrigatória do CE (ADR-042, `new_coverage >= 60%`) e os checks aplicáveis — resolve F1 (se a
   env estiver correta) **e** F3 no mesmo ato, e ativa o discriminador de F4.
4. **Pós-publicação:** verificar readiness 200 + `get-session` 200 + escrita de RUM no deployment novo;
   comparar com o `-sage` e registrar o defeito de origem no painel.
5. **Repositório (`develop`, sem pressa):** corrigir o bloco §1 do `PROGRESS.md` (F5) e registrar esta
   auditoria no journal append-only.
6. **Backlog:** F7 (título por rota), F8 (401 de prefetch), F9 (branch `develop` arquivada — restaurar ou
   declarar), retenção/limpeza do alias público (ADR-043 §A).

---

## 10. Anexos

`captures/http-probes.txt` · `captures/git-and-versions.txt` · `captures/security-headers.txt` ·
`captures/local-verification.txt` · `captures/final-gate.txt` · `RAW-EVIDENCE-LOG.md` · `MANIFEST.sha256`

**Timezone das observações:** UTC (todas as medições). Fuso do operador: America/Sao_Paulo (UTC−03).
