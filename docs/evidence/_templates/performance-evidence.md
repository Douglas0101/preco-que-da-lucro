# Template — evidência de performance (§35)

> Copie este arquivo para `docs/evidence/<tema>-<data>.md` e nomeie como
> `perf-*.md` ou `*-perf-*.md` quando o PR/commit afirmar ganho ou conserto de
> performance. `_templates/**` é ignorado pelo gate; o artefato copiado **não** é:
> `src/test/perf-evidence.test.ts` exige os 7 rótulos de §35 em todo
> `perf-*.md`/`*-perf-*.md` novo fora da allowlist de legado.

## Cabeçalho obrigatório

- **ambiente:** `dev-evidence` | `CONTROLLED` (nunca misturar; `dev-evidence` não
  é produção e não sustenta SLO).
- **método:** como os números foram produzidos (comando, ferramenta + versão,
  script, percentil).
- **n:** amostras por bucket (p95 com n baixo é frágil; declare `N/A`).
- **janela:** timestamps UTC de início → fim.
- **fonte:** caminho versionado do raw (`.jsonl`/`.json`/`.txt` em
  `docs/evidence/<tema>-<data>/`). `/tmp`, `artifacts/`, `logs/` e `raw/` não
  contam: sem fonte re-derivável o resultado vira `follow-up`.

## Campos §35 (os 7 rótulos exigidos pelo gate)

- **hypothesis:** a alegação antes da medição (o que deveria mudar e por quê).
- **metric:** métrica primária e unidade (ex.: p50 ms, RT-count, LCP p75).
- **before:** valor anterior, com n, janela e fonte.
- **change:** o que mudou (arquivos/PR/migration/comando).
- **after:** valor após a mudança, no mesmo método e regime do `before`.
- **result:** leitura honesta — caiu / não caiu / regrediu / indeterminado; sem
  promessa.
- **decision:** `keep` | `revert` | `follow-up` (+ justificativa e próximo passo).

## Exemplo mínimo preenchido

- **hypothesis:** o read-model UNION ALL reduz o p50 de `listProductsWithMetrics`.
- **metric:** p50 ms de `/_serverFn listProductsWithMetrics` (navegação autenticada).
- **before:** p50 4935 ms (n=5, 2026-08-29T19:05Z→23:54Z, fonte `docs/evidence/perf-baseline-2026-08-29.md`).
- **change:** `src/lib/products.functions.ts` (patch pós-S4, commit informado no artefato).
- **after:** p50 2463 ms (n=4, 2026-08-30T03:33Z→03:33Z, fonte `docs/evidence/perf-after-2026-08-29.md`).
- **result:** caiu 50,1% no mesmo regime `dev-evidence`; n baixo, p95 frágil.
- **decision:** `keep` — manter; follow-up: cobertura de integração contra Postgres real.

## Regras de honestidade

- `before` e `after` no **mesmo regime** de medição; declare confundidores (ex.:
  latência de rede entre sessões).
- Sem fonte versionada e re-derivável, o número não sustenta `keep`.
- Lacuna de amostragem é registrada como lacuna, nunca estimada.
- `CONTROLLED` só vale para harness local/mockado; tráfego real é `OBSERVED`.
