# ADR-017: Estratégia de branches develop (trabalho) e main (release via PR)

| Campo                 | Valor                                                            |
| --------------------- | ---------------------------------------------------------------- |
| Status                | Aceito                                                           |
| Data                  | 2026-08-07                                                       |
| Owner                 | plataforma/frontend                                              |
| Documentos normativos | `SDD.md` 1.4 e `PLANO_MESTRE_OTIMIZACAO_E_CIBERSEGURANCA.md` 1.6 |

## Contexto e problema

O projeto operava com branch única `main`, misturando trabalho diário de desenvolvimento, engenharia e cibersegurança com o conteúdo candidato a release. A SDD exige checkout limpo, commit imutável, SHA rastreável e branch protection para release, e o `AGENTS.md` proíbe reescrita de histórico publicado por causa da sincronização com o Lovable. É necessário separar o fluxo de trabalho do fluxo de release sem violar essas restrições.

## Decisão

- `develop` é a branch de trabalho diário: desenvolvimento, engenharia e cibersegurança. Commits diretos são permitidos e todo push dispara a workflow `ui-stack` completa.
- `main` é a branch de release e permanece a default do repositório e a conectada ao Lovable. Recebe conteúdo exclusivamente via PR `develop → main` com CI verde.
- Nenhuma branch publicada sofre force-push, rebase ou amend de commits já enviados, conforme a restrição Lovable em `AGENTS.md`.
- A proteção formal de branch (reviews obrigatórias, checks obrigatórios) permanece pendente de GitHub Pro ou repositório público; até lá, CI verde no PR é exigida por convenção registrada neste ADR.

## Consequências

- `.github/workflows/ui-stack.yml` dispara em push para `main` e `develop` e em todo `pull_request`.
- Os gates de release da SDD (checkout limpo, SHA rastreável, artifacts, rollback) continuam valendo para `main` inalterados.
- Commits enviados a `main` sincronizam com o Lovable quando a conexão for concluída; trabalho em `develop` não aparece no editor Lovable até o merge via PR.
- Reavaliar a default branch e a proteção formal após a conclusão da conexão Lovable↔GitHub (DSO-023).
