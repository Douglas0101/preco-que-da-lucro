# Pedido ao MAESTRO — dívida do incidente de downgrade de `drizzle-kit`

> **Por que este arquivo existe e não uma edição no registry:**
> `docs/evidence/agent-state/DEBTS.md` declara o **MAESTRO** como escritor (assim como `QUEUE.md`).
> O agente **não** edita nenhum dos dois. Este é o pedido auditável, com closure test executável.

- **Solicitante:** agente supervisionado, ciclo `SDD-20260925-dependency-policy`
- **Data:** 2026-09-25
- **Dívida candidata:** o incidente (severidade **SEV-2**, classe de mudança **M4 — downgrade**) não tem
  linha própria no registry.

## 1. O que aconteceu

Um WIP não commitado rebaixou `drizzle-kit` de `^0.31.10` para `^0.18.1`, com `package-lock.json`
reescrito em sincronia. A árvore instalava e a maioria dos gates passava, e ainda assim
`npm run typecheck` e `npm run m02:lockfile-guard` ficaram vermelhos: a versão `0.18.1` é **anterior
ao símbolo `defineConfig`**, importado por `drizzle.config.ts:1`.

Detalhe completo, medições e falsificações em
`docs/evidence/upgrades/drizzle-kit-downgrade-incident.md`.

## 2. Causa raiz (uma frase)

**A faixa de versão aprovada vivia hardcoded dentro do próprio guard, sem nada que a amarrasse ao
`package.json` — e ninguém verificava se o símbolo importado pela config ainda existia na versão
instalada.**

## 3. Por que uma linha nova, e não só fechar trabalho antigo

O registry hoje descreve **conformidade com gates**, não **risco de dependência**. O plano de
governança de upgrades/downgrades introduz uma classe de dívida que a taxonomia atual não nomeia:
dependência crítica fora da faixa aprovada, sem Downgrade Request, sem evidência e sem rollback
documentado. Sem linha para isso, a próxima rebaixada volta a ser descoberta pelo `typecheck` — ou
pior, não é descoberta.

## 4. Linha proposta (a MAESTRO cabe decidir; o agente não escreve)

```text
id: DBT-24
origem: incidente drizzle-kit 0.18.1 (SEV-2) · SDD-20260925-dependency-policy
classe: conformidade
severidade: média
closure test: src/test/upgrade-guard.test.ts — um rebaixamento de pacote `critical` sem Downgrade
  Request em scripts/dependency-approvals/ reprova nomeando pacote, de, para e o arquivo ausente; com
  a aprovação presente o finding de downgrade some e o de spec fora da faixa PERMANECE (aprovação não
  é atalho); política real + specs reais + versões resolvidas reais devolvem zero findings.
  src/test/migration-toolchain-guard.test.ts — `defineConfig` ausente dos types da versão instalada
  reprova, e o caso 0.18.1 sem o símbolo reprova por DUAS razões independentes.
evidência: docs/evidence/upgrades/drizzle-kit-downgrade-incident.md
status: FECHADA
```

**Ressalva para a decisão da MAESTRO:** o texto acima propõe `FECHADA` porque a prevenção está
entregue e falsificada. Se a intenção for manter a dívida aberta enquanto a matriz de criticidade não
cobrir todo o plano §36, `ABERTA` também é uma leitura defensável — e é essa escolha que o registry
precisa registrar, porque as duas produzem placares diferentes.

## 5. Prevenção já entregue (para que a decisão não dependa de confiança)

| peça                                       | estado                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `scripts/dependency-policy.json`           | 15 pacotes, faixa e motivo por pacote                                             |
| `scripts/lib/upgrade-guard.ts`             | política geral + Downgrade Request; 39 casos                                      |
| `scripts/lib/migration-toolchain-guard.ts` | checagem de símbolo e toolchain; 28 casos                                         |
| `scripts/m02-lockfile-guard.mjs`           | faixa derivada da mesma política (fonte única)                                    |
| cadeia `check`                             | 16 → **18** gates; ambos os novos também como passo direto do `verify`            |
| `AGENTS.md`                                | linha nova na tabela de cobertura, exigida por `src/test/m02-ci-coverage.test.ts` |

`npm run check` medido **exit 0** na árvore landada (18 gates, 117 s).

## 6. O que este pedido **não** pede

- Não pede push, billing, status no GitHub ou mudança de visibilidade do repositório.
- Não pede fechamento de `DBT-19` — aquele pedido está em
  `docs/sdd/SDD-20260923-boundary-guard-dbt19/MAESTRO-REQUEST-DBT-19-CLOSURE.md`, complementado neste
  ciclo com a asserção que faltava.
- Não pede alteração de taxa, de regra do `DEBTS.md` ou da régua de placar.
- Não pede exclusão de nenhum gate para fechar a linha mais rápido.
