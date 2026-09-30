# Snapshot Secret Scan — Blocked

## Status

```text
SNAPSHOT_STATUS=CONTAMINATED
```

O candidato local não pode ser declarado pronto para publicação.

> **HISTÓRICO — pré-triagem.** O relatório bruto do TruffleHog continha `52` registros, dos quais `3` eram mensagens operacionais/summary sem `DetectorName`; a contagem efetiva era `49` findings. O estado posterior está em `docs/auditoria-publicacao/SNAPSHOT-SANITIZATION-REPORT.md`.

## Escopo

- Snapshot: `/tmp/preco-public-snapshot-20260925`
- Base original: `36929a0ee909556abca940ad42d22c7a427b13a1`
- Commits no snapshot: `1`
- Histórico original: não incluído
- `.npmrc`: removido do snapshot
- `.npmrc.example`: presente

## Resultados

| Scanner              | Findings | Verificados | Regras/detectores                         |
| -------------------- | -------: | ----------: | ----------------------------------------- |
| Gitleaks `v8.18.4`   |        6 |           0 | `generic-api-key`: 6                      |
| TruffleHog `v3.97.9` |       52 |           0 | `Postgres`: 46; `URI`: 2; `SonarCloud`: 1 |

Nenhum valor de segredo foi impresso, copiado para este relatório ou commitado. Relatórios brutos permanecem apenas em `/tmp` e não são versionados.

## Interpretação

- O scan do snapshot falhou o gate de contaminação.
- Findings não verificados não são automaticamente falsos positivos.
- O snapshot não recebeu build, não será publicado e não deve ser sincronizado.
- O repositório original permanece privado e não foi reescrito.

## Próxima decisão

1. Revisar os findings somente em ambiente local controlado, sem imprimir valores.
2. Classificar cada detector como segredo real, placeholder ou falso positivo.
3. Sanitizar o candidato e escanear novamente.
4. Somente depois reconsiderar `READY_FOR_HUMAN_APPROVAL`.

Nenhuma ação destrutiva fora de `/tmp` foi executada.
