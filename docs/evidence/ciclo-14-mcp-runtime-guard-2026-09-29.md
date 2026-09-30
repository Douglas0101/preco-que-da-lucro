# Evidência — F14-4: a guarda do runtime de MCP (2026-09-29)

## O que foi medido antes de escrever qualquer linha

O brief do Ciclo 14 mandava relançar o cliente MCP com `node_modules/.bin/mcp-client --config ~/.config/mcp/config.json`. **Nenhum dos dois existe.** O que existe, medido:

| o que                              | onde                                       | como foi confirmado                                                                                          |
| ---------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Cliente                            | `pi` + pacote `npm:pi-mcp-adapter`         | declarado em `~/.pi/agent/settings.json`, chave `packages`                                                   |
| Config de precedência 1            | `~/.config/mcp/mcp.json`                   | `pi-mcp-adapter/config.ts:16` → `GENERIC_GLOBAL_CONFIG_PATH = join(homedir(), ".config", "mcp", "mcp.json")` |
| Prova de que é este o arquivo vivo | 7 servidores no arquivo                    | a superfície de ferramentas desta sessão bate **1-para-1** com ele                                           |
| A correção do ciclo 13             | `~/.dsh/bundles/kimi-mcp/cordis.patch.yml` | `cwd` + caminho absoluto presentes — mas é arquivo de **outro harness**, que este cliente **não lê**         |

## O achado: a prevenção do ciclo 13 acertou o arquivo errado

Execução real, `npm run guard:mcp-runtime -- --home`, 2026-09-29:

```
mcp runtime guard: escopo=repositorio+maquina · sitios auditados=2
  auditado: /home/douglas-souza/.config/mcp/mcp.json (primario, 1213 bytes)
  auditado: /home/douglas-souza/.dsh/bundles/kimi-mcp/cordis.patch.yml (outro-cliente, 5191 bytes)
  ausente : .mcp.json (projeto-padrao)
  ausente : .pi/mcp-adapter.json (projeto-adapter)
  ausente : /home/douglas-souza/.agents/mcp.json (compatibilidade)
  ausente : /home/douglas-souza/.agents/mcp/mcp.json (compatibilidade)
mcp runtime guard [violacao]: .../mcp.json: linha `playwright` lanca `npx` sem pin (@playwright/mcp@latest)
mcp runtime guard [violacao]: .../mcp.json: linha `playwright` lanca `npx` sem `cwd`
mcp runtime guard [violacao]: .../mcp.json: linha `github` lanca `npx` sem pin (@modelcontextprotocol/server-github@latest)
mcp runtime guard [violacao]: .../mcp.json: linha `github` lanca `npx` sem `cwd`
mcp runtime guard [violacao]: .../mcp.json: linha `github` carrega valor literal na variavel `GITHUB_PERSONAL_ACCESS_TOKEN` (93 bytes, sha256:688fceb9c449)
mcp runtime guard [violacao]: .../mcp.json: linha `chrome-devtools` lanca `npx` sem pin (chrome-devtools-mcp@latest)
mcp runtime guard [violacao]: .../mcp.json: linha `chrome-devtools` lanca `npx` sem `cwd`
mcp runtime guard: REPROVADO (7 violacao(oes))
exit=1
```

**O contraste é a prova, não o número.** Os dois arquivos foram auditados na mesma execução, pelo mesmo código, com o mesmo catálogo: o arquivo que recebeu a correção do ciclo 13 passou **limpo**, e o arquivo que o cliente realmente carrega rendeu **7 violações** — exatamente o mecanismo do DBT-32 (runner sem pin, sem `cwd`), três vezes, mais um segredo em texto claro. Uma prevenção de sítio único não é prevenção; a guarda agora enumera os sítios.

## A parte que não é sobre o DBT-32

A quinta violação é um achado de segurança com vida própria: a linha `github` deste cliente carrega o PAT **em texto claro** dentro de `~/.config/mcp/mcp.json` — um arquivo que não está sob versionamento, não está sob auditoria e não é coberto por nenhum guard de segredo do repositório, porque vive fora dele. Citado aqui, como manda o §19.4, **só por nome, tamanho e hash**: `GITHUB_PERSONAL_ACCESS_TOKEN`, 93 bytes, `sha256:688fceb9c449`.

