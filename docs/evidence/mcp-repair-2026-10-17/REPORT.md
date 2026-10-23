# Reparo dos MCPs que não carregavam — 2026-10-17

**Escopo autorizado pelo dono:** "conserte a fundo os MCPs que estão com problema".
**Natureza:** operação com uma perna na **máquina** (config viva, fora do versionamento) e outra no
**repositório** (a guarda que devia ter visto o defeito). Nenhum push, commit, deploy, merge, alias ou
toque em `main`/produção. Nenhum valor de credencial lido, transcrito ou registrado.

## 0. Sumário — o que estava quebrado, medido

| servidor                       | estado medido                              | causa-raiz medida                                                    | desfecho                                                        |
| ------------------------------ | ------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `aikido` (Cline)               | **não carregava** — _skipped_              | cache npx sem manifesto (`ENOENT`) + linha de runner **sem `cwd`**   | **reparado e verificado** (10 ferramentas)                      |
| `vercel` (Cline e pi/opencode) | **não carregava** — _skipped_              | OAuth exigido, sem `refresh_token`                                   | **declarado** — exige login humano (Via A)                      |
| `amplitude` (Cline)            | **não carregava** — _skipped_              | OAuth exigido, `access_token` sem refresh                            | **declarado** — exige login humano (Via A)                      |
| `context7` (Cline)             | carregava                                  | duplicata do `context7` do gateway + chave literal em `metadata.key` | **nomeado** pela guarda (não foi removido: decisão do dono)     |
| gateway `MCP_DOCKER`           | **carregava** (200 no handshake com token) | —                                                                    | intacto (6 sítios inalterados, provado em `05-config-diff.txt`) |
| `dhi`, `neon`                  | carregavam                                 | —                                                                    | intactos                                                        |

A medição primária é do **próprio cliente** (`~/.cline/data/logs/cline.log`,
`2026-10-17T05:17:49.702Z`, repetida em 05:23:19 e 05:25:53): três linhas
`[mcp] Failed to load tools from MCP server …, skipping`. Captura integral (com `code_challenge` e
`state` do fluxo PKCE recortados por política): `captures/04-cliente-log-falhas.txt`.

## 1. O `aikido`: causa-raiz e reparo

**O que o cliente disse, textualmente** (não interpretado):

```
MCP process exited for "aikido" (code=254, signal=null). stderr: npm error code ENOENT
npm error path /home/douglas/.npm/_npx/9a60de26ed7bbd1b/package.json
npm error enoent Could not read package.json
```

**Reprodução determinística** (`captures/03-aikido-controle-negativo.txt`), em cache npm **própria**
(o cache real não foi tocado): instalar a linha antiga cria `_npx/9a60de26ed7bbd1b/`, apagar dali o
`package.json` e rodar de novo devolve **`exit=254`** com **o mesmo hash de diretório** medido na
máquina. Não é uma teoria sobre um cache corrompido: é a mesma falha, no mesmo endereço.

**A segunda metade do defeito é estrutural:** a linha era `npx -y @aikidosec/mcp@1.0.9` **sem `cwd`** —
isto é, o _pin_ existia e o defeito continuava, porque o que faltava era o runtime isolado
(mecanismo do DBT-32). Um runner sem `cwd` resolve o "projeto" subindo a árvore a partir do diretório
corrente, que num cliente aberto sobre um checkout **é** o checkout.

**Reparo aplicado** (`captures/05-config-diff.txt`): a linha passou a ser **binário absoluto com `cwd`
fora de qualquer checkout**, que é a forma que o próprio runbook prefere a um runner:

```json
"aikido": {
  "transport": {
    "type": "stdio",
    "command": "/home/douglas/.mcp-runtime/node_modules/.bin/aikido-mcp",
    "args": [],
    "cwd": "/home/douglas/.mcp-runtime"
  },
  "disabled": false
}
```

O runtime isolado `~/.mcp-runtime/` — que o runbook cita como pré-condição e que o DBT-32 registra
como prevenção já executada — **não existia mais** em 2026-10-17 (descoberta desta janela). Foi
recriado com `0700`, `package.json` explícito e `@aikidosec/mcp@1.0.31` por `--save-exact`; o
diretório de cache corrompido (792 MB, só `node_modules/@aikidosec`, sem manifesto) foi
**quarentenado** — renomeado para fora do espaço de hash do npx, reversível por um `mv`.

**Verificação positiva** (`captures/07-aikido-positivo.txt`): o processo lançado **exatamente como o
cliente o lança** responde `initialize` (`Aikido MCP Server`) e `tools/list` com **10** ferramentas
`aikido_*`.

**Limite declarado:** as ferramentas carregam, mas a **primeira chamada** exige login Aikido no
navegador — o próprio servidor o diz em stderr (`Opengrep setup skipped: Aikido authentication
required.`). Carregar não é autenticar, e este relatório não os confunde.

