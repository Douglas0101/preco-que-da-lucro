# ADR-037 — PR e Quality Gate como condições de publicação

- **Estado:** ACEITO — D0 Opção A ratificada pelo MAESTRO no prompt do Ciclo 24.
- **Data:** 2026-10-01.
- **Owner:** MAESTRO.
- **Origem:** DBT-64; main d4b9395 publicou com new_coverage 63,2 < 80.

## Decisão

Main recebe merge via PR develop→main (ADR-017), sem push direto ou reescrita de histórico. O ruleset deve exigir verify e scan + cobertura da app GitHub Actions (integration_id 15368), com base atualizada. O scanner espera o CE por sonar.qualitygate.wait=true e falha em gate ERROR. Pending, NONE, timeout, check ausente ou SHA diferente não são aprovação. O limiar 80% e a janela de 30 dias permanecem.

Custo de planejamento: +1–3 min/run de polling do CE; medição real pendente. Main poderá ficar vermelho até 80% quando executar esse workflow; é o sinal esperado, não regressão. CLI exit 0 de submissão não substitui veredito do CE.

Dependabot version updates passam a target-branch develop; os sete PRs existentes continuam main, sujeitos às regras e à revalidação do Ciclo 25.

## Exceção datada e break-glass

- **Identificador:** C24-PUBLICATION-FREEZE.
- **Owner:** MAESTRO.
- **Justificativa:** ciclo de cobertura para atingir 80%, com produção congelada enquanto faltam condições de promoção.
- **Prazo:** fim do Ciclo 24; teto temporal 2026-10-01T23:59:59-03:00 (2026-10-02T02:59:59Z). Fecha antes se main atingir 80%.
- **Bypass list:** vazia (`bypass_actors=[]`). Nenhum bypass de gate vermelho foi concedido ao agente. Qualquer uso humano é ação explícita e registrada; não há bypass automático nem autorização para merge vermelho. GitHub não oferece expiração nativa nessa lista; prazo é operacional e precisa ser verificado antes de uma mudança.

## Prova necessária e limite aberto

DBT-64 só fecha depois de observar rejeição de push direto e bloqueio de promoção com gate reprovado, seguido de promoção conforme e gate verde em main. A exigência de checks de PR, isoladamente, não comprova que o denominador de new code da PR é o de main: essa equivalência é hipótese a medir antes de qualquer merge (V2). Nenhuma closure ou primeira publicação verde está declarada. O ruleset por si só não mede comportamento da Vercel.

Fontes: [GitHub rulesets](https://docs.github.com/en/rest/repos/rules), [Sonar qualitygate.wait](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui).
