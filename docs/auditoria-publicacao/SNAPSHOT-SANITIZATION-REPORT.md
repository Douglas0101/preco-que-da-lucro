# Snapshot Sanitization Report

## Data

2026-09-25

## Resumo executivo

Os findings do snapshot foram extraídos e classificados sem imprimir valores. O candidato foi sanitizado e o rescan de Gitleaks e TruffleHog ficou limpo. O gate completo `npm run check` permanece bloqueado por uma dependência estrutural de work packages removida do snapshot; portanto o candidato não está pronto para publicação.

## Estado inicial

- Snapshot: `/tmp/preco-public-snapshot-20260925`
- Gitleaks: `6` findings
- TruffleHog: `49` findings effective
- Registros operacionais do TruffleHog excluídos da contagem: `3`
- Status inicial: `CONTAMINATED`

## Classificação dos findings

| Classificação | Gitleaks | TruffleHog | Total | Tratamento |
|---|---:|---:|---:|---|
| `REAL_ACTIVE` | 0 | 0 | 0 | Nenhum confirmado |
| `PLACEHOLDER` | 0 | 12 | 12 | Sanitizados ou template sem credencial |
| `TEST_DATA` | 6 | 37 | 43 | Evidência removida ou literal de teste sanitizado |
| `FALSE_POSITIVE` | 0 | 0 | 0 | Nenhum |
| `UNKNOWN` | 0 | 0 | 0 | Nenhum |

A triagem foi feita por path, detector, regra e flags de contexto; nenhum valor de finding foi impresso.

## Ações no snapshot

- Removido `docs/evidence/` do candidato.
- Removidos `.npmrc`, patches, bundles, artefatos de preservação e raw.
- Sanitizados 25 literais de connection string em testes/guardas.
- `.env.example` substituído por template sem connection string com credencial.
- Criado `.gitleaksignore` sem entradas ativas.
- Criado `SECURITY_ALLOWLIST.md` com política deny-by-default e `active_entries=0`.
- Backup preservado somente em `/tmp/preco-public-snapshot-20260925-backup`.
- Relatórios brutos movidos para `/tmp/preco-public-snapshot-audit-raw-20260925`.

Nenhuma alteração foi feita no código-fonte do repositório original.

## Rescan

| Scanner | Findings | Status |
|---|---:|---|
| Gitleaks `v8.18.4` | 0 | `CLEAN` |
| TruffleHog `v3.97.9` | 0 | `CLEAN` |

```text
SNAPSHOT_SCAN_STATUS=CLEAN
```

## Validação de build

| Step | Resultado | Evidência |
|---|---|---|
| `npm ci --no-audit --no-fund` | PASS | exit `0` |
| `npm run check` | BLOCKED | exit `1` em `m02:work-package-guard` |
| `npm run build` | PASS | exit `0` |

O guard `m02:work-package-guard` exige um template de work package que foi deliberadamente removido de `docs/evidence/`. O código compilou, mas o gate completo não pode ser declarado verde sem uma decisão sobre um workflow público compatível com a ausência de evidência interna.

## Status final

```text
SNAPSHOT_SCAN_STATUS=CLEAN
SNAPSHOT_BUILD_GATE_STATUS=BLOCKED
PUBLICATION_STATUS=NOT_READY
```

O candidato não deve ser publicado, empacotado ou sincronizado até o gate público ser aprovado.

## Confirmações

- Nenhum push realizado.
- Nenhuma publicação realizada.
- Nenhuma alteração de billing.
- Nenhuma alteração de visibilidade.
- Nenhuma reescrita de histórico.
- Nenhum arquivo original removido.
- Nenhuma PII exposta.
- Nenhum segredo exposto.
- Nenhuma alteração no repositório original nesta triagem.
- Snapshot permanece em `/tmp`.

## Pendências humanas

1. Definir o gate público equivalente ao `m02:work-package-guard`.
2. Executar novamente `npm run check` no candidato com essa decisão.
3. Aprovar eventual publicação somente após check público verde.
4. Não usar o snapshot como candidato público enquanto `PUBLICATION_STATUS=NOT_READY`.

## Próxima ação

Aguardar decisão sobre o gate de work packages. Nenhuma publicação deve ocorrer.
