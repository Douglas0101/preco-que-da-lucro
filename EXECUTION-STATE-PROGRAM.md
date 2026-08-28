# EXECUTION-STATE-PROGRAM — Mandato de Execução v5 (Programa de Fechamento SDD, F0–F14/V7)

Ledger persistente do programa v5. Este arquivo não contém credenciais, tokens, URLs
Neon reais ou conteúdo de mensagens. Estrutura: Parte 0 (decisões) → estado de partida
→ ledger módulos × tarefas → cartões SA-nn → gates → residuais → regras de retomada.

- **Mandato vigente:** v5 (Programa de Fechamento SDD). v3 ENCERRADO (merge #21/#22;
  CI verde `a4e6fb1`, run `33037401855`); v4 consolidado por este documento.
- **Estrutura SDD:** CONSTITUIÇÃO (C-01..C-20) → ESPECIFICAÇÃO (REQs por módulo) →
  Q → PLANO (D-01..D-17) → SUBAGENTS DIRECIONADOS → TAREFAS → PODERES/PROIBIÇÕES
  (P-01..P-14; proibições 1–27) → RELATÓRIO.
- **Pipeline por módulo (D-14):** CARTÃO RAT → SPEC DRAFT → CARTÃO RT (se alto risco)
  → SPEC CONGELADA em commit (`docs/specs/M-xx-spec.md`) → IMPL → TESTES → CARTÃO AG
  → GATE → PR DRAFT → humano.
- **Ondas (D-16):** W1=M-01 · W2=M-04+M-06 · W3=M-05+M-02 · W4=M-03+M-07+M-08.
  Dependências inegociáveis: M-01→todos; M-04→M-05.
- **Início do programa:** 2026-08-27.
- **Última atualização:** 2026-08-28 (selagem S1/S4/S2 local concluída; S3 pendente; gates intactos).

---

## Parte 0 — Registro de decisões

### Aprovadas com transcrição verbatim (efeito duradouro por C-20)

> **H-001** — "Aprovo a Opção C e a SPEC-AMEND-001."
> **H-002** — "Autorizo a execução das Fases 1–4 sob os poderes v2 e os deltas propostos."
> **H-003** — "Q-008 permanece NÃO: usar contract tests para os drivers; não usar endpoint Neon."

**Efeitos duradouros:** (i) proibição de endpoint Neon real vincula M-04/M-06 e toda a
suíte de teste (H-003); (ii) o padrão de módulo encapsulado driver-agnóstico
(budget-ledger) é referência arquitetural para M-02/M-05 (H-001); (iii) ratificação
ambiental obrigatória antes de spec (H-001 → C-16).

