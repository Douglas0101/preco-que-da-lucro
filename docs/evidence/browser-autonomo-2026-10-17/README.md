# Bancada de browser autônomo no host — resultado (2026-10-17)

**Veredito:** o agente dirige um navegador real nesta máquina de forma autônoma — login por fixture,
walk das 8 seções, asserts, capturas, console e rede — com **8/8 rotas autenticadas, 0 erro de
console e 0 requisição falha**. O caminho exigiu remover três obstáculos de ambiente e **consertar
quatro defeitos do próprio instrumento**, todos medidos e preservados neste pacote.

Plano: [`SPEC.md`](SPEC.md). Método e limites para reuso: [`../../.artifacts/README-BANCADA-BROWSER.md`](../../.artifacts/README-BANCADA-BROWSER.md) (fora do Git).

## Evidência por fase

| fase              | o que foi medido                                                                                                       | captura                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| precondições      | node 24.21.0, playwright-core 1.62.1, Chrome 155, PG17 em `:5432`, `userns` bloqueado                                  | `captures/01-precondicoes.txt`                                                      |
| máquina           | Chromium do Playwright morre com SIGTRAP; `/opt/google/chrome/chrome` + `--no-sandbox` expõe CDP em ~2 s               | `captures/14-maquina-ambiente.txt`                                                  |
| **positivo**      | `sessaoValida=true`, walk **8/8** com marcador de sessão, 0 erro de console, 0 falha de rede, captura 1440×900         | `captures/02-positivo-bench-run-18.json`, `captures/03-positivo-bench-run-19.json`  |
| **negativos**     | cn-07 falsifica de verdade; cn-01…cn-06 **revelaram o instrumento cego** e foram mantidos                              | `captures/04-negativos.txt`, `captures/05-negativos-json-02-05.txt`                 |
| incidente próprio | parser de `--action` executava 1 de 5 passos e saía verde                                                              | `captures/06-incidente-parser-args.txt`                                             |
| causa-raiz        | `429` do rate limiter + medição lendo `"Carregando..."`                                                                | `captures/07-sessao-e-rate-limit.txt`                                               |
| instrumento       | driver, bancada e sondas, íntegros                                                                                     | `captures/08-driver.txt`, `09`, `10`, `11`                                          |
| superfície        | headers proibidos e arquivo de credenciais (só nomes, nunca valores)                                                   | `captures/12-superficie-config.txt`                                                 |
| prova visual      | `cu-19` e `cu-10` — header com `teste@example.test`, menu, pill ativa; chat com "Mensagem restaurada do histórico E2E" | `captures/16-cu-19-sessao-autenticada.png`, `captures/17-cu-10-chat-restaurado.png` |
| gate              | tempo real e honesto do que rodou                                                                                      | `captures/13-gate-local.txt`                                                        |

### Os quatro defeitos do instrumento (a parte útil deste pacote)

1. **Cegueira por vacuidade.** Sem `--login` o driver não testava nada, ficava em `about:blank` e
   saía **verde**. Corrigido com precondição de não-vacuidade (`navegou` + `temSubstancia`).
2. **Aceitava qualquer retorno de `eval`.** Um passo "que apagava o cookie" falhava por acidente
   (string vazia) e o `--expect-fail` invertia o veredito — o controle negativo "passava" sem medir
   nada. Agora resultado falsy reprova com mensagem nomeada.
3. **Controle negativo que se autocurou.** `--login` restaurava a sessão antes do walk, então o
   defeito plantado era desfeito pelo próprio ciclo; e o `storageState` salvo pelo login anterior
   reidratava uma sessão órfã. Corrigido com `--fresh` e `--skip-login`, que só existem para medir o
   instrumento contra ausência de sessão.
4. **Medição de URL em vez de conteúdo.** A rota responde 200 deslogada e o shell deslogado usa o
   **mesmo `<h1>`** de marketing: o walk "verde" media a URL. Agora a prova é o marcador de sessão no
   conteúdo, com **espera por sinal observável** (sair de `"Carregando..."`) — não por
   `domcontentloaded` nem por sleep fixo, que era a causa do falso vermelho seguinte.

### Causas de ambiente (não do código do repo)

- `429 Too Many Requests` no `sign-in/email` depois dos controles negativos repetidos — o rate limiter
  do Better Auth tem janela de 60 s e o próprio seeder E2E limpa `rate_limits` por isso. Limpo **na
  bancada**, nunca em produção. Sem cookie ⇒ app fica em `/auth`, o que parecia "regressão de sessão".
- `sec-fetch-site` é header **proibido ao cliente**: declará-lo faz o Chromium abortar todo subrecurso
  com `net::ERR_INVALID_ARGUMENT` (A/B: 19 falhas com, 0 sem).

## Arquivos e integridade

`MANIFEST.sha256` cobre **todos** os arquivos deste pacote: **19 entradas para 19 arquivos**
(`checked === discovered`, descoberta não vazia).

**Como o selo foi obtido (e por que não na árvore principal).** `m02-seal` é fail-closed por
precondição de ambiente: reprova (`exit 2`) quando há drift fora do selo, e esta árvore carrega WIP
alheio legítimo (41 entradas, de outra sessão) que esta bancada **não pode commitar nem reverter**. O
manifesto foi gerado e conferido numa **árvore Git limpa em `HEAD`** (`git worktree add --detach`),
com o pacote copiado para o mesmo caminho relativo:

```
git worktree add --detach .artifacts/selo-worktree HEAD
cp -r docs/evidence/browser-autonomo-2026-10-17 .artifacts/selo-worktree/docs/evidence/
(cd .artifacts/selo-worktree && node scripts/m02-seal.mjs --dir docs/evidence/browser-autonomo-2026-10-17 --write)
# -> m02-seal: OK (19 arquivos, checked === discovered)
```

