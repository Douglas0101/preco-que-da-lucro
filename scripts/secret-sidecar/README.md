# Sidecar secreto-injetor

Cofre local e área de transferência cega para rotação de credenciais. Ele existe para que um
operador (humano ou agente) consiga **usar** um segredo sem que o valor atravesse nenhuma
superfície que o registre: nem `argv`, nem stdout, nem stderr, nem o audit log, nem um trace,
nem um screenshot.

Contexto: `DBT-32` (harness com runtime MCP isolado) e a preparação da rotação BLIND do
Ciclo 15. A restrição que dá forma a tudo aqui é negativa — não é "o que o sidecar faz", é
**por onde o valor não passa**.

## O que ele deliberadamente não faz

| Não faz                                                               | Por quê                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Não tem `put`, nem qualquer comando que aceite o valor como argumento | Argumento de linha de comando aparece em `ps`, no histórico do shell e no journal do systemd. Um cofre que aceita o valor por `argv` vaza pelo `argv`. A única entrada de valor é `capture`, que lê da área de transferência. |
| Nenhum método devolve o valor de um segredo                           | Não existe um "me dê o segredo", e o cabeçalho de `sidecar.ts` diz que não deve passar a existir. `restore` devolve o `sha256`, não o valor: restaurar é restaurar a _capacidade de usar_.                                    |
| Não lê o corpo da resposta do console em `inject`                     | Um console que ecoa o payload devolveria o segredo a quem chamou.                                                                                                                                                             |
| Não põe a mensagem do `fetch` nem a do `pg` no audit                  | A mensagem do `pg` é montada com a string de conexão, e a string de conexão _é_ o segredo. Só o código (HTTP ou SQLSTATE) é classificado.                                                                                     |
| Não grava valor fictício no chaveiro real durante o autoteste         | `selftest` usa `--backend=memoria` por padrão: um valor de teste no chaveiro real ficaria lá depois, poluindo exatamente o ambiente que o sidecar protege.                                                                    |
| Não adivinha para onde sondar                                         | `test_endpoint` sem `--target` é **pré-condição** (exit `2`), não tentativa.                                                                                                                                                  |

## Onde fica

```text
~/.mcp-runtime/secret-sidecar/
├── audit.jsonl       append-only, 0600; nunca contém valor
├── denylist.jsonl    aposentadorias: {ts, ref, sha256_old, sha256_new}
└── bin/sidecar       lançador; o código vive em scripts/secret-sidecar/ no repositório
```

`~/.mcp-runtime/` **não é um repositório git**. Por isso o lançador é um wrapper fino que
aponta para `scripts/secret-sidecar/` dentro do repositório: código que só existe fora de um
clone não é verificável por clone, e um cofre não verificável é uma promessa.

Sobrepõem-se com `SIDECAR_ROOT`, `SIDECAR_AUDIT`, `SIDECAR_DENYLIST`, ou `--root`, `--audit`,
`--denylist`.

## Interface (`sidecar.ts`)

```ts
generate(ref, bytes?)              → { sha256, ref }        valor novo, ASCII (base64url)
copy_button_capture(ref)           → { sha256, ref }        lê a área, guarda, limpa, confere
copy_to_clipboard(ref, ttlMs?)     → { sha256, ref }        põe na área para colar
inject_env_console(ref, url, opts) → { status }             entrega a um host da allowlist
test_endpoint(ref, kind, target)   → { status, latency_ms, sha256 }
denylist_update(ref, old, new)     → void
restore_from_keychain(ref)         → { sha256 }             prova recuperabilidade
delete(ref) / list() / health()
```

`kind` é `"http"` (GET com `Authorization: Bearer <valor>`) ou `"db"` (sonda de
autenticação real via `pg`; `28P01`/`28000` → `401`, `3D000` → `404`, inalcançável → `0`).
O método legado registra transporte e status bruto. O par `401`→`200` sozinho não
fecha `DBT-36`: a rotação exige identidade protegida do provedor, funcionamento dos
consumidores e evidência da revogação. Use `test-provider` e o runbook de rotação.

`generate` produz **ASCII por construção** — `base64url` de `bytes` bytes de entropia, não
bytes crus. Não é estética: um valor binário em `Authorization: Bearer <valor>` faz o `fetch`
recusar o cabeçalho, e `test_endpoint` devolveria `0` para o valor _certo_; e `+`, `/`, `=`
do base64 comum são tratados como separador por alguns campos de console.

## CLI

```bash
sidecar generate segredo_aplicacao --bytes=32 # apenas segredos definidos pela aplicação; API keys são emitidas no provedor
sidecar capture vercel_token            # depois de clicar "copiar" no console
sidecar copy-out vercel_token --ttl-ms=30000
sidecar clear
sidecar test-provider vercel_token --provider=vercel --identity=<project_id>
sidecar denylist vercel-antigo <sha256_old> <sha256_new>
sidecar selftest
sidecar verify
```

`--backend=cofre` (padrão) fala com o Secret Service da sessão via D-Bus; `--backend=memoria`
é a bancada de CI, onde não há barramento de sessão.

