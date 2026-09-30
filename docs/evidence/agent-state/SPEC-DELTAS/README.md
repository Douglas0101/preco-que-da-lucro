# SPEC-DELTAS — protocolo (missão SDD 2026-09-15)

**Quem propõe:** squad do item (parando o item). **Quem decide:** SPEC-STEWARD (nesta rodada: o MAESTRO acumula o papel, decidindo por escrito com citação `arquivo:linha` da spec).

## Quando abrir

- A spec é ambígua, contraditória ou omite um caso que o código precisa decidir.
- O comportamento correto exige divergir do texto do plano (ex.: nome de tabela, coluna, ordem, contrato).
- Um teste derivado da aceitação **falha** por defeito real do motor/domínio (não por bug do teste).

## Formato

```markdown
# SPEC-DELTA — <id>

- **proposta:** <o que a spec diz> → <o que propomos>
- **justificativa:** <fatos, arquivo:linha>
- **impacto:** <itens/blocos afetados; risco de inflar a régua>
- **alternativas consideradas:** <e por que não>
- **decisão do STEWARD:** APROVADA (⇒ ADR `docs/adr/ADR-0XX-<slug>.md` + propagação) | REJEITADA (⇒ o item segue como a spec manda) | BLOQUEIA (⇒ registro na fila humana)
- **data/autor:** <UTC>
```

## Regra dura

Código que contradiz a spec **sem** ADR = rebaixamento automático a **NS** no fechamento, independentemente da qualidade do código.
