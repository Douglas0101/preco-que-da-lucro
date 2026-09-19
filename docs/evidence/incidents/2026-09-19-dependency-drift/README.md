# Incidente — deriva de dependência não registrada (2026-09-19)

**Classe:** integridade de contrato de dependências (`m02:lockfile-guard`) · **Classe de risco:** alteração de árvore sem intent `▶` no journal
**Estado:** **contido** (patch preservado + árvore restaurada + guard verde) · **Atribuição:** **NÃO ATRIBUÍDA** (declarado, não silenciado)

## 1. O que foi medido no boot

`git status --short` no boot do Bloco 1 (2026-09-19T16:10Z) contra `HEAD` = `develop` = `origin/develop` = `9e22a67`:

```text
 M package.json        drizzle-kit: ^0.31.10 → ^0.18.1
 M package-lock.json   reescrito (1402 inserções / 1507 remoções), resolve drizzle-kit@0.18.1
 ?? deepseek-harness   symlink → /home/douglas-souza/deepseek-harness (não gitignorado)
```

`npm run m02:lockfile-guard` ⇒ **exit 1**, com quatro razões:

| check                    | status | detail                                                                     |
| ------------------------ | ------ | -------------------------------------------------------------------------- |
| `package-json-devdep`    | fail   | spec `^0.18.1` fora do contrato `^0.31.x`                                  |
| `lock-resolved`          | fail   | resolvido `0.18.1` fora de `0.31.x`                                        |
| `lock-sha256-head`       | fail   | lock do worktree `70ea6064…` ≠ HEAD `c8c6e472…` (**reescrito sem commit**) |
| `node-modules-installed` | fail   | instalado `0.18.1` fora de `0.31.x`                                        |

Isto viola a disciplina de dependências do `AGENTS.md` (_"Every `package.json` change ships with a synchronized `package-lock.json` in the same commit"_) e é a **primeira** entrada de `npm run check` — o gate local estava vermelho antes de qualquer trabalho.

## 2. Evidência de origem (o que se pode e o que NÃO se pode afirmar)

**Fatos medidos:**

- mtime de `package.json` e `package-lock.json`: **2026-09-19 13:03:48 -0300** (16:03:48Z), com **12 ms** de diferença entre os dois ⇒ escrita em par, por um único processo.
- **Nenhum log npm de `install` / `ci` / `update` existe em 2026-09-19.** Os 11 logs do dia são:
  - 10 × `npm view <plugin-pi> version --json` + `npm config get prefix` entre **16:03:59Z e 16:04:04Z** (boot do runtime de agentes verificando versões de plugin), e
  - 1 × `npm run m02:lockfile-guard` (o próprio boot do Bloco 1, 16:07:33Z).
- **Nenhuma linha `▶` do journal cobre a mutação.** A última entrada era `L87` (land do INV-006 → `c7fa618`); não havia intenção órfã.

**Conclusão declarada:** a mutação é **não registrada e não atribuída**. Não há evidência suficiente para nomear o ator; o par `umask`/mtime e a ausência de log npm são compatíveis tanto com escrita direta por arquivo quanto com uma execução de npm fora do `~/.npm/_logs` do usuário.

**Hipótese (não confirmada):** o mesmo sintoma já apareceu em `L63` e `L66` (drizzle-kit `0.18.1` em `node_modules`, com manifest/lock então limpos), e `L66` nomeou como suspeito um app-server Codex de longa duração. O symlink `deepseek-harness` (criado 2026-09-19 00:03) indica ferramental externo ativo no diretório. **Nenhuma das duas hipóteses foi testada**; ficam registradas como linha de investigação, não como fato.

## 3. Remediação executada (autorizada pelo humano)

1. Patch integral preservado **dentro do workspace** — `package-drift.patch` (3693 linhas). Nunca em `/tmp`: a lição `L76` já provou que cada `bash` roda em bwrap com `/tmp` efêmero e os backups somem entre chamadas.
2. `git checkout -- package.json package-lock.json`
3. `npm ci --ignore-scripts` ⇒ **exit 0**
4. `npm run m02:lockfile-guard` ⇒ **exit 0**, `reasons: []`, os quatro checks em `pass`, `node-modules-installed` = `0.31.10`

## 4. Selo sha256

`sha256-pre-restore.txt` — hash dos arquivos sujos, do patch e dos arquivos restaurados:

```text
480cde677ded74e1a099a9ac126678cb7fd1b8aa6aa1040be1bcbaaea72c68d2  package.json          (sujo)
70ea606490bc70a435aabe7fb4e9e1c46a0137bce4265a2229e04dd80b7c6877  package-lock.json     (sujo)
fabf608517a7f21d5bf290cfb2b33d99c8083098eab046495db07fd6438a5a9c  package-drift.patch

# pós-restauração (2026-09-19T16:11Z)
5001c1012d2d7282358b962c8e296a2e1cdf4f85fc2bd6ee1add3f2a54cdceb7  package.json
c8c6e472a67dd5d4464992c1607428ebbf5eb60dc2d7e9482bb9e7d1a3de8124  package-lock.json
```

O hash pós-restauração do lock (`c8c6e472…`) é exatamente o que o `lock-sha256-head` exigia de `HEAD` — a restauração é bit a bit a versão versionada.

## 5. Não resolvido / follow-up

- **Causa-raiz desconhecida.** Enquanto o ator não for identificado, o sintoma pode recorrer (3ª ocorrência: `L63`, `L66`, agora). Recomendação: `m02:lockfile-guard` no boot **antes** de qualquer trilho, como já feito aqui, e não commitar nenhum WP enquanto a árvore estiver vermelha.
- **`deepseek-harness`** segue no diretório, não rastreado e não gitignorado. **Não foi tocado** (decisão humana). Enquanto existir, `git add -A` permanece proibido — o que já é regra do prompt.
