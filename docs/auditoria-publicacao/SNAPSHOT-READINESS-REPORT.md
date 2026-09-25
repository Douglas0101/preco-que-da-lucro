# Snapshot Readiness Report

## Data

2026-09-25

## Resumo executivo

O snapshot sanitizado local foi criado, mas o scan final encontrou findings no próprio candidato. O status é `CONTAMINATED`; não está pronto para aprovação humana nem para publicação.

## Estado do repositório original

- Branch: `develop`
- Base do snapshot: `36929a0ee909556abca940ad42d22c7a427b13a1`
- Repositório original: privado
- Rota C: ativa
- Rota B: bloqueada no gate final

## Auditoria de segurança

### `.npmrc`

- Rastreado no original: sim
- Auth patterns: `0`
- Registry patterns: `0`
- Classificação: `LOW_RISK`
- Snapshot: `.npmrc` removido; `.npmrc.example` presente

### Scans do original

| Ferramenta | Findings | HEAD findings | Verificados | Classificação |
|---|---:|---:|---:|---|
| Gitleaks `v8.18.4` | 8 | 0 | n/a | `SECRET_SUSPECT_HISTORICAL` |
| TruffleHog `v3.97.9` | 66 | 0 | 0 | `SECRET_SUSPECT_HISTORICAL` |

### Patch PII suspect

- Arquivo: `docs/evidence/incidents/2026-09-19-dependency-drift/package-drift.patch`
- Ação: email substituído por `[EMAIL_REDACTED]`
- Committed em: `36929a0`
- Backup local: `/tmp/package-drift.patch.backup`
- Email remaining: `0`
- Segredos no patch após tratamento: `0`

## Snapshot sanitizado

- Localização: `/tmp/preco-public-snapshot-20260925`
- Commits: `1`
- Autor do commit: identificador público placeholder
- Histórico original: não incluído
- `.git` original copiado: não
- Patches removidos: `2`
- Bundles removidos: `0` já presentes na árvore exportada
- `.npmrc` removido: sim
- Scans do snapshot: Gitleaks `6`, TruffleHog `52`
- Findings verificados: `0`
- Build: não executado; gate de scan falhou antes
- Status: `CONTAMINATED`

## Classificação dos findings do snapshot

- Gitleaks: `generic-api-key` — `6`
- TruffleHog: `Postgres` — `46`; `URI` — `2`; `SonarCloud` — `1`
- Nenhum valor foi impresso.
- Não há base para classificar os findings como falsos positivos.

## Rota de publicação

**Rota B — Snapshot sanitizado: `BLOCKED`**

A Rota B não está `READY_FOR_HUMAN_APPROVAL`.

Motivos:

1. findings no candidato;
2. ausência de classificação local dos findings;
3. build não executado por stop condition;
4. ausência de aprovação para publicação.

A Rota C — permanecer privado — permanece ativa.

## Confirmações

- Nenhum push realizado.
- Nenhuma publicação realizada.
- Nenhuma alteração de billing.
- Nenhuma alteração de visibilidade.
- Nenhuma reescrita de histórico.
- Nenhum arquivo sensível removido do repositório original.
- Nenhuma PII exposta.
- Nenhum segredo exposto.
- Nenhuma ferramenta adicional instalada.
- Snapshot permanece apenas em `/tmp`.

## Pendências humanas

1. Autorizar revisão local dos findings sem imprimir valores.
2. Classificar os findings do snapshot.
3. Autorizar sanitização do candidato, se segura.
4. Executar novo scan do candidato.
5. Executar build somente após scan limpo.
6. Aprovar criação de repositório público, push e CI/CD em etapas separadas.

## Próxima ação

Parar. Preservar o candidato em `/tmp` para análise local controlada e aguardar decisão humana. Não publicar, não sincronizar e não usar este snapshot como candidato público.
