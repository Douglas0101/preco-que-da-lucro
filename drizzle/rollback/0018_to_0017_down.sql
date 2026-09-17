-- Rollback 0018 → 0017: remove o dedup/versionamento/conflitos da memória
-- (§15.6/D3 — `ai_memory_versions` + `ai_memory_conflicts` + a coluna
-- `ai_memories.dedup_key` e o índice único parcial do dedup).
--
-- DDL reversível e aditivo: as duas tabelas são criadas por 0018 e a FK
-- composta delas para `ai_memories` é ON DELETE RESTRICT (o filho precisa cair
-- antes do pai). O down descarta o histórico e os conflitos já registrados,
-- então o rollback pós-tráfego exige decisão explícita sobre esse dado pessoal
-- (§48) e o caminho canônico é restore de snapshot; este arquivo existe para
-- rebase de ambientes de laboratório e para o chain de teste
-- (`scripts/db/test-migrations.ts`).
--
-- `dedup_key` é DROPada por último: sem o índice único parcial, a coluna não
-- tem dependentes. O down é destrutivo para o dado de dedup (recomputável a
-- partir de `scope`/`user_id`/proveniência/conteúdo) — não há backfill no up
-- porque a tabela não tinha escritor antes de D3 (SD-C3-2).
DROP POLICY IF EXISTS tenant_isolation ON "ai_memory_conflicts";
DROP POLICY IF EXISTS tenant_isolation ON "ai_memory_versions";
REVOKE ALL ON TABLE "ai_memory_conflicts" FROM app_runtime;
REVOKE ALL ON TABLE "ai_memory_versions" FROM app_runtime;
DROP TABLE IF EXISTS "ai_memory_conflicts";
DROP TABLE IF EXISTS "ai_memory_versions";
DROP INDEX IF EXISTS "ai_memories_tenant_dedup_key_active_uidx";
ALTER TABLE "ai_memories" DROP COLUMN IF EXISTS "dedup_key";
