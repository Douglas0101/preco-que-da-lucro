# ADR-043 — Topologia de publicação em produção e decisão de nonce da CSP

- Status: PROPOSTA — registro das duas decisões abaixo; ratificação pendente do
  MAESTRO. Nenhuma mutação de produção foi executada por este ADR.
- Data: 2026-10-08
- Escopo: identidade de publicação na Vercel, alcance público dos aliases do
  projeto e estado medido das violações de CSP que condicionam
  `CSP_ENFORCE=true`. Sem migração de banco e sem mudança de dependência.
- Dependências: ADR-017 (branching), ADR-037/038 (quality gate e espelho),
  ADR-039 (destinos de runtime), ADR-042 (cobertura mínima de 60%);
  `docs/runbooks/conditional-publication.md`; plano §20.1.

---

# Parte A — Publicação em produção e topologia de domínio

## Contexto

Fatos medidos em 2026-10-08, com evidência em
`docs/evidence/production-runtime-incident-2026-10-08/`:

1. **Identidade pública corrente.** O alias público
   `preco-que-da-lucro-sage.vercel.app` aponta para
   `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`, sha
   `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`, target `production`, `READY`,
   construído em 2026-10-01T14:52:06.674Z. A última escrita nesse alias foi em
   2026-10-08T19:00:33.986Z. Hoje ele responde `/api/health/live`
   `200 {"status":"ok"}`, `/api/health/ready`
   `200 {"status":"ready","dependencies":{"postgres":"ok"}}` e
   `/api/auth/get-session` `200 null`.
2. **A revisão de `main` não serve o alias.** `main` HEAD é
   `fa45632391ad9ffe1d20d3bad5264a53b565638e` (PR #60, merge em
   2026-10-08T17:35:28Z). Seu deployment de produção
   `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` está `READY` e **não** carrega o alias
   público. Enquanto o alias esteve brevemente atribuído a ele,
   `/api/health/ready` respondeu `503 not_ready` e `/api/auth/get-session`
   respondeu `500`. O alias voltou ao deployment antigo às 19:00:33.986Z; a
   última falha de readiness registrada ocorre 14 ms depois dessa escrita —
   correlação, não prova de ordenação.
3. **Topologia de alcance.** Projeto `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`:
   `autoAssignCustomDomains=false`, ou seja, a publicação do domínio
   customizado é manual; e `ssoProtection.enabled=true` com
   `deploymentType="all_except_custom_domains"`. Consequência medida: **todo**
   alias `.vercel.app` deste projeto fica atrás da Vercel Authentication e
   apenas o domínio customizado é publicamente alcançável. Confirmado por
   fetch — `preco-que-da-lucro-douglasultimatesouza-5127s-projects.vercel.app`
   e `preco-que-da-lucro-gssnblvr8.vercel.app/api/health/ready` devolvem a
   página de login da Vercel, não JSON.
4. **Rollback por redeploy está bloqueado pelo fornecedor.** Um redeploy da
   revisão antiga (`dpl_4vNYvd5xcXRBjVRyRcp9Fri7mhxz`) foi recusado com
   `BLOCKED_PACKAGE` porque resolve `@tanstack/react-start@1.168.49`, abaixo do
   piso obrigatório `>=1.168.60` (GHSA-qx66-fv34-fjm8 / CVE-2026-102989). O
   lockfile corrente resolve exatamente `1.168.60` — no piso, satisfazendo
   `>=`, e portanto sem folga.
5. **Lacuna de observabilidade.** A linha de log decisiva para o 503 não
   existe. De um lado, a retenção do plano Hobby rejeitou `since=7d` e
   `since=1h` com `400 bad_request` (só `since=30m` funciona). De outro, e mais
   grave, `src/routes/api/health/ready.ts:14` passa o `Error` cru a `logJson`,
   que serializa apenas `name` e `message`; `error.cause`, onde vive o
   discriminante de SQLSTATE/host, nunca é escrito. A consulta agregada
   (`vercel_get_runtime_errors`, `since=7d`) devolveu `health.readiness_failed`
   para `dpl_6h2LTZ` — `count=6`, de 17:50:54Z a 19:00:34Z — mas sem o detalhe
   que discrimina. O artefato existe e continua não-discriminante: é defeito da
   própria chamada de log, não apenas de retenção.

