# Tracked Patches — Metadata Inspection

## Resumo

- Patches rastreados: `2`
- PII suspeita: `1`
- Segredo suspeito: `0`
- Desconhecidos: `0`
- Método: leitura de blobs Git somente em memória; nenhum conteúdo de patch foi impresso.

## Tabela

| Arquivo | Blob | Tamanho | Commit adicionado | From | Emails | Subject | Date | Signed | Secrets | Classificação |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| `docs/evidence/incidents/2026-09-19-dependency-drift/package-drift.patch` | `db193e5439573ec8867f56c535541f3fffa9a322` | 135359 | `1a11ee285cd6c2587f6ad52acaca1ae08529d288` | 0 | 1 | 0 | 0 | 0 | 0 | `PII_SUSPECT` |
| `docs/evidence/trk-a-wp-b7-2026-09-17/fix.patch` | `c473bad544b9f61ebcdff4da60c2a7694550abba` | 19961 | `93c1d62a7a6cb09a1b45809449618e36e81f15e8` | 0 | 0 | 0 | 0 | 0 | 0 | `CLEAN_PROVAVEL` |

## Interpretação

A ocorrência de email no primeiro blob é suficiente para classificar o patch como `PII_SUSPECT` para fins de publicação, mesmo sem header `From:`. O segundo patch não apresentou os marcadores metadata-only definidos nesta fase. Isso não substitui scan de conteúdo completo.

Nenhum email, nome ou valor de segredo foi gravado neste relatório.
