# V1 — Drill ENV-GUARD × comandos do cutover (2026-09-07, CUTOVER-READY)

Objetivo: eliminar fail-cold-surprise no dia do cutover — todo caminho que o
runbook V5 usará foi exercitado contra o guard ANTES do freeze. Ferramenta:
`scripts/env-guard.mjs` (norma: emenda-2026-09-07 + **emenda #2** §8 do mesmo
arquivo). Método: selftest com envs sintéticas (7→**9 casos** após emenda #2)

- smokes de CLI reais. O guard nunca conecta a nada.

## Matriz de cenários (resultado real)

| #   | Cenário                                               | Comando/evidência                                  | Esperado                          | Obtido                                            |
| --- | ----------------------------------------------------- | -------------------------------------------------- | --------------------------------- | ------------------------------------------------- |
| 1   | local + `test`                                        | selftest `local+test`                              | allow                             | **ALLOW**                                         |
| 2   | remoto não-sancionado + `test`                        | selftest `remoto+test`; smoke CLI do E2.2 (exit 3) | deny                              | **DENY exit 3**                                   |
| 3   | remoto + sancionada (`smoke:substrate`)               | selftest `remoto+smoke:substrate`                  | allow + log                       | **ALLOW_SANCTIONED** (linha de auditoria)         |
| 4   | remoto + `test` + `ALLOW_REMOTE_DB=<motivo>`          | selftest `remoto+test+ALLOW_REMOTE_DB`             | allow + log                       | **ALLOW + override-log**                          |
| 5   | remoto + `db:migrate` + override                      | selftest `remoto+db:migrate+ALLOW_REMOTE_DB`       | deny (override imune)             | **DENY**                                          |
| 6   | URL malformada                                        | selftest `malformada+test`                         | deny fail-closed                  | **DENY**                                          |
| 7   | branch de drill + `db:migrate` + override (emenda #2) | selftest `drill-branch+db:migrate+ALLOW_REMOTE_DB` | allow + log `path:"drill-branch"` | **ALLOW + log**                                   |
| 8   | **produção** + `db:migrate` + drill-branch + override | selftest `producao+db:migrate+drill-branch`        | **hard-deny incondicional**       | **DENY** (nem override nem drill-branch resgatam) |
| 9   | sem envs                                              | selftest `sem envs+test`                           | allow                             | **ALLOW**                                         |

Selftest integral: **9/9 pass** (`node scripts/env-guard.mjs --selftest`, 2026-09-07). **Atualização pós-V1 (emenda #3, mesmo dia): selftest 12/12** — acrescidos `cutover-window+producao+janela-vigente` → **ALLOW+log** (único caminho de migration em produção, time-boxed), `janela-expirada` → DENY, `sem-override` → DENY; produção sem cutover-window permanece hard-deny. Ver runbook `docs/runbooks/cutover-A4.md` §11.

## Gap documentado: invocação direta/npx bypassa hooks npm

Hooks `pre*` só disparam via `npm run`. `npx tsx scripts/db/migrate.ts` (ou
`node` direto) **não passa pelo guard**. Classificação: **risco aceito** com
duas compensações:

1. **Regra de runbook (V5)**: "todo passo de cutover executa via npm script" —
   nunca comando direto — de modo que o guard esteja sempre no caminho;
2. O guard é **não-invasivo por construção** (só inspeciona env em memória) —
   o risco residual é alguém invocar migração direta contra produção, o que o
   runbook proíbe e o manifest do dia fixa os comandos exatos.

## Caminho de migração do V2 (dry-run em branch)

`db:migrate` remoto é negado por padrão (imune a override). Com a emenda #2, o
caminho sancionado é:

```
ALLOW_REMOTE_DB="V2 CUTOVER-READY dry-run em branch efêmera" \
NEON_MIGRATION_TARGET_KIND=drill-branch \
DATABASE_ADMIN_URL=<URL DIRECT da branch de drill> \
npm run db:migrate
```

Produção continua hard-deny (cenário 8). Se este caminho tivesse sido negado
sem saída, a emenda #2 seria redigida e aplicada ANTES do V2 — foi o que
ocorreu (aplicada nesta rodada, antes da criação da branch).
