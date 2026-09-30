# ADR-031 — Sidecar cego de segredos: rotação sem que o valor entre no contexto

- **ID:** ADR-031 · **Rastro:** brief do Ciclo 14 §F14-1 (R5/DBT-32) · **Data:** 2026-09-29
- **Estado:** **IMPLEMENTADA (2026-09-29) — ratificação pendente.** O código existe em
  `scripts/secret-sidecar/` e está exercitado (autoteste 5/5 contra `--backend=memoria` **e**
  contra o Secret Service real; 9 testes de CI verdes). Falta a ratificação humana e, no
  Ciclo 15, o uso real sobre as quatro credenciais.
- **Tipo:** segurança operacional (manuseio de credenciais)
- **Precedente de forma:** ADR-029 (proposta/draft com implementação pendente), ADR-030
  (contrato de gate com errata de estado no cabeçalho)
- **Rastro de origem:** `docs/evidence/agent-state/PROGRESS.md` `L232`; dívida nova **DBT-36**

## 1. Fato

1. **As quatro credenciais do projeto vivem em `Keys.txt`** (Neon, Vercel, GitHub PAT, Sonar),
   arquivo gitignored que nunca esteve no histórico. Rotacioná-las exige **digitar o valor** em
   quatro consoles distintos.
2. **O caminho de clipboard normal não resolve o problema — ele o cria.** Copiar um valor para
   colá-lo num console exige, antes, _ter_ o valor: ele passa pela tela, pelo screenshot, pela
   árvore de acessibilidade e pela janela de contexto do agente. Um agente que leu a credencial
   para digitá-la já a leu. É por isso que os Ciclos 10–13 **recusaram** a rotação em vez de
   improvisá-la: uma rotação que vaza pelo processo de rotação não é rotação.
3. **A restrição é de percepção, não de permissão.** Nada no repositório proibia a rotação; o
   que faltava era um mecanismo em que o valor **nunca** atravessasse a fronteira de texto do
   agente.
4. **DBT-32** registrou que o provisionamento dos MCP servers via `npx --yes <pkg>@latest` a
   partir da raiz do repo mexeu em `node_modules` (drizzle-kit 0.31.10 → 0.18.1) no mesmo
   segundo. O remédio de **prevenção** é lançar o cliente de um diretório sem `package.json` —
   configuração de harness, fora deste repositório. O que o repositório pode garantir é
   **detecção** (`scripts/mcp-runtime-guard.ts`), e agora também um alvo instalável que não
   mora na árvore do projeto.

## 2. Decisão

Construir um sidecar de segredos em `scripts/secret-sidecar/` — versionado no repositório,
portanto verificável por clone — cuja **propriedade central é negativa**: nenhum método devolve
o valor de um segredo. A interface pública é a de `scripts/secret-sidecar/sidecar.ts`:
`generate`, `copy_button_capture`, `copy_to_clipboard`, `inject_env_console`, `test_endpoint`,
`denylist_update`, `restore_from_keychain`, `delete`, `list`, `health`.

A **única entrada de valor** é `copy_button_capture`, que lê da área de transferência. Não existe
`put`. Um valor passado por `argv` aparece em `ps`, no histórico do shell e no journal do
systemd; um cofre que aceita o valor por argumento vaza pelo argumento.

`restore_from_keychain` existe apesar do nome porque **"restaurar" é restaurar a capacidade de
usar, não expor o valor**: ele devolve `{sha256}` e nada mais.

O lançador vive como **symlink** em `~/.mcp-runtime/secret-sidecar/bin/sidecar` apontando para
`scripts/secret-sidecar/bin/sidecar` **no repositório**, para que `~/.mcp-runtime/` não guarde
código que um clone não consegue conferir.

O audit log (`~/.mcp-runtime/secret-sidecar/audit.jsonl`, append-only, modo `0600`) registra
`{ts, op, ref, sha256, outcome, audit_id}` — os seis campos do brief — mais duas extensões
declaradas, `backend` e `detail`, **ambas `string | number`**. A construção do registro é
centralizada em `auditRecord()`, e é isso que impede um chamador de inventar um campo: um campo
inventado é exatamente por onde um valor entraria.

## 3. Contratos e invariantes

1. **Nenhum caminho devolve valor.** Nem em sucesso, nem em erro, nem "só para depurar". O CI
   prende isso por **forma**: `Object.keys(alvo).sort().join(",") === "ref,sha256"`.
2. **Fail-closed com taxonomia de saída.** `exit 2` = pré-condição (cofre indisponível, área de
   transferência ausente, `target` não informado); `exit 1` = falha; `exit 0` = sucesso. A
   distinção espelha a das guardas do repositório: pré-condição não satisfeita não é veredito.
