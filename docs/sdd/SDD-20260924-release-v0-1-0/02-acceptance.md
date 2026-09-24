# 02 — Critérios de aceite

Os critérios abaixo são contratuais. Um critério só pode ser `done` quando existe comando executável, saída capturada, SHA exato do conteúdo validado, inventário versionável, selo verificado em clone limpo e concordância explícita entre `result.txt`, manifesto e relatório. A existência de ponteiro histórico ou a simples presença de código não prova o estado do release.

| ID        | Critério de aceite                                                                                               | Verificação esperada                                                                                                                             | Estado inicial      |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| **AC-01** | Todos os itens P0 do Plano Mestre §36 estão verdes, formalmente excepcionados ou removidos do escopo do release. | conferir `P0-01`…`P0-17`; nenhum `done` sem evidência; exceções/blockers nomeados em `06-traceability.md` e `08-report.md`.                      | `partial`           |
| **AC-02** | O gate de conclusão P0 do Plano Mestre §41 está verde ou declarado bloqueado com justificativa.                  | conferir `G41-01`…`G41-11`; `CI verde` exige run aplicável no SHA exato; todo bloqueio tem motivo e ação.                                        | `partial`/`blocked` |
| **AC-03** | A contradição `23.2` / `DBT-09` está resolvida ou formalmente declarada como limitação conhecida.                | conferir `outbox-dbt09.md`, `MAESTRO-REQUEST-DBT-09-RELEASE.md` e ausência de promoção indevida a `DONE`.                                        | `blocked`           |
| **AC-04** | O pipeline local passa no SHA de release.                                                                        | executar `LOCAL_CI_DB_TIER=auto ./scripts/local-ci.sh`; registrar comando, `headSha`, resultado, pendências e duração.                           | `partial`           |
| **AC-05** | A evidência metadata-only verifica em clone limpo.                                                               | `result.txt == manifest.result == REPORT.result`; `sha256sum -c evidence.git.sha256` em clone no SHA exato; inventário sem logs/bundles/patches. | `partial`           |
| **AC-06** | Nenhum push é realizado.                                                                                         | auditar refs, comandos e receipt; nenhum remoto deve mudar.                                                                                      | `partial`           |
| **AC-07** | Nenhuma alteração de billing é realizada.                                                                        | nenhum endpoint de billing é repetido; nenhuma mutação de cobrança/pagamento/spending limit.                                                     | `partial`           |
| **AC-08** | Nenhum segredo é exposto.                                                                                        | `m02:secrets-audit` e revisão dos artefatos; nenhuma credencial em relatório, bundle ou logs.                                                    | `partial`           |
| **AC-09** | Release notes listam as limitações conhecidas.                                                                   | `release/v0.1.0-mvp/RELEASE-NOTES.md` e `KNOWN-LIMITATIONS.md` coerentes com `08-report.md` e o estado real do outbox/DBT-09/DBT-19.             | `partial`           |
| **AC-10** | O pacote de release é verificável por bundle, patches e checksums.                                               | `git bundle verify`, `git format-patch`, `sha256sum` e manifesto do pacote; tag somente local e nunca push.                                      | `partial`           |

## Regras de encerramento

- `done` sem prova executável e selada é proibido.
- `cancelled`, skip, ausência de execução e resultado histórico em outro SHA não são verde.
- Divergência entre `result.txt`, manifesto e relatório produz `blocked`; não editar artefatos para fabricar concordância.
- O cleanup de uma worktree e qualquer ação remota permanecem fora deste pacote.