É a prova de que o _sidecar_ de injeção (F14-1) não é cerimônia: enquanto ele não existir, tirar o valor do arquivo significa não ter onde guardá-lo. E é a razão de a rotação das 4 credenciais (R1) ter de acontecer **depois** do sidecar, nunca antes.

> **Limite declarado.** A guarda cita segredo por `sha256:<12 hex>`, nunca pelo valor — e há teste dedicado que reprova se o valor (ou um recorte dele) aparecer na saída: `src/test/mcp-runtime-guard.test.ts`, caso _«acusa o segredo literal citando so nome, tamanho e fingerprint»_. Uma guarda de segredo que imprime o segredo é um vetor, não uma guarda.

## O que foi construído

| artefato                             | o que é                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/mcp-runtime-guard.ts`       | Guarda de node built-ins. **Dois escopos** (ver abaixo). Exit `0` limpo · `1` violação · `2` precondição.                                                                                    |
| `src/test/mcp-runtime-guard.test.ts` | **20 casos**, 20 verdes. Controle negativo que dá valor: a forma medida no incidente, transcrita, tem de render **7 violações**; a correção do ciclo 13, transcrita, tem de render **zero**. |
| `docs/runbooks/mcp-relaunch.md`      | O procedimento de relançamento, com a asserção que fecha o mecanismo: `sha256sum` dos dois manifestos **idêntico** antes e depois.                                                           |
| `package.json`                       | `guard:mcp-runtime` encadeado em `npm run check`.                                                                                                                                            |
| `AGENTS.md`                          | Linha na tabela de cobertura, com o `✘` da heavy e da light **nomeado e justificado**.                                                                                                       |

### Por que dois escopos — e por que `$HOME` não entra no gate

- **Escopo-repositorio** (padrão, é o que `npm run check` executa): só `.mcp.json` e `.pi/mcp-adapter.json` do próprio clone. Determinístico, verificável por clone, e o veredito **não muda** com o `$HOME` de quem roda.
- **Escopo-máquina** (`--home`): inclui os configs globais. É o que o runbook chama. **Não entra em gate nenhum**, de propósito: um gate de repositório que depende do `$HOME` reprova o CI por causa da máquina de quem contribui — e um gate que reprova pelo ambiente de quem o roda é desligado na primeira semana.

Superfície vazia é tratada de forma diferente nos dois escopos, e isso é deliberado: no escopo-máquina ela é **precondição** (sem o primário não há o que auditar, exit `2`); no escopo-repositorio ela é **limite declarado impresso em tela** (o repositório não versiona config MCP; a superfície viva é a da máquina). Precondição nunca vira "limpo" por vacuidade — vira nota.

## Limites declarados desta entrega

1. **A auditoria de YAML é textual.** Sem dependência de parser, a regra pergunta se o arquivo usa `@latest` e se declara `cwd` em algum lugar — não casa cada `command:` com o seu `cwd`. Um arquivo com dois runners, um corrigido e outro não, é sinalizado: o veredito é conservador **na direção certa**.
2. **`guard:mcp-runtime` não é passo do `verify` nem da `ci-light`** — declarado como **DBT-33**, com a condição de fechamento escrita (acrescentá-lo aos dois **e** à tabela no mesmo commit). Hoje o escopo-repositorio é vazio neste repositório, então o valor em CI é nulo e o valor local é proteção prospectiva.
3. **O que fecha o DBT-32 não é esta guarda.** É a asserção do runbook: os dois manifestos com o mesmo `sha256` antes e depois de um relançamento. A guarda mede a _forma_ da linha; o `sha256` mede o _efeito_.
4. **Nada da configuração viva foi alterado nesta entrega.** O arquivo continua com as 7 violações; corrigi-lo é o passo 3 do runbook, e o passo 4 depende do sidecar que ainda não existe.
