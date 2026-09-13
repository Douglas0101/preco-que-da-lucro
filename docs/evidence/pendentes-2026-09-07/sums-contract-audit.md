# A-01 — Auditoria de contrato `m02-sums` (somente leitura)

- Data (UTC): 2026-09-07
- Branch: `develop` — repo `/home/douglas-souza/preco-que-d-main`
- Arquivos auditados (LEITURA, sem execução, sem rede, sem banco):
  - `scripts/m02-sums.mjs` (295 linhas)
  - `scripts/m02-sums.d.mts` (44 linhas)
- Verificação prévia de wiring: chave `m02:sums` **não existia** em `package.json`
  (busca por `m02:sums` em `package.json` retornou zero ocorrências antes da edição).

## Veredito: CONTRATO CONFORME — wiring autorizado e executado

| #   | Item esperado                                               | Evidência no código                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Veredito            |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Sela TODOS os `SHA256SUMS` sob `docs/evidence`              | `parseArgs`: `root` default `"docs/evidence"` (`m02-sums.mjs:61`); `discoverBundles` lista todos os subdirs com `SHA256SUMS`, ordenados (`m02-sums.mjs:95-102`); `regenBundle` reconstrói cada SUMS a partir de `paths do SUMS existente ∪ arquivos atuais do bundle` recursivo, excluindo ocultos e o próprio `SHA256SUMS` (`m02-sums.mjs:164-184`, `collectBundleFiles` em `m02-sums.mjs:115-127`)                                                                                                                                                                                                                                                                          | CONFORME            |
| 2   | Semântica `sha256sum -c` a partir da raiz                   | Paths root-relative (`relative(rootDir, …)` / `resolve(rootDir, …)`, raiz = repo root em `m02-sums.mjs:35`); formato `<hash>␣␣<path>` + LF + ordem lexicográfica (`buildSumsContent`, `m02-sums.mjs:129-132`); parser estrito `^([0-9a-f]{64})  (.+)$` (`m02-sums.mjs:104-113`); hash in-process `node:crypto`, sem spawn (`sha256OfFile`, `m02-sums.mjs:91-93`); modo `--verify` só lê, default regenera-e-verifica (`m02-sums.mjs:218-244`)                                                                                                                                                                                                                                 | CONFORME            |
| 3   | Exceção ÚNICA e datada p/ gsec até V0, com `--release-gsec` | `GSEC_EXCEPTION` único: bundle `gsec-2026-09-06`, label `vermelho-esperado até assinatura do memo (V0)`, marker `.gsec-exception-released`, 2 pins nominais (`scripts/env-guard.mjs`, `docs/specs/M-02/emenda-2026-09-07-env-guard.md`) (`m02-sums.mjs:40-50`); pinning restrito ao bundle gsec (`m02-sums.mjs:136,172`); `--release-gsec` grava o marker com timestamp ISO (`m02-sums.mjs:206-217`); `exceptionActive = !existsSync(marker)` (`m02-sums.mjs:217`); vermelho pós-V0 no gsec = hard fail (`m02-sums.mjs:263-267`); pin ausente no disco = fail-closed (`m02-sums.mjs:245-251`); caminho selado ausente na regen = erro sem reescrever (`m02-sums.mjs:175-178`) | CONFORME            |
| 4   | Exits 0/1/2                                                 | `0` = todos GREEN ou RED-LABELED; `1` = RED-UNLABELED não-gsec (`m02-sums.mjs:263-266`); `2` = fail-closed: arg inválido (`m02-sums.mjs:189-192`), raiz inexistente (`m02-sums.mjs:194-198`), zero bundles (`m02-sums.mjs:199-204`), erro de regen (`m02-sums.mjs:232-237`), SUMS malformado (`m02-sums.mjs:224-229`), pinado ausente (`m02-sums.mjs:245-251`), vermelho pós-V0 (`m02-sums.mjs:263-267`). Confere com o header (`m02-sums.mjs:27-28`)                                                                                                                                                                                                                         | CONFORME            |
| 5   | Proibido editar SUMS à mão                                  | Regra de processo documentada no header: ordenação `assinatura/appends → m02:sums → -c verde → staging`, nunca staging com SUMS vermelho (`m02-sums.mjs:23-24`, `usage` em `m02-sums.mjs:52-58`); único escritor é `regenBundle` (mecânico: hash do disco ou hash pinado) + marker de release; idempotente byte-a-byte (`m02-sums.mjs:25-26`); caminho selado ausente = fail-closed sem reescrever (`m02-sums.mjs:22,175-178`). A proibição é constraint de processo (não há check de código que a enforce — por desenho, o selo mecânico a torna desnecessária)                                                                                                              | CONFORME (processo) |
| 6   | Paridade `m02-sums.d.mts` × `.mjs`                          | `.d.mts` declara exatamente os 8 exports do `.mjs` (`GSEC_EXCEPTION`, `parseArgs`, `main`, `sha256OfFile`, `discoverBundles`, `parseSums`, `buildSumsContent`, `verifyEntries` — `m02-sums.mjs:286-295` × `m02-sums.d.mts:29-44`); interfaces cobrem args/entries/bundles/failures/results; união de status `GREEN \| RED-LABELED \| RED-UNLABELED` confere (`m02-sums.d.mts:22-28` × `m02-sums.mjs:155-161`)                                                                                                                                                                                                                                                                 | CONFORME            |

Nenhuma divergência encontrada → wiring executado (não foi necessário PARAR).

## Wiring (1 linha em `package.json`)

- Inserida `"m02:sums": "node scripts/m02-sums.mjs"` entre `"m02:rls-probe"` e
  `"m02:v2b"` (posição alfabética local `rls-probe < sums < v2b`, dentro do bloco `m02:*`).
- Validação JSON: `package.json OK` (parse via `node -e "JSON.parse(...)"`).
- `git diff --stat package.json` reporta **20 inserções**: 19 já estavam sujas na
  working tree ANTES desta tarefa (hooks `pre*` env-guard + entradas `m02:readiness`,
  `forensic-bundle`, `reconcile`, `rls-probe`, `v2b`, `role-membership`, `cutover-t0`,
  `snapshot`, `env-guard-selftest`, `backup-verify` — visíveis na leitura inicial) e
  **1 é desta tarefa** (`m02:sums`). Nenhuma outra linha tocada.
- Sem commit, sem staging (`git add` não executado; `git status` mostra só `M package.json` unstaged + este arquivo novo untracked).

## Secrets

Nenhum valor de secret impresso ou lido. Os arquivos auditados não referenciam
nomes de envs (apenas `node:crypto`/`node:fs`/`node:path`/`node:url`); nada a listar.
