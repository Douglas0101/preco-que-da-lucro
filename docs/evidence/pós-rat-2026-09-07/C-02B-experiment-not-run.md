# C-02B - Experimento com privilégios (2026-09-08)

## Estado

**NÃO EXECUTADO.** O experimento delimitado usaria uma branch efêmera nova,
o mesmo `dump.pgc` e `pg_restore --no-owner` sem `--no-privileges`. A rodada
foi encerrada antes da criação dessa branch porque ocorreram duas falhas
consecutivas no caso (a):

1. `m02:rls-probe` retornou exit 2 com `42P01` na fase PROBE;
2. a tentativa de diagnóstico read-only não executou por quoting do shell.

Não há PASS/FAIL presumido para (b), não houve escrita adicional em Neon e
não se deve iniciar (b) sem nova autorização/retomada após causa registrada.

## Aceitação pré-declarada para retomada

PASS somente se `backup-verify` exit 0 com `catalog PASS`, reconcile 26/26,
probe RLS `app_runtime` bidirecional PASS, cleanup com prova e
`snapshot-fresco` PASS. PASS tornará (b) o caminho primário; FAIL com causa
anexada mantém (a) como caminho sancionado e reparo como fallback.
