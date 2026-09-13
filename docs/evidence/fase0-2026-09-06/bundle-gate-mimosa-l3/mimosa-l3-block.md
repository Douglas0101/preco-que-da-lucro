# Bloqueio de gate: Mimosa L3 impede commits (2026-09-06)

## Fato

Todo `git commit` neste checkout está bloqueado pelo hook PreToolUse `git-gate-hook`
(plugin Mimosa 1.0.3): "L3 — 发现 11 个高危、1 个中危，最高等级 high ·
高危已强制拦截，请修复并重新扫描". O gate varre o projeto inteiro e bloqueia
enquanto houver finding high, sem mecanismo de baseline/triagem
(documentação do plugin, `commands/mimosa-scan.md`: "高危: 必须修复 — 按建议改正,
改完再次调用 security_scan 确认通过").

## Scan selado executado nesta rodada (requisito "rescan")

- job `scan-job-mtq5ix0r-b8781abe72ee277f` (depth deep, estático, sem runtime)
- scanId `scan-2026-09-06T18-35-03.677Z-c16585454925`
- seal `sha256:ee81f4d2533e4520b750c92776d50edcbb320292e4828f18a14042dc1eb64fcf`
- findingCount 11 · diretório: `~/.mimosa/security-scans/project-a6d37a05884a2a5e9c7954a3/scan-2026-09-06T18-35-03.677Z-c16585454925`
- Commit permaneceu bloqueado após o scan selado → o gate exige correção
  efetiva dos achados, não referência/selar.

## Os 11 high + 1 medium (todos pré-existentes — zero no diff desta rodada)

| #   | Local                                  | Alegação                  | Classificação preliminar (leitura das linhas)                                                                  |
| --- | -------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `src/test/auth-policy.test.ts:48`      | 硬编码凭据                | FALTO-ALARME provável: senha-fixture de teste unitário (bcrypt/scrypt)                                         |
| 2   | `src/test/auth-policy.test.ts:55`      | 硬编码凭据                | idem                                                                                                           |
| 3   | `src/routes/auth.tsx:223`              | 硬编码凭据                | FALSO-ALARME: `<Input type="password" value={password}>` — binding de formulário                               |
| 4   | `src/lib/chat.functions.ts:144`        | fetch = ssrf 入口         | TRIAGEM: fetch ao endpoint do gateway IA (env `AI_GATEWAY_URL`, operador-controlado)                           |
| 5   | `src/lib/chat.functions.ts:192`        | fetchModelAttempt ssrf    | idem                                                                                                           |
| 6   | `src/lib/chat.functions.ts:234`        | runModelAttempt 2 saltos  | idem (taint cross-file)                                                                                        |
| 7   | `scripts/db/backup-verify.ts:159`      | sql-injection 入口        | CONFORME-by-design provável: interpola só IDENTIFICADOR lido do catálogo via `quote()`; valores parametrizados |
| 8   | `scripts/db/backup-verify.ts:160`      | idem                      | idem                                                                                                           |
| 9   | `src/middleware/request-context.ts:63` | sql-injection 入口        | TRIAGEM: resolveMembership por user id (verificar parametrização interna)                                      |
| 10  | `scripts/db/explain-evidence.ts:158`   | sql-injection 入口        | TRIAGEM: EXPLAIN diagnóstico com `query.sql`/`query.params` internos                                           |
| 11  | `scripts/db/migrate.ts:91`             | sql-injection 入口        | TRIAGEM: `prepareLegacySalesTotals` (script admin)                                                             |
| 12  | `src/lib/chat.functions.ts:144`        | [medium] taint cross-file | acompanha #4                                                                                                   |

## Consequência e caminhos de desbloqueio (decisão do operador)

A entrega versionada desta rodada (PR-A docs, PR-B scripts, entrada de ledger)
está pronta no working tree mas NÃO commitada. Caminhos:

1. **Rodada de segurança dedicada** para triar/corrigir os 12 achados
   (4 FALSO-ALARME provável + 8 TRIAGEM) e re-scan — recomendado antes de
   qualquer novo commit via agente;
2. Operador comita manualmente os artefatos prontos (fora do gate do agente);
3. Reconfiguração do gate pelo operador (fora do escopo do agente).

Nenhum comando git de mutação foi executado contra branches publicadas;
nenhum force-push/rebase.
