# SPEC — WP-R2 (checklist anti-vacuoso no template de work package)

**Fato-fonte:** análise do Bloco 3 × Plano Mestre (2026-09-20), achado "o S6 está caçando harness
vacuoso, não bugs"; veredictos S6 selados dos WPs 3–5 (ponteiros na §3 do README).
**Base:** `1aad70cbc` · **Branch:** `mission/r2-wp-checklist` · **Worktree:** `.worktree-r2-wp-checklist`

## 1. Problema

Os S6 dos WPs 3–5 forçaram 17 correções (3 CORR + 14 N), das quais 7 são defeitos **materiais de
harness** e 0 são de código de produto. Sem contrato de prova no WP, o S6 paga as mesmas lições a
cada rodada.

## 2. Contrato

- Todo WP segue `docs/evidence/_templates/work-package.md` com o **checklist anti-vacuoso de 14
  itens** demonstrado item a item antes do S6.
- Taxonomia fixada: **CORR** = claim corrigida; **N** = defeito novo; "correções forçadas" = CORR +
  N corrigidos; bounds do SDD limitam rodadas de correção, não claims corrigidas; N corrigidos na
  §7 do selo, declarados na §Riscos.
- O checklist **não** é gate automático — o enforcement é humano/S6 (declarado).

## 3. Mudanças

1. `docs/evidence/_templates/work-package.md` (novo; 14 itens + apêndices A/B).
2. `AGENTS.md` (nova seção `## Work packages (contrato de prova)`).
3. Este selo (`SPEC.md` + `README.md` + `captures/` + `MANIFEST.sha256`).

Não muda: nenhum arquivo de código, dependência, schema ou CI.

## 4. DoD

- [x] template com o checklist de 14 itens e origens rastreadas (apêndice A)
- [x] pointer no `AGENTS.md` sem contradizer regras vigentes e sem prometer automação
- [x] **validação por rastreabilidade**: cada um dos 7 defeitos de harness mapeado a itens, com
      citação do veredicto selado; controle positivo nos itens cobertos pelos bytes finais (README §3)
- [x] `npm run check` exit 0 (captura `gate-local.log.txt`)
- [x] S7 assertado (isolamento, credenciais, H-9, escopo, refs; `s7-guard.log.txt`)
- [x] `checked === discovered` no `MANIFEST.sha256`

## 5. Testes / validação

O WP não tem código a testar; a falsificação é a **rastreabilidade**: o checklist tem de pegar os
defeitos reais que o S6 pegou (tabela §3 do README). O S6 adversarial audita o pacote e a
fidelidade das citações — foi o que encontrou as imprecisões que a revisão final corrigiu (§7).

## 6. Riscos

- Prosa não impede reincidência sozinha — declarado; o S6 continua sendo a lane de reprovação.
- Cobertura parcial: `m02:secrets-audit`/`m02:boundaries` são gate global e ficam fora do checklist.
- Automatizar o checklist viraria linter frágil — declaradamente fora de escopo.

## 7. Rollback

Descartar a branch e o worktree. O diff é `AGENTS.md` + `docs/**`; nada em `develop` antes do Gate C.
