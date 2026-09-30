# Runbook — Relançamento do cliente MCP

## Por que isto existe

Um servidor MCP stdio lançado por um _package runner_ sem pin e **sem `cwd`** resolve o "projeto" subindo a árvore a partir do diretório corrente. Se esse diretório corrente está dentro de um checkout, a instalação acontece **na árvore desse checkout** e reescreve `package.json` / `package-lock.json`. Não é hipótese: em 2026-09-28/29 o processo `npx --yes mcp-remote@latest` foi lançado nessa forma e `drizzle-kit` — pin `critical` em `scripts/dependency-policy.json` — foi de `0.31.10` para `0.18.1` no mesmo segundo em que `package.json`, `package-lock.json` e `node_modules` mudaram. Quatro ocorrências, três ciclos, nenhuma causa isolada (DBT-32).

O ciclo 13 aplicou a correção. **Ela alcançou o arquivo errado.** Medido em 2026-09-29: o patch de pinagem foi escrito em `~/.dsh/bundles/kimi-mcp/cordis.patch.yml`, que pertence a _outro_ harness e que este cliente **não lê**; o arquivo que este cliente realmente carrega continuava com três linhas `npx …@latest` sem `cwd`. Um relançamento é o único momento em que essa diferença importa: é quando o cliente lê a configuração. Este runbook existe para que esse momento seja verificado, e não presumido.

> **Limite declarado.** Um servidor MCP é lançado **no processo do cliente**, fora do repositório. Nenhum gate de `npm run check` pode consertar isso — o que o repositório pode fazer é (a) reprovar uma configuração MCP **versionada** que use essa forma, e (b) entregar um verificador que audite a configuração **da máquina** sob demanda. As duas coisas existem: `scripts/mcp-runtime-guard.ts`.

## O que o cliente realmente é (medido, não presumido)

| o que                           | onde                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cliente                         | **`pi`** com o pacote `npm:pi-mcp-adapter` (declarado em `~/.pi/agent/settings.json`, chave `packages`) |
| Config de precedência **1**     | `~/.config/mcp/mcp.json` — `GENERIC_GLOBAL_CONFIG_PATH`, `pi-mcp-adapter/config.ts:16`                  |
| Configs de compatibilidade      | `~/.agents/mcp.json`, `~/.agents/mcp/mcp.json`                                                          |
| Config por projeto              | `<cwd>/.mcp.json` · `<cwd>/.pi/mcp-adapter.json`                                                        |
| **Não** é lido por este cliente | `~/.dsh/bundles/kimi-mcp/cordis.patch.yml` (harness `dsh`)                                              |

`~/.config/mcp/config.json` e um binário `mcp-client` **não existem** nesta máquina. Se um procedimento mandar invocá-los, o procedimento está desatualizado — e é este runbook que o substitui.

Os servidores são processos filhos do cliente, e a configuração é lida **na inicialização**. Por isso "relançar" significa encerrar a sessão do cliente e abrir outra; não existe recarga a quente.

## Pré-condições

- [ ] `git status --porcelain` limpo **ou** o motivo da sujeira conhecido (o relançamento não é o lugar de descobrir drift).
- [ ] `npm run m02:lockfile-guard` verde. Um relançamento com a árvore já driftada não distingue causa nova de causa antiga.
- [ ] `node scripts/mcp-runtime-guard.ts --home` **executado e lido** antes do relançamento (ver Verificação).
- [ ] Backup datado da configuração viva: `cp ~/.config/mcp/mcp.json ~/.config/mcp/mcp.json.bak-<AAAAMMDDTHHMMSSZ>`.
- [ ] Nenhum segredo é digitado, colado ou lido neste procedimento. Se um passo exigir isso, o passo está errado.

## Procedimento

1. **Medir antes.** `npm run guard:mcp-runtime -- --home`. Anote o número de violações e os nomes apontados. Este é o estado "antes"; sem ele, o "depois" não prova nada.

2. **Encerrar a sessão do cliente.** Encerre o `pi` (a sessão, não apenas a conversa). Confirme que os processos filhos morreram:

   ```bash
   pgrep -af 'npm exec|mcp-remote|mcp@latest|chrome-devtools-mcp' || echo "nenhum servidor MCP filho vivo"
   ```

3. **Corrigir a configuração viva, se a medição acusou.** Para cada linha de runner sem pin ou sem `cwd`:
   - trocar o especificador por uma **versão exata** (o cache do npx já contém a resolução real do que estava rodando — use-a, não o `@latest`);
   - acrescentar `cwd` apontando para um runtime **fora de qualquer checkout** (`~/.mcp-runtime` é o runtime isolado criado para isso);
   - preferir o caminho absoluto do binário já instalado (`~/.mcp-runtime/node_modules/.bin/<pacote>`) a um runner — é o que o ciclo 13 fez no arquivo que **não** era lido, e é a forma correta.

