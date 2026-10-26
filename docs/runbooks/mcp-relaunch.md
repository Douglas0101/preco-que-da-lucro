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

### Sítios auditados pelo guard (medidos em 2026-10-17, varredura de `mcp*.json` sob o `$HOME`)

O catálogo é **explícito e versionado** em `scripts/mcp-runtime-guard.ts` (`homeCatalog()`): um sítio novo
tem de entrar nele, e um sítio que apareça na máquina e não esteja no catálogo é uma lacuna declarada, não
um silêncio. Em 2026-10-17 o catálogo anterior conhecia **1** sítio e o cliente que estava de fato rodando
**não era nenhum deles** — foi por esse buraco que o defeito do `aikido` sobreviveu.

| papel                | caminho                                                      | formato                                            |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| primário (pi)        | `~/.config/mcp/mcp.json`                                     | `mcpServers`                                       |
| compatibilidade      | `~/.agents/mcp.json`                                         | `mcpServers`                                       |
| compatibilidade      | `~/.agents/mcp/mcp.json`                                     | `mcpServers`                                       |
| **primário-cline**   | `~/.cline/data/settings/cline_mcp_settings.json`             | `mcpServers` + `transport` aninhado                |
| primário-pi          | `~/.pi/agent/mcp-adapter.json`                               | `mcpServers`                                       |
| compatibilidade-pi   | `~/.pi/agent/mcp.json`                                       | `mcpServers`                                       |
| plugin-vercel        | `~/.cache/plugins/github.com-vercel-vercel-plugin/.mcp.json` | `mcpServers`                                       |
| plugin-codex         | `~/.config/Codex/executor-plugins/codex-app-tools/.mcp.json` | `mcpServers`                                       |
| outro-cliente-medido | `~/.config/opencode/opencode.json`                           | `mcp.servers` (**`command` em array**)             |
| outro-cliente-medido | `~/.gemini/config/mcp_config.json`                           | `mcpServers` (0 byte em 2026-10-17 → pré-condição) |
| outro-cliente        | `~/.dsh/bundles/kimi-mcp/cordis.patch.yml`                   | YAML textual (`command:`/`cwd:`)                   |

São **11 sítios de máquina**, e o catálogo é **igualdade de conjunto**:
`src/test/mcp-runtime-guard.test.ts` fixa a lista exata de caminhos, então
remover ou renomear um sítio reprova o teste e adicionar um sítio exige
atualizar a lista de propósito. O escopo-repositório tem **2 sítios**
(`.mcp.json` e `.pi/mcp-adapter.json`), igualmente fixados por asserção.

O **runtime isolado** `~/.mcp-runtime/` não é config, mas é pré-condição do passo 3: se ele não existir, o
reparo não tem para onde apontar `cwd`. Ele **pode sumir sem que nada acuse** (medido em 2026-10-17), então
confira a existência antes de confiar nele:

```bash
ls -ld ~/.mcp-runtime ~/.mcp-runtime/package.json ~/.mcp-runtime/node_modules/.bin/ 2>&1
```

Recriá-lo (uma vez, fora de qualquer checkout):

```bash
umask 077 && mkdir -p ~/.mcp-runtime && cd ~/.mcp-runtime &&
  printf '%s\n' '{ "name": "mcp-runtime", "private": true }' > package.json &&
  npm install --save-exact --no-audit --no-fund @aikidosec/mcp@<versão-exata>
```

Os servidores são processos filhos do cliente, e a configuração é lida **na inicialização**. Por isso "relançar" significa encerrar a sessão do cliente e abrir outra; não existe recarga a quente.

## Pré-condições

