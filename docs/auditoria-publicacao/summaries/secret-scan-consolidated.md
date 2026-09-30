# Secret Scan — Consolidated Report

## Resumo

| Ferramenta           | Executado | Findings | Classificação               |
| -------------------- | --------- | -------: | --------------------------- |
| Gitleaks `v8.18.4`   | sim       |        8 | `SECRET_SUSPECT_HISTORICAL` |
| TruffleHog `v3.97.9` | sim       |       66 | `SECRET_SUSPECT_HISTORICAL` |

Ambos os scans produziram relatórios brutos apenas em `docs/auditoria-publicacao/raw/`, ignorado pelo Git. Nenhum valor de segredo foi impresso neste relatório.

## Gitleaks — Rules Summary

| Quantidade | Regra              |
| ---------: | ------------------ |
|          6 | `generic-api-key`  |
|          1 | `aws-access-token` |
|          1 | `github-pat`       |

O Gitleaks retornou exit `1`, comportamento esperado quando há findings. O relatório foi parseado com sucesso; houve `0` findings associados ao commit HEAD no momento do scan e `4` paths únicos, sem imprimir paths ou valores.

## TruffleHog — Detectors Summary

| Quantidade | Detector     |
| ---------: | ------------ |
|         60 | `Postgres`   |
|          2 | `URI`        |
|          1 | `SonarCloud` |

O TruffleHog retornou exit `0`; o relatório JSON foi parseado com sucesso. Findings verificados: `0`; findings associados ao commit HEAD: `0`; commits distintos: `25`; paths únicos: `35`. Esses números são metadata-only.

## Análise

### Findings ativos

- Findings associados ao HEAD: `0` em ambos os scanners.
- Findings verificados pelo TruffleHog: `0`.
- Isso não prova que o histórico esteja limpo; apenas mostra que os reports não indicam finding ativo no HEAD segundo os campos de commit.

### Findings históricos

- Gitleaks: `8` findings em regras de token/API.
- TruffleHog: `66` findings em detectores de Postgres, URI e SonarCloud.
- Classificação atual: `SECRET_SUSPECT_HISTORICAL`.
- Os valores não foram revisados nem impressos; a classificação deve ser tratada como suspeita até o scan final do candidato.

### Falsos positivos prováveis

- Não confirmados. A concentração em detectores de configuração e fixtures é uma hipótese, não evidência.
- Nenhuma allowlist foi criada neste ciclo.

## Recomendação

Não declarar o repositório original limpo. A Rota B permanece a direção correta porque o snapshot não copiará o histórico. O candidato deve ser escaneado novamente após:

1. anonimização do patch PII;
2. exclusão de `.npmrc`;
3. exclusão de artefatos de preservação;
4. criação de um único commit anonimizado.

Se qualquer finding aparecer no snapshot, o status será `CONTAMINATED` e o ciclo será interrompido.

## Próximo passo

Tratar o patch `PII_SUSPECT`, criar o snapshot sanitizado em `/tmp` e escanear o candidato com as duas ferramentas.
