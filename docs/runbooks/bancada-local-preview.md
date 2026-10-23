# Runbook — bancada local de preview (:4173) para CU e e2e

Bancada usada para **verificação de browser** (computer-user / depuração visual) e para a
suíte Playwright local. É composta por: container PG do
[`postgres-local-docker.md`](./postgres-local-docker.md), **seed** da fixture e um
**preview do build de produção** em `http://127.0.0.1:4173`.

Ordem importa: **semear ANTES de subir o preview** — o preview serve o build atual e o
seed é idempotente (upsert), nunca um alvo de teste descartável.

## Por que este runbook existe

O kit da bancada é **gitignored** (carrega credenciais de fixture em modo 0600 e não pode
ser versionado). O que era conhecimento de sessão virou contrato aqui: sem isto, a matriz
completa de e2e no PR volta a **gastar turns reais de IA** — já aconteceu, medido e
declarado como errata (ver "Errata do kit" abaixo). Este arquivo carrega os **mecanismos**
e os **nomes**; nunca os valores.

## Subir

1. `npm run db:up` (container `preco-que-da-lucro-postgres`, `:5432`).
2. Semear: `npm run e2e:prepare` (`scripts/e2e/seed-auth.ts`, upsert idempotente).
3. Subir o preview como **job gerenciado**, com o kit local (`.artifacts/bench-preview.sh`),
   exportando as variáveis de banco de fixture e as credenciais de e2e que vivem em
   `.artifacts/e2e-local.env` (0600): `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`,
   `E2E_DB_RUNTIME_PASSWORD`.
4. Health check: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/` ⇒ `200`
   (e `/inicio` ⇒ `200`).

## Os três consertos do kit (todos medidos)

### 1. Zerar as DUAS credenciais de IA — a legada **e** a atual

`AI_GATEWAY_API_KEY` (nome legado) **e** `DEEPSEEK_API_KEY` (nome atual). Zerar só a
legada deixa a chave atual ativa no `.env` e a bancada passa a fazer **chamadas reais**
(medido: ~7 turns de IA consumidos antes do conserto). O consumidor escolhe o ramo pelo
provedor, então **qualquer** credencial de IA ligada reintroduz a chamada externa.

### 2. Entrada direta do build, não `nitro preview`

```bash
node --env-file-if-exists=.env .output/server/index.mjs
```

### 3. Mecanismo (o que torna os dois anteriores necessários)

| caminho                          | o que acontece com o `.env`                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nitro preview`                  | carrega o `.env` em **runtime e sobrescreve** a variável exportada vazia (A/B medido: `ai.model_attempt outcome=success` com o env inicial vazio)          |
| `node --env-file-if-exists=.env` | **não** sobrescreve variável já definida no ambiente (semântica do Node) ⇒ o vazio exportado vence para a IA e os segredos de auth seguem vindos do `.env` |

Consequência prática: com a entrada direta, a bancada serve o build de produção com
**auth real do `.env`** e **IA desligada**, sem editar o `.env`.

## Armadilha medida: `/proc/<pid>/environ` não é prova

`/proc/<pid>/environ` mostra o ambiente **INICIAL** do processo e **não** reflete o dotenv
carregado em runtime. Ele **não** serve para provar que as chaves de IA estão vazias — a
prova é o A/B de comportamento (ver acima) ou a leitura do log (`ai.model_attempt`).

## Caminhada autenticada (padrão dos probes)

`storageState: ".artifacts/e2e-auth.json"` + `createRequire(<repo>/package.json)` para
resolver `playwright-core` + `channel: "chrome"` + `x-forwarded-for` de bucket próprio.
Medições de banco são feitas por `docker exec … psql -U postgres -d preco_que_da_lucro_test -tAc`
(sempre escopando por `product_id`/`tenant_id`, porque o banco de fixture carrega dados de
vários tenants). Exemplos vivos: `.artifacts/cu/depuracao-visual.mjs`,
`.artifacts/cu/prova-fase2a.mjs`, `.artifacts/cu/aceitacao-fase1.mjs`.

**Limite declarado:** os `--action` do driver genérico (`bench-browser.mjs`) rodam **antes**
do login — servem para sonda anônima; verificação autenticada usa um script no padrão acima.

## Suíte Playwright: reusar a bancada

`playwright.config.ts` usa `reuseExistingServer: !process.env.CI`. Com a bancada **de pé**,
o Playwright **não** sobe servidor próprio — de propósito: o `webServer.command` usa
`npm run preview`, que é `nitro preview`, e religaria as credenciais de IA do `.env`.

Env do processo do Playwright (nomes): `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`,
`DATABASE_ADMIN_URL`, `DATABASE_URL`, `DATABASE_DRIVER` — os specs que criam fixture
própria (vendas, composição) leem o banco por `DATABASE_ADMIN_URL`.

Projetos: `chromium` + `mobile` no dia a dia; a matriz completa (`firefox` + `webkit`) é do
PR/dispatch.

## Derrubar

Parar o job do preview e `npm run db:down`.

## Errata do kit (registrada, não apagada)

1. A primeira correção zerava **apenas** `AI_GATEWAY_API_KEY`; o `DEEPSEEK_API_KEY` seguiu
   ativo e a bancada fez chamadas reais de IA (~7 turns) antes de o defeito ser medido e o
   conserto fechado nos três sítios.
2. A primeira hipótese foi `nitro preview` + env exportado; o A/B mostrou o override do
   `.env` em runtime, o que levou à entrada direta do build.