> **H-004** — Ativação do Mandato v5 e autorização da execução de W1 (M-01) sob os
> poderes herdados e os deltas (seleção explícita do humano em 2026-08-27; frase
> canônica do documento: "Ativo o Mandato v5 e autorizo a execução de W1 (M-01) sob
> os poderes herdados e os deltas."). Q-011 resolvida para o escopo de W1.

### Defaults seguros aplicados (C-19 — nunca expandem escopo; override humano a qualquer momento)

| Q                                             | Default aplicado                                                                                                                | Override humano                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Q-010 (residual de falha dupla de settlement) | **CORRIGIR em M-04** + teste dedicado do caso                                                                                   | "Aceito o residual formalmente" — **não informado** |
| Q-016 (política de merge)                     | humano revisa e mergeia cada PR de módulo (C-09) — **aplicado nesta execução: PRs em draft, nenhum merge pela linha principal** | política alternativa explícita — **não informada**  |
| Q-009 (proveniência dos merges #21/#22)       | registrado como **presumido-humano, pendente de confirmação**; NÃO-bloqueante                                                   | confirmação factual — **não informada**             |

### Genuinamente abertas (sem default possível)

| Q                                                                                     | Owner   | Estado                                                                             |
| ------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| **Q-001 (A1)** — fresh provisioning OU URL somente leitura da fonte Supabase          | HUMANO  | **Aberta — bloqueia F8 e o caminho crítico de produção. Único desbloqueio de F8.** |
| Q-002 (TAC)                                                                           | EXTERNO | Aberta                                                                             |
| Q-004 (destino da `wip/`)                                                             | HUMANO  | Aberta                                                                             |
| Q-012..Q-015 (Hostinger, Neon persistente, credenciais reais, acessibilidade externa) | HUMANO  | Abertas (camada C)                                                                 |

Resolvidas (histórico): Q-005..Q-008 (v3), Q-011 (H-004).

---

## Estado de partida — M01-1 (verificação 2026-08-27)

- `HEAD` = `a4e6fb1879daf020ed933cc5fb6755498b835b1c` em
  `fix/ai-budget-reservation-csf58b4`; worktree **limpo** (`git status --porcelain` vazio).
- `origin/develop` = `12c90a17f81edd5a126c2e32c3f703c8b7841f87` — _Merge pull request #21
  from fix/ai-budget-reservation-csf58b4_ (tip publicado).
- `origin/main` = `55cb5502d43b18f21e0fce85708472ff836a0c06` — _Merge pull request #22
  from fix/ai-budget-reservation-csf58b4_.
- **Igualdade de conteúdo develop↔main:** `git diff --name-only origin/develop origin/main`
  → **0 arquivos** (conteúdo idêntico; SHAs divergem apenas por história de merges:
  main-only = 3 merge commits — #22, #18, #7; develop-only = 1 — #21; merge-base = `a4e6fb1`).
- `develop` local defasado (`c371032`, merge #19) — intocado nesta sessão; alinhamento
  somente por fast-forward quando exigido (Parte IX).
- Preservações intocadas: branch local `wip/preservacao-c371032-20260826` (sem ref
  remota) e `stash@{0}` preexistente em `codex/local-dev-postgres`.
- CI: `gh` autenticado (`repo`, `workflow`); workflows ativos: `UI stack`,
  `Neon preview boundary`, `Neon readiness`; environment `neon-readiness` **sem
  protection_rules** (dispatch executa sem aprovação extra).
- Scan v3 selado: Standard scan ID `2ca2b19a-3ab2-49a1-a436-0a9ab46b3fcd`, alvo
  `e61c8c8` (antecessor imediato do tip publicado; único delta até `12c90a1` é o merge
  commit #21, sem delta de conteúdo — ver M01-4), cobertura parcial **6/240**,
  artefatos em `docs/evidence/security-scan/csf-58b444f-2026-08-27/` com hashes
  registrados no `EXECUTION-STATE.md` v3.
- **ADR-021** (`docs/adr/ADR-021-migration-cutover-supabase-neon.md`): **intocável**.
- Auditoria ambiental vigente: `docs/auditoria-ambiental-2026-08-26.md` (Nitro
  `node-server` + PostgreSQL 17; harness `docker-compose.yml` saudável).

## Correção de estado M-02 — registro aditivo (2026-08-27)

- `HEAD` = `154efcd94c97d77d7061ac557e6d6cbf17472395`, branch
  `program/v5-fechamento-sdd`; o commit é histórico/local e não foi alterado.
- Worktree **sujo**, com a alteração pré-existente deste ledger, `.pi/` não
  rastreado e o conjunto de artefatos da execução M-02; nada foi limpo,
  sobrescrito ou publicado. A diferença entre o estado descrito acima e o
  estado observado é registrada aqui, não corrigida por rewrite silencioso.
- Causa-raiz registrada: o ledger de M-01 não foi atualizado após a criação da
  branch/programa e a abertura do trabalho M-02; por isso o bloco de partida
  deixou de descrever o checkout efetivo.
- `.pi/` permanece preservado; Q-004 continua aberta e nenhuma política de
  versionamento foi inferida. A decisão humana continua necessária.
- Evidência local do incremento: `npm run typecheck`, `npm run lint -- --quiet`,
  `npm test -- --reporter=dot` (26 arquivos/276 testes),
  `npm run m02:matrix:check`, `npm run m02:boundaries`,
  `npm run m02:state:check`, `npm run check:ui-stack`,
  `npm run check:no-supabase-runtime`, `npm run build` e
  `npm run check:bundle` passam; não são evidência de CI, GitHub, Neon,
  produção ou publicação.

## Handoff C2–C5 + Trilha B-2 — 2026-08-27

- Pacote factual e resultados da execução em
  `docs/evidence/c2-c5-m04-m06-handoff-2026-08-27.md`.
- C2/C4 registrados como concluídos no escopo verificável; C3/C5 concluídos
  localmente após E2E, build, bundle e revisão de segurança do diff.
- A verificação remota confirmou o PR #23 como `OPEN/DRAFT` documental de M-01;
  não criar duplicata. O check `verify` permanece `UNSTABLE` por `format:check`.
- A correção de M-02 descreve `sendChatMessage` como operação composta, sem
  alterar runtime, schema, migrations ou status de congelamento.
- M-04 e M-06 foram criados como specs `DRAFT`; Q-019/Q-020 continuam humanas.

## Execução incremental SDD v5.0 — 2026-08-27

- A ativação da Trilha A/B-2 foi aplicada somente aos artefatos locais permitidos:
  nenhum gate foi consumido, nenhuma spec foi congelada, `SDD.md` legado não foi
  promovido a derivado e `docs/SDD-v5.0.md` não foi criado antes de Q-024.
- E6 recebeu um gate lógico exclusivo do harness em
  `scripts/db/test-ai-budget.ts`. O ledger compartilhado espera as oito
  reservas antes de liberar os dois admitidos; o runtime, schema e migrations
  permanecem sem alteração por este patch. `E6_ONLY`, `E6_HOLD_MS` e
  `E6_QUEUE_MS` são controles bounded de fixture.
- A matriz E6 local (hold `300/600/1200` ms × queue `0/50/200/500` ms) passou nas
  12 combinações com 2 chamadas ao gateway, 2 sucessos, 6 rejeições de quota,
  `peakActiveCalls=2`, `tokens_reserved=0` e `in_flight=0`. A evidência está em
  `docs/evidence/e6-determinism-2026-08-27.md`; isso não promove o run remoto
  `33080843742` nem torna E6 verde em `develop`.
- M-02 teve a distinção de contagem reforçada: `transactionSites=13`,
  `directDatabaseFiles=21` e `concreteOperations=31`. O gerador/check semântico,
  a fronteira BFF e o state marker passam localmente.
- M-04 permanece DRAFT: D-008 (fencing), D-009 (settle-after-expire), D-010
  (determinismo do harness) e as células F-21/F-22 foram documentados. A
  compatibilidade entre a escrita prévia de outcome de D-004 e o predicate de
  claim de D-008 continua explicitamente pendente de Q-019; não houve mudança
  de settlement, sweep, schema ou outbox.
- M-06 permanece DRAFT: workload v2 agora exige `N` por bucket, p99 `N/A` para
  `N<100`, reexecução quando CV do p50 exceder 10%, provider-fixture local,
  `pg_stat_statements_reset()` entre repetições, labels de ambiente, cold
  `compute-wake`/`first-query` quando observável e a matriz E6 separada. Runner,
  seed e percentis continuam não implementados/medidos.
- `.pi/` e todo WIP preexistente foram preservados. Não houve stage, commit,
  push, alteração remota, acesso persistente ao Neon ou operação de produção.
- Verificações locais desta execução: `npm run db:test` (migrations, auth,
  tools, chat e T1–T10), `npm run typecheck`, `npm run lint -- --quiet`,
  `npm test -- --reporter=dot` (26 arquivos/276 testes), `npm run format:check`,
  checks de UI/cutover, `npm run build`, `npm run check:bundle`,
  `npm run check:hostinger-runtime`, matriz/check de M-02 e E2E 32/32. O E2E
  foi executado com `NO_COLOR` removido do ambiente para não transformar um
  aviso do Node em falha do wrapper de build; isso não altera o artefato.

## Execução SDD v5.1-EXEC — P0/P1 — 2026-08-27

- P0 produziu os três briefs de decisão, sem aplicar qualquer Q humano:
  `docs/decision-briefs/sdd-v5.1-exec/Q-024-ratificacao-sdd-v5.1.md`,
  `Q-021-politica-pi.md` e `Q-022-e6.md`. Cada brief contém contexto, opções,
  recomendação, rollback e evidência classificada.
- R2 foi confirmado em uma árvore limpa obtida por stash nomeado
  `e2797caf10819fbad43b5a2d9ae9730117c0b10d`: `npm run format:check` falhou
  somente em `EXECUTION-STATE-PROGRAM.md` e no relatório histórico selado de
  segurança. O relatório selado não foi reformatado; as exclusões necessárias
  e a normalização do ledger foram isoladas em `b35b540`.
- A restauração do WIP foi feita por `git stash apply --index` usando o stash
  nomeado `7d396ff710fd5c773859d8519055cc2294a04ea5`; o único conflito no
  quadro de cartões foi resolvido preservando SA-06 e a formatação. O stash
  permanece local como recuperação; nenhuma limpeza ou rewrite foi executado.
- A partição local produziu os commits, nesta ordem: `b35b540` (format),
  `bdeadbe` (M-04 DRAFT), `227631a` (M-06 DRAFT), `d2d44bf` (M-02 matriz e
  tooling), `fa05b64` (E6 harness/evidência) e `cab5f81` (security-fix com
  regressão estrutural cross-tenant). O pacote de handoff e ledger segue neste
  commit; o WIP M-02 será preservado em ref própria no passo 8 do runbook.
- P1 ainda não consome Q-017: todos os commits são locais e a branch continua
  sem push. `.pi/` permanece não rastreado conforme Q-021.

## Execução SDD v5.1-EXEC — P3/P4/P5 — 2026-08-27

- P3 entregou `docs/specs/M-02/reconciliation-r5.md` por handoff transferível;
  o commit do writer `ba40ef6` foi integrado como `67c9408`. A execução oficial
  no checkout principal confirmou `npm run m02:matrix:check` e
  `npm run m02:boundaries` como `PASS`. O documento distingue 13 sites
  transacionais de 21 arquivos com alcance à persistência, e mantém M02-1b
  pendente de Q-023.
- P4 foi read-only, sem alterações de checkout. A revisão encontrou oito
  achados adicionais, principalmente P1: sweep sem `outcome IS NULL`, ausência
  de `recordOutcome` idempotente, breakdown insuficiente para recovery,
  settlement que aceita valores duplicados do chamador, TTL baseado no relógio
  da aplicação e semântica de late outcome ainda sem persistência runtime. O
  handoff foi rechecado localmente e registrado em
  `docs/evidence/m04-p4-adversarial-review-2026-08-27.md`; P9 continua
  bloqueado por Q-019.
- P5 entregou `eec4829`, integrado no principal como `8a5b2e8`, com
  `scripts/e2e-hygiene.sh`, script `test:e2e:hygiene` e documentação do smoke.
  `bash -n` passou; execução sem `DATABASE_URL` falhou de forma controlada antes
  do Playwright. O wrapper remove `NO_COLOR` e exige banco de teste configurado;
  não constitui autorização para banco de produção.
- Latest state marker parent = `89712ab61968cd4caed23bc29b2b28cb9040fe1c`; este
  marker será validado pelo checker no commit de relatório desta rodada e não
  referencia o SHA do próprio commit.
- P2 ainda não foi executado. A árvore contém somente `.pi/` não rastreado e o
  artefato P4 pendente de integração; depois do commit deste bloco, o agente
  principal deverá deixar a árvore quiescente antes do scan selado.

## Execução SDD v5.1-EXEC — P2 — 2026-08-27/28

- O scan final foi executado somente depois da integração P1/P3/P5 e da
  confirmação de árvore quiescente: apenas `.pi/` permaneceu não rastreado e
  permitido. O alvo foi o range local exato
  `154efcd94c97d77d7061ac557e6d6cbf17472395..89712ab61968cd4caed23bc29b2b28cb9040fe1c`,
  sem fetch, push, CI, GitHub, Neon ou produção.
- Security diff scan `5957f8ed-7b2c-42db-a63c-f0e52ba3a1e0` foi selado como
  `complete`, com inventário nativo de 51 itens executáveis e cobertura
  `51/51`; o resultado foi **0 findings reportáveis** em cinco superfícies
  (BFF/autenticação/entrada; persistência multi-tenant/RLS; AI budget/retry/tool
  replay; scripts/harness/E2E; serialização/saída frontend). O TAC consultado
  imediatamente antes do scan retornou `not_granted`; isso não bloqueou a
  revisão local nem promove qualquer afirmação para segurança de produção.
- Snapshot digest selado:
  `codex-security-snapshot/v1:sha256:0de7376c9528fd2bd1c9f980672882adeb74bb1e22603d35ce357526dc1aa04d`.
  Hashes canônicos: `findings.json`
  `d516bd33d2ffd89a754cd4d031a6f17c7c9f58195b0605641f2afef4be40bd6b`;
  `coverage.json`
  `53b3e39fbd1b412774a4e40519c59b90a7d194b4969ad8a9c68eb6dbd15558a4`;
  `scan-manifest.json`
  `e7cb6ccf21faf2978c7aa0b4a98a092304ded3a4854550a0a7cdc26ce921268c`;
  `report.md`
  `9b9298e44f45bb9d5f41b7fc812ac590481d353bf8041810286dbae48df8dd01`;
  SARIF `b291c53998e54f908c5e936732a3b8041dab523f2e536bd789147899ccbe006b`.
  Os artefatos estão no diretório selado temporário retornado pelo plugin; não
  foram normalizados nem reformatados.
- Verificações auxiliares pós-integração e pré-selagem: `npm run
m02:matrix:check` = PASS; `npm run m02:boundaries` = PASS; `npm run
m02:state:check` = PASS com marker parent-pinned; `bash -n
scripts/e2e-hygiene.sh` = PASS; `git diff --check` = PASS. A preparação E2E
  não foi executada neste scan por ser destrutiva e depender de banco
  configurado pelo operador.
- A evidência anterior `762d628c` foi formalmente descartada como evidência
  final porque a árvore mutou durante aquele scan. Nenhum finding ficou
  pendente de validação ou attack path nesta execução.
- P2 não consome Q-017 nem qualquer outro gate. O marker parent-pinned foi
  atualizado para o parent deste commit; a branch continua somente local, com
  tracking ref sem fetch e `.pi/` preservado.

## Execução SDD v5.1-EXEC — S1/S4/S2 — 2026-08-28

- O relatório endereçável da rodada está em
  `docs/evidence/s2-sealing-2026-08-28.md`. A execução separou evidência local,
  referências históricas e limites externos; não houve fetch, push, merge,
  comentário em PR, operação Neon ou acesso à produção.
- S1 fechou R8, R9 e R10.1: o WIP de extração permanece em
  `wip/m02-extraction @ 477707dedee63ed23470e1effca6e4ed7aa90745`; a branch do
  programa não contém o `src/` desse WIP; `bdeadbe3a1ecb0e75443ce0f9391a1bb5e10e7e3`
  é o SHA completo do DRAFT M-04; e `a2919e73cb7b8347b520d8979cea7e5d271e1a7a`
  altera somente este ledger na preservação pré-S1.
- S4 está materializado no commit `7e00560`: D-011/CAS, settle-after-expire,
  matriz de crash-recovery e G1–G8 permanecem DRAFT nos quatro artefatos de
  `docs/specs/M-04/`. Q-019 continua necessária; nenhum runtime, schema ou
  migration foi alterado.
- S2 passou localmente contra PostgreSQL 17 descartável em Docker: `npm run
db:test` = PASS (T1–T10); `npm run check` = PASS (26 arquivos/273 testes,
  lint, typecheck, format, build, bundle e checks de UI); matriz E6 = 12/12
  (`gatewayCalls=2`, `peakActiveCalls=2`, 2 sucessos, 6 rejeições,
  `tokens_reserved=0`, `in_flight=0`); E2E com o wrapper de higiene = 32/32.
  Tudo isso é `LOCAL-VERIFIED` e não promove o readiness remoto histórico
  `33080843742`, que continua vermelho no SHA publicado antigo.
- `git diff --check` = PASS. No candidato pré-M-02, os checks
  `npm run m02:matrix:check` e `npm run m02:boundaries` retornaram exit 1 e
  foram classificados como `NOT-APPLICABLE/EXPECTED-FAILURE` até P10, conforme
  a seção pós-S1 de `docs/specs/M-02/reconciliation-r5.md`; regenerar os
  artefatos para ocultar o drift não é permitido.
- A primeira tentativa E2E com `NODE_ENV=test` foi interrompida pelo bundle
  SSR (`jsxDEV is not a function`) antes de testes. A repetição no modo padrão
  do preview, com segredo efêmero local válido, passou 32/32; o primeiro evento
  é limitação de runner/configuração e não foi contado como falha funcional.
- O revisor read-only Copernicus foi aguardado uma vez e encerrado sem handoff;
  essa ausência não foi tratada como aprovação. O conteúdo S4 já existente não
  foi atribuído ao subagent.
- Antes do commit documental de integração, o marker parent-pinned aponta para
  `d5da736e12d9a4e2242c2c14aabf38b7a314d610`, o HEAD que será seu parent:

  ```text
  Latest state marker parent = `d5da736e12d9a4e2242c2c14aabf38b7a314d610`
  ```

  Depois do commit, S3 deverá usar o candidato resultante como alvo e atualizar
  o marker apenas no commit final de relatório.

- S1/S2/S4 não consomem gates. Q-017, Q-019, Q-020, Q-021, Q-022, Q-023,
  Q-024 e Q-001/A1 permanecem pendentes; o scan integral novo de S3 ainda é
  obrigatório antes de qualquer pacote C6 ou ação remota.

## Execução SDD v5.1-EXEC — S3 — 2026-08-28

- O relatório endereçável da rodada está em
  `docs/evidence/s3-security-scan-2026-08-28.md`. O scan foi executado depois
  de S1/S4/S2, em árvore quiescente, sem fetch, push, merge, GitHub, Neon,
  produção ou remediações.
- O security diff scan oficial `fa8f03a6-a7f0-45c5-8b80-5614a6a64003` cobriu a
  faixa local exata `12c90a17f81edd5a126c2e32c3f703c8b7841f87..e5adbcf2f7a3a50786deb0e01457da55368f46aa`.
  O workbench selou `complete`, com inventário compacto 7/7, cobertura
  `complete` e **0 findings reportáveis**. Não houve candidatos para validação
  ou attack-path analysis.
- Snapshot digest selado:
  `codex-security-snapshot/v1:sha256:ef4e857bd1cc67af74e069b9014a30abc6c3e0dfc07cfe366f72eea4cd61e56e`.
  Hashes dos artefatos: `findings.json`
  `57251009dd2949d2e66ac9c0d2a7d868a7d6e1c2465dc6a8f543c3fcddaf7801`;
  `coverage.json`
  `5b0cbca36dfdf4cac258bf1d03b2bb821ac74021e7aa407ddb8a8908f8ab0d53`;
  `scan-manifest.json`
  `b5eae695d0dee5981371b067372ae87368bf0b178072085de032dcdcdc6b6448`;
  `report.md`
  `66f83b5edcf81f62bb936344d276ea34075aa3a74e8d14803a4ea477484871a5`;
  SARIF `05bdc64f9c832b05809030d82eacc96ec9e54badf17fbcc64ef31a14f4ef33df`.
  Os artefatos canônicos estão no diretório temporário selado registrado no
  relatório S3 e não foram normalizados.
- As sete superfícies alteradas receberam `no_issue_found`. A revisão direta
  de `src/server/repositories/ai-tool.repository.ts` também rastreou o
  executor produtivo, schema e RLS: o repositório novo possui predicados
  tenant+usuário, mas ainda não é importado por `src/lib/ai/tool-runner.ts`.
  Sem caminho de ID controlado pelo atacante e com RLS como controle efetivo
  local, isso foi mantido como pendência arquitetural, não finding reportável;
  a integração permanece fora desta rodada.
- TAC retornou `not_granted`; a revisão local prosseguiu com esse limite. Não há
  `SECURITY.md` na raiz. O threat model gerado foi preservado no artefato
  `artifacts/01_context/threat_model.md` do scan selado.
- Newton foi subagent read-only com write-set vazio. Foi aguardado em janela
  bounded e encerrado sem handoff transferível; sua observação foi contexto,
  não aprovação. A ausência foi registrada conforme D-15/C-12.
- S3 fecha a lacuna de scan integral/R10.2 no candidato `e5adbcf`, mas não
  consome Q-017 nem qualquer outro gate. Q-017, Q-019, Q-020, Q-021, Q-022,
  Q-023, Q-024 e Q-001/A1 permanecem pendentes. A branch segue local, com
  tracking ref sem fetch e `.pi/` preservado.
- O marker parent-pinned será validado no commit documental desta rodada; seu
  parent esperado é o candidato atualmente selado:

  ```text
  Latest state marker parent = `e5adbcf2f7a3a50786deb0e01457da55368f46aa`
  ```

---

## Ledger de módulos e tarefas

Status: `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `NOT_RUN`.

### M-01 — Reconciliação de estado e evidência (W1; sem deps)

| Tarefa                                                        | Status | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Predicado de retomada                                                                                                                            |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| M01-1 Verificação de partida + este ledger                    | DONE   | Seção acima; SHAs/diffs registrados                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `git rev-parse HEAD` = branch do programa em `12c90a1`; status limpo; seção "Estado de partida" presente                                         |
| M01-2 Branch do programa a partir de `origin/develop@12c90a1` | DONE   | Branch `program/v5-fechamento-sdd` criada; `HEAD` = `12c90a1`; commit inicial do ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `git rev-parse HEAD` = `12c90a17f81…`; `git status --porcelain` vazio após commit                                                                |
| M01-3 Higiene documental (REQ M01-3)                          | DONE   | Commit `b2da0fb`: Plano Mestre com status real + registro de execução (fix **MERGEADO** PR #21 `12c90a1` / PR #22 `55cb550`; CI `33037007387`; mapeamento V7↔Plano referenciado) + `docs/evidence/release-readiness-develop-main-2026-08-27.md` (release develop→main **CUMPRIDA**; cutover permanece bloqueado por Q-001/A1)                                                                                                                                                                                                                                                                                                                                                                                                                 | Diff NÃO toca ADR-021 — verificado (`git show --name-only HEAD                                                                                   | grep -c ADR-021` = 0) |
| M01-4 Delta-scan Standard no tip publicado `12c90a1`          | DONE   | Commit `60ad804`: artefatos selados em `docs/evidence/security-scan/csf-58b444f-delta-2026-08-27/` — scan `cb6038a1-c397-4042-a68d-ae6427e95802`; delta `e61c8c8→12c90a1` = 7 arquivos 100% documentais (zero código/schema/testes/config); `findings.json` vazio; veredito **RESOLVIDO no publicado**; cobertura parcial 7 superfícies/240 registrada sem mascarar                                                                                                                                                                                                                                                                                                                                                                           | Artefatos com hashes no `scan-manifest.json`; producer honesto (`pi-program-v5.standard-delta-scan 1.0`, não-codex)                              |
| M01-5 Reexecução do workflow neon-readiness no SHA atual      | DONE   | Run `33080843742` (dispatch em `develop`, `headSha=12c90a1`, `dry-run` + `no-legacy-source`): ref develop ✓; credenciais ✓; branch Neon descartável `readiness/develop-33080843742` criada e **deletada no cleanup** ✓; URLs direct/pooled provadas (PostgreSQL 17, hosts distintos) ✓; etapas de migração **PERMANECEM skipped** ✓; evidência upada como artefato `neon-readiness-33080843742` (retenção 7d) ✓; **conclusão: failure** — `npm run db:test` falhou somente em **T6/E6** (`scripts/db/test-ai-budget.ts:427`, `gatewayCalls <= 2` → `false !== true`); T1–T5 verdes no Neon; restrição 403 da API de branches: **não foi necessária** (verificação integral via `gh run view`/`--log-failed` + URLs web — fallback registrado) | Predicado cumprido (re-execução + registro); o vermelho é EVIDÊNCIA registrada, não máscara; roteado como residual (linha abaixo) e ao relatório |
| M01-6 Registro de residuais                                   | DONE   | Seção "Residuais" atualizada: E6 Neon (run `33080843742`) adicionada; cobertura 7 superfícies/240 (delta `cb6038a1`); Q-010 → M-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Seção consistente com scan-delta e readiness doc                                                                                                 |
| M01-7 Gate G-M1 + auditoria independente SA-01                | DONE   | SA-01 `confirm` com GAPS fechados por comando: sha256 dos artefatos de `60ad804` = manifesto selado (`b1f1575e…`/`704f67cd…`/`52de5c8f…`); ADR-021: 0 arquivos em `12c90a1..HEAD`, `docs/adr/` vazio; drift de re-autofix sobre `report.md` revertido (restaurado de HEAD, regra 8)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Cartão SA-01 com handoff D-15 e verdict `confirm` OU verificação manual equivalente registrada; commit de gate                                   |

### M-02..M-08 (esqueleto; specs congeladas no pipeline D-14 antes de implementar)

| Módulo                                                    | Onda | Deps             | Status      | Predicado de retomada                                                                                                                                                                                                      |
| --------------------------------------------------------- | ---- | ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-02 F3/F4 arquitetura uniforme                           | W3   | M-01             | IN_PROGRESS | RAT SA-06 `diverge`; F0 local + implementação incremental; matriz 8 BFF/30 declarações/31 operações/13 transações/21 arquivos DB passa; build/testes locais verdes; spec segue `DRAFT` e congelamento continua gate humano |
| M-03 F5 decimal canônico (RISCO ALTO, gate humano)        | W4   | M-02 recomendada | PENDING     | Cartão RT SA-07 + RD SA-08; gate humano no diff de golden tests antes do PR                                                                                                                                                |
| M-04 F9 orquestração + residual Q-010 (default: corrigir) | W2   | M-01             | PENDING     | Cartão AG SA-02; teste dedicado do caso de falha dupla                                                                                                                                                                     |
| M-05 F10 memória pela sequência de gate                   | W3   | M-04             | PENDING     | Cartões RAT SA-04 + RT SA-05; ordem do gate inegociável                                                                                                                                                                    |
| M-06 F0/F11–F14-parcial baselines controlados             | W2   | M-01             | PENDING     | Cartão RAT SA-03; rotulagem CONTROLADO (não é RUM); SLO/error budget calculados do baseline                                                                                                                                |
| M-07 F14/F1 hardening verificável                         | W4   | M-01             | PENDING     | Cartão AG SA-09; cobertura de scan incremental registrada sem mascarar                                                                                                                                                     |
| M-08 F2 wire-level com mocks                              | W4   | M-01             | PENDING     | Cartão RT SA-10; credenciais reais permanecem Q-014                                                                                                                                                                        |

---

## Cartões de missão registrados (C-17/C-18; subagents SOMENTE leitura)

| Cartão | Agente                    | Módulo | Papel | Perguntas fechadas                                                                                                                     | Status                                                                                                                                                                      |
| ------ | ------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-01  | Turing→carrier `reviewer` | M-01   | AG    | (1) O ledger reflete SHAs/runs reais? (2) Algum diff de docs toca ADR-021? (3) O scan do tip publicado registra csf_58b444f resolvido? | DONE — **VERDICT `confirm`** (handoff D-15 válido; GAPS fechados e evidenciados na linha M01-7; carrier registrado por C-18)                                                |
| SA-06  | Kant                      | M-02   | RAT   | (1) BFFs com Drizzle/SQL direto? (2) Serviços/repos do catálogo? (3) Composição/cálculo em telas?                                      | DONE — **VERDICT `diverge`** (recon no `HEAD` `154efcd`; handoff D-15 transferível; catalogação, fronteira e cálculos exigiam spec executável; não é gate de implementação) |

Cartões emergentes: nenhum. Novos cartões SA-11+ são registrados aqui com o mesmo
template antes da instanciação (C-18). Veredito `diverge` de RAT/RT bloqueia
congelamento de spec; `blocked`/ausência de handoff → registra e segue (C-12).

---

## Gates

| Gate        | Estado   | Evidência                                                                                                                                                                                                                        |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-M1 (M-01) | **DONE** | M01-1..M01-7 DONE; SA-01 `confirm` com GAPS fechados por comando; commits `1aa17f2`→`b2da0fb`→`60ad804`→`7034ccf` + commit de gate sobre `12c90a1`; residuais registrados (E6 Neon → M-06; cobertura 7/240 → M-07; Q-010 → M-04) |

---

## Residuais registrados

| Residual                                                                                                                                                                                                                                                                                                                                         | Origem                                                              | Destino                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha dupla de transação em `settle` pode adiar correção para o sweep por TTL (retry único reduz, não elimina)                                                                                                                                                                                                                                   | v3 / scan `2ca2b19a` limitations                                    | **M-04 — CORRIGIR (default C-19 Q-010) + teste dedicado**                                                                                                                                                              |
| Cobertura de scan parcial: 6/240 superfícies no scan base; delta-scan `cb6038a1` re-registrou 7 superfícies com recibo (6 + verificação de delta) de 240, restante `needs_follow_up`; seam test-only `callModelForTests` listado como residual de revisão                                                                                        | scan base `2ca2b19a` coverage.json + delta `cb6038a1` coverage.json | **M-07 — estratégia incremental de scan (100% das superfícies críticas em scans sucessivos)**                                                                                                                          |
| Q-009 proveniência #21/#22 presumida-humano                                                                                                                                                                                                                                                                                                      | default C-19                                                        | Confirmação factual humana (não-bloqueante)                                                                                                                                                                            |
| **E6 (T6) sensível à latência no Neon**: `scripts/db/test-ai-budget.ts:427` assume janela de hold de 300ms ≫ latência local; no Neon pooled um holder concluiu dentro do burst e uma 3ª chamada foi aceita (comportamento correto da barreira — `peakActiveCalls <= 2` PASSOU). `db:test` não-verde no Neon no tip `12c90a1` (run `33080843742`) | neon-readiness reexecutado (M01-5)                                  | **Correção do harness (hold determinístico até liberação pelo teste, não por wall-clock) — proposta para ratificação de harness do M-06 (cartão SA-03); integridade do ledger NÃO foi violada no Neon (E1–E5 verdes)** |

---

## Regras de retomada

1. Revalidar `HEAD`, worktree limpo, ancestry da base (`12c90a1`) e integridade das
   preservações (`wip/*`, stash) antes de cada gate.
2. `develop` movendo → re-ratificar o módulo afetado contra o novo tip (C-16) antes de
   prosseguir; alteração estrutural exige parada e nova decisão.
3. Uma tarefa só passa a `DONE` após seu método de verificação e evidência registrados
   (comando + saída OU file:line).
4. Subagent sem handoff conforme template D-15 = "sem evidência transferível" → encerra
   e segue (C-12); a linha principal assume a verificação.
5. Q humana/externa sem default (Q-001/A1, Q-002, Q-004, Q-012..Q-015), endpoint Neon
   real, segredos, ADR-021, merge de PR, force-push ou operação fora dos poderes
   interrompem a execução.
6. Waits bounded ≤15 min; retomada idempotente por predicado; commit do ledger a cada gate.
7. Pré-push: rebase local do branch do programa; pós-push: merge `develop`→branch
   (fast-forward/merge normal), **jamais force**; nenhum rewrite de branches publicadas.
8. **Artefatos selados de scan são imutáveis**: normalização automática de lint NÃO pode
   alterar bytes de `docs/evidence/security-scan/*/` — se o drift ocorrer, restaurar de
   HEAD e re-verificar os hashes do manifesto (aplicado em 2026-08-27 ao delta-scan
   `cb6038a1`).
