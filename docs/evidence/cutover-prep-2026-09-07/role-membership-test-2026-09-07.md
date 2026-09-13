# P3 — GAP-TOOLING fechado: drill de `m02:role-membership` (2026-09-07)

Achado original (evidence.json da rodada CUTOVER-READY):
`db:migrate` **não** invoca `ensureRuntimeRoleMembership` (somente as suites
`db:test-*`); no smoke A4 a membership precisaria existir **antes** do
`SET ROLE app_runtime` da sonda H-07. Fechamento: **ordem de runbook** (§2.5
novo passo (v) do T-0, ANTES do smoke §5) + **script**
(`scripts/m02-role-membership.mjs`, entrada npm `m02:role-membership`,
reusando a fonte de verdade `scripts/db/migrate.ts:108` — nenhum SQL
duplicado).

## 1. Branch de teste (drill-branch, §12.4/§12.5)

- `probe-membership-2026-09-07` → id `br-super-dawn-ayzdf306`
- parent `br-snowy-violet-aymcvvvv` (production @ HEAD); expires-at de
  segurança `2026-09-08T01:19:55Z`
- Endpoint DIRECT: `ep-long-feather-ayxexehk.<region>.aws.neon.tech` (mascarado;
  host ≠ produção)
- URL lida em-processo (`neon cs … --extended -o json` → arquivo 0600 em /tmp,
  nunca impressa)

## 2. Sequência idempotência (aceite da rodada)

| #   | Operação                                          | Resultado                                                                                                                                                                                                                                |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | snapshot catálogo ANTES (`pm-state-before.json`)  | `neondb_owner→app_runtime`: `set_option=false, admin_option=true` (membership só-administrativa do PG16+)                                                                                                                                |
| 2   | `m02:role-membership` execução 1                  | exit 0 · `before.has_set_membership=false → after=true` · `idempotent_noop=false` (trabalho real)                                                                                                                                        |
| 3   | snapshot INTERMEDIÁRIO (`pm-state-mid.json`)      | 2 linhas: admin-only + grant simples `set_option=true`                                                                                                                                                                                   |
| 4   | `m02:role-membership` execução 2                  | exit 0 · `idempotent_noop=true`                                                                                                                                                                                                          |
| 5   | snapshot DEPOIS (`pm-state-after.json`)           | **`diff mid × after` = VAZIO** — idempotência provada                                                                                                                                                                                    |
| 6   | `--dry-run`                                       | `has_set_membership=true`, `action="dry-run: nenhuma escrita"`, exit 0                                                                                                                                                                   |
| 7   | conferência catálogo produção (read-only, SELECT) | host `ep-long-violet-aye9g0bn…`: `set_option=false, admin_option=true` + `app_runtime` com `rolsuper=false, rolbypassrls=false` — **inalterada; o grant do drill NÃO vazou** (confirmado empírico: membership é por branch no substrato) |

Artefatos do script: `role-membership-run1.md/.json`, `role-membership-run2.md/.json`.

## 3. Cleanup §12.5 (prova antes/depois)

Antes:

```
probe-membership-2026-09-07 | br-super-dawn-ayzdf306 | ready | 2026-09-08T01:19:55Z
production | br-snowy-violet-aymcvvvv | ready | never
develop | br-small-hill-aymcu14y | archived | never
```

Comando: `neon branches delete br-super-dawn-ayzdf306 --project-id damp-forest-57346541`

Depois:

```
production | br-snowy-violet-aymcvvvv | ready | never
develop | br-small-hill-aymcu14y | archived | never
```

**Só `production` (ready) e `develop` (archived) restam** — substrato como
encontrado. A deleção da branch também destruiu o único efeito de escrita do
drill (grant na cópia).

## 4. Predefinições validadas do operador (código)

- kind `drill-branch` mirando host de produção → **DENY pré-conexão** (exit 3,
  Emenda #2).
- kind `cutover-window` fora de janela / sem `ALLOW_REMOTE_DB` → **DENY
  pré-conexão** (exit 3, Emenda #3) — inclusive `--dry-run` remoto, por
  conservadorismo.
- Hoje (D0) o caminho `cutover-window` em produção está corretamente
  **indisponível**: o T-0 roda dry apenas com kind `drill-branch` (local/sandbox)
  e o grant em produção acontece só na janela, antes do smoke.
