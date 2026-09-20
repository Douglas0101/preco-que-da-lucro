# SPEC — WP-R0 (reconciliação do ledger)

**Fato-fonte:** análise avançada do Bloco 3 × Plano Mestre (2026-09-20), itens 1 e 6; persistida em
`docs/evidence/analise-avancada-bloco3-plano-mestre-2026-09-20.md`.
**Base:** `c9d1740` · **Branch:** `mission/r0-ledger-recon` · **Worktree:** `.worktree-r0-ledger`

## 1. Problema

O placar "86,36% parcial" não tinha fórmula explícita; a narrativa dos WPs 3–5 misturava **CORR**
(claims corrigidas) com correções de **N** (defeitos novos); e os **12 NS + 2 UNV** do placar não
tinham lista nominal derivável — a fila só declarava os totais.

## 2. Contrato

- Fórmula explícita: **crédito = (D + ½·P)/187**, NS/UNV = 0; crua = D/187.
- Taxonomia fixada: CORR = claim corrigida; N = defeito novo; "correções forçadas" = CORR + N; bounds
  do SDD limitam rodadas, não claims.
- Lista canônica dos NS/UNV derivada do raw com método reproduzível (parser + transições + dedup).
- **Nenhum placar muda por inferência**: a promoção de itens (cluster de memória, 25.4) exige
  re-medição própria (R0b) + ratificação do MAESTRO.

## 3. Mudanças

1. `docs/evidence/analise-avancada-bloco3-plano-mestre-2026-09-20.md` (transcrição com proveniência).
2. `docs/evidence/ledger-reconciliation-2026-09-20/` (este selo).
3. Nada mais: `QUEUE.md`/ledger intocados, nenhum código.

## 4. DoD

- [x] fórmula conferida ao dígito contra `QUEUE.md` e o ledger
- [x] errata CORR×N dos WPs 3–5 com as contagens dos veredictos selados
- [x] 12 NS + 2 UNV nominais extraídos com asserção de **identidade** (não só cardinalidade)
- [x] varredura de estado por item, com capturas versionadas
- [x] §41/§42 com números **correntes** (não os da part-E de 2026-09-13)
- [x] gate `npm run check` exit 0; S7 assertado; `checked === discovered`

## 5. Testes

O WP é documental; a prova é a **extração reproduzível** (`captures/extrai-ns.sh.txt` →
`extrai-ns.log.txt`, com `assert` da lista canônica e da composição) + a varredura de estado
(`captures/estado-ns.sh.txt` → `estado-ns.log.txt`) + o S6 adversarial de contexto limpo.

## 6. Riscos

- A extração parte do anexo de 2026-09-15 (raw mais recente item a item) — declarado.
- Promoções pendentes (15.1/15.2/15.3/15.4/25.4) **não** movem o placar aqui; R0b é WP próprio com
  S6 e ratificação MAESTRO.
- Os números de gate do §41/§42 vêm da medição de 2026-09-15; a part-E de 2026-09-13 é histórica.

## 7. Rollback

Descartar a branch e o worktree; nada em `develop` antes do Gate C.
