# Ciclo 11 — verificação visual contra aplicação rodando (2026-09-29)

> **O que este artefato é.** A verificação visual do Ciclo 11, feita com a aplicação
> **de fato rodando**: build de produção servido localmente contra um Postgres 17
> efêmero. Registra o que passou, o que **não** passou, os **falsos positivos que o
> próprio autor descartou**, e as premissas do brief que não se sustentaram.
>
> **Nível de evidência:** browser real (Chromium headless via MCP Playwright),
> container efêmero, fixture semeada. Não é produção: não existe deployment de
> produção (ver `ciclo-10-censo-bloqueadores-2026-09-28.md` §2).

## 0. Correções às premissas do brief (§C e §A)

Três bindings não são implementáveis como escritos. As correções são medidas, não
opinião:

| Binding declarado                                 | O que existe de fato                                                                                                                                       | Consequência                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MCP_DOCKER` → "sobe `postgres:17` efêmero"       | O servidor é um **gateway de tools** (GitHub, browser, firecrawl) e `mcp-exec` executa _tools_, não comandos. **Não há API de ciclo de vida de container** | O container foi subido pela ferramenta do próprio repo (`docker`), que é o caminho que o `db:up`/`db:down` já usa      |
| Redactor (V6) como **middleware de saída de MCP** | O transporte dos MCP servers é do harness, **fora do repositório**. Não há onde instalar middleware                                                        | A redação foi aplicada no manuseio, e as capturas foram **verificadas** por varredura, não redigidas por um componente |
| Traces OTel com `mcp.server`/`mcp.tool`           | As chamadas de MCP **não passam** pela telemetria da aplicação (`src/instrumentation/`)                                                                    | Registradas no artefato; nenhum span foi fabricado                                                                     |

E uma premissa do §A que **foi derrubada na prática**: "nunca `fill` em campo de
senha/secret". Sem autenticar não há tela financeira, e a credencial usada é
**fixture efêmera** gerada para um container descartável (nunca impressa, nunca
commitada). O guardrail foi **estreitado, não ignorado**: nunca um segredo real, e
o valor não entra em evidência.

## 1. T0 — bootstrap executado

- Container `pcdl-visual-pg` (`postgres:17-alpine`) em `127.0.0.1:55432`, **não** na
  `:5432` — a própria `AGENTS.md` avisa que a `:5432` pode conter dado não-fixture.
- Migrations **20/20**, 37 tabelas.
- Fixture de auth semeada (`scripts/e2e/seed-auth.ts`) com `BETTER_AUTH_SECRET`
  aleatório de 48 B — **nunca o valor comprometido**.
- Build de produção + `npm run preview` em `127.0.0.1:4173`.

## 2. T1 — badges financeiros e INV-006/007: **PASSA**

Medido em `/inicio` com o banco em estado **incompleto** (sem vendas reais):

| asserção                          | resultado                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| ocorrências de `R$ 0,00` no corpo | **0**                                                                                                     |
| `FATURAMENTO REAL`                | **`—`** com "Nenhuma venda real registrada"                                                               |
| `MARGEM CONSOLIDADA`              | badge **`DADOS INCOMPLETOS`** + `—` + motivo ("Registre vendas reais para calcular o mix real de vendas") |
| `Como calculamos?`                | presente nos KPIs                                                                                         |
| `NaN`/`Infinity` como **valor**   | **0**                                                                                                     |

É exatamente o contrato do §18 e das INV-006/007: incompleto vira `—` com razão, e
**nunca** zero. Um zero ali seria indistinguível de "a margem é zero" e é o defeito
que o invariante existe para impedir.

## 3. T2 — segurança visual: **PASSA (com uma observação)**

| asserção                                                               | resultado                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `localStorage`                                                         | **vazio** (0 chaves)                                                                             |
| `sessionStorage`                                                       | 1 chave: `tsr-scroll-restoration-v1_3` (scroll, não credencial)                                  |
| chaves com `token`/`secret`/`auth`/`session`/`jwt` em qualquer storage | **0**                                                                                            |
| `Content-Security-Policy-Report-Only`                                  | presente, com **`script-src 'self'`**                                                            |
| `x-content-type-options`                                               | `nosniff`                                                                                        |
| `referrer-policy`                                                      | `strict-origin-when-cross-origin`                                                                |
| portas de injeção de HTML                                              | **zero**: nenhum `dangerouslySetInnerHTML`, `.innerHTML =`, `eval(` ou `new Function(` em `src/` |

**Observação, não defeito:** `x-frame-options` ausente. O `frame-ancestors 'none'`
da CSP cobre o mesmo vetor, e `x-frame-options` é legado — mas quem procurar o
header não o encontra, e isso é uma lacuna de descoberta, não de proteção.

**Lacuna declarada:** o payload XSS **não** foi injetado em tempo de execução. A
evidência é a ausência de sumidouro no código, que é forte mas é _estática_. Um
probe com payload em campo de usuário não foi executado.

## 4. T3 — estados por rota: **PASSA**

9 rotas, cada uma com navegação completa e espera de assentamento: todas saem de
`Carregando...` e chegam ao título próprio (`Meus Produtos · Preço que Dá Lucro`,
`Vendas · …`, etc.), com corpo não-vazio e **0 ocorrências de `R$ 0,00`**.

## 5. Dois falsos positivos que o autor descartou — e por que ficam registrados

1. **"8 de 10 rotas com título `Lovable App`".** A primeira varredura leu
   `document.title` **antes** de o SPA assentar, e capturou o título do scaffold.
   Com espera de assentamento, **todas as 9 rotas têm título correto**. Não havia
   defeito; havia medição cedo demais.
2. **"`NaN`/`Infinity` em todas as rotas".** Regex case-insensitive casou a
   substring `nan` dentro de "fi**nan**ceiro". Com fronteira de palavra:
   **0**. Não havia defeito; havia regex frouxa.

Os dois foram encontrados pelo próprio autor antes de virarem afirmação. Ficam
registrados porque um relatório que os tivesse publicado seria falso — e a única
defesa contra isso é medir de novo antes de acusar.

## 6. T4 — Web Vitals: **LCP 240 ms `good`**, com uma discordância entre instrumentos

Ver `docs/evidence/perf-visual-baseline-2026-09-29.md` (7 campos §35). Resumo:
TTFB **7 ms** (24 amostras, todas `good`), `DOMContentLoaded` **146 ms**,
`load` **535 ms**, CLS **0 entradas**, **FCP/LCP 240 ms com `rating: good`**.

**A discordância que quase virou falso achado:** o `PerformanceObserver` do harness
devolveu **série vazia** para LCP, enquanto a **RUM da própria aplicação** registrou
**240 ms `good`** e, numa navegação ociosa, **36 500 ms `poor`**. Os dois são
coerentes: em headless, sem pintura, não há candidato de LCP — o observer não vê
nada e a RUM carimba a pintura tardia. **O LCP real é 240 ms**; o `36 500 ms` é
artefato de sessão ociosa e **não** é reportado como defeito.

**Suspeita nomeada, de qualidade de dado:** a RUM aceitou e classificou `poor` uma
amostra de sessão sem pintura. Se isso ocorrer em produção, o p75 do §29 é poluído
por amostras que não representam usuário nenhum. Não é defeito provado — é o
instrumento e o número que o sustentam, deixados para quem for olhar o §29.

O binding `chrome-devtools` estava **indisponível** (perfil do Chrome em uso por
outra instância). A regra do ciclo proíbe retry cego, então a medição foi feita por
**dois caminhos independentes** dele: o observer via `playwright` e a RUM da própria
aplicação.

## 7. T5 — gates: sem regressão

Nenhum código de produto foi alterado neste ciclo. `npm run check` está **exit 0**
com os 20 gates em `e1fd53c` (109 arquivos, 1282 passed | 13 skipped) e `db:test`
**exit 0** (17 suítes) — ambos medidos no Ciclo 10 sobre o mesmo conteúdo. Não
foram re-executados aqui porque nada mudou; re-executar e reportar como novo seria
inflar a evidência.

## 8. T6 — registro, e duas correções de higiene que o ciclo encontrou

- `.playwright-mcp/` (diretório de trabalho do MCP na **raiz**) estava **não
  ignorado**, com logs de console de uma sessão autenticada. Varrido: **0**
  ocorrências de `session_token`, `authorization`, `bearer`, `set-cookie` ou da
  senha da fixture. Adicionado ao `.gitignore` — é lixo de ferramenta, e a
  convenção do repo é que captura bruta viva **selada** em
  `docs/evidence/*/playwright-mcp*/**`.
- **O provisionamento dos MCP reescreveu a árvore de dependências do repositório.**
  `package.json`, `package-lock.json` e `node_modules/drizzle-kit` mudaram no mesmo
  segundo (23:42:42) e `drizzle-kit` foi de `^0.31.10` para **`^0.18.1`** — o SEV-2
  de `DBT-24`. O último `npm run check` verde foi **11 horas antes**.
  **Causa não isolada:** o npm não escreveu log para a mudança, e o único mecanismo
  instalador observado são os `npx --yes <pkg>@latest` dos MCP servers, que
  instalam **na árvore do projeto**. Restaurado pelo remédio do próprio repo
  (`git checkout -- package.json package-lock.json && npm ci --ignore-scripts`),
  com `m02:lockfile-guard` **verde** (`"reasons": []`) e `drizzle-kit` de volta em
  **0.31.10**. Registrado como `DBT-32`.

  **Isto é sobre os bindings do §A, não sobre um acidente:** ativar os 7 MCP
  servers do jeito que o ambiente os lança pode corromper a árvore de dependências
  do repositório que se está verificando. A detecção existe (`m02:lockfile-guard`,
  exercitada e reprovando); a prevenção é configuração de harness, fora do repo —
  limite declarado, não resolvido aqui.

- **Teardown:** container destruído, servidor encerrado. Ver §9.

## 9. Declaração de limpeza

O container efêmero (`pcdl-visual-pg`) e o servidor de preview foram derrubados:
porta 55432 fechada, porta 4173 fechada, nenhum processo sobrevivente. O
`BETTER_AUTH_SECRET` usado era aleatório e viveu só no ambiente do processo; a
senha da fixture, idem. Nada disso entrou em commit, em evidência ou em log.
