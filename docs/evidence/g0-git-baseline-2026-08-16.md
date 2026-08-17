# G0 — Git baseline confiável — 2026-08-16

## Resultado

**PASS local / BLOQUEADO para mutações externas.** O checkout principal foi
preservado, o WIP foi copiado para backup com checksum e a base do PR #15 foi
validada em clone isolado. Nenhum reset, stash, rebase, amend, force-push,
merge, rerun de CI ou alteração de produção foi executado.

## Checkout principal preservado

- Caminho: `/home/douglas-souza/preco-que-d-main`
- Branch: `codex/local-dev-postgres`
- HEAD: `71b0dc14de2b43bd606e122695cd97bb0c1eb5f0`
- Estado: sujo, conforme backup; nenhuma alteração foi feita durante G0.
- Backup: `/tmp/preco-wip-backup-20260816`

Checksums SHA-256 do backup:

| Artefato           | SHA-256                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `status.txt`       | `c274c12bb53c6c1785d9bb037fb0cfe66f217e8fb53e6ab90e7c744c871c940d` |
| `tracked.patch`    | `a75aba30e839e46560d77c7942c8a06e19c604b98145c81641bc0a69b7c07c12` |
| `untracked.tar.gz` | `9dc71ccff23ea3d5d4bd8198dcb6a0c2efdbf4fb2f8588c938cbf26d2abb74c8` |

O arquivo compactado contém somente os quatro arquivos não rastreados
registrados no status inicial: três evidências e
`src/test/query-performance.test.ts`.

## Base e head do PR

- SHA-base do PR #15: `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`.
- Head remoto verificado do PR #16: `07e3c05a46a0fe8f6142276e746900b8a2ada28f`.
- Branch do PR #16: `codex/p1-tanstack-query`.
- PR #16: aberto e draft.

O clone inicial de G0 foi materializado em
`/tmp/preco-g0-clean-20260816`, com branch `codex/pr16-sonar-dedupe`, HEAD
`aed4c37` e `git fsck --full --strict` sem erros. A validação do patch foi
depois isolada em `/tmp/preco-pr16-head-20260816-v2`, baseada no head completo
do PR #16, para não confundir a base limpa com o patch publicado.

## Limites

- `origin/develop` local não foi usado como fonte de verdade.
- O arquivo será versionado junto da evidência G1; sua vinculação operacional
  é feita pelos SHAs de base, head remoto e fix local registrados acima.
- G2 depende de confirmação externa dos checks e do Sonar.
- G3/G4 permanecem bloqueados por credenciais Neon ausentes.
- Nenhum segredo, URL privada ou token foi registrado.

## Comandos verificáveis

```text
git status --short --branch
git diff --binary
git ls-files --others --exclude-standard
git show --no-patch aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5
git fsck --full --strict
sha256sum /tmp/preco-wip-backup-20260816/*
```