O manifesto resultante é **byte a byte idêntico** ao da árvore principal (`5fdb30ca…` nas duas) e a
verificação independente fecha:

```
sha256sum -c docs/evidence/browser-autonomo-2026-10-17/MANIFEST.sha256   # 19/19 OK
node scripts/m02-seal.mjs --dir docs/evidence/browser-autonomo-2026-10-17 # exit 2 = precondicao de drift alheio
```

**Superfície formatter-selada.** Os brutos deste pacote são `.json`/`.txt` gerados por execução, e o
byte bruto é a prova — reformatá-los mudaria o digest que o manifesto cobre. Por isso
`.prettierignore` ganhou, com comentário e escopo estreito:

```
docs/evidence/browser-autonomo-2026-10-17/captures/**
```

`SPEC.md` e `README.md` continuam **formatter-checados** de propósito (só `captures/**` está fora).
Depois dessa declaração, `npm run format:check` segue reprovando **apenas** `src/styles.css` — WIP
alheio pré-existente, que esta sessão não tocou nem declarou verde.

A integridade do pacote está provada; o que **não** está provado é a árvore principal limpa — e ela
não estava limpa antes desta sessão nem por causa dela. A árvore temporária foi removida
(`git worktree remove --force`); a lista voltou a ter só a principal e as duas do Cline, alheias.

## Correção aplicada (2026-10-18) — affordance do gatilho de reset

`captures/18` diagnosticou que o gatilho "Recomeçar" funcionava mas não parecia botão. A correção
(mínima, em `src/routes/_authenticated/novo-produto.tsx`) e a bateria de aceitação estão em
`captures/21-reset-aceitacao.txt`, com prova visual em `captures/19-reset-gatilho-outline.png` e
`captures/20-reset-dialogo.png`. Aceitação: caixa visível, rótulo "Nova conversa", diálogo coerente
(título/corpo/botão nomeiam o apagar), 3 → 0 mensagens com `reset_at` gravado, anuncio
`role="status"`, gatilho desabilitado com conversa vazia e durante envio, Tab/Enter/ESC e foco de
retorno preservados, 0 erros de console. WIP alheio no mesmo arquivo preservado byte a byte.

## Auto-verificação pré-S6

| #   | item do checklist                      | como foi satisfeito                                                                                 |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | controle negativo                      | cn-07 com `delete from sessions` + `--fresh --skip-login`: instrumento reprova (`04-negativos.txt`) |
| 2   | fronteira nas duas direções            | sessão válida ⇒ 8/8 ficam; sessão inválida ⇒ 8/8 expulsas (`02`×`04`)                               |
| 3   | identidade, não cardinalidade          | cada rota é nomeada com destino e marcador (`walk[]`), e o 429 é citado por status + corpo          |
| 4   | proibido exit-code-only                | veredito exige 0 erro de console **e** 0 falha de rede **e** sessão no conteúdo                     |
| 5   | proibido sleep fixo                    | espera por sinal observável (sair de `"Carregando..."`, `waitForURL`)                               |
| 6   | sem valor degenerado                   | `sessaoValida` é booleano derivado de token presente; `walk[].autenticada` é booleano por rota      |
| 7   | precondição de estado compartilhado    | sessão conferida no servidor **antes** do walk; `rate_limits` e `sessions` medidos por SQL          |
| 8   | sentinela real                         | fixture E2E real (conversa, produto, mensagem) e marcador `teste@example.test`                      |
| 9   | fingerprint de revisão                 | SHA/versão em `01-precondicoes.txt`; nenhum arquivo de `src/**` tocado                              |
| 10  | `checked === discovered`               | `MANIFEST.sha256` gerado pelo selo sobre a descoberta do diretório                                  |
| 11  | S6 adversarial                         | **não executado** (bancada, não WP) — declarado na §Riscos do `SPEC.md`                             |
| 12  | falha alta                             | precondições e veredito reprovam com mensagem nomeada; nenhum `try/catch` compensatório             |
| 13  | isolamento de bancada                  | loopback, fixture própria, ramo controlado de IA, perfil dedicado; produção intocada                |
| 14  | todo check impresso tem gate e captura | cada fase da tabela acima aponta o arquivo bruto                                                    |
| 15  | run de CI                              | **N/A-trigger**: nenhum commit/push nesta sessão; nada a atar                                       |
| 16  | descoberta multi-sítio                 | os 8 destinos são enumerados por rota e medidos um a um, sem amostragem                             |
| 17  | precondição de ambiente                | `sessaoValida`/`naoVacuidade` verificados em runtime antes do veredito                              |

**KPI `capturados pelo autor antes do S6 / total de achados`: 4/4.** Os quatro defeitos do
instrumento foram encontrados pela própria bancada (controle negativo e medições divergentes), não
por revisor externo. Densidade para o journal: 4 achados em 1 sessão, 0 CORR, 0 N de produto.

## Riscos e limites declarados

- **Sem S6 adversarial.** Não houve lane de contexto limpo; o que há é autofalsificação.
- **`--no-sandbox`**: mitigação, não correção. A correção é `chrome-sandbox` setuid (root).
- **A janela CDP não persiste entre comandos** do harness (a árvore de processos é encerrada); a
  sessão é reidratada por `storageState`/login a cada execução.
- **`/tmp` é efêmero entre comandos** — por isso todo bruto vive em `.artifacts/` e neste pacote.
- **Nenhum `npm run check` completo** nesta sessão: o passo 1 (`m02:lockfile-guard`) está vermelho
  por WIP alheio anterior. Não foi "consertado" nem declarado verde.
- O walk prova **sessão presente e conteúdo renderizado**; não prova correção funcional das telas.
