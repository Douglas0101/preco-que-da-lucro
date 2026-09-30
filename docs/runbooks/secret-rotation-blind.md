# Runbook — rotação cega de credenciais (Ciclo 15)

Este runbook é o procedimento de **rotação das quatro credenciais** (`Keys.txt`: Neon, Vercel,
GitHub PAT, Sonar) de modo que **nenhum valor de segredo entre no contexto de um agente** — nem
em trace, nem em screenshot, nem em log. O mecanismo é o sidecar do **ADR-031**; a dívida que
ele fecha é a **DBT-36**.

## Por que isto existe

A rotação normal exige _ver_ o valor para digitá-lo. Um agente que leu a credencial para
digitá-la já a leu: o valor passa pela tela, pelo screenshot e pela janela de contexto. Os
Ciclos 10–13 recusaram a rotação justamente por isso. O sidecar inverte a direção: o valor vive
no chaveiro do SO e na área de transferência, e o que o agente vê é **`ref` e `sha256`**.

## Pré-condições (todas verificáveis, nenhuma presumida)

```bash
# 1. Tripwire do repositório
git status --porcelain          # tem de estar vazio
npm run m02:lockfile-guard      # tem de sair 0

# 2. O lançador existe e é executável
test -x ~/.mcp-runtime/secret-sidecar/bin/sidecar || exit 1

# 3. O mecanismo está verde com fictícios ANTES de tocar em qualquer valor real
~/.mcp-runtime/secret-sidecar/bin/sidecar selftest --backend=cofre

# 4. O cofre está vazio (nenhum ref de trabalho pendente)
~/.mcp-runtime/secret-sidecar/bin/sidecar list --backend=cofre
```

O passo 3 é obrigatório e não é cerimônia: se o autoteste falhar, o sidecar **não** é um canal
confiável para um valor real, e a rotação para aqui. **Se a pré-condição falhar, o produto da
rotação seria um valor que ninguém pode afirmar ter sido guardado.**

O passo 4 evita que um ref de uma sessão anterior seja sobrescrito por engano.

## Procedimento (por credencial, uma de cada vez)

A ordem importa: **o valor novo é estabelecido antes de o antigo ser aposentado.** Rotacionar
sem ter o novo funcionando é tirar a chave antes de ter a outra.

### 1. Guardar o valor antigo no cofre (para poder sondá-lo depois)

Copie o valor antigo de `Keys.txt` para a área de transferência **manualmente** e, em seguida:

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar capture <credencial>-antigo
```

O comando guarda no chaveiro, **limpa a área de transferência** e prova que ela ficou vazia.
Imprime `{sha256, ref}` — nunca o valor.

### 2. Gerar o valor novo dentro do sidecar

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar generate <credencial>-novo --bytes=32
```

`--bytes` é **entropia**, não comprimento: a saída é `base64url` (ASCII), para que o valor
atravesse um cabeçalho `Authorization: Bearer` e qualquer campo de console.

### 3. Entregar o valor novo ao console do provedor

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar copy-out <credencial>-novo --ttl-ms=60000
```

O valor vai para a área de transferência e é **limpo automaticamente** ao fim do TTL, com a
limpeza verificada antes de o processo terminar. Cole no console do provedor dentro da janela.

> **Ponto de toque humano (ATTEST):** se o provedor pedir 2FA, **um toque** do operador. O
> agente não contorna 2FA em nenhuma hipótese — é o item 2 do §7 do brief.

### 4. Verificar que o valor novo autentica e o antigo não

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar test <credencial>-novo --kind=http --target=<endpoint>
~/.mcp-runtime/secret-sidecar/bin/sidecar test <credencial>-antigo --kind=http --target=<endpoint>
```

Esperado: **`200` no novo e `401` no antigo**. É este par que o closure test da DBT-36 exige.
Para uma credencial de banco use `--kind=db --target='postgres://usuario:{secret}@host/db'` — o
`{secret}` é substituído no processo, e a sonda mapeia `28P01`/`28000` para `401`.

Se o novo **não** autenticar (não-200), **pare e reverta no console do provedor**: o valor novo
não foi aceito e o antigo ainda pode estar ativo. Não prossiga para o passo 5.

### 5. Aposentar o valor antigo na denylist

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar denylist <credencial> <sha256_old> <sha256_new>
```

Os dois hashes vêm das saídas dos passos 1 e 2. O comando **recusa** se `sha256_old` divergir do
hash atual do cofre — a denylist não registra rotação que não ocorreu.

### 6. Remover o valor antigo do cofre

```bash
~/.mcp-runtime/secret-sidecar/bin/sidecar delete <credencial>-antigo
```

## Verificação (pós-condições)

```bash
# O audit não contém valor nenhum, e nenhuma linha está malformada
~/.mcp-runtime/secret-sidecar/bin/sidecar verify

# O cofre só contém os refs novos
~/.mcp-runtime/secret-sidecar/bin/sidecar list --backend=cofre

# O tripwire continua limpo: a rotação não tocou no repositório
git status --porcelain
```

E a varredura de segredo do próprio repositório:

```bash
npm run m02:secrets-audit
```

**Critério de fechamento da DBT-36:** o sidecar verde com fictícios **e** `test_endpoint`
devolvendo `200` no valor novo e `401` no antigo, contra os endpoints reais, para as quatro
credenciais.

## Rollback

- **Valor novo recusado pelo provedor** → reverter no console do provedor (o antigo continua
  válido) e `delete <credencial>-novo` do cofre. Nada foi aposentado.
- **Falha depois de o valor novo estar ativo** → `restore_from_keychain` devolve o `sha256`
  para conferir qual valor está no cofre; o valor em si se recupera no console do provedor, não
  pelo sidecar.
- **A limpeza da área de transferência falhar** → o erro nomeia as duas metades (`valor
guardado, mas a area de transferencia nao foi limpa`); limpe manualmente e **não** trate como
  concluído.

## Proibições

1. **Nunca** passar um valor de segredo como argumento da CLI. Não existe `put` por desenho: um
   argumento aparece em `ps`, no histórico do shell e no journal do systemd.
2. **Nunca** registrar o valor em trace, log, commit ou comentário. O audit aceita apenas
   `string | number` em `detail`, e `auditRecord()` é a única porta.
3. **Nunca** copiar da área de transferência para lugar nenhum além de `capture`. O caminho é
   `capture → cofre → copy-out → console`.
4. **Nunca** contornar 2FA nem interagir com console de credencial além do necessário para
   colar o valor novo. O 2FA é um toque humano.
5. **Nunca** usar valor real no `--selftest`. O autoteste opera com
   `FICTICIO-NAO-E-SEGREDO-` e falha se achar um valor em claro — usar um real ali poluiria o
   chaveiro e a própria busca.
