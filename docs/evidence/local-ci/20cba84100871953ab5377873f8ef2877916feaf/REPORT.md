# CI local supervisionado

Pipeline local que substitui temporariamente o GitHub Actions bloqueado por billing. Nao
houve tentativa de contornar cobranca, nao houve push e nao houve postagem de status sem
aprovacao explicita.

## Veredicto

- Estado: **success**
- SHA validado: `20cba84100871953ab5377873f8ef2877916feaf`
- Range: `origin/develop..20cba84100871953ab5377873f8ef2877916feaf`
- Branch: `develop`
- Inicio: 2026-09-23T11:37:28Z
- Fim: 2026-09-23T11:42:56Z
- Push realizado: **nao**
- Billing alterado: **nao**
- CI remoto usado: **nao**
- Status GitHub: skipped

## Etapas

| Etapa                     | Status  | Duracao | Log                           |
| ------------------------- | ------- | ------- | ----------------------------- |
| npm-pin-verified          | success | 0s      | npm-pin-verified.log          |
| npm-ci                    | success | 14s     | npm-ci.log                    |
| m02:lockfile-guard        | success | 0s      | m02:lockfile-guard.log        |
| m02:work-package-guard    | success | 0s      | m02:work-package-guard.log    |
| m02:debts-guard           | success | 1s      | m02:debts-guard.log           |
| m02:temporal-guard        | success | 0s      | m02:temporal-guard.log        |
| m02:seal-dts:check        | success | 2s      | m02:seal-dts:check.log        |
| m02:matrix:check          | success | 2s      | m02:matrix:check.log          |
| check:ui-stack            | success | 0s      | check:ui-stack.log            |
| check:no-supabase-runtime | success | 0s      | check:no-supabase-runtime.log |
| m02:secrets-audit         | success | 2s      | m02:secrets-audit.log         |
| m02:boundaries            | success | 1s      | m02:boundaries.log            |
| m02:state:check           | success | 0s      | m02:state:check.log           |
| format:check              | success | 19s     | format:check.log              |
| typecheck                 | success | 9s      | typecheck.log                 |
| lint                      | success | 10s     | lint.log                      |
| test                      | success | 72s     | test.log                      |
| build                     | success | 5s      | build.log                     |
| check:bundle              | success | 1s      | check:bundle.log              |
| audit                     | success | 1s      | audit.log                     |
| check-chain               | success | 119s    | check-chain.log               |
| db:test                   | skipped | 0s      | db:test.log                   |
| db:check                  | skipped | 0s      | db:check.log                  |
| playwright-install        | success | 0s      | playwright-install.log        |
| playwright-e2e            | success | 66s     | playwright-e2e.log            |
| evidence-policy-check     | success | 1s      | evidence-policy-check.log     |
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
| ephemeral-pg-e2e        | e2e roda contra PG17 EFEMERO em 127.0.0.1:55432, com segredos efemeros gerados na hora                                                                                                                                                    |
| playwright-without-deps | CI usa 'playwright install --with-deps' (exige root); aqui os navegadores vem do cache e o install roda sem --with-deps                                                                                                                   |
| no-color-unset          | tier de e2e roda com NO_COLOR/FORCE_COLOR removidos: com NO_COLOR=1 o webServer do Playwright (que forca FORCE_COLOR) faz o node emitir aviso nao-registrado e o gate de avisos do build reprova — ambiente do CI nao tem essas variaveis |

## Pendencias que exigem decisao humana

Nenhuma pendencia registrada.

## Evidencia e politica de versionamento

- Politica: **metadata-only** — versiona-se apenas o metadata.
- Arquivos: 127 no total · **85 versionaveis** · 42 ignorados pelo Git.
- Logs: 32 · ignorados pelo Git: 32 (ficam **locais**; cobertos pelo selo integral, nao pelo versionavel).
- Artefatos de preservacao (bundle/patches): 10 · sob `artifacts/`, ignorado pelo `.gitignore` — **nunca versionados**.

## Artefatos

- `20cba84100871953ab5377873f8ef2877916feaf.sha256` — selo integral (cobre **todos** os arquivos, inclusive logs e artefatos)
- `evidence.git.sha256` — selo restrito ao que o Git versiona
- `manifest.json` + `manifest.sha256` + `evidence-counts.json`
- `artifacts/local-commits-20cba84.bundle` (local-only)
- `artifacts/patches/` (9 patches, local-only)
- `artifacts.sha256`

## Seguranca

- Nenhuma mutacao remota; nenhum push; nenhuma tag enviada.
- Nenhuma leitura ou alteracao de billing / spending limit.
- Nenhuma instalacao global de pacote.
- Selagem: sha256 (checksum), nao assinatura criptografica de identidade.
- Etapas sem sucesso: db:test (skipped), db:check (skipped).

## Proximos passos

1. Decisao humana sobre push: nada foi enviado.
2. Revalidar no CI oficial quando o billing voltar; este selo cobre a janela de bloqueio.
3. Manter bundle e patches preservados ate o push acontecer.