## 2. A classe: por que a guarda não viu o defeito

Duas medições, ambas com o código real:

1. **O catálogo não conhecia o cliente que estava rodando.** O `--home` do código do `HEAD`
   auditava **1** sítio; nenhum deles era `~/.cline/data/settings/cline_mcp_settings.json`
   (`captures/01-guard-home-antes.txt`). Havia oito sítios de config MCP na máquina.
2. **A linha real estava aninhada em `transport`, e a guarda só lia a forma plana.** O código
   anterior lia `row["command"]`; a entrada do Cline declara `transport.command`. Mesmo com o sítio
   no catálogo, o defeito teria passado. Prova, com a linha real como fixture e os dois códigos
   (`captures/08-guarda-classe-antes-depois.txt`): **antes → `exit=0` com "OK"**; **depois →

O que mudou em `scripts/mcp-runtime-guard.ts` e `src/test/mcp-runtime-guard.test.ts`:

- `homeCatalog()` passa a cobrir os **sítios medidos**: config do Cline, `~/.pi/agent/mcp-adapter.json`
  e `mcp.json`, plugin Vercel, app-tools do Codex, `opencode.json` e a config do Gemini. Um sítio novo
  continua reprovando por _default_ (`checked === discovered`).
- `auditJsonConfig` lê **as duas formas** (plana e aninhada em `transport`), com o nível de fora vencendo.
- Detecção de credencial deixa de olhar só `env`: passa a olhar `env`, `headers` e `metadata`, com
  **detecção por nome de campo** (`authorization`, `key`, `token`, `api_key`, …) porque um valor sob
  nome de credencial é uma credencial mesmo quando a entropia não denuncia — é o caso da chave do
  context7. `Bearer <valor>` é citado pelo **valor** (fingerprint), nunca pelo cabeçalho inteiro.
- **Segundo parser** para o esquema do opencode (`mcp.servers`, `command` em **array**): "não é o meu
  formato" não pode virar "não é minha conta".
- 31 casos na suíte da guarda (**20 originais intactos** + 11 novos). Uma regra nova que silencia a
  antiga não é uma regra — e foi exatamente o que um primeiro rascunho fez, com o regex de placeholder
  engolindo um `github_pat_…`; o caso está pinado em teste (`as regras puras decidem pelos casos que
importam`).

## 3. `vercel` e `amplitude`: bloqueio humano, declarado e não escondido

A sonda HTTP independente (`captures/02-sonda-http.txt`) separa o que é autenticação do que é
disponibilidade, **sem enviar credencial nenhuma**:

| superfície                              | sem credencial                                             |
| --------------------------------------- | ---------------------------------------------------------- |
| gateway `MCP_DOCKER` (`127.0.0.1:8811`) | **401** `Bearer realm="MCP Gateway"` — o gateway autentica |
| `dhi.io/mcp`                            | 200                                                        |
| `mcp.context7.com/mcp`                  | 200 (anônimo; a chave existe para limites de uso)          |
| `mcp.neon.tech/mcp`                     | 401                                                        |
| `mcp.vercel.com`                        | **401** `invalid_token … No authorization provided`        |
| `mcp.amplitude.com/mcp`                 | **401** `Missing authorization header`                     |

Nem `vercel` nem `amplitude` têm `refresh_token` na config do Cline: não há renovação possível, só
reautorização por navegador (**Via A**). O `amplitude` chegou a produzir URL de autorização no log do
cliente; o `vercel` não. **Não foram desabilitados** — o `README-mcp-docker.md` do próprio harness é
explícito: a pendência "não deve ser escondida desabilitando o servidor". Ficam registrados como
dívida com closure verificável (servidor na superfície + sonda autenticada 200).

## 4. Invariantes do repositório (a asserção do passo 6 do runbook)

`package.json` e `package-lock.json` foram medidos **antes** de qualquer mutação da máquina e
reconferidos no fim: `6851b1cd…` e `a245989f…`, **byte a byte idênticos**
(`captures/09-invariantes-manifestos.txt`). Os dois manifestos **já estavam modificados** antes desta
sessão (WIP alheio de frontend/auth), então `git status` não serve de baseline — o baseline é o hash.
O reparo é cirúrgico por medição: dos 7 servidores da config viva, **6 `INALTERADO`, 1 `ALTERADO`**
(`05-config-diff.txt`).

O escopo-repositorio da guarda continua **0 sítios / `exit=0`** (este repositório não versiona config
MCP), e agora ele é **passo direto do `verify`** em `.github/workflows/ui-stack.yml` (DBT-33, metade
heavy), com a linha da tabela do `AGENTS.md` atualizada no mesmo commit e os **59** testes de
cobertura/tiers verdes (`captures/10-testes.txt`).

