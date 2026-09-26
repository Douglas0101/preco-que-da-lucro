# Commit Metadata PII Audit

## Resultado

```text
COMMIT_METADATA_PII_LIKELY
```

A classificação é `COMMIT_METADATA_PII_LIKELY` porque existem emails únicos no histórico e contagens de domínios pessoais. Nenhum nome ou email foi impresso ou gravado.

## Métricas

| Métrica                   | Valor |
| ------------------------- | ----: |
| Unique author names       |    14 |
| Unique author emails      |    14 |
| Unique committer names    |    15 |
| Unique committer emails   |    15 |
| Author noreply            |    40 |
| Committer noreply         |     2 |
| Author personal-like      |   700 |
| Committer personal-like   |   700 |
| Sensitive commit messages |    15 |

## Efeito

Tornar o repositório atual público exporia os metadados de author/committer. A rota segura continua sendo C. Uma eventual Rota B exigiria snapshot sem histórico, commit inicial anonimizado e aprovação humana.

## Limitações

- As contagens não revelam identidades.
- Não houve validação de liveness de credenciais.
- Scan de secrets e inspeção de `.npmrc` foram interrompidos pelo limite de segurança do histórico.