- [ ] `git status --porcelain` limpo **ou** o motivo da sujeira conhecido (o relançamento não é o lugar de descobrir drift).
- [ ] `npm run m02:lockfile-guard` verde. Um relançamento com a árvore já driftada não distingue causa nova de causa antiga.
- [ ] `npm run guard:mcp-runtime -- --home` **executado e lido** antes do relançamento (ver Verificação).
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
   - preferir o caminho absoluto do binário já instalado (`~/.mcp-runtime/node_modules/.bin/<pacote>`) a um runner — é o que o ciclo 13 fez no arquivo que **não** era lido, e é o que o reparo de 2026-10-17 fez no arquivo que **era** lido. A forma preferida elimina o runner: sem runner não há resolução de projeto, logo a classe inteira do DBT-32 sai do caminho.

   **Caso medido (2026-10-17), para reconhecer o sintoma:** um _pin correto_ não imuniza a linha. O `aikido` do Cline declarava `@aikidosec/mcp@1.0.9` — versão exata — e **não carregava**, por duas razões somadas: (a) a entrada de cache do npx perdeu o `package.json` (o cliente registrou `code=254` e `npm error ENOENT … /home/douglas/.npm/_npx/9a60de26ed7bbd1b/package.json`), e (b) a linha não declarava `cwd`. Se o cliente disser _"failed to initialize"_ com `code=254`/`ENOENT` num diretório `_npx/`, o cache daquele pacote está quebrado: **não** "conserte" o cache (ele é descartável e o defeito volta), troque a linha pela forma com binário absoluto e deixe o cache privatizado/limpo.

   **O que o guard vê desse caso — e o que ele não vê.** A guarda audita a **linha de configuração**; ela **não inspeciona o cache do npx**. A linha nomeia um _pacote_ (`npx -y <pkg>@<versão>`), nunca o diretório de cache que o npm vai resolver em runtime — o par (spec → `~/.npm/_npx/<hash>`) é interno do npm e não é contrato. Por isso o sintoma do `code=254`/`ENOENT` aparece **no log do cliente**, e não no veredito do guard. A única forma de o guard ver esse cache é a configuração **nomear** o cache — e isso é reportado: uma linha cujo `cwd` aponta para um diretório `…/.npm/_npx/…` que existe e **não tem `package.json`** é acusada (`cache do npx … não tem package.json`), porque é o caso em que a própria configuração aponta para o cache quebrado. Não existe, e não vai existir, um check que "classifique como saudável" um cache que a configuração não nomeia: a guarda não inventa veredito sobre estado que ela não alcança.

4. **Tirar segredo literal do arquivo.** Um valor literal em `env`, em `headers` ou em `metadata` é uma credencial em texto claro num arquivo que não está sob versionamento nem auditoria. O caminho correto é o _sidecar_ de injeção (`scripts/secret-sidecar/`, F14-1): o arquivo referencia, o sidecar resolve. Se o sidecar ainda não existe, **não improvise** uma forma alternativa de guardar o segredo — registre como pendência e mantenha a rotação na fila. Duas exceções medidas nesta máquina ficam **declaradas, não resolvidas**: o cabeçalho do gateway Docker é literal porque o cliente não expande `${VAR}` em `headers` (a contenção é permissão `700`/`600`), e a chave do `context7` é duplicata do servidor que o gateway já serve — removê-la é decisão do dono.

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

| exit | significado                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | limpo                                                                                                                                                                 |
| `1`  | violação encontrada (runner sem pin, sem `cwd` ou com `cwd` em checkout, `cwd` no cache do npx sem `package.json`, caminho relativo como comando, credencial literal) |
| `2`  | **precondição**: alvo ausente, JSON ilegível, `mcpServers`/`mcp.servers` vazio ou ausente                                                                             |

### Regras que o guard aplica (2026-10-17)

1. **As duas formas de linha.** O Cline aceita `{ command, args, cwd }` no nível da linha **e** aninhado
   em `transport`. O guard lê as duas (o nível de fora vence). Antes disto ele lia só a forma plana, e a
   linha real do `aikido` era aninhada: o defeito passou por baixo da guarda _mesmo com o sítio no
   catálogo_ (medido nos dois códigos em `docs/evidence/mcp-repair-2026-10-17/captures/08-*`).
