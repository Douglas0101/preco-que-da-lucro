# Pedido ao MAESTRO — registro de `DBT-23` no registry de dívidas

> **Por que este arquivo existe e não uma linha no registry:** `docs/evidence/agent-state/DEBTS.md`
> declara o **MAESTRO** como escritor (assim como `QUEUE.md`). Um agente **não** edita nenhum dos dois.
> Este pedido é o registro auditável da dívida **fora** do registry, para que ela não dependa de memória
> de agente — que é exatamente a razão de o registry existir.

- **Solicitante:** agente supervisionado, ciclo `SDD-20260923`
- **Data:** 2026-09-23
- **Origem:** `SDD-20260923-evidence-policy`, §"Lacunas declaradas" (`07-evidence.md`)

## Ação requerida do MAESTRO

Avaliar a abertura de **`DBT-23`** com as duas lacunas abaixo (classe: instrumento/higiene; severidade:
baixa), e — se aceita — escrever a linha no `DEBTS.md` com closure test.

### L1 — contagens do manifesto valem "em `measuredAt`", não no fim

- **Defeito:** o manifesto declara `filesTotal`/`logsTotal` medidos **antes** de 3 arquivos criados por
  construção depois da última medição: `evidence-policy-final.status` (fecho da política),
  `evidence-git-checksum.log` (log da verificação do selo) e `manifest.sha256` (selo do próprio
  manifesto).
- **Medição exata (ciclo de `3c088b6`):** `filesTotal` 125 declarado × **128** final; `logsTotal` 32
  declarado × **33** final.
- **Por que não é mentira, mas é imprecisão:** o manifesto carrega `evidence.measuredAt` e a semântica é
  "as of"; ainda assim, o número não é o final.
- **Closure test proposto:** teste que reexecuta a medição após a selagem e asserta que o delta é
  exatamente o conjunto de arquivos criados pelo fechamento — ou implementação que publique um
  `evidence-final-counts.json` e o inclua no selo.

### L2 — `manifest.sha256` fora do selo versionável

- **Defeito:** `manifest.sha256` é criado **depois** do último `generate_git_checksum`, então não
  aparece em `evidence.git.sha256` (está coberto pelo selo integral, que roda depois).
- **Severidade:** baixa — o conteúdo é derivável do `manifest.json`, que **está** no selo versionável.
- **Closure test proposto:** assertar que todo arquivo versionável do diretório aparece no selo
  versionável, com lista explícita e declarada das exclusões por construção (hoje: apenas o próprio
  `evidence.git.sha256`).

## Contexto que o MAESTRO deve considerar

- Ambas foram encontradas **pelo próprio instrumento** durante o ciclo, não por auditoria externa.
- Ambas estão declaradas em `docs/sdd/SDD-20260923-evidence-policy/07-evidence.md` e no journal (`L160`).
- A correção natural é escopo do `SDD-20260923-local-ci-hardening` (item 5 da fila do agente), que
  **aguarda aprovação** — não é mudança de contrato de CI, mas mexe no instrumento de evidência.

## O que este pedido **não** pede

- Não pede alteração de `.gitignore` (política `full-logs` continua **não aprovada**).
- Não pede push, billing, status no GitHub ou visibilidade de repositório.
- Não pede fechamento de DBT-19 — esse é objeto de `ADR-030`, com pedido de aprovação separado.
