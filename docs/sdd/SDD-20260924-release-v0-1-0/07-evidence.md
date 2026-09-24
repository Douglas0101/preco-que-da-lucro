# 07 — Evidência e regra de selagem

## Política: metadata-only

A evidência do RC deve conter somente metadados e referências verificáveis. O inventário mínimo previsto é:

| ID          | Artefato lógico            | Conteúdo permitido                                                 | Estado    |
| ----------- | -------------------------- | ------------------------------------------------------------------ | --------- |
| `EV-REL-01` | identidade do release      | versão, alvo, branch, base e refs; hashes, nunca tokens            | `partial` |
| `EV-REL-02` | manifesto                  | contagens, política, lista de arquivos e classificações            | `partial` |
| `EV-REL-03` | relatório                  | decisão, ações, pendências e veredicto derivado                    | `partial` |
| `EV-REL-04` | inventário de fontes       | ponteiros `file:line` para P0, §41 e testes                        | `partial` |
| `EV-REL-05` | inventário de testes       | comando, precondição, resultado esperado/medido, SHA               | `partial` |
| `EV-REL-06` | selos                      | `evidence.git.sha256` e selo integral, quando produzidos           | `blocked` |
| `EV-REL-07` | blockers                   | `DBT-09`, `DBT-19`, `23.2` e ações, sem alteração do registry      | `partial` |
| `EV-REL-08` | incidente                  | rota e código HTTP 404 observados, data e proibição de repetição   | `partial` |
| `EV-REL-09` | reconciliação do workspace | status, exclusão da árvore suja e preservação                      | `partial` |
| `EV-REL-10` | decisão de publicação      | run oficial aplicável, `headSha`, conclusão e política de rollback | `blocked` |

O inventário lógico acima não afirma que qualquer item foi gerado. `EV-REL-06` e `EV-REL-10` dependem de execução/selagem futura. Não versionar `*.log`, screenshots brutos, bundles, patches, arquivos de ambiente ou credenciais. O conteúdo deve ser suficiente para auditoria sem expor segredo.

## Binding ao SHA exato

A rodada do RC deve gravar em manifesto e relatório:

- `headSha`: SHA completo exato do conteúdo validado;
- `baseSha`: `420e47b1a2d1222cc53a1c6cf955f8fc0a4c9dd0`;
- `originDevelop`: `a2f5ff67e58ccff9035a972eff4ef171912036ca`;
- `originMain`: `9724d2c73b269d0a0199ea305308f3237b38fa09`;
- lista de caminhos versionados cobertos e exclusões;
- horário/ambiente em formato não sensível.

Um ponteiro de arquivo só é evidência quando o arquivo pertence ao `headSha`. Um resultado histórico em outro SHA é contexto, não prova de release. `cancelled` não é resultado verde; execução não aplicável também não é aprovação.

## Concordância result/manifest/REPORT

O instrumento final deve ser considerado válido somente se:

```text
result.txt == manifest.result == REPORT.result
```

A comparação deve ser feita pelo mesmo procedimento, após a geração, e uma divergência deve produzir `blocked`, pendência nominal e nenhuma alegação de sucesso. Não editar `result.txt`, manifesto ou relatório para fabricar concordância. A rodada `1b54a89c3fe9d4489828bafdbe98eee30e28f2b8` é o controle negativo conhecido: `result.txt` falhou enquanto manifesto/REPORT diziam sucesso; ela é histórica, não reescrevível e não liberável.

## Verificação independente

Depois que a evidência estiver versionada, o verificador deve:

1. criar ou usar clone limpo e isolado;
2. confirmar que o clone está no `headSha` exato;
3. executar `sha256sum -c evidence.git.sha256` sem depender do script selador;
4. confirmar ausência de logs, bundles, patches e segredos no conjunto versionável;
5. conferir contagens e `result.txt == manifest.result == REPORT.result`;
6. registrar a saída, o comando e o SHA do clone, sem valores sensíveis.

Qualquer falha, clone ausente, base desconhecida ou contagem divergente é pré-condição/veredicto bloqueado, conforme aplicável; não é `done` por fallback.

## Incidente de billing

Um probe anterior, somente leitura, acessou uma rota de billing do GitHub Actions e recebeu **HTTP 404**. O fato é disclosure de incidente, não evidência de estado de billing. O endpoint não deve ser repetido neste ciclo. Nenhuma afirmação de que a leitura não alterou nada é feita: somente se declara ausência de nova chamada e ausência de mutação realizada por esta SDD. Billing continua fora de escopo e não é declarado verde, intacto ou disponível.

## Ausências intencionais

Não há, nesta tarefa, resultado executável novo, `local-ci` do SHA atual, execução oficial do SHA atual, `manifest.json`, selo gerado, `REPORT.md` de execução ou clone limpo verificado. Esses são pendentes de `07-evidence.md`, não fatos inventados.