2. **Dois esquemas de config.** `mcpServers` (a maioria) e `mcp.servers` do opencode, onde `command` é um
   **array**. Um cliente a mais não pode ser um silêncio a mais.
3. **Credencial por entropia _ou_ por nome de campo.** `authorization`, `key`, `token`, `api_key`, `pat`,
   `client_secret`… — um valor sob um destes nomes é citado mesmo quando a entropia não denuncia (é o
   caso da chave do `context7`). `Bearer <valor>` é citado pelo **valor**; placeholder (`${VAR}`) e valor
   curto não são acusados.
4. **O guard cita segredo só por nome do campo, tamanho e `sha256:<12 hex>`.** Nenhum valor, nem
   recortado, entra em stdout, stderr, log ou evidência — há teste dedicado para essa propriedade
   (`src/test/mcp-runtime-guard.test.ts`), porque uma guarda de segredo que imprime o segredo é um vetor,
   não uma guarda.
5. **O catálogo é igualdade de conjunto.** 11 sítios de máquina e 2 de repositório, fixados por
   asserção de lista exata: remover ou renomear um sítio reprova o teste, e adicionar um sítio exige
   atualizar a lista de propósito. A medição que motivou isso: com a asserção anterior
   (`length >= 8`), até **três** sítios podiam sumir sem reprovar — e foi exatamente por um sítio
   ausente que o cliente que de fato carregava MCP passou com defeito.

### Limites declarados do guard

- **O guard audita a LINHA DE CONFIG, não o cache do npx.** A linha de configuração nomeia um pacote, e
  não o diretório `~/.npm/_npx/<hash>` que o npm resolve em runtime (esse par é interno do npm). O
  sintoma de cache quebrado (`code=254` / `ENOENT … package.json`) é visível **no log do cliente** e
  não no veredito do guard. O que a guarda consegue ver — e reporta — é o caso em que a **própria
  configuração** aponta para o cache: `cwd` dentro de `…/.npm/_npx/…` cujo diretório existe e não tem
  `package.json` é acusado como achado. O remedy é o mesmo dos demais casos: binário absoluto em um
  runtime fora de qualquer checkout (sem runner, sem cache, sem resolução de projeto).
- **Piso de 12 bytes para a detecção por nome.** Abaixo dele, um valor sob nome de credencial não é
  acusado _pelo nome_ (o piso existe para não reprovar rótulo; a detecção por entropia continua valendo,
  sem piso). Uma credencial real menor que isto passaria.
- **`oauth.*` está fora do escopo.** `oauth.tokens`/`clientInformation` são o armazenamento do próprio
  mecanismo OAuth, renovado pelo cliente — um fato a declarar no registry, não um veredito deste guard,
  que julga o que o **operador** escreveu num arquivo de config. A contenção ali é permissão de arquivo.
- **O guard mede forma, não existência.** Uma linha `cwd: ~/.mcp-runtime` que aponte para um diretório
  **inexistente** não é acusada: não há verificador de existência do runtime isolado (dívida registrada).
- **Config de 0 byte vira pré-condição**, não aprovação nem violação — o cliente pode estar puramente
  quebrado, e "não consegui olhar" nunca é "está limpo".
- **O escopo-repositorio é vazio por desenho** (este repositório não versiona config MCP). Ele é passo
  direto do `verify` no `ui-stack.yml` como proteção **prospectiva**: um PR que versione `.mcp.json` sujo
  reprova. A metade **light** segue `✘` **nomeado** na tabela do `AGENTS.md` — o pipeline só dispara com
  **todos** os arquivos alterados sob `docs/evidence/**`, onde nenhum dos dois sítios vive; incluir o
  passo ali seria vacuidade permanente. A ratificação é humana.

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