`copy-out` espera o TTL e limpa sozinho, de propósito: um timer `unref`-ado morre junto com o
processo e deixaria o valor na área de transferência para sempre.

## Formato do audit

Uma linha JSONL por operação:

```json
{
  "ts": "2026-09-29T00:00:00.000Z",
  "op": "generate",
  "ref": "vercel_token",
  "sha256": "…",
  "outcome": "ok",
  "audit_id": "…"
}
```

Seis campos, como especificado, mais duas **extensões declaradas**: `backend` (qual cofre
atendeu) e `detail` (escalares `string | number` — não há caminho por onde um blob entre).

`outcome` é `"ok" | "fail" | "precondicao" | "recusado"`. `precondicao` é distinto de `fail`
pela mesma razão que o exit `2` é distinto do `1` nas guardas deste repositório: "o ambiente
não permite medir" não é "a operação deu errado", e confundir os dois faz o relatório culpar
o clima.

`op` ∈ `generate`, `capture`, `copy_out`, `inject_env`, `test_endpoint`, `denylist`,
`restore`, `delete`, `list`, `health`, `selftest`.

O único derivado do valor que pode aparecer no log é o `sha256`. É o mesmo princípio do §2.4
do brief do Ciclo 14 (o trace referencia hash, não a imagem) aplicado ao cofre: o registro
aponta para o valor sem carregá-lo.

## Códigos de saída

| Código | Significado                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `0`    | a operação aconteceu e foi medida                                                                                            |
| `1`    | veredicto: falhou, ou recusado por política (allowlist, `--confirm` ausente, `sha256_old` divergente)                        |
| `2`    | **pré-condição**: o ambiente não permite medir (sem cofre, sem área de transferência, ref inexistente, comando desconhecido) |

Fail-closed: qualquer falha do cofre aborta a operação. Nada é "melhor esforço".

## Área de transferência

Wayland: `wl-paste --no-newline` / `wl-copy` / `wl-copy --clear`. X11: `xclip -selection clipboard`
(`-o` para ler, `-i` para escrever). Limpeza **é verificada**: `wipe()` relê a área e falha se
ainda houver byte.

Uma área de transferência que **não responde** não é uma área de transferência **vazia**, e as
duas não são tratadas como a mesma coisa — `read()` devolve vazio quando a ferramenta não
produz bytes, mas uma ferramenta que estoura o tempo limite levanta `ClipboardError("failure")`.
Tratar as duas como iguais faria a verificação da limpeza passar justamente quando ela não
mediu nada.

## Bancada de teste

`sidecar selftest` roda cinco cenários com valores **fictícios** (`FICTICIO-NAO-E-SEGREDO-…`,
ASCII, nunca reais):

1. `generate-e-restore` — cinco refs; a **forma** do retorno é asserida campo a campo
   (`Object.keys(...).sort().join(",") === "ref,sha256"`). Um método que devolvesse o valor
   "só para depurar" passaria em todas as outras asserções; é esta que o reprova.
2. `area-de-transferencia` — preserva e restaura o conteúdo do operador no `finally`. Mede
   captura, limpeza, devolução byte a byte e limpeza final.
3. `fail-closed-no-cofre` — cofre com falha injetada em seis operações; cada uma tem de
   falhar **e** ser `KeychainError`, e o cofre tem de continuar vazio.
4. `sonda-401-200-e-denylist` — servidor local que nunca ecoa o que recebe; exige antigo→`401`
   e novo→`200`, e que a denylist recuse um `sha256_old` divergente.
5. `audit-sem-valor` — varre todos os arquivos sob a raiz procurando a marca e cada valor em
   quatro codificações. **Controle positivo obrigatório:** o `sha256` de cada valor tem de
   _estar_ no audit — sem isso um arquivo vazio passaria por vácuo, e "não achei" não seria
   "medi".

## Limites declarados

- O transporte D-Bus implementa apenas `unix:path=` de sessão, e não negocia `SCM_RIGHTS`.
- `inject_env_console` entrega a um host da allowlist; os adaptadores por provedor (o formato
  exato de cada console) são do Ciclo 15.
- `denylist_update` prova que a aposentadoria foi **registrada**. A invalidação exige
  evidência do provedor e uma sonda protegida; status bruto de `test_endpoint` não
  demonstra revogação por si só.

## C26: seis provedores e evidência de autenticação

O catálogo `ROTATION_PROVIDERS` contém Neon, Vercel, Sonar, Context7, DeepSeek e
GitHub. `test-provider <ref> --provider=<nome> --identity=<metadado>` usa somente
endpoint HTTPS fixo, recusa redirects e não persiste/devolve corpo. Compara resposta
anônima/protegida, preserva rawstatus e distingue identidade autenticada, rejeição e
NO-VERDICT. HTTP403 ou HTTP200 público não fecha revogação.

As identidades Context7/DeepSeek ainda não têm contrato validado no probe e retornam
NO-VERDICT. Nenhuma emissão arbitrária de token API é feita por generate. Entrada,
submissão e revogação no console continuam humanas ViaA. Cinco cenários reais nos
dois backends são pré-condição; detecção do clipboard/cofre não prova o circuito.
Procedimento atual: docs/runbooks/secret-rotation-blind.md.
