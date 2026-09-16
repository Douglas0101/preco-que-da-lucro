# Template — evidência de performance (§35)

> Copie este arquivo para um diretório de captura `docs/evidence/<tema>-<data>/`
> nomeando-o `perf-evidence.md`, ou para `docs/evidence/perf-<tema>-<data>.md`,
> quando o PR/commit afirmar ganho ou conserto de performance. `_templates/**` é
> ignorado pelo gate; o artefato copiado **não** é: `src/test/perf-evidence.test.ts`
> descobre por **caminho** — todo `.md` sob `docs/evidence/perf-*/**` e todo
> `perf-*.md`/`*-perf-*.md` — e exige os 7 rótulos de §35 de cada artefato, com
> descoberta vazia reprovando (fail-closed) e allowlist de legado de 2 artefatos
> `dev-evidence` pré-gate, justificada no próprio gate.

## `report.md` de captura: bloco §35 gerado (não manter à mão)

`scripts/perf/summarize.mjs` **emite o bloco §35** no `report.md` que gera, a
partir do raw do próprio diretório (`meta.json`, `route-samples.jsonl`,
`chat-samples.jsonl`, `context-tx.jsonl`, `ai-model-attempts.jsonl`,
`bundle-report.json`): regime (`label`), `n`/warmup, ambiente (base URL, banco,
mock de IA, runtime, browser), janela, commit de origem e as métricas medidas
entram derivados; o que o raw não tem sai como `N/A`/lacuna declarada — o
gerador **nunca** inventa número. Regenerar (`node scripts/perf/summarize.mjs
--dir <dir>`) reproduz o bloco e mantém o gate verde; não recoloque o bloco à mão.

Rótulos de **julgamento** podem (e devem) ser declarados verbatim no raw, em
`meta.section35.<rótulo>` (`hypothesis`, `before`, `change`, `decision`): o texto
declarado tem precedência sobre o padrão derivado. Sem declaração, o `before` e o
`change` saem `N/A` (nada é presumido) e a `decision` derivada é conservadora —
`keep` quando a métrica primária (prontidão de rota) foi medida, `follow-up`
quando não há amostra de rota; `revert` nunca é derivado, só declarado. O
artefato §35 revisável (método, n, janela, limites e follow-ups) continua sendo o
`perf-evidence.md` ao lado do sumário.

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