## 5. Limites declarados

1. **`vercel`/`amplitude` continuam não carregando** até um humano completar o OAuth. Nada aqui
   autoriza contornar verificações de segurança de fornecedor.
2. **Duas credenciais literais continuam na config viva**, agora _nomeadas_ pela guarda
   (`headers.Authorization` do gateway, 64 bytes; `metadata.key` do context7, 43 bytes). A chave do
   gateway é literal por exigência do cliente (os headers do Cline não expandem `${VAR}`) e a
   contenção vigente é permissão `700`/`600`; a chave do context7 é duplicata do servidor que o
   gateway já serve. **Removê-las é decisão do dono**, não deste reparo.
3. **O estado do `oauth.*` não é auditado** pela guarda: ali vive o armazenamento do próprio
   mecanismo OAuth (renovado pelo cliente), não um valor que o operador colou num arquivo de config.
   Um armazenamento em texto claro continua sendo um fato — declarado aqui e no registry, fora do
   veredito da guarda.
4. **A causa da perda do `package.json` no cache npx não foi isolada** (nenhum log npm da mutação) —
   a mesma classe de limite que o DBT-32 já declara. O que foi eliminado é o caminho de falha: a linha
   deixou de ser runner.
5. **A config do Gemini tem 0 byte** e a guarda a reporta como **pré-condição** (`JSON ilegível`), não
   como aprovação nem como violação. O arquivo não foi tocado.
6. **O detector de ausência do runtime isolado não existe**: `~/.mcp-runtime/` sumiu uma vez sem que
   nada acusasse. Registrado como dívida com closure a desenhar.
7. **A metade light do DBT-33 segue aberta por decisão**, não por esquecimento: aquele pipeline só
   dispara com **todos** os arquivos alterados sob `docs/evidence/**`, onde nenhum dos dois sítios do
   escopo-repositorio vive — o passo seria vacuidade permanente, e cerimônia em CI é o que este repo
   proíbe. A ratificação do `✘` nomeado (ou a inclusão do passo) é humana.

## 6. O que **não** foi feito

- Nenhum push, commit, merge, deploy, promoção de alias, mudança de ruleset ou de limiar.
- Nenhum banco tocado (nem local, nem de PR, nem de produção).
- Nenhuma dependência do repositório alterada; nenhum manifesto reescrito.
- Nenhum teste, guarda, regra ou orçamento afrouxado ou removido.
- Nenhuma credencial lida em claro, transcrita em journal/evidência nem posta em `argv`.
- Nenhum sítio novo "declarado fora do contrato" para calar a guarda: os oito sítios medidos são
  auditados, e dois deles com parser próprio.

## 7. Gate local — onde ele está verde e onde já estava vermelho

`npm run check` **não** é declarado verde: a cadeia foi executada passo a passo e **20 dos 21** passos
saíram `0`, com exceção do **primeiro**.

| passo                                                                                                                                                                                                                                                                                                                                               | resultado                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `m02:lockfile-guard` (passo 1)                                                                                                                                                                                                                                                                                                                      | **VERMELHO — pré-existente, alheio a este reparo** |
| `guard:upgrade`, `check:migration-toolchain`, `guard:contracts`, `m02:work-package-guard`, `m02:debts-guard`, `m02:temporal-guard`, `m02:state:check`, `m02:boundaries`, `m02:secrets-audit`, **`guard:mcp-runtime`**, `m02:seal-dts:check`, `m02:matrix:check`, `check:ui-stack`, `check:no-supabase-runtime`, `format:check`, `lint`, `typecheck` | `EXIT=0`                                           |
| `test`                                                                                                                                                                                                                                                                                                                                              | `EXIT=0` — **147 arquivos / 2315 testes PASS**     |
| `build`, `check:bundle`                                                                                                                                                                                                                                                                                                                             | `EXIT=0`                                           |

O vermelho do passo 1 é **medível como alheio**: (a) ele reprova comparando o lock do _worktree_ com o
do `HEAD`, e os dois manifestos estão modificados na árvore — com o **mesmo hash** do baseline desta
janela, medido antes de qualquer mutação; (b) o diff é de frontend/shadcn (`@fontsource-variable/*`,
`@phosphor-icons/react`, `cn`, `next-themes`, `shadcn`); (c) o `git status` inicial da sessão já listava
` M package.json` e ` M package-lock.json`; (d) o remédio que o próprio guard sugere
(`git checkout -- package.json package-lock.json`) **descartaria trabalho de outra sessão** — proibido
pela custódia de WIP. Captura passo a passo: `captures/12-gate-local.txt`.

`exit=1`**, `linha 'aikido' lança 'npx' sem 'cwd'`.