## Opções

**(a) Status quo — o domínio customizado como única entrada pública, com
publicação manual.**

- Custo: nenhum; a topologia já é esta.
- Risco: a produção permanece numa revisão que o fornecedor classifica como
  vulnerável, e o fornecedor recusa reconstruí-la — o rollback por redeploy
  está fechado. Além disso a causa raiz do 503 não está isolada e nada garante
  que o sintoma não retorne.

**(b) Desligar o SSO dos aliases `.vercel.app` do projeto, para que as URLs de
deployment sejam diretamente testáveis.**

- Custo: uma configuração de projeto; ganho real de testabilidade — qualquer
  URL de deployment passaria a responder JSON sem login.
- Risco: **amplia a exposição pública.** Este ADR declara isso sem atenuante: a
  regra governante proíbe ampliar permissão apenas para fazer um health check
  passar. A opção só se sustenta se for justificada por mérito próprio —
  verificação de runtime em ambiente real, que hoje é justamente o bloqueio
  `H-6` da promoção da CSP (Parte B) — ou rejeitada. "Para o health check
  ficar verde" não é justificativa.

**(c) Um alias público dedicado de preview/staging fora de produção, para
verificação de runtime.**

- Custo: um alias e a disciplina de publicar nele apenas SHA aprovado;
  preserva a capacidade de verificação de runtime.
- Risco: um segundo destino público precisa ser reconciliado no runbook de
  publicação — receptores automáticos suspensos e identificados (§1 de
  `docs/runbooks/conditional-publication.md`). Um preview pode carregar
  override próprio de `DATABASE_URL` e divergir de produção, produzindo
  veredicto falso. Preview é evidência de runtime, nunca evidência de release.

## Decisão (PROPOSTA)

1. **Recomendação: (a) como estado corrente, com (c) como caminho.** Manter o
   domínio customizado como única entrada pública de produção e a publicação
   manual, e construir um alias público dedicado de não-produção para
   verificação de runtime. A opção **(b) não é adotada**.
2. Nenhuma publicação em produção de `fa45632` ou posterior ocorre antes de
   cumprir a cadeia de precondições de
   `docs/runbooks/conditional-publication.md` §1-§3: gate local, PG17/RLS,
   matriz completa atual, checks aplicáveis no SHA e reconciliação head/base.
   Por ADR-042, exige-se a decisão **real** do Compute Engine sobre o SHA de
   `main` — `new_coverage >= 60%` e os checks de runtime aplicáveis. **A
   medição da PR não prova cobertura de `main`.** Merge e publicação são ações
   distintas.
3. A testabilidade de runtime não é obtida por ampliação de exposição em
   produção; é obtida por um destino segregado (c). Se (b) vier a ser
   proposta, entra como proposta própria com justificativa de mérito, nunca
   como passo desta decisão.
4. A causa raiz do 503 permanece **não isolada**. As hipóteses ranqueadas e o
   experimento decisivo bloqueado estão em
   `docs/evidence/production-runtime-incident-2026-10-08/README.md`. Este ADR
   não declara causa.

## Consequências

- **Exposição de segurança do status quo.** A produção serve uma revisão com
  vulnerabilidade conhecida (`@tanstack/react-start@1.168.49`,
  GHSA-qx66-fv34-fjm8) e o fornecedor recusa reconstruí-la — o rollback por
  redeploy está fechado. A contenção que restaurou o serviço mantém esse risco
  aberto, e ele não é resolvido por este ADR.
- **Lacuna de observabilidade.** `src/routes/api/health/ready.ts:14` deveria
  serializar a causa do driver, não apenas `name`/`message`. Corrigir isso é o
  que teria tornado o incidente diagnosticável sem ler credencial. Até lá,
  qualquer recorrência do 503 em produção continua não-discriminante.
