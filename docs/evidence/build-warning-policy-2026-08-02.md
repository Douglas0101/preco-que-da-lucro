# Política de Warnings do Build - 2026-08-02

## Regra

`npm run build` mantém warnings visíveis, grava `.artifacts/build-warnings.json` e falha para qualquer warning não registrado ou com exceção expirada. O relatório inclui o Git SHA no CI.

## Exceção Temporária

| Campo                  | Valor                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID                     | `WARN-NITRO-001`                                                                                                                                               |
| Assinatura exata       | `inlineDynamicImports option is ignored because the codeSplitting option is specified.`                                                                        |
| Owner                  | plataforma/frontend                                                                                                                                            |
| Release                | `local` e `pre-beta-internal`; CI sem canal explícito e produção são rejeitados                                                                                |
| Expiração              | 2026-09-01                                                                                                                                                     |
| Justificativa          | Nitro 3.0.260603-beta passa `inlineDynamicImports: false` junto de `codeSplitting` no build Rolldown.                                                          |
| Controle compensatório | A assinatura exata é a única aceita; qualquer outro warning ou a expiração falha o build. Typecheck, bundle budget e matriz Playwright permanecem bloqueantes. |
| Risco residual         | Ruído conhecido no log pode reduzir sinal operacional, limitado por correspondência exata e prazo curto.                                                       |
| Rollback               | Remover a exceção e o wrapper de build após atualização Nitro/Lovable compatível; não alterar o warning limit.                                                 |

A versão Nitro 3.0.260610-beta ainda contém a mesma combinação e é rejeitada por `npm ls` devido à semântica prerelease do peer `>=3.0.260603-beta` no wrapper Lovable 2.8.5. Por isso, o projeto mantém 3.0.260603-beta fixado até existir uma atualização que passe instalação, typecheck, build e E2E sem a exceção.

Esta exceção não cobre warning de `vite-tsconfig-paths`, depreciação de `inputValidator`, chunk acima do budget ou qualquer mensagem nova.
