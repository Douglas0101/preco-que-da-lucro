# P2 — Validação local do `neon-pr-branch.yml` (2026-09-07)

Workflow novo (PLANO_MESTRE §26 / item 28 de §40): PR do próprio repo ganha
branch Neon efêmera `pr-<num>-<run>`, migrations via DIRECT obtida em runtime
(pooled derivado por troca de hostname), integração `db:test`, sonda H-07
(`m02:rls-probe`) contra o POOLED da branch e cleanup `always()` com prova +
comentário no PR. **Nunca** usa secret `DATABASE_URL` de produção: a única
credenencial é `NEON_API_KEY` (+ `vars.NEON_PROJECT_ID`); a URI da branch é
emitida pela API na hora e morre com o job.

## Aceite 1 — parse YAML

```
$ python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/neon-pr-branch.yml')); print(d['jobs'])"
YAML OK; jobs: ['gate', 'branch-ci', 'cleanup']
on: {'pull_request': {'types': ['opened', 'synchronize']}}
permissions: contents: read, pull-requests: write   (mínimas, §25)
```

## Aceite 2 — pin-check (§25/2.11: actions por SHA completo)

```
$ grep "uses:" .github/workflows/neon-pr-branch.yml | grep -vE "uses: [a-zA-Z0-9_./-]+@[0-9a-f]{40} #"
(vazio) → PIN-CHECK OK
```

Pins reaproveitados dos workflows já em CI: `actions/checkout@3d3c42e5…(v7.0.1)`,
`actions/setup-node@82076278…(v7.0.0)`,
`neondatabase/create-branch-action@fb620d43…(6.3.1)`,
`neondatabase/delete-branch-action@4468d825…(v3.2.1)` — mesmos SHAs de
`neon-preview.yml`/`neon-drill-ops.yml` (sem superfície nova).

## Aceite 3 — simulação local dos jobs SEM secrets (dry-run das decisões)

Gate (fork-guard + presença de segredo), mesmo script do job:

| Caso (head ≠ base? key?)                              | Output                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fork (`fork-org/repo`)                                | `run=false · reason=fork-guard` (PR de fork: skip antes de qualquer segredo — GitHub já não entrega secrets a forks; dupla checagem = defesa em profundidade)                          |
| mesmo repo, **sem** `NEON_API_KEY`                    | `run=false · reason=secret-missing(SKIP-GRACIOSO-ROTULADO: configure NEON_API_KEY + vars.NEON_PROJECT_ID)` — gatilho de parada "secret indisponível → skip gracioso rotulado" cumprido |
| mesmo repo, com key (vars vazio → default do projeto) | `run=true · reason=same-repo-with-secrets`                                                                                                                                             |

Transformação pooled (passo de runtime), com URL sintética:

```
direct  ep-test-branch.c-5.us-east-2.aws.neon.tech
pooled  ep-test-branch-pooler.c-5.us-east-2.aws.neon.tech  (senha preservada)
```

URIs vivem só em `$RUNNER_TEMP` (0600) e morrem com o job; nada de URL em
argv; logs do guard/motivo entram como texto.

## Conformidades documentadas no YAML

- cleanup: job `cleanup` com `if: always() && needs.gate.outputs.run == 'true'`
  - rede de segurança `expires-at +24h` via PATCH na criação (§12.5).
- `production` nunca é alvo: parent é `production` (cópia @ HEAD); hard-deny da
  Emenda #2 permanece — o job usa o caminho sancionado `drill-branch` com
  motivo (`predb:migrate` hook do guard valida antes de conectar).
- H-07 roda na **branch**, não na produção; seed é o sintético do probe
  (marcador `@preco-que-da.test`), destruído com a branch.

## Pendência de CI (não da rodada)

O **run real** do `neon-pr-branch.yml` só pode ocorrer no primeiro PR
`develop → main`/PR comum pós-merge do feixe humano (V0/V4/V5), pois exige o
workflow commitado + `NEON_API_KEY`/`vars.NEON_PROJECT_ID` no repo. Registro
como fila humana; não é bloqueador desta rodada.
