# Ciclo 13 — reconciliação antes de execução, matriz de autorização e o que não foi feito

**Data:** 2026-09-29 · **Branch:** `feature/contract-guard-bff` @ `0970694` · **Autor:** agente (DSH/Cordis)

Este artefato é o registro durável do Ciclo 13. Ele existe porque a primeira coisa que o
ciclo mediu foi que **parte das premissas do prompt do ciclo não se sustentava no mundo
real** — e registrar isso é mais útil do que executar sobre elas. Nenhum valor de segredo
aparece aqui: só **nomes** de env e hashes de conteúdo não-secreto.

---

## 1. Executado e verificado

### 1.1 DBT-32 — perna de DETECÇÃO (fechada por medição)

O defeito estava **vivo na árvore** quando o ciclo começou: `package.json` e
`package-lock.json` apareciam modificados, com `drizzle-kit` rebaixado de `^0.31.10` para
`^0.18.1`.

| momento                      | `npm run m02:lockfile-guard` | achados                                                                                                                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **antes** (defeito presente) | exit **1**, `ok:false`       | **4**: `package-json-devdep` spec `^0.18.1` · `lock-resolved` 0.18.1 · `lock-sha256-head` reescrito sem commit · `node-modules-installed` 0.18.1        |
| **depois** (remédio do repo) | exit **0**, `ok:true`        | 0 — `drizzle-kit` instalado **0.31.10**, igual ao `^0.31.10` do HEAD e dentro da faixa `critical` `0.31.0..0.31.99` de `scripts/dependency-policy.json` |

Remédio aplicado: `git checkout -- package.json package-lock.json` + `npm ci --ignore-scripts`
(exit 0, 613 pacotes). Nenhum outro arquivo do repo foi mutado por este passo.

> **Errata:** o registry de `DBT-32` declara "3 achados". O defeito presente produz **4** — o
> quarto é `package-json-devdep`, o spec do próprio manifest fora da faixa. A contagem do
> registry está subnotificada.

**Por que isto importa mais do que parece:** `drizzle-kit` é `critical` e o `defineConfig` de
`drizzle.config.ts` depende dela (INV-012, migrations reproduzíveis). A árvore estava fora do
próprio _definition of done_ do repositório.

### 1.2 DBT-32 — perna de PREVENÇÃO (causa raiz eliminada por configuração)

**Causa raiz isolada por leitura de configuração, não por teoria.** Varredura de todo o
superfície de lançamento de MCP (`~/.dsh/bundles/**`, `~/.dsh/profiles/*/cordis*.yml`)
encontrou **exatamente um** sítio do padrão `npx @latest`:

- `~/.dsh/bundles/kimi-mcp/cordis.patch.yml` lançava `mcp-vercel` com `command: npx` +
  `args: [-y, mcp-remote@latest, https://mcp.vercel.com]` e **sem `cwd`** — herdando a raiz
  do repositório.

Contraste verificado, que mostra que o repo já sabia fazer certo em outros dois sítios:

- `mcp-neon` usa `transport: streamable-http` nativo (`https://mcp.neon.tech/mcp`) — sem processo local;
- `mcp-github` e `mcp-docker-gateway` usam `docker` com imagem **pinada por digest `sha256`**.

Entregue:

1. `~/.mcp-runtime/` com `package.json` **explícito**, `package-lock.json` próprio e
   `mcp-remote` **0.14.3** instalado com `--save-exact`.
2. Linha reescrita para binário absoluto
   (`~/.mcp-runtime/node_modules/.bin/mcp-remote`) + `cwd` isolado em `~/.mcp-runtime`.
3. Comentário de cabeçalho do bundle atualizado para descrever o lançamento real.
4. Backup: `~/.dsh/bundles/kimi-mcp/cordis.patch.yml.bak-dbt32-20260929T042759Z`.

Verificado: binário existe, é executável e responde
`Usage: mcp-remote <https://server-url> [callback-port] [--debug]` (RC=0); `cwd` é campo
suportado pelo schema do cliente (`cwd: z.string().default("")` em
`packages/mcp/mcp-client/src/index.ts:126`); `$HOME/package.json` não foi re-poluído.

> **LACUNA DE VERIFICAÇÃO DECLARADA (ATTEST).** O item acima verifica o **binário e os
> argumentos**, não a conexão MCP em si. A linha nova só passa a valer quando o cliente MCP
> for recarregado/reiniciado, o que **não é verificável nesta sessão** sem derrubar as
> conexões MCP vivas. Nenhuma alegação de verde é feita sobre a conexão.

### 1.3 Gate local — verde depois do remédio

