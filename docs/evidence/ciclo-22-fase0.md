# Ciclo 22 — Fase 0: enquadramento e correções de premissa

- **Data:** 2026-10-01 · **Base:** `a2f14f6` (develop) · **CI consumido:** **zero** (commit local, sem push)
- **Natureza desta fase:** corrigir o que o Ciclo 21 **inferiu**, sem tocar no que ele **mediu**.

---

## 1. Premissas corrigidas (medidas nesta fase)

| #   | o que se dizia                                           | o que foi medido                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "a cota de 50k está dissolvida" (repo público)           | **FALSO.** O repositório é público mas **não tem `LICENSE`**, e o `README.md:127` declara _"Repositório privado. Todos os direitos reservados."_. O programa OSS do SonarCloud exige **público com licença OSI**; sem ela, a cota de **50.000 LOC segue ativa**, com as **cinco recusas** já medidas. |
| 2   | "a análise que vale é a última que landar"               | **NÃO MEDIDO.** Era citação de doc apresentada como predição. O run `36807917872` prova não-falha **naquele** evento; não prova o estado do toggle. → `DBT-59` reescrito.                                                                                                                             |
| 3   | "o valor efetivo de new code é o default da organização" | **FALSO.** `sonar.leak.period` **não aparece** em `GET /api/settings/list_definitions` — **258 definições, nenhuma contendo "leak"**. Resposta vazia não é oráculo de validade de chave.                                                                                                              |
| 4   | "DBT-57 é decidir o _new code period_"                   | **JÁ CONSUMIDO no Ciclo 20:** a janela de 30 dias é o que derrubou os 408 achados para 24 (`sonar-dbt55-unblock-2026-09-30.md:86`). O que resta é o **limiar de cobertura**.                                                                                                                          |

---

## 2. Entregas da F0

| #    | entrega                                                                                                                       | estado |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| F0.1 | `DBT-59` reescrito: sai "coexistem" e entra **"toggle NÃO VERIFICADO"**, nomeando o desconhecido e as 4 probes que o resolvem | ✅     |
| F0.2 | **ERRATA** em `ciclo-21-closure-2026-10-01.md` com as três correções (a), (b) e (c)                                           | ✅     |
| F0.3 | `.sonarcloud.properties`: a nota "a última que landar" virou **"estado do toggle: NÃO VERIFICADO"**                           | ✅     |
| F0.4 | **`DBT-60`** registrada: `README.md:127` declara "privado" e o repositório é **público**                                      | ✅     |
| F0.5 | **`ADR-035` §6**: a **terceira via** medida — licença OSI dissolve a cota, sem recorte e sem pagar                            | ✅     |

**Nota de precisão sobre citações:** a referência do brief a `README.md:249-250` não confere — o
arquivo tem **127 linhas** e a declaração está na **127**. O fato é o mesmo; a linha foi corrigida
para a real. O mesmo vale para `DEBTS.md:55`, que é a linha do `DBT-55`; o "days=30" está em
`sonar-dbt55-unblock-2026-09-30.md:86`.

---

## 3. A inconsistência de governança (`DBT-60`)

`README.md:127` afirma que o repositório é privado e que todos os direitos estão reservados. O
repositório é **público**. Duas ações possíveis, **ambas do MAESTRO**, nenhuma executada:

- **(a)** corrigir o README para refletir o estado público; ou
- **(b)** rever a visibilidade do repositório.

**Consequência de segurança que sobe de prioridade com repositório público:** os prefixos de token
do Sonar (`sqa_`, `squ_`) **não** estão nas varreduras de segredo (`m02-secrets-audit.ts:126-130`,
`local-ci-secret-scan.mjs:27-34`). Em repositório público, um token vazado no histórico **é público**
— deixa de ser higiene e passa a ser urgente. Tratado na F4.3.

---

## 4. A via que dissolve a cota (`ADR-035` §6)

O programa OSS do SonarCloud dá as features de plano pago, a custo zero, para repositório **público
com licença OSI**. Este repositório é público e **sem licença** — logo inelegível, e a cota continua
ativa. A distância entre "free com cota" e "free sem cota" é um arquivo `LICENSE` (MIT ou
Apache-2.0). É **decisão de negócio** (produto comercial × código aberto), registrada como terceira
via e **não decidida** aqui.

**Controle negativo:** licenciar sem tornar público não move nada; tornar público sem licença OSI
também não — é o estado atual, medido. As duas condições são necessárias.

---

## 5. Limites desta fase

- Nada foi decidido sobre `DBT-57`, `DBT-58` ou `DBT-60`: as três seguem **ABERTAS**, aguardando o MAESTRO.
- O estado do **toggle** da Automatic Analysis continua **desconhecido** — é o que a Fase 1 mede.
- Esta fase não consumiu CI: o commit é local. O push acontece junto da primeira fase que precise dele.
