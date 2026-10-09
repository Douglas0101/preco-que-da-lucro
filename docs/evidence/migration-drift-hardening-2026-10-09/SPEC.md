# SPEC — endurecimento do harness de migrações contra deriva (2026-10-09)

## 1. Problema (medido, não hipotético)

- A sonda E4 (2026-10-09, container PG17 efêmero próprio) reproduziu o aborto
  do chain de downs tip→0003 com o guarda de 0010 recusando (`accounts > 0`,
  SQLSTATE `P0001`): **9 downs commitados, journal ainda no head** — schema !=
  journal — e a reexecução falhava antes e com outra assinatura
  (`users_pkey`, SQLSTATE `23505`, em `seedIsolationFixtures`), em vez de se
  recuperar.
- O mesmo estado residual existia no volume de bancada que recusou a primeira
  execução do `db:test` de 2026-10-09 (contas herdadas; guarda 0010 na 10ª
  migration de rollback).
- Nenhuma conta é apagada para contornar o guarda; a proteção de dados reais
  do 0010 é intocável.

## 2. Invariantes

1. **I1 — atomicidade:** qualquer falha dentro do chain de downs tip→0003
   (inclusive a recusa do guarda) desfaz TODOS os downs já aplicados; o journal
   permanece íntegro. Não existe mais "parcialmente revertido" produzido pelo
   harness.
2. **I2 — guarda preservado:** `drizzle/rollback/0010_to_0009_down.sql`
   permanece byte a byte; continua recusando com `P0001` quando há qualquer
   linha em `accounts` e continua exigindo restore de snapshot como caminho
   pós-tráfego.
3. **I3 — pré-condições fail-closed:** antes de qualquer seed ou rollback, a
   cadeia recusa quando detecta (a) contagem do journal diferente do head,
   (b) objetos canários de migrações recentes ausentes (0011/0019) com journal
   no head, ou (c) resíduo dos fixtures de seed de uma execução anterior.
4. **I4 — recusas acionáveis:** as mensagens nomeiam a causa e a recuperação
   (recriar o ambiente efêmero / restaurar o snapshot), distintas do modo de
   falha críptico anterior.
5. **I5 — sem exercício em dados reais:** o harness roda somente contra bancos
   efêmeros locais (loopback); produção/Neon nunca são alvo; nenhuma migração
   forward/reversa é executada em banco real por esta mudança.

## 3. Implementação (escopo exato)

- `scripts/db/test-migrations.ts`:
  - `applyDowns`: transação única do cliente (`begin`/`commit`/`rollback`),
    com neutralização dos `BEGIN;`/`COMMIT;` embutidos do arquivo 0010
    (auto-transação para uso isolado em psql) apenas dentro do harness;
  - `expectedJournalEntries()`: head derivado de `drizzle/meta/_journal.json`;
  - `assertChainConsistency()`: journal == head + canários (política
    `auth_service_access` de 0011, tabela `ai_memory_policies` de 0019);
  - `assertNoSeedResidue()`: fixtures de seed (userA/userB) ausentes;
  - cenários: `assertRefusedRollbackLeavesNoDrift()` (recusa + re-recusa sem
    deriva, contas intactas), `assertPreflightDetectsDrift()` (controle
    negativo com deriva plantada em transação desfeita),
    `assertSeedResidueDetected()` (controle negativo do resíduo);
  - fiação em `main()` antes de `seedIsolationFixtures`.
- Nenhuma mudança em `drizzle/rollback/**`, `drizzle/meta/**` ou em dados.
- Nenhuma mudança de workflow: o gate já existente (`npm run db:test` no
  `verify`, com PostgreSQL 17 efêmero e `db:check`) passa a carregar as
  garantias; falha bloqueia release.

## 4. Evidência

- `captures/e5-drift-hardening.txt` — E5.1/E5.2 (verdes), E5.3 (deriva externa
  recusada com mensagem acionável), E5.4 (resíduo recusado); containers
  efêmeros próprios (55434/55435), descartados; bancada conferida intacta.
- `captures/db-test-full.log.txt` + `db-test-summary.txt` — cadeia de 18
  suítes verde (`DB_TEST_EXIT=0`) em container efêmero próprio (55436).
- `captures/check-full.log.txt` + `check-summary.txt` — gate local completo
  verde (141 arquivos / 2136 testes; bundle inalterado).
- `captures/git-state.txt` — estado do repositório no selo.
- `captures/platform-state.txt` — leitura read-only de Vercel/GitHub.

## 5. Limites declarados

- A atomicidade cobre o chain tip→0003 (onde o guarda vive e onde a deriva foi
  medida). O down 0002→0001 continua fora da transação; a pré-condição de
  consistência no início de cada execução é a rede fail-closed para qualquer
  deriva externa, inclusive desse trecho.
- A recuperação automática de um banco já derivado não é feita por desenho:
  a cadeia recusa e exige recriação do ambiente efêmero ou restore de snapshot
  (decisão humana em ambiente real).
- Este pacote não publica nada e não toca produção; a validação de runtime do
  candidato permanece gated por valores de ambiente Via A (ver
  `docs/evidence/publication-candidate-2026-10-09/GO-NO-GO-2026-10-09.md`).