4. **Tirar segredo literal do arquivo.** Um valor literal em `env` é uma credencial em texto claro num arquivo que não está sob versionamento nem auditoria. O caminho correto é o _sidecar_ de injeção (`scripts/secret-sidecar/`, F14-1): o arquivo referencia, o sidecar resolve. Se o sidecar ainda não existe, **não improvise** uma forma alternativa de guardar o segredo — registre como pendência e mantenha a rotação na fila.

5. **Relançar o cliente** e confirmar a superfície de ferramentas: os servidores `stdio` declarados precisam aparecer, e nenhum processo filho pode estar rodando a partir do diretório do repositório.

6. **Medir depois.** `npm run guard:mcp-runtime -- --home` de novo. E, o teste que o DBT-32 realmente exige:
   ```bash
   sha256sum package.json package-lock.json
   git status --porcelain package.json package-lock.json
   ```
   Depois de um relançamento, os dois manifestos têm de estar **idênticos** ao que estavam antes. É a asserção que fecha o mecanismo; o guard sozinho só mede a forma da linha.

## Verificação

```bash
npm run guard:mcp-runtime            # escopo-repositorio (o que `npm run check` executa)
npm run guard:mcp-runtime -- --home  # escopo-maquina: a superficie viva
```

E a asserção do **passo 6** — a que de fato fecha o mecanismo — tem forma executável:

```bash
scripts/verify-mcp-relaunch.sh --snapshot /tmp/antes.json   # ANTES de relançar
# ... relance o cliente (passos 2 a 5) ...
scripts/verify-mcp-relaunch.sh --verify /tmp/antes.json     # DEPOIS: reprova se a árvore mudou
```

O script roda as duas guardas acima, confere o cofre e o audit log, e compara o `sha256sum` dos
dois manifestos contra o snapshot. Ele **não** relança o cliente — isso é o passo humano, porque um
MCP stdio nasce no processo do cliente e não há recarga a quente. E ele **reporta** o
escopo-máquina como nota em vez de reprovar a árvore pelo `HOME` de quem o roda: reprovar ali é o
que faz um gate ser desligado na primeira semana.

Códigos de saída — diferentes de propósito, porque "não consegui olhar" e "olhei e está sujo" não são o mesmo veredito:

| exit | significado                                                                                  |
| ---- | -------------------------------------------------------------------------------------------- |
| `0`  | limpo                                                                                        |
| `1`  | violação encontrada (runner sem pin, `cwd` dentro de checkout, segredo literal)              |
| `2`  | **precondição**: alvo ausente, JSON ilegível, `mcpServers` vazio, chave sem regra de emissor |

O guard cita segredo **só** por nome da variável, tamanho e `sha256:<12 hex>`. Nenhum valor, nem recortado, entra em stdout, stderr, log ou evidência — há teste dedicado para essa propriedade (`src/test/mcp-runtime-guard.test.ts`), porque uma guarda de segredo que imprime o segredo é um vetor, não uma guarda.

## Rollback

O relançamento não altera o repositório; o rollback é da configuração.

```bash
cp ~/.config/mcp/mcp.json.bak-<carimbo> ~/.config/mcp/mcp.json
```

Depois, relance o cliente outra vez. Se a configuração restaurada for a que tinha runner sem pin, **o rollback reintroduz o mecanismo do DBT-32** — é um rollback de disponibilidade, não de segurança, e por isso o estado para o qual se volta fica registrado na evidência.

## Proibições

- **Não** digitar, colar, ler em voz alta ou transcrever credencial nenhuma. Se um passo exigir a credencial em claro, o passo está errado — pare e escale.
- **Não** contornar verificação de segurança de fornecedor (Cloudflare challenge, 2FA, captcha). Canal negado é **limite declarado**, não obstáculo a vencer.
- **Não** editar a configuração de outro harness para "consertar" este. Foi exatamente esse erro de alvo que deixou o DBT-32 vivo por três ciclos.
- **Não** substituir `@latest` por uma faixa (`^1.2.3`) e chamar isso de pin. Faixa não é pin, e `isPinned` reprova.
- **Não** registrar o valor de um segredo em journal, evidência, PR ou mensagem de commit — só nome, tamanho e hash.
- **Não** concluir o relançamento sem a medição "depois" dos dois manifestos. Um relançamento verde sem essa asserção é uma impressão, não uma verificação.