3. **A limpeza da área de transferência é verificada, não presumida.** `wipe()` relê e conta
   bytes; se sobrar um byte, é `ClipboardError("not-empty")`. Área de transferência que **não
   responde** não é área de transferência vazia — tratar as duas como a mesma coisa faria a
   verificação passar justamente quando ela não mediu nada.
4. **Guardar precede limpar.** Em `copy_button_capture`, uma falha de cofre **não** pode custar o
   valor ao operador. Se a limpeza falhar depois de o valor estar guardado, o erro diz as duas
   metades: `valor guardado, mas a area de transferencia nao foi limpa: …`.
5. **A denylist não registra rotação que não ocorreu.** `denylist_update` recusa se
   `sha256_old === sha256_new` **ou** se `sha256_old` divergir do hash atual do cofre. Sem isso
   uma aposentadoria gravada vira evidência de rotação fictícia.
6. **A sonda classifica o código, nunca a mensagem.** Em `test_endpoint(kind: "db")` só o `code`
   do erro do `pg` é mapeado (`28P01`/`28000` → 401, `3D000` → 404, vazio → 0, resto → 500). A
   mensagem é descartada porque o `pg` a monta com a string de conexão — e a string de conexão
   _é_ o segredo.
7. **O segredo gerado é ASCII por construção.** `generate` produz `base64url`, não bytes
   crus: um valor binário usado como `Authorization: Bearer <valor>` faz o `fetch` **recusar o
   cabeçalho**, e a sonda devolveria `0` para o valor _certo_; além disso `+`, `/` e `=` do
   base64 comum são tratados como separador por alguns campos de console.
8. **`inject_env_console` exige `confirm: true` e host em allowlist**, e **nunca lê o corpo da
   resposta** — um console que ecoa o payload devolveria o segredo. A mensagem do `fetch` também
   nunca entra no audit: ela pode carregar a URL.
9. **O transport é exercitado contra o barramento real.** A bancada em memória nunca exercita
   `sessionBusPath()`, e foi por isso que um defeito real no parser de endereço do D-Bus
   atravessou um autoteste 5/5 verde: o parser exigia `,` antes da primeira chave, quando o
   separador ali é `:`.

## 4. Alternativas

| Alternativa                                                                      | Por que não                                                                                                                   |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Copiar para a área de transferência e um humano colar                            | O valor entra na percepção do agente no momento da cópia; não resolve a restrição do §1.2 — apenas a desloca                  |
| Injetar por variável de ambiente no console                                      | Mesmo problema de leitura, mais vazamento por ambiente e por `ps`                                                             |
| Guardar as credenciais no chaveiro e deixar um adaptador de provedor escrevê-las | Não é alternativa: é a **continuação** desta decisão (adaptadores por provedor, Ciclo 15). O núcleo cego é pré-requisito dela |
| Não rotacionar e manter manual                                                   | É o estado atual, e é o que manteve `DBT-31` bloqueada por um ciclo inteiro                                                   |
| Guardar o valor em arquivo temporário e apagar depois                            | Apagar não é o mesmo que nunca ter escrito; um `unlink` não promete nada sobre a cópia em página, swap ou backup de FS        |

## 5. Consequências

- A rotação passa a ser executável por um agente **sem que o valor entre no contexto**: o
  agente vê `ref` e `sha256`, e é só isso que existe para ver.
- O autoteste fecha com **cinco segredos fictícios** e a marca literal `FICTICIO-NAO-E-SEGREDO-`
  torna a busca executável em vez de intencional: o cenário `audit-sem-valor` varre todos os
  arquivos sob a raiz em quatro codificações (cru, hex, base64, base64url) e exige, como
  **controle positivo**, que o `sha256` de cada valor **esteja** no audit — sem isso um arquivo
  vazio passaria por vácuo.
- Proveito duplo sobre `DBT-32`: o lançador é um alvo instalável **fora** da árvore do projeto,
  que é a forma que a prevenção do drift de `node_modules` pede.
- **Limites declarados:** o transporte cobre apenas `unix:path=` de sessão (sem `abstract=`, sem
  `SCM_RIGHTS`); `inject_env_console` hoje é um POST genérico porque os **adaptadores por
  provedor são do Ciclo 15**; e o sidecar prova o _mecanismo_ da rotação — o fechamento de
  `DBT-36` exige a execução real, com `test_endpoint` devolvendo `401` no valor antigo e `200`
  no novo contra os endpoints de verdade.