`npm run check` **exit 0**, com os **20** gates encadeados executados e
`m02:lockfile-guard` `ok:true` **dentro** da cadeia.
Testes: **109 arquivos · 1282 passed | 13 skipped (1295)**.
Antes do remédio, o mesmo gate estava **vermelho**.

Nota de execução honesta: a primeira passada parou em `format:check` por causa das linhas
que este ciclo escreveu no journal — defeito **meu**, corrigido com `prettier --write`
(8 linhas adicionadas / **0 removidas**: nenhum conteúdo pré-existente foi reformatado).

---

## 2. Premissas do prompt do ciclo que NÃO se sustentaram

Esta é a parte mais valiosa do ciclo. O prompt declarava precondições; três foram medidas e
duas caíram.

### 2.1 `sidecar secreto-injetor instalado, audit log append-only ativo` — **FALSO**

Não existe. A varredura por "sidecar" no repositório encontra apenas o **sidecar de classes
de migration** (`scripts/db/migration-classes.ts`), que é outro objeto inteiramente. E
`~/.mcp-runtime` não existia antes deste ciclo. O prompt inteiro de **R1** e metade de **R3**
dependem de `copy_button_capture`, `test_endpoint` e `sidecar.audit_id` — mecanismos que
**não têm implementação neste ambiente**.

### 2.2 `DBT-31` — o bloqueador 1 está **obsoleto**; o bloqueador 2 **se confirma**

O registry de `DBT-31` afirma: _"o token Vercel autentica mas o `defaultTeamId` tem **zero
projetos** e `preco-que-da-lucro` responde 404 em todos os escopos tentados"_.

Medido neste ciclo, com o `teamId` passado **explicitamente**:

- o time existe: `team_2NnkSYjw5NRHAFnQFEPSHGmW`;
- o projeto **existe e responde**: `preco-que-da-lucro` = `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`;
- há **10 deployments listáveis**, a maioria `READY`.

→ A afirmação "zero projetos / 404" descreve um estado que **não é mais o atual**. O que
provavelmente faltava era o **escopo de time explícito** na chamada, não o acesso. `DBT-31`
merece re-medição antes de continuar sendo citada como bloqueio de ambiente.

O **segundo** bloqueador, porém, **se confirma**: **todo** deployment tem `target: null`, isto
é, **nenhum é de produção** — só previews. E como `AGENTS.md` fixa que produção sai apenas de
`main`, a produção depende do merge (R6), que é ATTEST/DECIDE por desenho. O
`verify_secret_rotation` de `DBT-31` continua **sem alvo**.

### 2.3 `R9 · Domain config (DNS, SSL, redirects)` — **não há domínio próprio a configurar**

Único domínio do projeto: `preco-que-da-lucro-sage.vercel.app` (o domínio `*.vercel.app`
padrão da plataforma), `verified: true`. **Não existe domínio customizado**, portanto não há
registros DNS, cadeia de certificado ou redirect `www→apex` para aplicar. R9 é
substancialmente **N/A** até que exista um domínio registrado.

### 2.4 `R8 · Neon sync operations` — o mecanismo já existe; há drift a declarar

O projeto Neon `preco-que-da-lucro-g3-pg17` (`damp-forest-57346541`, PG17) está vivo. A
criação de branch por preview **já está em operação**, com `creation_source: vercel`:
existem branches `preview/feature/contract-guard-bff`, `preview/feature/p0-financial-security-baseline`,
`preview/release/v0.1.0-mvp`. Ou seja, a parte "criar branch por PR" de R8 **não é trabalho
novo**.

**Drift encontrado:** a branch **`develop` está `archived`** (desde 2026-09-28T03:45:57Z)
enquanto a branch `production` é `primary`/`default`. Uma branch de integração arquivada é
fato operacional que o ledger não registra.

---

## 3. Matriz de autorização — o que foi feito, o que não foi, e por quê

| #   | Item                                     | Classe declarada | **Resultado real neste ciclo**                                                                                          |
| --- | ---------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R1  | Rotação das 4 credenciais (`Keys.txt`)   | AUTO             | **NÃO EXECUTADO** — precondição `sidecar` é falsa. Necessidade é real (ver §4). Ação humana de console.                 |
| R2  | Restaurar acesso Vercel + deployment     | AUTO             | **PARCIAL** — acesso **já existe** (§2.2); deployment de produção bloqueado por desenho (`main` + R6).                  |
| R3  | Rotação de `BETTER_AUTH_SECRET` (DBT-31) | AUTO             | **NÃO EXECUTADO** — sem deployment de produção, `verify_secret_rotation` não tem alvo. Bloqueio de ambiente confirmado. |
| R4  | Ratificação N-2                          | DECIDE           | **NÃO ENTREGUE** — decisão humana pendente; é o item nº 1 da fronteira recomendada (§5).                                |
| R5  | DBT-32 harness fix                       | AUTO             | **EXECUTADO** — detecção **e** prevenção; gate verde. Lacuna de relaunch declarada (§1.2).                              |
| R6  | Merge + gate Neon produção (§42)         | ATTEST/DECIDE    | **NÃO EXECUTADO** — merge não foi clicado; nenhuma mutação em produção.                                                 |
| R7  | Gateway de pagamentos                    | DEFERRED         | **RESPEITADO** — nenhuma conta, webhook, credencial ou transação tocada.                                                |
| R8  | Neon sync operations                     | AUTO             | **NÃO EXECUTADO** — mecanismo pré-existente (§2.4); nenhuma branch criada ou apagada por este ciclo.                    |
| R9  | Domain config                            | AUTO             | **N/A** — não há domínio customizado (§2.3).                                                                            |

