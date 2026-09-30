# ADR-034 — Escopo da análise SonarCloud limitado pela cota do plano gratuito

- **ID:** ADR-034 · **Rastro:** Ciclo 18 / decisão do MAESTRO em 2026-09-30 · **Data:** 2026-09-30
- **Estado:** **ACEITO** — decisão do MAESTRO tomada no Ciclo 18, entre quatro caminhos medidos
  (excluir fontes de teste, subir o plano, declarar o impedimento e seguir sem o gate, ou parar).
- **Tipo:** conformidade / escopo de análise estática
- **Precedente de forma:** `ADR-030-boundary-guard-dbt19.md`, `ADR-033-computer-user-observability.md`

---

## 1. Fato

A organização `douglas0101` está no plano gratuito do SonarCloud, cujo teto é **50.000 linhas de
código**. Medição de 2026-09-30:

| superfície             | LOC                                                             |
| ---------------------- | --------------------------------------------------------------- |
| `main` (analisava bem) | **35.666**                                                      |
| Árvore da release      | **58.226** (`ts=51.851`, `js=4.516`, `shell=1.001`, `yaml=858`) |
| `src/test/**`          | ≈ **22.812**                                                    |
| `e2e/**`               | ≈ **887**                                                       |

Cinco tarefas consecutivas do compute engine **falharam** com a mesma causa, medida na API
(`/api/ce/activity`):

> _This analysis will make your organization 'douglas0101' reach the maximum allowed lines limit of 50000. Current LOC usage is: 0. LOC count in this analysis: 58226._

A consequência não é um gate vermelho — é a **ausência de veredito**. A análise aborta antes de
inspecionar qualquer arquivo, então os 69 achados de confiabilidade corrigidos em `eff4f99` não
chegam a ser medidos e o check do GitHub fica `cancelled` com _"The last analysis has failed"_.
E depois da release o próprio `main` herdaria as ~58k linhas e passaria a falhar igual.

## 2. Decisão

Excluir da análise estática as **fontes de teste**, mantendo sob análise o código de produção e o
ferramental:

```
sonar.exclusions=drizzle/**,src/test/**,e2e/**
```

`drizzle/**` já era excluído desde antes (migrations imutáveis e snapshots gerados). As duas novas
exclusões são de **cota**, não de qualidade: `src/test/**` e `e2e/**` são executados — e portanto
verificados — por `npm run test` e pelo tier de e2e do `ui-stack`, que são a autoridade sobre eles.

## 3. Contratos e invariantes

- **A exclusão é declarada, nunca silenciosa:** está no `.sonarcloud.properties`, neste ADR e em
  `DBT-54`, com o número de linhas de cada superfície.
- **Nenhum achado foi silenciado.** Nenhuma issue foi marcada como falso positivo ou aceita; os 68
  achados de confiabilidade que permanecem no escopo analisado foram **corrigidos** em `eff4f99`.
- **O gate continua sendo sobre código de produção.** O que sai do escopo é test harness, não
  superfície de runtime.
- **"Sem veredito" ≠ "verde".** Falha de cota produz um estado distinto de reprovação; tratar os
  dois como iguais, em qualquer direção, é o defeito que este ADR existe para impedir.

## 4. Alternativas

| Alternativa                                           | Por que não                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subir o plano do SonarCloud**                       | Resolveria sem reduzir escopo, ao custo recorrente de dinheiro; decisão do MAESTRO foi não pagar agora. Fica registrada como o caminho que preserva 100% do escopo. |
| **Declarar o impedimento e seguir sem o gate**        | Deixa a linhagem sem nenhuma análise estática de terceiro, e o check continuaria `cancelled` em todo PR — ruído permanente sem informação.                          |
| **Marcar os achados como falso positivo**             | Silenciar em vez de corrigir; proibido pela cultura do repositório e recusado explicitamente.                                                                       |
| **Excluir diretórios de produção para caber na cota** | Reduziria justamente o escopo que o gate existe para medir, transformando uma cota em um gate teatral.                                                              |

## 5. Consequências

**Positivas.** A análise volta a rodar e a produzir veredito; o gate passa a medir o que importa
(código de produção e ferramental), com folga de ~15k linhas sobre a cota. A decisão fica auditável
por clone.

**Negativas e limites.** Testes e e2e deixam de receber análise estática de terceiro — continuam
cobertos por execução, não por análise. Se a árvore de produção crescer ~15k linhas, a cota volta a
ser atingida e a escolha volta à mesa (plano pago ou nova redução de escopo). O limite é declarado;
`DBT-54` carrega o teste de fechamento.

**Dívida declarada.** `DBT-54` registra a redução de escopo e o critério que a encerra. Enquanto ela
estiver aberta, nenhum documento pode afirmar que o repositório tem análise estática completa.
