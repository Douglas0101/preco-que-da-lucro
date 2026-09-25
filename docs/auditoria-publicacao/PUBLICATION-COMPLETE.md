# Publicação sanitizada concluída

## Identificação

- Repositório público: https://github.com/Douglas0101/preco-que-da-lucro-public
- Branch: `main`
- CI público: run `36151209245`, commit `b8a40a6335e9338ac03dbf2377366215696928bc`, resultado `success`
- Release: `v0.1.0 Public Snapshot` (draft, sem assets)

## Verificações

- `npm ci --no-audit --no-fund`: PASS.
- `npm run check:public`: PASS; 99 arquivos de teste, 1010 testes aprovados, 13 já marcados como skipped no baseline, build e `check:bundle` aprovados.
- Gitleaks `v8.18.4`: 0 findings no commit final publicado `b8a40a6` (`/tmp/preco-public-snapshot-audit-raw-20260925/gitleaks-prepub.json`).
- TruffleHog `v3.97.9`: 0 registros com `DetectorName` no commit final publicado `b8a40a6` (`/tmp/preco-public-snapshot-audit-raw-20260925/trufflehog-prepub.json`).
- Workflows privados de evidence/Neon foram removidos do snapshot; o workflow público único executa a cadeia pública, e a branch protection exige o contexto `verify`.
- Branch protection: 1 approving review, admins incluídos, resolução de conversa obrigatória, force-push e deleção bloqueados.
- Secret scanning e push protection: habilitados.

## Isolamento

- O repositório privado não foi publicado e nenhuma ref privada foi enviada.
- O histórico público contém somente commits sanitizados com `Public Contributor <public@example.com>`; nenhum histórico, PII ou segredo da origem foi incluído.
- `origin/develop` privado permaneceu em `a2f5ff67e58ccff9035a972eff4ef171912036ca` e `origin/main` em `9724d2c73b269d0a0199ea305308f3237b38fa09`.
- O repositório privado continua sendo a fonte de desenvolvimento; este repositório é um snapshot público de CI/CD.
