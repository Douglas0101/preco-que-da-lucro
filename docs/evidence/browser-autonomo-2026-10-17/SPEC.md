# SPEC — bancada de browser autônomo (2026-10-17)

> **Natureza:** bancada operacional de harness, não work package de produto. Não altera `src/**`,
> não abre PR e não promove nada no placar de 187. O selo de WP (S1…S6) é aplicado como **contrato de
> prova** — o que ele exige de evidência vale aqui; o que ele exige de S6 adversarial **não foi
> executado** e está declarado na §Riscos, não maquiado como verde.

## 1. Fato-fonte

- Pedido do dono, em sessão: _"Consegue depurar o navegador para uso autônomo?"_ → nível escolhido
  pelo dono entre quatro opções: **bancada fixture + Chrome com CDP + storageState**.
- Contexto medido no boot: `develop` com WIP alheio (41 entradas em `git status --porcelain`),
  daemon do Docker parado, preview `:4173` da sessão anterior derrubado, nenhum Chrome em execução.
- Antecedente no repo: `docs/evidence/computer-user-2026-10-17/` (browser MCP em container, walk das
  8 seções, achados ungated). Esta bancada é o caminho **sem container**, no host, com CDP de porta.

## 2. Problema

Não existia caminho verificável para o agente dirigir um navegador real nesta máquina:

1. **Sandbox do Chrome quebrado** — `kernel.apparmor_restrict_unprivileged_userns=1` bloqueia o
   namespace sandbox e `/opt/google/chrome/chrome-sandbox` não é setuid. Sintoma medido:
   `FATAL:setuid_sandbox_host.cc:172` e `exit 133` (SIGTRAP), inclusive com `--headless=new`.
2. **Browser MCP indisponível sem Docker** — `mcp/playwright` é container; daemon parado ⇒ sem
   ferramenta de navegador. E o harness encerra a árvore de processos ao fim de cada comando, o que
   inviabiliza "abrir o Chrome e usar depois".
3. **Sem prova de sessão** — a rota autenticada responde **200 mesmo deslogada** (redirect no
   cliente) e o shell deslogado renderiza o **mesmo `<h1>`** de marketing. Status HTTP e URL não
   distinguem os dois estados: foi a fonte de dois falsos verdes medidos nesta sessão.

## 3. Contrato (invariante falsificável)

> Um ciclo autônomo de navegador só é **verde** se, na mesma execução: (a) o servidor devolve um
> token de sessão real para a conta de fixture; (b) o cookie de sessão está presente no contexto;
> (c) cada uma das 8 rotas autenticadas termina **no próprio caminho E com o marcador de sessão
> visível no conteúdo**; (d) nenhum passo falhou, nenhum erro de console ocorreu e a rodada **não é
> vácua** (navegou para página real e executou passo, login ou walk). Qualquer item ausente reprova.

Corolário de instrumentação: o mesmo driver, com `--expect-fail`, tem de **reprovar** quando o
defeito é plantado (0 sessões no banco). Um verde sem esse par não prova nada.

## 4. Mudanças

**Dentro do escopo (tudo fora do Git, em `.artifacts/`):**

| artefato                               | papel                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `.artifacts/bench-preview.sh`          | sobe o preview `:4173` com env de bancada (ramo controlado de IA)                   |
| `.artifacts/bench-browser.mjs`         | driver CDP: lança/reusa Chrome, autentica, faz walk, executa passos, emite veredito |
| `.artifacts/e2e-local.env`             | credenciais de fixture (modo 600, gitignored)                                       |
| `.artifacts/cu/*`                      | relatórios brutos, sondas, capturas                                                 |
| `.artifacts/README-BANCADA-BROWSER.md` | método e limites                                                                    |

**Fora do escopo / não muda:** `src/**`, `scripts/**`, `.github/**`, manifests, gates, testes, ADRs,
`docs/MAPA-OPERACIONAL.md`, qualquer branch ou ambiente remoto. Nada de push, commit, deploy ou
alias. WIP alheio preservado byte a byte.

## 5. DoD (critérios binários, cada um com o artefato que o prova)

1. Chrome do host expõe CDP e o driver conecta — `captures/01-precondicoes.txt`,
   `captures/14-maquina-ambiente.txt`.
2. Login autentica de fato (não só redireciona) — `captures/03-positivo-bench-run-19.json`
   (`sessaoValida: true`, cookie `preco_que_da_lucro.session_token`).
3. Walk 8/8 com marcador de sessão no conteúdo — mesmo arquivo (`walk[].autenticada === true`).
4. Zero erro de console e zero requisição falha na rodada positiva — mesmo arquivo.
5. Rodada vácua reprova — `captures/04-negativos.txt` (cn-03: `about:blank`, "rodada vacia").
6. Defeito plantado (0 sessões) reprova — `captures/04-negativos.txt` (cn-07: 8/8 rotas expulsas).
7. Repositório intocado — `captures/13-gate-local.txt` (41 entradas antes e depois).

## 6. Testes (par que reprova quando o defeito existe)

| cenário     | planta                                          | espera                                                        |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------- |
| positivo    | sessão nova por fixture                         | verde com 8/8 e marcador no conteúdo                          |
| cn-07       | `delete from sessions` + `--fresh --skip-login` | `sessaoValida=false`, 8/8 expulsas p/ `/auth`                 |
| cn-03       | nenhum passo, nenhum login                      | "não navegou para página real" + "rodada vácua"               |
| cn-01…cn-06 | variantes mais fracas                           | **revelaram que o instrumento era cego** — mantidas no pacote |

## 7. Riscos

- **S6 adversarial de contexto limpo não foi executado** (é lane de WP de produto). O que substitui:
  a série de controles negativos acima, incluindo os que **falharam** em falsificar.
- **`--no-sandbox`** é mitigação declarada, não correção: exige `chrome-sandbox` setuid (root).
- A bancada vive em loopback com fixture e ramo controlado de IA; nada disso autoriza tocar produção
  ou o perfil pessoal do usuário.
- O walk mede o marcador de sessão no texto renderizado; não mede correção funcional das telas.

## 8. Rollback

`docker compose down`, encerrar o job de fundo do preview, remover `.artifacts/` (nada versionado).
Nenhum rollback de Git é necessário — não houve commit.