- Esta decisão não aprova publicação. Nenhum destino público novo é criado por
  ela.

---

# Parte B — Decisão de nonce da CSP

## Contexto

A política CSP do repositório é estática e `script-src 'self'` exato. O plano
§20.1 decidiu não usar nonce, e três travas independentes congelam essa
decisão:

- `src/test/security-headers.test.ts:93` — `expect(policy).not.toContain("nonce-")`,
  junto da lista fechada de diretivas (linhas 80-95) e da trava
  `not.toMatch(/unsafe-inline|unsafe-eval|strict-dynamic/)` (linha 91).
- `docs/evidence/agent-state/SPEC-CARDS/20.1-csp.md:13` — lista NÃO-fazer:
  "adicionar host/diretiva em `script-src`".
- `docs/evidence/csp-2026-09-15/report.md:212-215` — nota 3 de interpretação:
  o plano decidiu não usar nonce; introduzir nonce quebraria T1/T2 e exigiria
  decisão de spec.

**Disponibilidade da capacidade.** `router.options.ssr.nonce` existe e está
integralmente conectado nos pacotes instalados:
`@tanstack/router-core/src/router.ts:543-545` (a própria opção `ssr.nonce`),
`ssr/ssr-server.ts:406` (`createHydrationScripts(router.options.ssr?.nonce)`),
`ssr/hydrationScripts.ts:80-131` (nonce repassado às tags iniciais) e
`:453-455` (`<script nonce="…">`), além de
`@tanstack/react-router/src/ScriptOnce.tsx:15`. O framework também emite
`<meta property="csp-nonce">` e o lê de volta no cliente
(`@tanstack/router-core/src/load-client.ts:2205`). Portanto a objeção histórica
do plano — nonce exigiria threading no SSR sem driver concreto — **não se
sustenta mais**: o driver existe e está na versão instalada.

## Estado medido hoje (2026-10-08)

Cinco violações foram observadas em produção pelo alias público, todas com
`disposition=report` — a política servida é
`content-security-policy-report-only`, então nada é bloqueado. São elas: 2×
`<script>` inline (`script-src-elem`), 2× `<style>` inline (`style-src-elem`) e
1× `eval` (`script-src 'self'`, `unsafe-eval`). Captura verbatim em
`docs/evidence/production-runtime-incident-2026-10-08/captures/browser-csp-report-only-violations.txt` —
a confirmação do lado do servidor, independente do browser, aparece no mesmo
artefato como `event=csp.violation` com `effectiveDirective:"style-src-elem"`.

Depois da remediação que está **na árvore de trabalho e ainda não foi
commitada**:

