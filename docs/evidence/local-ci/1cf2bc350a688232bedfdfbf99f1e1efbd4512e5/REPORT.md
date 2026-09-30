# CI local supervisionado

Pipeline local que substitui temporariamente o GitHub Actions bloqueado por billing. Nao
houve tentativa de contornar cobranca, nao houve push e nao houve postagem de status sem
aprovacao explicita.

## Veredicto

- Estado: **success**
- SHA validado: `1cf2bc350a688232bedfdfbf99f1e1efbd4512e5`
- Range: `origin/develop..1cf2bc350a688232bedfdfbf99f1e1efbd4512e5`
- Branch: `develop`
- Inicio: 2026-09-24T03:40:52Z
- Fim: 2026-09-24T03:46:33Z
- Push realizado: **nao**
- Billing alterado: **nao**
- CI remoto usado: **nao**
- Status GitHub: skipped

## Etapas

| Etapa                     | Status  | Duracao | Log                           |
| ------------------------- | ------- | ------- | ----------------------------- |
| npm-pin-verified          | success | 0s      | npm-pin-verified.log          |
| npm-ci                    | success | 8s      | npm-ci.log                    |
| m02:lockfile-guard        | success | 0s      | m02:lockfile-guard.log        |
| m02:work-package-guard    | success | 0s      | m02:work-package-guard.log    |
| m02:debts-guard           | success | 0s      | m02:debts-guard.log           |
| m02:temporal-guard        | success | 0s      | m02:temporal-guard.log        |
| m02:seal-dts:check        | success | 2s      | m02:seal-dts:check.log        |
| m02:matrix:check          | success | 2s      | m02:matrix:check.log          |
| check:ui-stack            | success | 0s      | check:ui-stack.log            |
| check:no-supabase-runtime | success | 0s      | check:no-supabase-runtime.log |
| m02:secrets-audit         | success | 2s      | m02:secrets-audit.log         |
| m02:boundaries            | success | 0s      | m02:boundaries.log            |
| m02:state:check           | success | 0s      | m02:state:check.log           |
| format:check              | success | 19s     | format:check.log              |
| typecheck                 | success | 12s     | typecheck.log                 |
| lint                      | success | 9s      | lint.log                      |
| test                      | success | 68s     | test.log                      |
| build                     | success | 5s      | build.log                     |
| check:bundle              | success | 0s      | check:bundle.log              |
| audit                     | success | 2s      | audit.log                     |
| check-chain               | success | 117s    | check-chain.log               |
| db:test                   | success | 27s     | db:test.log                   |
| db:check                  | success | 1s      | db:check.log                  |
| playwright-install        | success | 1s      | playwright-install.log        |
| playwright-e2e            | success | 62s     | playwright-e2e.log            |
| evidence-policy-check     | success | 0s      | evidence-policy-check.log     |
| coverage-assert           | success | 0s      | coverage-assert.log           |
| preserve-bundle           | success | 0s      | preserve-bundle.log           |
| preserve-patches          | success | 0s      | preserve-patches.log          |

## Cobertura

- Checks declarados: 19
- Cobertos por etapa nomeada: 19
- Lacunas: nenhuma

## Adaptacoes ao ambiente local

| Item                    | Detalhe                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| state-check-informativo | m02:state:check nao pertence a npm run check nem aos dois workflows; roda como etapa INFORMATIVA (nao aborta) e vermelho vira pendencia nominal                                                                                           |
| ephemeral-pg            | tier de banco em PG17 EFEMERO 127.0.0.1:55432; o container :5432 do usuario nao e tocado                                                                                                                                                  |
| ephemeral-pg-e2e        | e2e roda contra PG17 EFEMERO em 127.0.0.1:55432, com segredos efemeros gerados na hora                                                                                                                                                    |
| playwright-without-deps | CI usa 'playwright install --with-deps' (exige root); aqui os navegadores vem do cache e o install roda sem --with-deps                                                                                                                   |
| no-color-unset          | tier de e2e roda com NO_COLOR/FORCE_COLOR removidos: com NO_COLOR=1 o webServer do Playwright (que forca FORCE_COLOR) faz o node emitir aviso nao-registrado e o gate de avisos do build reprova — ambiente do CI nao tem essas variaveis |

## Pendencias que exigem decisao humana

Nenhuma pendencia registrada.

## Evidencia e politica de versionamento

- Politica: **metadata-only** — versiona-se apenas o metadata.
- Arquivos: 143 no total · **93 versionaveis** · 50 ignorados pelo Git.
- Logs: 31 · ignorados pelo Git: 31 (ficam **locais**; cobertos pelo selo integral, nao pelo versionavel).
- Artefatos de preservacao (bundle/patches): 19 · sob `artifacts/`, ignorado pelo `.gitignore` — **nunca versionados**.

## Artefatos

- `1cf2bc350a688232bedfdfbf99f1e1efbd4512e5.sha256` — selo integral (cobre **todos** os arquivos, inclusive logs e artefatos)
- `evidence.git.sha256` — selo restrito ao que o Git versiona
- `manifest.json` + `manifest.sha256` + `evidence-counts.json`
- `artifacts/local-commits-1cf2bc3.bundle` (local-only)
- `artifacts/patches/` (18 patches, local-only)
- `artifacts.sha256`

## Seguranca

- Nenhuma mutacao remota; nenhum push; nenhuma tag enviada.
- Nenhuma leitura ou alteracao de billing / spending limit.
- Nenhuma instalacao global de pacote.
- Selagem: sha256 (checksum), nao assinatura criptografica de identidade.
- Etapas sem sucesso: nenhuma.

## Proximos passos

1. Decisao humana sobre push: nada foi enviado.
2. Revalidar no CI oficial quando o billing voltar; este selo cobre a janela de bloqueio.
3. Manter bundle e patches preservados ate o push acontecer.
