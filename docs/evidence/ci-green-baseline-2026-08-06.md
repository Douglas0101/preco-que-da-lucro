# Baseline de CI Verde - 2026-08-06

## Run de referência

| Campo     | Valor                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| Run       | [30732769570](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/30732769570)      |
| SHA       | `ecea55a`                                                                                      |
| Resultado | CI completa aprovada, sem anotações                                                            |
| Gates     | `npm ci`, format, lint, typecheck, 4 testes unitários, build, bundle, audit e 12/12 Playwright |

## Métricas de bundle

| Métrica        | Valor        |
| -------------- | ------------ |
| Entry          | 231581 bytes |
| Grafo estático | 423418 bytes |

Artifacts de bundle e de browsers registram o SHA completo correto.

## Toolchain

- Node fixado em `24.15.0` (npm 11.14.1).
- Actions oficiais fixadas por SHA.
- Working tree sincronizada com `origin/main` no SHA `ecea55a`.

## Re-check WARN-NITRO-001 (2026-08-06)

`npm view nitro versions` confirma que a versão mais recente publicada continua sendo `3.0.260610-beta` — a mesma já registrada em [`build-warning-policy-2026-08-02.md`](./build-warning-policy-2026-08-02.md) como rejeitada por `npm ls` devido à semântica prerelease do peer `>=3.0.260603-beta` no wrapper Lovable 2.8.5.

Não existe versão de Nitro publicada que levante a exceção hoje. A exceção permanece válida somente para `local` e `pre-beta-internal` até 2026-09-01; produção segue bloqueada. Próxima verificação antes da expiração.

## Lockfile

Em 2026-08-06 o `package-lock.json` foi normalizado pelo toolchain pinado (npm 11.14.1 / Node 24.15.0): entradas aninhadas de `lru-cache` e bumps de patch em devDependencies. Validado com `npm ci --dry-run` (íntegro e em sync com `package.json`).

## Pendências externas (fora do repositório)

| Pendência                                | Bloqueio                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Branch protection                        | Requer GitHub Pro ou repositório público                                                 |
| Conexão Lovable ↔ GitHub                 | Não se aplica: sem conexão direta; fontes obtidos por export (esclarecido em 2026-08-07) |
| Validação NVDA/Windows e VoiceOver/macOS | Requer hardware/OS                                                                       |
| E2E com backend e credenciais reais      | Requer ambiente provisionado                                                             |
