# 08 — Relatório de release

**OPEN / NOT VERIFIED**

## Resumo

Este é um pacote de especificação e rastreabilidade para `v0.1.0-mvp`, com alvo `2026-09-26`, `SCOPE_FREEZE=yes`, branch `release/v0.1.0-mvp` e base limpa `420e47b1a2d1222cc53a1c6cf955f8fc0a4c9dd0`. Nenhum teste executável novo, `local-ci` do SHA atual, execução oficial do SHA atual, publicação, produção ou billing foi realizado ou validado nesta tarefa. O estado dos 17 P0 permanece majoritariamente `partial`; o gate de CI e o blocker `23.2` permanecem `blocked`.

## Controles de veto ratificados pelo swarm

1. **Worktree suja excluída:** o checkout principal e o downgrade não relacionado de `drizzle-kit` para `^0.18.1` ficam fora do RC; a worktree limpa é a única base.
2. **Preservação de 1.161 arquivos não rastreados:** `docs/evidence/local-ci/**` do checkout principal é preservado, não apagado e não usado como prova.
3. **Sem ação remota:** nenhum push, PR, release, publicação, alteração de visibilidade ou acesso novo a billing é permitido neste ciclo.
4. **Histórico contraditório não liberável:** `1b54a89c3fe9d4489828bafdbe98eee30e28f2b8` é `historical/non-releasable`; `result.txt` falhou enquanto manifesto/REPORT diziam sucesso.
5. **Blockers abertos:** `DBT-09` continua aberta/alta e o outbox não tem runner runtime; `23.2` não pode receber `done`; `DBT-19` continua aberta.
6. **CI obrigatório no SHA exato:** não há evidência current-SHA; qualquer estado verde ou publicação fica bloqueado até run aplicável e selado.
7. **Rotas:** a rota oficial futura, a rota offline e a rota pública/espelho permanecem distintas; espelho/publicação exige aprovação explícita.
8. **Segredos e ambiente:** nenhum segredo, valor de credencial, `:5432`, remoção de worktree ou reescrita de histórico é permitido.

O veto de qualquer observador suspende mutações. Os controles acima foram tratados como condições de escopo, não como workarounds.

## Estado por grupo

| Grupo           | Estado    | Observação                                                                              |
| --------------- | --------- | --------------------------------------------------------------------------------------- |
| P0-01 a P0-17   | `partial` | ponteiros de código/teste existem, mas não há execução produzida e selagem current-SHA. |
| G41-01 a G41-10 | `partial` | fontes/testes pendentes de rodada executável e selada.                                  |
| G41-11 / CI     | `blocked` | nenhum run oficial current-SHA citado; não afirmar verde.                               |
| `23.2` / DBT-09 | `blocked` | dispatcher runtime inexistente; dívida alta aberta.                                     |
| `DBT-19`        | `blocked` | asserções de fechamento ainda não comprovadas nesta SDD.                                |
| Billing         | `blocked` | incidente HTTP 404 divulgado; não repetir e não inferir estado.                         |

## Pendências obrigatórias

- `PENDENTE-T3`: executar e mapear testes de chat, finanças, tools, auth, request-context, persistência e banco.
- `PENDENTE-T4`: produzir rodada `LOCAL_CI_DB_TIER=auto ./scripts/local-ci.sh` na worktree limpa, se autorizada.
- `PENDENTE-T5`: confirmar `result.txt == manifest.result == REPORT.result`.
- `PENDENTE-T6`: executar `sha256sum -c` independente em clone limpo no SHA exato.
- `PENDENTE-T7`: tratar `DBT-09` e `DBT-19` por seus donos; não alterar os registries neste pacote.
- `PENDENTE-T10`: decisão humana e run oficial aplicável antes de publicação.

Nenhum placeholder deve ser convertido em `done` sem prova executável e selada.

## Afirmações explicitamente não feitas

Este relatório **não afirma** que local CI, CI oficial, produção, billing ou publicação estão verdes; **não afirma** que o incidente de billing deixou o sistema intocado; **não afirma** que `23.2` ou `DBT-09`/`DBT-19` estão fechados; **não afirma** que os P0 foram promovidos. O pacote deve permanecer aberto até evidência current-SHA, decisão de blockers e aprovação de publicação.

## Próximo passo recomendado

Executar T0–T6 na worktree limpa, começando por uma rodada de teste current-SHA e pelo selo independente. Só depois avaliar T7–T11. Nenhuma etapa remota deve ser iniciada com base neste relatório.
