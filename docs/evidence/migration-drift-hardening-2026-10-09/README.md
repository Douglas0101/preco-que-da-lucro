# README — endurecimento do harness de migrações contra deriva (2026-10-09)

Pacote de evidência do endurecimento de `scripts/db/test-migrations.ts` contra o
estado derivado medido em E4: um aborto no meio do chain de downs deixava 9
downs commitados com o journal ainda no head, e a reexecução falhava com
`users_pkey` (23505) antes do guarda. A correção torna o chain atômico
(transação única) e adiciona pré-condições fail-closed com mensagens acionáveis.

## O que mudou (código)

- `applyDowns` roda em **uma transação do cliente**: qualquer falha — inclusive
  a recusa do guarda de `0010_to_0009_down.sql` (`accounts > 0`, `P0001`) —
  desfaz todos os downs e mantém o journal íntegro. Os `BEGIN;`/`COMMIT;`
  embutidos do arquivo 0010 são neutralizados **apenas dentro do harness** (o
  arquivo permanece byte a byte; sua auto-transação continua valendo para uso
  isolado em psql).
- `assertChainConsistency`: recusa quando o journal não tem as entradas do head
  (`drizzle/meta/_journal.json`) ou quando canários de migrações recentes
  (política `auth_service_access` de 0011, tabela `ai_memory_policies` de 0019)
  estão ausentes — o diagnóstico "banco parcialmente revertido" com a
  recuperação nomeada.
- `assertNoSeedResidue`: recusa quando os fixtures de seed de uma execução
  anterior ainda existem, em vez de colidir com `users_pkey`.
- Cenários novos: recusa do guarda **não deixa deriva** (journal + canários
  medidos após a recusa e após a re-recusa) e dois **controles negativos**
  (deriva plantada em transação desfeita; resíduo de seed detectado).
- O guarda de 0010 não foi alterado: nenhuma conta é apagada ou modificada para
  contorná-lo; produção/Neon nunca são alvo.

## Evidência (captures/)

| captura                                                                        | conteúdo                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `captures/e5-drift-hardening.txt`                                              | E5.1/E5.2 verdes; E5.3 deriva externa recusada; E5.4 resíduo recusado; bancada intacta ao final  |
| `captures/db-test-full.log.txt`                                                | cadeia completa de 18 suítes contra container PG17 efêmero próprio (55436), `DB_TEST_EXIT=0`     |
| `captures/db-test-summary.txt`                                                 | resumo curado da cadeia (54 marcas `: OK`, topologia do alvo)                                    |
| `captures/check-full.log.txt`                                                  | `npm run check` integral no commit do código — `CHECK_EXIT=0`                                    |
| `captures/check-summary.txt`                                                   | 141 arquivos / 2136 testes aprovados; bundle `sha256=30ca04baaa66`                               |
| `captures/git-state.txt`                                                       | estado git do selo (branch, HEADs, divergências, commits não enviados)                           |
| `captures/platform-state.txt`                                                  | leitura read-only de Vercel/GitHub (alias de produção, deployments, envs por nome, runs de main) |
| `captures/db-test-abort-drift.txt` (pacote `publication-candidate-2026-10-09`) | sonda E4 que mediu o estado residual antes da correção                                           |

## Auto-verificação pré-S6 (checklist anti-vacuoso)

| item                                | situação                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| controle negativo                   | **sim** — E5.3 (deriva plantada → recusa) e E5.4 (resíduo → recusa); internos: `assertPreflightDetectsDrift`, `assertSeedResidueDetected` |
| fronteira nas duas direções         | **sim** — recusa em estado derivado E verde em estado íntegro (E5.1/E5.2); `checked === discovered` no MANIFEST                           |
| identidade, não cardinalidade       | **sim** — head derivado de `_journal.json` + canários por nome; nunca contagem solta de downs                                             |
| proibido exit-code-only             | **sim** — as recusas imprimem causa + recuperação (mensagem de assertion); o transcript mostra o texto                                    |
| proibido sleep fixo                 | **sim** — prontidão por `pg_isready`; nenhum sleep/timeout novo no código                                                                 |
| sem valor degenerado na identidade  | **sim** — 0 = 0 reprova (journal vazio recusa; canário ausente recusa; resíduo presente recusa)                                           |
| precondição de estado compartilhado | **sim** — pré-condições rodam antes de qualquer seed/rollback; guarda 0010 segue gate de dados reais                                      |
| sentinela real por cenário          | **sim** — `P0001` do guarda, journal/canários medidos após recusa e re-recusa, mensagens de resíduo                                       |
| fingerprint de revisão              | **sim** — `captures/git-state.txt`                                                                                                        |
| `checked === discovered`            | **sim** — `MANIFEST.sha256` cobre a lista descoberta do pacote                                                                            |
| falha alta / fail-closed            | **sim** — toda inconsistência recusa com exit 1 antes de ação destrutiva                                                                  |
| isolamento de bancada assertado     | **sim** — containers efêmeros próprios, sem volume, portas dedicadas; bancada `:5432` conferida intacta                                   |
| descoberta multi-sítio              | **sim** — sítios de deriva enumerados: contagem/poda do journal, canários 0011/0019, resíduo de seed                                      |
| run de CI atado ao commit selado    | **pendente de push** — citado no journal após a execução; a pipeline executa a revisão candidata, sem reúso                               |
| S6 de contexto limpo                | **não executado nesta rodada** — declarado; a evidência bruta está versionada para a lane adversarial                                     |

## Limites declarados

- A atomicidade cobre o chain tip→0003; o down 0002→0001 permanece fora e é
  coberto pela pré-condição de consistência no início de cada execução.
- A recuperação de banco já derivado é recusa + recriação/restauro, nunca
  auto-heal em dados reais.
- Nada foi publicado; a publicação do candidato de produção permanece gated
  pelos valores Via A e pela autorização de promoção (ver
  `docs/evidence/publication-candidate-2026-10-09/GO-NO-GO-2026-10-09.md`).