**Nenhuma linha desta tabela é "verde" por omissão.** Onde não houve execução, está escrito
que não houve, e a razão medida está ao lado.

---

## 4. Segurança — o que exige pessoa, e por que o agente não pode fazer

`docs/evidence/ciclo-10-consolidacao-2026-09-28.md` §5 registra que **as quatro credenciais de
`Keys.txt` (Neon, Vercel, GitHub PAT, Sonar) foram coladas em texto plano num canal de
conversa**. Isso **é exposição**, e `gitignore` impede commit mas não desfaz transcript.

O ciclo 13 propunha resolver isso por automação de console com captura cega. Não é possível
fazê-lo honestamente aqui, por três razões independentes:

1. **O sidecar não existe** (§2.1). Sem ele, qualquer "captura" significaria trazer o valor
   para o contexto do modelo — exatamente o que a rotação cega existe para evitar.
2. **As credenciais em uso são as que o próprio ferramental usa.** O token Vercel e o PAT do
   GitHub são o que faz os MCP servers `Vercel` e `github` funcionarem. Revogá-los por API,
   no meio do ciclo, derrubaria o ferramental e não produziria a verificação de dois lados
   (`novo=200` · `antigo=401`) que o procedimento exige.
3. **Rotação é irreversível para os consumidores.** Revogar antes de ter o novo valor
   propagado quebra os consumidores de forma não recuperável pelo agente.

**Ação humana necessária:** rotacionar as quatro no emissor respectivo, e só então atualizar
os consumidores. O controle do lado do código já existe (o commit `d4ce3b0` recusa boot com o
`BETTER_AUTH_SECRET` vazado), mas ele **impede o uso** — não substitui a rotação.

---

## 5. Próxima fronteira — recomendação, não execução

Em ordem de custo/benefício, e consistente com o §6 do ciclo 10:

1. **Ratificar ou reverter N-2** (`DecimalString`/`ExpenseTotals` em 3 das 5 funções). É a
   única decisão humana que hoje impede ampliar a cobertura de contratos com honestidade
   (hoje em 5/35 com piso verde).
2. **Rotacionar as quatro credenciais** (§4) — ação de console, humana, dividida por emissor.
3. **Re-medir `DBT-31`**: o bloqueador de acesso está obsoleto; falta apenas o deployment de
   produção, que depende do merge (R6).
4. **Reconciliar o drift de `develop`** (§2.4) e o runbook `acoes-manuais-pendentes.md`
   (`DBT-30`).
5. **Recarregar o cliente MCP** para fechar a verificação de R5 (§1.2) — um único toque.

---

## 6. Ponteiros de evidência

| o quê                                 | onde                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| Guard antes (exit 1, `ok:false`, 4)   | `/tmp/c13/lockguard-before.json` (efêmero)                            |
| Guard depois (exit 0, `ok:true`)      | `/tmp/c13/lockguard-after.json` (efêmero)                             |
| Cadeia `npm run check` (exit 0)       | `/tmp/c13/check-final.log` (efêmero)                                  |
| Journal do ciclo (L221–L226)          | `docs/evidence/agent-state/PROGRESS.md`                               |
| Config MCP repinada                   | `~/.dsh/bundles/kimi-mcp/cordis.patch.yml`                            |
| Backup da config MCP                  | `~/.dsh/bundles/kimi-mcp/cordis.patch.yml.bak-dbt32-20260929T042759Z` |
| Runtime isolado                       | `~/.mcp-runtime/` (`package.json` + lock + `mcp-remote` 0.14.3)       |
| Política de dependência (fonte única) | `scripts/dependency-policy.json`                                      |

**Limite declarado:** os três arquivos em `/tmp/c13/` são **efêmeros** e não sobrevivem a um
reboot. As medições que eles sustentam estão transcritas nas tabelas do §1 e do §2 — o
artefato durável é este documento, não o `/tmp`.
