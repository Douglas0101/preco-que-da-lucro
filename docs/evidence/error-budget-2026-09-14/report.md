# Error budget — evidência §30 (2026-09-14)

- **ambiente:** `dev-evidence` **local-first** — sem banco, sem rede e sem origem de
  produção. Node v24.15.0, `tsx` ^4.23.12 (devDependency). Nenhuma variável de ambiente
  influencia a apuração.
- **método:** `scripts/obs/error-budget.ts` parseia JSONL de `request.completed`/
  `request.failed`/`ai.*` (e, opcionalmente, `app.financial.states`/`app.ai.timeouts`),
  recorta a janela ancorada no último `timestamp`, agrega por `code` e compara com as
  tolerâncias **candidatas** de `docs/specs/M-06/error-budget.md`. O procedimento operacional
  está em `docs/runbooks/slo-error-budget.md`.
- **n:** 4 cenários canônicos (2 fixtures + 1 fixture de amostra insuficiente + 1 input
  sintético de caminho verde) e 5 repetições por outros caminhos (stdin, rede isolada,
  `strace`, `DATABASE_URL` remoto, env local).
- **janela:** fixtures ancoradas em `2026-09-13T11:59:00Z` (7 d); input sintético ancorado em
  `2026-09-14T00:01:00Z` (24 h).
- **fonte:** os `.md`/`.json`/`.txt` desta pasta; a transcrição integral com comando, stdout e
  código de saída de cada execução é `runs.txt`.

## O que esta evidência prova — e o que não prova

**Prova:** a ferramenta é executável de ponta a ponta; classifica as classes/códigos do §30;
falha fechado (exit 2) quando não há amostra, sinal ou baseline; não contacta produção (ver
"Verificação local-first / parse-only" abaixo); e o runbook descreve o procedimento.

**Não prova:** nenhuma taxa de erro real e nenhum SLO. Não existe baseline M-06 executado
(M-06 segue `PENDING`/`DRAFT` no `EXECUTION-STATE-PROGRAM.md`) e a tolerância de IA continua
**candidata**. Nenhum artefato aqui emite o rótulo `CONTROLADO`, por desenho. O cenário 4 é um
input sintético para exibir o caminho verde: `demo-sintetico-nao-ratificado` **não é** um
baseline ratificado e não autoriza uso operacional da tolerância.

## Artefatos

| Arquivo                          | O que é                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `runs.txt`                       | Transcrição: comandos exatos, stdout integral e códigos de saída observados.                                                                    |
| `basic-7d.md` / `.json`          | Apuração da fixture `basic-7d.jsonl` (classe de servidor exaurida, IA `DRAFT`).                                                                 |
| `financial-invalid.md` / `.json` | Apuração da fixture `financial-invalid.jsonl` (financeiro crítico exaurido).                                                                    |
| `insufficient.md` / `.json`      | Apuração da fixture `insufficient.jsonl` (fail-closed por N insuficiente).                                                                      |
| `demo-ok-24h.md` / `.json`       | Caminho verde com baseline sintético declarado (exit 0).                                                                                        |
| `demo-ok-24h.jsonl`              | Input sintético do cenário 4: 301 linhas (100 `ai.chat_completed` + 100 `request.completed` 200 + 100 `app.financial.states` + 1 `AI_TIMEOUT`). |

As fixtures canônicas não são copiadas para cá: elas são versionadas em
`src/test/fixtures/error-budget/` e cobertas pelo teste `src/test/error-budget.test.ts`. Os
`.json` são o mesmo relatório serializado pela função exportada `buildReport` (harness em
`runs.txt`, seção 6) — nenhuma regra de negócio nova.

## Resultado por cenário (observado)

| #   | Comando (resumo)                                                                                         | Veredito       | Exit |
| --- | -------------------------------------------------------------------------------------------------------- | -------------- | ---- |
| 1   | `--input=.../basic-7d.jsonl --window=7d`                                                                 | `FAIL`         | `1`  |
| 2   | `--input=.../financial-invalid.jsonl --window=7d`                                                        | `FAIL`         | `1`  |
| 3   | `--input=.../insufficient.jsonl --window=7d`                                                             | `INSUFFICIENT` | `2`  |
| 4   | `--input=.../demo-ok-24h.jsonl --window=24h --min-requests=100 --baseline=demo-sintetico-nao-ratificado` | `OK`           | `0`  |

Repetições que devolvem o mesmo `INSUFFICIENT`/`exit 2` do cenário 3: stdin (bloco 5), rede
isolada (bloco 7), `DATABASE_URL` remoto + `NODE_ENV=production` (bloco 10a) e env canônico
local (bloco 10b). Uso incorreto (`--window=7w`, `--window=0d`, `--min-requests=0`, `--nope`)
também sai `2` sem gravar artefato (bloco 12).

## Verificação local-first / parse-only

| Verificação                        | Método                                                                                                                                                              | Resultado                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sem cliente de rede / HTTP / shell | `grep -nE` no script para `node:http`, `node:https`, `node:net`, `node:dns`, `node:tls`, `node:child_process`, `fetch(`, `WebSocket`, `undici`, `axios`, `require(` | 0 ocorrências (bloco 11).                                                                                          |
| Sem leitura de ambiente            | `grep -n 'process\.env'` no script                                                                                                                                  | 0 ocorrências (bloco 11).                                                                                          |
| Sem socket IP                      | `strace -f -e trace=network`                                                                                                                                        | 0 sockets AF_INET/AF_INET6; só AF_NETLINK (interfaces do kernel) e 2 `connect` AF_UNIX de pipe do `tsx` (bloco 8). |
| Roda sem rede                      | `unshare -rn` (namespace novo, só `lo` DOWN)                                                                                                                        | Mesmo veredito; relatório idêntico ao da run com rede, ignorando `Gerado em:` (bloco 7).                           |
| Escrita só em `--out`              | `strace -f -e trace=openat,creat,rename,unlink,mkdir`                                                                                                               | Único destino do script é o `--out` pedido; os demais são debug-log do `npx` e pipes/cache do `tsx` (bloco 9).     |
| Produção não muda nada             | `DATABASE_URL` remoto + `NODE_ENV=production`                                                                                                                       | Mesmo veredito e relatório idêntico (bloco 10).                                                                    |

Código-fonte do script: um único `writeFile(outPath)` e um único `mkdir(dirname(outPath))`,
ambos derivados de `--out`; nenhuma escrita em caminho fixo e nenhum upload.

## Limitações conhecidas (não fechadas aqui)

- **`app.financial.states` é counter OTEL, não log.** Enquanto a série não for exportada em
  JSONL, a classe financeira fica `UNKNOWN` e o veredito geral `INDETERMINATE` (fail-closed).
  É o caso das execuções 1–3; o cenário 4 traz o sinal.
- **Nenhum baseline M-06 executado**, logo nenhuma tolerância é promessa e `--baseline` não
  tem valor real. O documento de política e o script seguem `DRAFT`.
- **Sem gate de CI**: nenhum workflow invoca o script; promover a gate exige ADR e Q-020.
- **Amostra**: `--min-requests=100` é piso bruto de envelope, não plano amostral de M-06.

Próximo passo (fora do escopo desta tarefa): executar o baseline M-06 em Q-020, recalcular a
tolerância de IA e a de `server_fault` no documento de política e só então remover o `DRAFT`.
