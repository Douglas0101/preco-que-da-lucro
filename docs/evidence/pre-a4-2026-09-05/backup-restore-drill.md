# Drill de backup/restore §42 — 2026-09-05

- **Rodada:** pré-A4 burn-down · **Script:** `scripts/db/backup-verify.ts` (`npm run m02:backup-verify`) · **JSON:** `backup-restore-drill.json` (neste diretório)
- **Autorização exercida:** A4 (criação/destruição de banco efêmero de drill; evidência coletada antes de destruir)

## Critério extraído da spec (Regra 1, Passo 0)

| Requisito              | Seção            | Cláusula                                                      | Verificação                             |
| ---------------------- | ---------------- | ------------------------------------------------------------- | --------------------------------------- |
| Backup/restore testado | Plano Mestre §42 | "backup/restore testado" no gate pré-Neon-production          | drill com restore real + verificação    |
| RPO/RTO                | SDD NFR-RES-003  | RPO ≤ 15 min, RTO ≤ 4 h                                       | restore externo medido                  |
| PITR                   | SDD §2446        | PITR ≥ 7 dias obrigatório ou controle alternativo             | plano tem 6 h → exceção BAK-01          |
| Prova independente     | SDD §2998        | "Backup independente e restauração isolada comprovam RPO/RTO" | dump fora do provedor + restore isolado |

## Resultado do drill (2026-09-05T20:24:20Z → 20:26:44Z)

| Fase             | Status | Duração | Detalhe                                                                                               |
| ---------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------- |
| source-inventory | PASS   | 11.0 s  | 27 tabelas, journal 11 entries                                                                        |
| pg-dump          | PASS   | 26.1 s  | 135.416 bytes, sha256 `f5659573fb0ae9229844e51204634d3350d6bd691cffc2d01ca2c31026541893`              |
| scratch-create   | PASS   | 0.3 s   | `drill_restore_20260905202420`                                                                        |
| pg-restore       | PASS   | 95.3 s  | `--no-owner --no-privileges` (ver limite)                                                             |
| verify           | PASS   | 9.4 s   | 27/27 contagens iguais; journal **11/11 hashes reconciliados**; RLS 20/20 tabelas tenant; 25 policies |
| scratch-drop     | PASS   | 1.1 s   | banco efêmero destruído após evidência                                                                |

**Veredito §42: backup externo independente + restauração isolada COMPROVADOS**
(controle compensatório de BAK-01). O item "backup/restore testado" do gate §42
fica satisfeito por este drill; a não conformidade residual é PITR ≥ 7 dias do
plano → exceção **BAK-01** (`docs/decision-briefs/2026-09-05-bak-01-backup-restore-policy.md`).

## Limites da evidência

- Restore com `--no-owner --no-privileges`: ownership e GRANTs não são
  exercitados (objetos internos Neon pertencem a `neon_service` e afins). O
  drill cobre dados, schema, journal, RLS flags, policies e constraints.
- Restore executado no mesmo cluster Neon (banco efêmero), não em provedor
  separado; o artefato `dump.pgc` é externo e portátil (pg_restore em qualquer
  PostgreSQL 17).
- Primeira tentativa falhou com `must be able to SET ROLE "neon_service"`
  (statement de ownership de schema interno `pgrst`) — corrigida com
  `--no-owner --no-privileges`; registrado para o runbook.
- Dump em `.artifacts/backup-drill/20260905202420/` (gitignored), não commitado
  por conter os dados (fixtures) do banco.

## RPO/RTO observados

- Snapshot (dump): 26 s para o volume atual (135 KB) → RPO prático muito abaixo
  de 15 min para este tamanho; RTO de restore ≈ 1,6 min + verificação ≈ 2,3 min
  total — dentro do RTO 4 h com folga de ~2 ordens de magnitude no volume atual.
  Estes números NÃO escalam linearmente com volume; revalidar quando houver
  dados reais (pós-A4).