| violação                                       | estado         | como                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eval` do zod                                  | **ELIMINADA**  | `z.config({ jitless: true })` em `src/lib/csp/zod-jitless.ts`, aplicado a partir de `src/router.tsx`. A chamada é load-bearing: `package.json:4` tem `"sideEffects": false`, que derruba importação por efeito colateral pura.                          |
| `<style>` e `onclick` inline da página de erro | **ELIMINADOS** | estilos em `public/error-page.css`; handler substituído por `<a href="">`. Nenhum atributo de evento pode ser nonced nem hasheado, então a única saída CSP-limpa é não usá-lo.                                                                          |
| `<style>` injetado em runtime pelo sonner      | **REDUZIDA**   | o CSS do sonner também passa a ser servido por `sonner/dist/styles.css` via `src/styles.css`, então os toasts renderizam mesmo que a injeção seja bloqueada. **O evento de report não é eliminado**; fechar exige patch ou substituição da dependência. |
| 2× `<script>` inline do SSR TanStack           | **PERMANECEM** | são os bloqueadores reais do enforcement.                                                                                                                                                                                                               |

## O que uma decisão futura teria de mudar, e o custo

1. Alterar `script-src` de `'self'` para algo como `'self' 'nonce-{dinâmico}'`.
   É mudança de diretiva congelada: quebra a lista fechada e as travas de
   `src/test/security-headers.test.ts` (linhas 91 e 93) e exige decisão de spec
   do plano §20.1. Rollback: reverter a política.
2. **Nonce não desliga `'self'`.** Apenas `'strict-dynamic'` propaga confiança
   a scripts injetados por um script nonced. Sem ele, scripts externos seguem
   autorizados por `'self'`/host — ou seja, adicionar nonce **não** fecha
   injeção por origem desconhecida e **não** remove a necessidade da lista de
   origens. O ganho seria apenas habilitar os dois `<script>` inline do SSR.
3. A paridade report-only × enforce (T1) precisaria ser re-derivada e o
   critério de "relatório limpo" do §5 reescrito.
4. Existe alternativa de custo comparável — hash `'sha256-…'` — e a própria
   mensagem do navegador já calculou os hashes (por exemplo
   `sha256-zFML+AEdb/HsbX66VlYzBOqJKNNHs5/WNGYP8JiblyY=`), mas ela exige hash
   estável por tag e é igualmente mudança de diretiva congelada. Nenhuma das
   duas foi decidida aqui.

## Gate de promoção (ainda não cumprido)

`CSP_ENFORCE=true` somente depois de cumprir
`docs/evidence/csp-2026-09-15/report.md` §5, medido em ambiente real:

1. **Canal vivo antes de contar:** uma violação sintética observada durante a
   janela aparece no log estruturado (`event=csp.violation`). Sem isso, "zero
   violações" é indistinguível de canal morto e a janela é inválida.
2. **Janela:** ≥3 execuções de soak sobre as rotas autenticadas (`/inicio`,
   `/produtos`, `/ponto-equilibrio`, `/diagnostico`, `/simulacoes`, `/chat`)
   com ≥500 page-views e ≥72 h de coleta contínua — o **maior** dos dois — e
   última coleta ≤24 h antes da virada.
3. **Zero violações** nas diretivas que a promoção congela (`script-src`,
   `object-src`, `base-uri`, `form-action`, `frame-ancestors`, `default-src`):
   contagem literal de `event=csp.violation` agrupada por `effectiveDirective`
   igual a **0**. Qualquer valor acima de 0 reprova a janela.

**A evidência de hoje já reprova esse gate:** os dois `<script>` inline do SSR
TanStack permanecem, e são violações de `script-src`. A remediação acima
reduziu o conjunto de cinco para dois, não o zerou — e a política continua em
report-only, sem enforcement exercitado em produção.

## Decisão (PROPOSTA)

1. **Não** introduzir nonce agora. A capacidade existe e está verificada, mas a
   decisão de spec §20.1 e três travas a congelam; e o ganho seria apenas
   habilitar os dois scripts inline do SSR, sem fechar injeção por origem —
   nonce não desliga `'self'`.
2. A promoção para `CSP_ENFORCE=true` permanece bloqueada pelo gate §5, que a
   evidência atual não satisfaz.
3. Se uma rodada futura decidir por nonce ou por hash, ela precisa alterar a
   diretiva, atualizar os testes de paridade e a lista fechada, e re-derivar o
   critério de relatório limpo — como proposta própria, não como passo desta.

## Referências

- `docs/evidence/production-runtime-incident-2026-10-08/` (identidade,
  timeline, diagnóstico diferencial e limites declarados).
- `docs/runbooks/conditional-publication.md` §1-§3 (cadeia de precondições e
  gate de runtime: `/api/health/live`, `/api/health/ready` e
  `/api/auth/get-session` precisam responder JSON do backend).
- ADR-042 — `new_coverage >= 60%` e decisão real do CE no SHA de `main`.
- `src/lib/security-headers.ts`, `src/test/security-headers.test.ts`,
  `docs/evidence/agent-state/SPEC-CARDS/20.1-csp.md`,
  `docs/evidence/csp-2026-09-15/report.md`.
- `src/lib/csp/zod-jitless.ts`, `src/router.tsx`, `src/lib/error-page.ts`,
  `public/error-page.css`, `src/styles.css` (remediação não commitada).
