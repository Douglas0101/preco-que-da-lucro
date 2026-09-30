# SPEC — WP-R3 (forense da citação + item 15 + contract lint + calibração)

**Fato-fonte:** análise Fase 0 §2 (run de CI do WP-R2 citado fora do commit selado).
**Base:** `ad05428` · **Branch:** `mission/r3-forensics`.

## 1. Problema

A citação de CI do WP-R2 apontou `35484327532` (de `1aad70c`), anterior ao próprio WP; os runs reais
(`35512525965`/`35512525992`) não foram citados. Run ID é _claim_ e exige identidade. Além disso, um
template alterado sozinho não passava por nenhuma validação estrutural, e as categorias `REJECTED`/
`UNVERIFIABLE` do S6 nunca haviam sido emitidas em 5 WPs.

## 2. Contrato

- Toda célula de CI cita run com `headSha` igual ou descendente do commit selado; sem trigger,
  `N/A-trigger <motivo>; último verde = <run> em <commit>` (item 15).
- O template de WP é validado estruturalmente nos dois pipelines: `npm run check` local/pesado (`m02:work-package-guard` na cadeia) e passo dedicado no `verify` do `ui-stack.yml`; no leve, para push docs-only.
- `REJECTED` e `UNVERIFIABLE` são alcançáveis (calibração selada).

## 3. Mudanças

Item 15 no template; `AGENTS.md` (15 itens + cadeia do gate + leve); `scripts/m02-work-package-guard.mjs`;
`package.json` (script + check); `ci-light.yml` (passo novo); análise persistida; este selo. Nenhum runtime.

## 4. DoD

- [x] errata do WP-R2 no journal (`L130`/`L131`, comitados no land) com runs conferidos por SHA (`captures/ci-binding.log.txt`)
- [x] item 15 no template e no `AGENTS.md`
- [x] guard falsificado em 4 casos (item não numerado, origem degenerada `N/A`, coluna extra, template inexistente) e ligado a `check` + `ui-stack` + `ci-light`
- [x] calibração: uma lane `REJECTED` e uma `UNVERIFIABLE` (mais a lição do B1), com proveniência declarada
- [x] `npm run check` exit 0 com `CHECK_EXIT=0`; S7 assertado; `checked === discovered` (marcado no fecho, após o S7/selo — correção do S6 N7)

## 5. Testes

Guard: real passa, duas cópias scratch reprovam (captura). Binding: `gh run list` filtrado por SHA.
Calibração: três lanes sintéticas de contexto limpo. S6 adversarial do próprio WP.

## 6. Riscos

Guard é estrutural; prosa segue com o S6. Calibração sintética prova alcance, não qualidade.
A errata não reescreve o selo do R2 (journal é canônico).

## 7. Rollback

Descartar branch/worktree; nada em `develop` antes do Gate C.

## 8. Checklist anti-vacuoso demonstrado (auto-aplicação)

O WP que institucionaliza o checklist o demonstra (correção do S6 N8). Não aplicável ≠ dispensado:
cada linha aponta a evidência.

| #   | item                            | demonstração                                                                                   |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Controle negativo               | falsificação do guard: cópias mutadas reprovam (`guard-falsifica.log.txt`)                     |
| 2   | Fronteira nas duas direções     | binding de CI conferido nos dois sentidos: `c9d1740` verde × run stale de `1aad70c`            |
| 3   | Identidade, não cardinalidade   | guard lê a **coluna origem** pelo header e rejeita valor degenerado; não conta colunas         |
| 4   | Proibido exit-code-only         | selo exige `CHECK_EXIT=0` no log do gate; calibração exige a linha de veredicto, não a palavra |
| 5   | Proibido sleep fixo             | N/A — nenhuma espera temporal neste WP                                                         |
| 6   | Sem valor degenerado            | `N/A`/`TBD`/`?` na origem reprovam (mutação N1 do S6)                                          |
| 7   | Precondição de estado           | S7 asserta escopo/refs; selo asserta gate e calibração antes de montar o manifesto             |
| 8   | Sentinela real por cenário      | cada caso de falsificação tem sua cópia scratch selada (`captures/scratch-*.txt`)              |
| 9   | Fingerprint de revisão          | `hashes.txt` + sha256 no S7                                                                    |
| 10  | `checked === discovered`        | MANIFEST conferido por `sha256sum -c`                                                          |
| 11  | S6 de contexto limpo            | veredicto selado verbatim; `REJECTED`/`UNVERIFIABLE` provados alcançáveis na calibração        |
| 12  | Falha alta                      | guard exit 1/2 nomeado; `SET -u`; nenhum `catch` compensatório                                 |
| 13  | Isolamento assertado            | S7: `:5432` 0 listeners, zero credencial herdada, `origin/main` conferido                      |
| 14  | Check impresso tem gate/captura | todo caso da falsificação e da calibração está em `captures/` e é lido pelo selo               |
| 15  | Run de CI atado ao commit       | errata com `headSha`; os runs do land deste WP serão citados por SHA após o push               |
