# WP-R3 — forense da citação de CI + item 15 + contract lint + calibração do S6

**Work package:** `WP-R3` (Fase 0, correção do achado da análise Fase 0)
**Fato-fonte:** `docs/evidence/analise-avancada-fase0-wpR2-wpR0-2026-09-20.md` §2
**Base:** `ad05428` · **Branch:** `mission/r3-forensics`
**Natureza:** docs + tooling de contrato; nenhum runtime tocado.

---

## 1. Problema e veredicto forense

A análise apontou que o WP-R2 teria citado o run `35484327532` como seu CI, sendo esse run do commit
**anterior** (`1aad70c`). **Confirmado:** a citação era stale. A CI do WP-R2 **existiu e ficou verde**
— `35512525965` (UI stack) e `35512525992` (CI light), ambos em `c9d1740`
(captura `ci-binding.log.txt`). A hipótese de _paths filter_ bloqueando a pesada para
`AGENTS.md`+template está **refutada** (a pesada rodou). Errata registrada no journal `L131`.

**Corolário estrutural que fica coberto:** um template alterado sozinho (só `docs/evidence/**`) roda
apenas o pipeline leve, que antes não validava a estrutura do contrato — agora valida.

## 2. O que muda

| #   | arquivo                                    | mudança                                                                                       |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | `docs/evidence/_templates/work-package.md` | **item 15** — run de CI atado ao commit selado (`N/A-trigger` explícito quando não aplicável) |
| 2   | `AGENTS.md`                                | checklist 15 itens; cadeia do gate com `m02:work-package-guard`; pipeline leve idem           |
| 3   | `scripts/m02-work-package-guard.mjs`       | guard node-only, falsificável por `--template`, valida 15 itens + origens + seções + layout   |
| 4   | `package.json`                             | script `m02:work-package-guard` e entrada na cadeia do `check`                                |
| 5   | `.github/workflows/ci-light.yml`           | passo novo: o guard roda em push docs-only                                                    |
| 6   | `docs/evidence/analise-avancada-fase0-...` | análise persistida com proveniência + adendo de verificação                                   |

## 3. Evidência

- **Binding de CI:** `captures/ci-binding.log.txt` — runs de `c9d1740` verdes e o run stale com
  `headSha = 1aad70c` (prova da errata).
- **Guard com dentes (4 casos):** `captures/guard-falsifica.log.txt` — template real passa; item 15 não
  numerado reprova (`checklist tem 14 itens`); origem degenerada `N/A` reprova; coluna extra (que
  mascarava a coluna de origem) reprova; template inexistente sai com erro alto. As cópias scratch
  usadas estão seladas em `captures/scratch-*.txt` (correção do S6 N11).
- **Calibração do S6 (anexo):** cada captura traz método/proveniência (lane read-only de contexto limpo); o selo exige a **linha de veredicto** (`**C1 — REJECTED**` / `**C1 — UNVERIFIABLE**`), não a palavra solta na prosa (correção do S6 N3): `captures/calib-a.md.txt` (`REJECTED`), `captures/calib-b1.md.txt`
  (`REJECTED`, com a lição de desenho: ausência declarada ≠ imensurável) e `captures/calib-b2.md.txt`
  (`UNVERIFIABLE`). Ambas as categorias antes nunca emitidas são **alcançáveis**; o veredicto é lido
  das capturas pelo selo (grep fail-closed).
- **Gate:** `captures/gate-local.log.txt` com `CHECK_EXIT=0` (o próprio `check` agora roda o guard).
- **S7:** `captures/s7-guard.log.txt` (escopo, secrets, H-9, refs).

## 4. Riscos e limites declarados

| item                                                         | situação                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| o guard valida **estrutura**, não conteúdo                   | declarado: prosa de um WP continua sendo julgada pelo S6 humano/lane                           |
| a calibração usa casos sintéticos                            | declarado: prova que as categorias são alcançáveis, não que a calibração do revisor seja ótima |
| a errata vive no journal (append-only), não no selo do WP-R2 | declarado: o journal é o registro canônico; o selo do R2 não é reescrito                       |
| `049ebc7`/`a7f1e4a` nunca tiveram runs próprios              | declarado: só o land `c9d1740` foi empurrado; o item 15 exige conferir por SHA                 |

## 5. Como reproduzir

```bash
node scripts/m02-work-package-guard.mjs                      # OK (15 itens)
node scripts/m02-work-package-guard.mjs --template <scratch> # reprova se faltar item/origem
npm run check                                                # gate completo (inclui o guard)
```

## 6. S6 ADVERSARIAL

**Revisão auditada:** guard `m02-work-package-guard.mjs`, wiring `package.json`/`ui-stack`/`ci-light`,
item 15, errata e calibração. **Método:** subagente read-only de contexto limpo; veredicto selado
verbatim em `captures/adversarial-r3-verdict.md.txt`.

**Veredicto:** **0 REJECTED · 0 UNVERIFIABLE · 2 CORRECTED · 11 N.** Nenhuma claim central refutada —
a errata, o guard, o wiring e a calibração se sustentam. O S6 provou que o WP **não era selável no
estado auditado** e apontou dois defeitos materiais.

| achado                                                                    | tratamento (revisão final)                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **N4 (material)** — o guard não rodava em push misto (pesado sem o passo) | passo `npm run m02:work-package-guard` adicionado ao `verify` do `ui-stack.yml`            |
| **N8 (material)** — o WP não demonstrava o checklist de 15 itens          | `SPEC.md` §8 com a demonstração item a item                                                |
| **CORR-1** — a cadeia citada no `AGENTS.md` omitia `m02:matrix:check`     | cadeia completada (bate com o `package.json`)                                              |
| **CORR-2** — "todo push" superestimava a cobertura                        | texto corrigido: `check` + `verify` (pesado) e passo no leve para docs-only                |
| **N1/N2** — origem `N/A` passava; coluna extra mascarava a origem         | guard lê a coluna pelo header e rejeita origem degenerada; 4 casos de falsificação selados |
| **N3** — o gate da calibração casava a palavra "não REJECTED" na prosa    | selo passou a exigir a linha de veredicto por arquivo                                      |
| **N5** — ponteiro de captura inexistente no adendo                        | corrigido para `ci-binding.log.txt`                                                        |
| **N6** — journal fora da branch                                           | `L130`/`L131` entram no commit de land (o selo aponta o SHA)                               |
| **N7** — DoD `[x]` antes de o selo existir                                | DoD com o item de S7/selo marcado apenas no fecho                                          |
| **N9** — rótulo da falsificação impreciso                                 | casos renomeados e mutações reais (remoção de linha, não renomeação)                       |
| **N10** — capturas de calibração sem proveniência                         | cabeçalho de método/proveniência adicionado                                                |
| **N11** — entradas da falsificação não seladas                            | `captures/scratch-*.txt` versionadas                                                       |
