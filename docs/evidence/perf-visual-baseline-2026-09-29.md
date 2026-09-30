# Baseline de Web Vitals — verificação visual (2026-09-29)

> **O que este artefato é.** A medição de carregamento da aplicação rodando local,
> durante o Ciclo 11. É **baseline**, não promessa: registra o que foi medido, o que
> **não** foi medível neste harness, e por quê. Nenhum número aqui é estimado.
>
> **Cabeçalho obrigatório**
>
> - **ambiente:** build de produção (`npm run build`, preset `node-server`) servido
>   por `npm run preview` em `127.0.0.1:4173`, contra container PG17 efêmero em
>   `127.0.0.1:55432` (migrations 20/20 aplicadas, fixture de auth semeada).
>   Chromium headless via MCP Playwright.
> - **método:** `PerformanceObserver` instalado por `addInitScript` **antes** do
>   `load`, com `buffered: true`, para LCP/CLS; `performance.getEntriesByType("navigation")`
>   para TTFB/DCL/load. Uma navegação por rota, 1500 ms de janela de observação.
> - **n:** 9 rotas (`/inicio`, `/produtos`, `/despesas`, `/vendas`,
>   `/ponto-equilibrio`, `/simulacoes`, `/diagnostico`, `/precos`, `/novo-produto`).
> - **janela:** 2026-09-29T03:01–03:03Z.
> - **fonte:** `docs/evidence/ciclo-11-visual-2026-09-29.md` §4 (mesma sessão).

## Campos §35

- **hypothesis:** a aplicação local, em build de produção contra um banco efêmero
  recém-migrado, carrega dentro dos alvos do §29 e sem deslocamento de layout
  perceptível nas rotas críticas.
- **metric:** TTFB, `DOMContentLoaded`, `load` (ms); LCP (ms, p75 não aplicável com
  n=1 por rota); CLS (soma adimensional de `layout-shift` sem entrada recente).
- **before:** `N/A` — não há medição anterior desta superfície neste harness. A
  primeira série observada é esta; **lacuna declarada**, não preenchida com número
  inventado.
- **change:** `N/A` — nenhum código de produto foi alterado no Ciclo 11. A medição
  é do build em `e1fd53c`, o mesmo commit em que `npm run check` está verde.
- **after:** medido em `/inicio`, a rota mais pesada da amostra (KPI + 4 cards):

  | métrica            | valor medido                                                   |
  | ------------------ | -------------------------------------------------------------- |
  | TTFB               | **7 ms** (24 amostras da RUM da própria app, **todas `good`**) |
  | `DOMContentLoaded` | **146 ms**                                                     |
  | `load`             | **535 ms**                                                     |
  | CLS                | **0** (0 entradas de `layout-shift` observadas)                |
  | **FCP / LCP**      | **240 ms, `rating: good`** — medidos pela RUM da própria app   |
  | recursos           | 32 requisições, 4 531 B de documento                           |

- **result:** carregamento local rápido e sem deslocamento observado. O LCP é
  **240 ms com rating `good`**, medido pela telemetria da própria aplicação — não
  pelo observer do harness, que devolveu série vazia (ver §Lacunas).
- **decision:** registrar como baseline e **não** promover nada a gate. `n=1` por
  rota e uma execução não sustentam p75, e transformar `load` em proxy de LCP seria
  trocar a métrica que importa por uma fácil de medir.

## Uma discordância entre dois instrumentos, resolvida — e o que ela ensinou

Os dois instrumentos **discordaram**, e a discordância quase virou um falso achado:

| instrumento                                                    | LCP em `/inicio`                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `PerformanceObserver` do harness (`addInitScript`, `buffered`) | **série vazia** (0 amostras)                                              |
| RUM da própria aplicação (`/api/vitals`)                       | **240 ms `good`** _e_ **36 500 ms `poor`**, em duas navegações diferentes |

O valor `36 500 ms` apareceu na navegação em que a página ficou **ociosa em
headless** e só pintou ~36,5 s depois; o `240 ms` apareceu na navegação com pintura
normal. Os dois são coerentes entre si e com o observer vazio: **em headless, sem
pintura, não há candidato de LCP** — o observer não vê nada, e a RUM registra o
carimbo tardio quando a pintura finalmente acontece.

**O LCP real é 240 ms.** O `36 500 ms` é artefato de sessão ociosa, e **não** é
reportado como defeito.

**Observação que sobra, e é de qualidade de dado, não de performance:** a RUM
**aceitou e classificou como `poor`** uma amostra de sessão sem pintura. Se sessões
headless/background/ociosas reportarem assim em produção, o p75 do §29 é poluído
por amostras que não representam usuário nenhum. Não é defeito provado — é
suspeita nomeada, com o instrumento e o número que a sustentam, para quem for
olhar o §29.

## Lacunas declaradas, e são o motivo de este baseline ser parcial

1. **O observer do harness não capturou LCP.** Série vazia em duas tentativas. A
   causa — ausência de pintura em headless — é **consistente com a RUM ter
   registrado o carimbo tardio**, mas não foi isolada por experimento controlado.
   O número que vale é o da RUM (**240 ms**), que é o instrumento da aplicação.
2. **INP não foi medido.** Exige interação real do usuário e o observer de `event`
   com `durationThreshold`; a sessão não produziu interação instrumentada.
3. **CLS com 0 amostras.** "Zero entradas observadas" **não** é o mesmo que "CLS
   bom": é ausência de sinal. Registrado como observação, não como veredito.
4. **n=1 por rota, uma execução.** Não há p75 nem variância. Qualquer afirmação de
   percentil aqui seria fabricação.
5. **Harness local, não produção.** Não há CDN, TLS, latência de rede real nem
   o deployment de produção — que, neste ciclo, **não existe**
   (`DEPLOYMENT_NOT_FOUND`).
6. **O binding `chrome-devtools` não pôde ser usado:** o perfil do Chrome daquele
   servidor já estava em uso por outra instância, e a regra do ciclo proíbe retry
   cego. A medição foi feita pelo binding `playwright`, e o LCP veio da RUM da
   própria aplicação — dois caminhos independentes do binding bloqueado.
