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
- **Última atualização:** 2026-09-05 (publicação confirmada ponta a ponta: wave1 em `main` via PR #25 + fix Sonar R5 via PRs #26/#27 com Quality Gate verde; A6 changelog review 1.6.27→1.7.2 registrado; R5 CLOSED; P1 permanece CLOSED e agora também publicado em git — deploy Hostinger + janela A5/B3 seguem como pendências operacionais; matriz M-02 regenerada contra a árvore atual; gate M-02 boundaries tratado por categoria e verde com exceções transitórias documentadas; guarda anti-automação no down 0010).

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
- Registro aditivo (2026-09-11): `HEAD` = `e6da2479b7bd82b8a91fd2ab006bc9226f4c9dca`,
  branch `develop` (parent `c2c84f64580e861de1f6b0235e1e5b770a2c54c0`). O checkout
  efetivo passou a `develop` após os PRs #42/#43; o histórico anterior permanece
  inalterado (sem rewrite). Evidência local: `npm ci` pelo lock do HEAD,
  `m02:state:check` e trio de snapshot `m02:snapshot` do dia
  (`.artifacts/backup-drill/2026-09-11-cutover2/`, read-only).
- Atualização aditiva (2026-09-12): `HEAD` = `e7db6bfa618974c19005968458e65693a4e2caac`,
  branch `develop` (parent `d837114991b8df4d342fe8517ac56bbc9016cb35`) — commits
  `d837114` (fix do snapshot PGSSLMODE) e `e7db6bf` (ledger/freeze/SEC-01/matriz);
  CI `UI stack` verde em `develop` (run 34665381651).
- **G1 transcrito por delegação explícita do operador** (2026-09-12T02:43Z):
  assinatura de Douglas no `M02-D-008-G1-memo.md`, opção (a) greenfield/SUNSET
  2026-09-20; transcrição autorizada em sessão e registrada para auditoria.

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

## Execução SDD v5.1-EXEC — QA local e Browser — 2026-08-28

- O relatório endereçável da rodada está em
  `docs/evidence/browser-navigation-2026-08-28.md`. O escopo foi local e
  descartável: PostgreSQL 17 em Docker, fixture E2E efêmera e preview em
  `127.0.0.1:4173`; não houve fetch, push, GitHub, Neon persistente,
  Hostinger, produção ou consumo de gate.
- Verificação fresca do candidato: branch `program/v5-fechamento-sdd`,
  `HEAD=a311fac509cf9581f089263f933b8097792b09a9`, tracking ref local sem
  fetch e apenas `.pi/` não rastreado deliberado. Nenhum código, schema,
  migration ou configuração foi alterado durante a rodada.
- `npm run db:up` terminou com PostgreSQL 17 saudável; `npm run e2e:prepare`
  preparou a fixture owner/member; `npm run check` terminou com exit 0,
  incluindo 26 arquivos/273 testes Vitest, lint, typecheck, format, build,
  bundle e checks de UI. `npm run db:test` terminou com T1–T10 OK. A suíte
  `npm run test:e2e:hygiene` terminou com `32 passed (1.1m)` nos projetos
  Chromium, Firefox, WebKit e mobile. Esses resultados são
  `LOCAL-VERIFIED`, sem promoção para CI/produção.
- `npm run m02:matrix:check` e `npm run m02:boundaries` foram reexecutados e
  retornaram exit 1. A saída confirma drift da matriz e caminhos do catálogo
  ainda ausentes; a classificação operacional é
  `NOT-APPLICABLE/EXPECTED-FAILURE` até P10, conforme o adendo S1/S4/S2. A
  matriz não foi regenerada para mascarar o estado; M-02 continua pendente.
- A tentativa de navegação supervisionada não pôde iniciar: o Browser in-app
  inicializado pelo runtime oficial respondeu literalmente `Browser is not
available: iab`. Não houve `goto`, snapshot, login visual, mudança de
  viewport ou mutação manual. A limitação é
  `CONFIGURATION-MISSING/BLOCKED`; o skill proíbe fallback para Chrome ou
  Docker Browser sem nova autorização, regra respeitada.
- R1 (`01a04822-e069-7520-91de-d115884e1320`) e R2
  (`01a04829-1125-7810-9eee-040f9d090f07`) foram despachados em write-set
  vazio/read-only. Ambos produziram comentários parciais, mas nenhum handoff
  final dentro das janelas bounded; as threads foram arquivadas e a ausência
  não foi tratada como aprovação. A observação parcial de R1 sobre rotas sem
  assertões diretas está registrada no relatório, como `REPORTED`.
- O resultado manual permanece pendente até o IAB estar disponível. A QA
  automatizada cobre somente os oito cenários existentes; `/produtos`,
  `/precos` e `/ponto-equilibrio` continuam sem assertão direta específica na
  suíte atual. Nenhum fluxo de IA foi enviado e nenhuma despesa sentinela foi
  criada.
- Esta rodada não consumiu Q-017, Q-019, Q-020, Q-021, Q-022, Q-023, Q-024 ou
  Q-001/A1. A branch permanece local, sem atualização de estado remoto.
- Antes do commit documental desta entrada, o marker parent-pinned deverá
  apontar para o parent do commit final:

  ```text
  Latest state marker parent = `a311fac509cf9581f089263f933b8097792b09a9`
  ```

- Correção documental posterior: o relatório não afirma mais que não houve
  diff após S3; registra que `fc2f322` contém somente os dois artefatos
  documentais e, portanto, não foi feita nova revisão de código. A cobertura
  S3 não inclui esses bytes documentais; qualquer requisito de faixa integral
  incluindo documentação deve ser reexecutado antes de P8.
- O próximo commit documental desta correção usa o marker parent-pinned:

  ```text
  Latest state marker parent = `fc2f3227a0facc5e55e0227ce0a34e8fac40626c`
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

---

## Adendo de execução — rodada OPEN-01..OPEN-06 — 2026-08-28

**Classe da rodada:** execução local orquestrada; nenhum gate consumido; nenhuma operação remota.

### Baseline reobservado

- Branch: `program/v5-fechamento-sdd`.
- HEAD: `233ad6c28f0f2f5a543524ee174efc39f5a6d62e`.
- Tracking: `origin/program/v5-fechamento-sdd`, referência local sem `fetch`, `[ahead 18]`.
- Worktree rastreado sem diff; `.pi/` permanece untracked e deliberado.
- `git diff --check`: exit `0`.
- `npm run m02:matrix:check`: exit `1`, drift esperado/pending.
- `npm run m02:boundaries`: exit `1`, 13 ocorrências em 9 caminhos únicos ausentes.
- `npm run m02:state:check`: confirmado pelo agente de QA como verde; não substitui os checks M-02 pendentes.

### Resultados por escopo

1. **OPEN-01 — `BLOCKED` / `CONFIGURATION-MISSING/BLOCKED`:** o IAB oficial inicializou, mas `http://127.0.0.1:4173/` retornou `net::ERR_CONNECTION_REFUSED`. Nenhum fallback foi usado; não há veredicto de produto.
2. **OPEN-02 — análise concluída, M-02 `PENDING`:** matrix e boundaries continuam exit `1`. Os nove caminhos únicos ausentes foram registrados como `DEFERRED-EXTRACTION` para planejamento; nenhuma matriz foi gerada, nenhum stub/catálogo/runtime foi alterado.
3. **OPEN-03 — `BLOCKED` / cobertura incompleta:** scan oficial `8dfe96b9-03a5-4521-a840-bcbbbfb3abfe` não produziu `in_scope_files` nem artefato/report selado; `findingCount=0` não foi promovido a `SCAN-CLEAN`. O scan integral continua obrigatório antes de P8.
4. **OPEN-04 — `BLOCKED`:** `/produtos`, `/precos` e `/ponto-equilibrio` não carregaram por dependerem do runtime bloqueado em OPEN-01.
5. **OPEN-05 — auditoria concluída:** R1 `01a04822-e069-7520-91de-d115884e1320` e R2 `01a04829-1125-7810-9eee-040f9d090f07` permanecem `ABSENT-HANDOFF`; comentários parciais não foram tratados como aprovação. Os agentes M-02/Security/Scribe da rodada atual também não entregaram handoff final.
6. **OPEN-06 — preparação concluída:** checklist remoto criado; `remote_touched=false`. Nenhum `fetch`, `pull`, `push`, PR, merge ou deploy.

### Artefatos

- `.pi/evidence/orchestrated-open-scopes-2026-08-28/round.yaml`
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/report.md`
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/remote-sync-checklist.md`

### Gates e pendências

Gates consumidos: `[]`.

Gates pendentes: `Q-017`, `Q-019`, `Q-020`, `Q-021`, `Q-022`, `Q-023`, `Q-024`, `Q-001/A1`.

Próxima ação: disponibilizar o runtime/fixture para repetir a manual QA no IAB oficial e obter scan oficial integral selado antes de qualquer P8; manter M-02 pendente até autorização arquitetural correspondente.

---

## Adendo de execução — retomada agentic + Post-Op — 2026-08-28

**Resultado:** `COMPLETED_WITH_POST_OP_FAILURES`.

### Escopo e segurança operacional

- Branch: `program/v5-fechamento-sdd`.
- HEAD: `233ad6c28f0f2f5a543524ee174efc39f5a6d62e`.
- O runtime foi iniciado apenas com `DATABASE_URL` e `DATABASE_ADMIN_URL` apontando para `127.0.0.1:5432`; o primeiro preview que herdou endpoints Neon foi encerrado e descartado como evidência.
- Não houve `fetch`, `pull`, `push`, PR, merge, deploy, acesso a produção, alteração de runtime/schema/migration/configuração, `matrix:generate`, criação de stub ou remoção de volume.
- Nenhum gate foi consumido: `[]`.

### Pipeline de agentes

1. Runtime Bootstrapper `01a048f4-6fe7-7d63-bfcd-7dc5afa8b699`: handoff final `RUNTIME_HEALTHY`; PID Nitro `3904979`; bind `127.0.0.1:4173`; live/ready/root HTTP `200`. O processo foi encerrado no post-op.
2. IAB Navigator `01a048f8-ce31-7fe0-a86d-5d89dd1e59e2`: `FAILED`/`CONFIGURATION-MISSING`; a superfície oficial retornou `Browser is not available: iab` e disponibilidade `[]`. Nenhum fallback, login, rota ou snapshot foi usado.
3. Security Sealer `01a048f8-f335-7ad0-99b0-9788bd7f2d2f`: `BLOCKED-TOOLING/coverage-incomplete`; scan oficial `8dfe96b9-03a5-4521-a840-bcbbbfb3abfe`; `running=true`, `sealed=false`, `in_scope_files.txt` vazio, `reportAvailable=false`, `findingCount=0`. O zero não foi promovido a CLEAN.
4. Post-Op Auditor `01a048fe-ff96-7c41-99fb-936604f61a9b` e recuperação `01a04903-80bc-7203-84e5-10d97c4bbf91`: sem handoff final; ambos foram encerrados após exceder a janela. A auditoria foi assumida pelo principal e os fatos físicos foram rechecados diretamente.

### Revisão Pós-Operatória

| Item                                                   | Resultado                                           |
| ------------------------------------------------------ | --------------------------------------------------- |
| Runtime subiu e respondeu antes do IAB                 | `PASS`                                              |
| IAB gerou snapshots das três rotas                     | `FAIL` — IAB indisponível                           |
| `in_scope_files.txt` populado para `fc2f322`/`233ad6c` | `FAIL` — arquivo vazio                              |
| Scan selado                                            | `FAIL` — `sealed=false`, `running=true`, sem report |
| M-02 intocado, matrix/boundaries exit `1`              | `PASS`                                              |
| Gates intactos                                         | `PASS`                                              |
| Worktree no escopo permitido                           | `PASS` — ledger modificado e `.pi/` não rastreado   |
| Hashes recalculados                                    | `PASS` — manifest separado                          |

### Teardown e M-02

- Socket `127.0.0.1:4173`: livre após o teardown.
- `npm run db:down`/teardown Docker: concluído; nenhum container ou rede do compose permanece ativo.
- Volume `preco-que-d-main_postgres-data`: preservado; não houve `docker volume rm`.
- `npm run m02:matrix:check`: exit `1`, drift: `execute npm run m02:matrix:generate and review the result.`
- `npm run m02:boundaries`: exit `1`, mesmas 13 ocorrências em 9 caminhos únicos ausentes.

### Artefatos e hashes

Os hashes abaixo foram calculados depois das respectivas escritas e são repetidos no manifest de evidência:

- `.pi/evidence/orchestrated-open-scopes-2026-08-28/round.yaml`: `a0b1631b1b3032abbcfc713abb86e02447efa338d37dc4182c91e435d9a1cec6`.
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/report.md`: `0208b87bc7b521b23e7e6963f2645a8e2a3baf20acd633d6c45344835f074907`.
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/remote-sync-checklist.md`: `46e1216762e046c50a91f56b4b8c096981608653fc43ec19b7674f807038f7dc`.
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/post-op/iab-report.md`: `5fd6da4d5cc1f5f5cb72cd1d9ea62bd9750242312914f2cae8787d13e2fe3fff`.
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/post-op/post-op-report.md`: `404e34135fd0040ef1b2bcdceaa58d75d4d784acb79bcfb394074442348a00af`.
- `.pi/evidence/orchestrated-open-scopes-2026-08-28/post-op/handoff.yaml`: `b46a04b3055a749223f5fb83d675166f77a8127f684d40ed306a15e0ee7ed0e3`.
- SHA final do próprio ledger: registrado no manifest externo após este append, para evitar circularidade.

### Pendências e próxima ação

OPEN-01 e OPEN-04 permanecem `BLOCKED`; OPEN-02 mantém `DEFERRED-EXTRACTION`; OPEN-03 permanece bloqueado até scan oficial com escopo populado e selo; OPEN-05 foi auditado sem promover ausência a aprovação; OPEN-06 foi preparado sem tocar remoto. A próxima ação é disponibilizar o IAB oficial nesta sessão e produzir o scan integral selado dos commits-alvo antes de qualquer P8. M-02 e todos os gates permanecem pendentes.

---

## Adendo de execução — rodada operacional condicional pós-autenticação — 2026-08-28

**Resultado:** `COMPLETED_WITH_BLOCKERS`.

### Escopo e guardrails

- Branch: `program/v5-fechamento-sdd`.
- HEAD observado: `233ad6c28f0f2f5a543524ee174efc39f5a6d62e`.
- A divergência documental prevista no baseline foi observada: o artefato
  `PLANO_OTIMIZADO_AUTENTICACAO_E_RETOMADA.md` permanece não rastreado e foi
  criado nesta retomada; não há alteração de código, schema, migration,
  dependência ou configuração.
- Não houve `fetch`, `pull`, `push`, PR, merge, deploy, release, acesso a
  produção ou operação em Neon persistente.
- Nenhum gate foi consumido: `[]`.

### O1 — Runtime Bootstrap

- `npm run db:up`: exit `0`; container PostgreSQL local saudável.
- `npm run e2e:prepare`: exit `0`; fixture owner/member local preparada com
  credenciais efêmeras não registradas.
- `npm run build`: exit `0`; build client/SSR/Nitro concluído.
- Preview Nitro: bind `127.0.0.1:4173`, PID `4024089`.
- Verificações de ambiente do processo confirmaram que `DATABASE_URL` e
  `DATABASE_ADMIN_URL` apontavam para loopback; o secret estava presente sem
  ser exposto.
- Healthchecks: `/api/health/live=200`, `/api/health/ready=200`, `/=200`.

**Handoff O1:** `RUNTIME_HEALTHY`.

### O2 — IAB Navigator

A seleção oficial via `get("iab")` falhou com a saída literal:

```text
Browser is not available: iab
```

Por consequência:

- login visual não executado;
- `/produtos`, `/precos` e `/ponto-equilibrio` não receberam snapshots;
- despesa sentinela e diálogo de reset não foram executados;
- nenhum fallback foi usado;
- cookies, localStorage, sessionStorage, perfis e stores não foram
  inspecionados, conforme `NOT_PERMITTED_BY_IAB_SKILL`.

**Handoff O2:** `IAB_BLOCKED`; product verdict: `NO-VERDICT`.

### O3 — Scan Continuator

- Scan continuado pelo `scanId` original
  `8dfe96b9-03a5-4521-a840-bcbbbfb3abfe`.
- Range preservado:
  `a311fac509cf9581f089263f933b8097792b09a9..233ad6c28f0f2f5a543524ee174efc39f5a6d62e`.
- `prepare_codex_security_review_items` no scan existente retornou
  `reviewItemsTotal=0`.
- Listagem oficial de review items retornou `items=[]`.
- Contexto final observado: `running=true`, `phase=threat_model`,
  `filesTotal=292`, `closedRows=0`, `worklistRows=0`, `findingCount=0`,
  `reportAvailable=false`, `artifacts={}`.
- `in_scope_files.txt` permaneceu vazio; não foi criado artefato substituto.
- Nenhum scan paralelo foi iniciado e o scan existente não foi cancelado.

**Handoff O3:** `SCAN_CONTINUATION_BLOCKED`. O valor zero de findings não foi
promovido a `SCAN-CLEAN`.

### O4 — M-02 Observer

Handoff recebido: `M02_PENDING_MAINTAINED`.

| Check                      | Exit | Resultado                               |
| -------------------------- | ---: | --------------------------------------- |
| `npm run m02:state:check`  |  `0` | marker parent-pinned válido para o HEAD |
| `npm run m02:matrix:check` |  `1` | drift; geração não autorizada           |
| `npm run m02:boundaries`   |  `1` | 13 ocorrências em 9 caminhos únicos     |

`npm run m02:matrix:generate` não foi executado. Não houve stub, mock,
catálogo falso ou waiver implícito. Classificação preservada:
`DEFERRED-EXTRACTION/PENDING`.

### O5 — Teardown

- Preview encerrado graciosamente; não há processo Nitro e a porta `4173` está
  livre.
- `npm run db:down`: exit `0`; container e rede locais removidos.
- O volume `preco-que-d-main_postgres-data` continua presente.
- Não houve `docker volume rm` nem `docker compose down -v`.
- `git diff --check`: exit `0`.

**Handoff O5:** `TEARDOWN_SUCCESS`.

### O6 — Post-op

O subagent auditor `01a04a15-76d7-7070-84be-399847977c79` não produziu handoff
final dentro das janelas bounded e foi encerrado. A auditoria foi assumida
diretamente pelo principal; ausência de handoff não foi tratada como aprovação.

| Critério                         | Resultado                                  |
| -------------------------------- | ------------------------------------------ |
| runtime saudável antes do IAB    | `PASS`                                     |
| IAB disponível e jornada manual  | `FAIL/BLOCKED`                             |
| snapshots das três rotas         | `FAIL/BLOCKED`                             |
| scan selado, com report e escopo | `FAIL/BLOCKED`                             |
| M-02 intocado e pendente         | `PASS`                                     |
| gates intactos                   | `PASS`                                     |
| remoto intocado                  | `PASS`                                     |
| volume preservado                | `PASS`                                     |
| worktree dentro do escopo        | `PASS` — ledger, `.pi/` e plano documental |

### Classificação final e retomada

OPEN-01 e OPEN-04 permanecem `BLOCKED` pelo IAB indisponível. OPEN-02 mantém
`DEFERRED-EXTRACTION/PENDING`. OPEN-03 é `SCAN_CONTINUATION_BLOCKED` até que o
scan oficial tenha escopo populado, cobertura concluída, report e selo.

Próxima ação: disponibilizar o IAB oficial e recuperar o scan existente em uma
rodada futura; somente depois preparar o dossiê para gates humanos. P8 continua
bloqueado. O hash desta atualização do ledger deve ser calculado externamente,
após o append, para evitar circularidade.

---

### [2026-08-28T21:06:34Z] Platform Incident Response

- `LOCAL-VERIFIED`: a nova tentativa oficial de `get("iab")` em
  `2026-08-28T21:00:28.675Z` retornou literalmente `Browser is not available:
iab`; o stack foi capturado no PIR. Nenhum fallback de browser foi usado.
- `LOCAL-VERIFIED`: as flags allowlisted de IAB, browser, scanner e sandbox
  estavam ausentes; isso não prova ausência de quota/provisioning limit.
- `LOCAL-VERIFIED`: o scan existente
  `8dfe96b9-03a5-4521-a840-bcbbbfb3abfe`, no range
  `a311fac509cf9581f089263f933b8097792b09a9..233ad6c28f0f2f5a543524ee174efc39f5a6d62e`,
  permanece `running=true`, fase `threat_model`, `0/1` superfícies,
  `filesTotal=292`, `reviewItems=[]`, `reportAvailable=false`,
  `in_scope_files.txt` vazio e sem artefatos canônicos. `findingCount=0` não
  foi promovido a `SCAN-CLEAN`; o scan não foi cancelado nem substituído.
- `LOCAL-VERIFIED`: não foram observados logs de erro do motor, report,
  manifest, findings ou coverage no `scanDir`; causa-raiz permanece
  `NOT-DETERMINED`. Pressão de swap é apenas hipótese operacional.
- `LOCAL-VERIFIED`: nenhum processo Nitro/preview órfão foi identificado; não
  houve kill/restart de processos e nenhum volume foi removido.
- `REPORTED`: os três subagents read-only entregaram handoffs finais; forense,
  metadados e observação do scan confirmaram limitações, hashes históricos e
  estado incompleto, sem estabelecer causa-raiz ou aprovação.
- Gerado `.pi/evidence/PLATFORM_INCIDENT_REPORT.md` com diagnóstico,
  evidências, limitações e critérios de resolução da infraestrutura.
- Nenhum teste de aplicação, `db:up`, preview, novo scan, cancelamento,
  alteração de código, operação remota ou gate foi executado nesta resposta de
  incidente. M-02 permanece `DEFERRED-EXTRACTION/PENDING`.
- Estado operacional: `WAITING_ON_ENVIRONMENT`; retomar somente após IAB
  navegável e scan selado ou cancelamento oficial pela infraestrutura.

---

## Adendo de execução — Programa de ondas PERF/FIN 2026-08-29 (Ondas 0–3)

**Classe da rodada:** execução local orquestrada por ondas (S0-BASELINE →
S1-PERF-TX → S2-FIN-APPLY → S3-PERF-NAV → S4-CLOSE); nenhum gate consumido
(`[]`); nenhuma operação remota (sem fetch/push/PR/merge/Neon/produção); zero
novas dependências; schema/migrations intocados pelas ondas; `scripts/forensic/**`
intocado. Worktree permanece SEM commit.

### F0-04 — Baseline de performance: PARCIAL → FECHADO (rotulado `dev-evidence`)

- Fechamento com as DUAS medições do ciclo: before em
  `docs/evidence/perf-baseline-2026-08-29.md` (S0; janela UTC
  19:05:14Z→23:54:46Z de `/tmp/opencode/vite-dev.log`) e after em
  `docs/evidence/perf-after-2026-08-29.md` (S4; sessão 02:27:29Z→02:46:10Z UTC de
  2026-08-30 em `/tmp/opencode/vite-dev-after.log`; RT-count instrumentado via
  `app.context_tx`, n=81, média 5,32 RT/tx, p50 4, p95 11; `/produtos` e
  `/precos` medidos em 7 RTs/tx, confirmando −5 e −3 RTs da tabela S1).
- **Limitação rotulada `dev-evidence`**: single-user/Vite dev/Neon remoto; n baixo
  (0–40 por endpoint); latência por RT varia entre sessões; nenhum valor é SLO e
  nenhuma afirmação de produção deriva destes documentos.
- **M-06 permanece caminho de produção e NÃO foi executado**: baseline controlado
  (rotulagem CONTROLLED) e SLO/error budget continuam no escopo do módulo M-06
  (`PENDING`); este fechamento é dev-evidence e não consome o cartão SA-03.
- **Achado material da re-mineração (S4):** o log before contém, além da janela
  aceita do S0, uma janela intermediária (00:35Z→02:22:12Z UTC de 2026-08-30; 126
  `request.completed`; 69 `app.context_tx`; 13× 503 no read-model UNION ALL;
  páginas `/diagnostico`) que o baseline não declarou — registrada como descoberta
  no doc after §7 e excluída do comparativo.

### Ondas registradas (status por tarefa)

| Onda               | Agente       | Tarefas                                                                                                                                                                                                                                     | Status                                                                                                               | Evidência                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onda 0 — BASELINE  | S0-BASELINE  | Baseline F0-04 + log bruto + diagnóstico aceito (RTs fixos por server function + waterfalls; N+1 já resolvido)                                                                                                                              | DONE                                                                                                                 | `docs/evidence/perf-baseline-2026-08-29.md`; draft `docs/adr/ADR-025-session-cookie-cache.md`; `docs/evidence/manual-navigation-2026-08-29.md`                                                                                                                                                                                              |
| Onda 1 — PERF-TX   | S1-PERF-TX   | T1 (requireDatabaseAuth em transação única + `withResolvedTenantTransaction` + instrumentação `app.context_tx`) / T2 (loadProductReadModels 5→2 e listPurchasePrices 3→2, UNION ALL na tenant tx, golden 5/5) / T3 (cookie cache de sessão) | DONE / DONE / **BLOCKED_ON_ADR** (ADR-025 PROPOSED/PENDING; status deliberado, NÃO é PARTIAL)                        | `src/middleware/request-context.ts`, `src/db/client.server.ts`, `src/lib/products.functions.ts`; testes `cross-tenant-denial.perf-waves.test.ts`, `round-trip-instrumentation.perf-waves.test.ts`, `products-read-models.golden.perf-waves.test.ts` (+ `src/test/fixtures/`); desvio aprovado: pin `src/test/query-performance.test.ts` 5→2 |
| Onda 1 — FIN-APPLY | S2-FIN-APPLY | T1–T5 (`decimalInput(v, minDigits=2)` e `qty(v, unit?, digits=6)`; aplicação em precos/simulacoes; SYSTEM_PROMPT pt-BR com vedação de inventar valores; badge SIMULAÇÃO + skeleton; varredura toFixed/Intl limpa)                           | DONE (5/5)                                                                                                           | `src/lib/format.ts`, `src/routes/_authenticated/precos.tsx`, `src/routes/_authenticated/simulacoes.tsx`, `src/lib/chat-execution.server.ts`; `format.test.ts` 21/21                                                                                                                                                                         |
| Onda 2 — PERF-NAV  | S3-PERF-NAV  | T1–T6 (break-even client-side; loaders não-bloqueantes com ensureQueryData + pendingComponent; preload "intent"; staleTime por query key; debounce 400ms com generation counter + teste de race; get-session único via session-context)     | DONE (6/6)                                                                                                           | `src/lib/break-even.ts`, `src/lib/session-context.tsx`, `src/lib/query-stale-time.ts`, `src/router.tsx`, `src/routes/_authenticated/*.tsx`, `src/components/app-shell.tsx`; testes `break-even.parity.test.ts`, `simulation-race.test.tsx`                                                                                                  |
| Onda 3 — CLOSE     | S4-CLOSE     | T1 (evidence after) / T2 (este adendo) / T3 (rascunho YAML forense AUTH-2026-08-29-PERF-WAVES.yaml no handoff apenas)                                                                                                                       | **DONE** (handoff intermediário PARTIAL por lint vermelho + 503; ambos resolvidos pelo patch pós-S4 e reverificados) | `docs/evidence/perf-after-2026-08-29.md` (inclui §4.1 patch pós-S4); handoffs S4 (bloco YAML para arquivar em `$EVID/auth/`)                                                                                                                                                                                                                |

### Desvios do orquestrador (authorized_orchestrator)

1. `drizzle.config.ts` — `defineConfig` removido (export de objeto puro) para
   compatibilidade drizzle-kit 0.18/0.31; drift PRÉ-existente (`package.json` já
   estava com `^0.18.1` antes das ondas).
2. Break-even com direção invertida — implementação pura movida para
   `src/lib/break-even.ts` e `src/server/services/break-even.service.ts` reexporta
   (o reexport service→lib do S3 violava import-protection e quebrava o build).
3. `src/lib/query-stale-time.ts` (NOVO, constantes puras) + reexport em
   `src/lib/query-options.ts` + import em `src/router.tsx` + dynamic imports nos
   loaders de inicio/despesas/ponto-equilibrio — corrige regressão de bundle
   (initial graph 610.350B > 500k FAIL → 467.625B PASS; entry 406.942B → 272.380B;
   a causa era `router.tsx` açoando `query-options` → `*.functions/zod` para o grafo inicial).

### Gates finais registrados pelo orquestrador

Gate 1→2 e Gate 2→3 verdes: vitest 315/315 (31 arquivos), lint 0, typecheck 0,
build exit 0, check-bundle PASS (entry 272.380 min/84.802 gzip; graph 467.625
min/148.837 gzip). **Correção de processo:** o "lint 0" original estava mascarado
por pipe no orquestrador (exit code não propagado); reconhecido como falha de
processo do orquestrador, não dos agentes — gates re-executados com exit codes
sem pipe (confiáveis) após o patch pós-S4.

### Patch pós-S4 (authorized_orchestrator_post_s4)

Aplicado pelo orquestrador após o handoff intermediário PARTIAL do S4
(lint vermelho + descoberta dos 503):

1. **Lint fix:** `npx eslint --fix` em `src/lib/query-options.ts:16` e
   `src/routes/_authenticated/ponto-equilibrio.tsx:37` (formatação prettier dos
   desvios 3/S3).
2. **Bug dos 503 corrigido** em `src/lib/products.functions.ts`: causa-raiz
   confirmada contra o Neon (`UNION types text and numeric cannot be matched` —
   bare `null` acumulado nos branches esquerda do UNION ALL resolve como `text` e
   colide com `numeric` do branch fee). Fix: (i) casts explícitos nos 36
   placeholders null (`null::text|numeric|timestamptz` conforme a coluna);
   (ii) `normalizeChildRow` em `loadChildRows` (`execute()` não aplica decoders
   do Drizzle; neon-serverless devolve timestamptz como string — paridade entre
   drivers). Detalhes e medição pós-patch em
   `docs/evidence/perf-after-2026-08-29.md` §4.1.
3. **Verificação:** tráfego Playwright real 3× (/produtos, /precos) contra
   dev+Neon → HTTP 200 e UI renderizada ("1 produto cadastrado | Produto de teste
   | REAL | Custo: R$ 10,00…"); `app.context_tx` rt=7 **commit**. Comparativo
   final: listProductsWithMetrics p50 4935→2463 (−50,1%) e listPurchasePrices
   3873→2834 (−26,8%).
4. **Gates re-executados (exit codes sem pipe):** test 315/315 (31 arquivos),
   lint 0, typecheck 0, build 0, check-bundle PASS (entry 272.380 min/84.802
   gzip; graph 467.625 min/148.837 gzip). Reverificação final S4: test/lint/
   typecheck/build todos exit 0 → **status geral das ondas: DONE**.

**Lição de cobertura (registrada):** golden test com fake transaction não executa
SQL real — o bug do UNION passou nos gates locais porque node-postgres/
golden-fake nunca executou o UNION contra o Postgres. Cobertura contra Neon
exige teste de integração com Postgres real para o read-model UNION
(recomendação registrada ao próximo agente; ver riscos do handoff S4 final).

### Observação pós-verificação (dev runtime, rotulada; HISTÓRICA — corrigida)

A sessão after original evidenciou 503 recorrentes em `listProductsWithMetrics`
(0/12) e `listPurchasePrices` (0/4) contra Neon em dev — wrapper Drizzle "Failed
query" do read-model UNION ALL e `TypeError: row.priceUpdatedAt?.toISOString is
not a function`. O padrão já ocorria na janela intermediária do log before (13×
503 a partir de 01:05:05Z) e não foi capturado pelos gates locais. **Este registro
permanece como histórico do bug; a causa-raiz foi confirmada e corrigida no
patch pós-S4 (item 2 acima)** — a medição pós-patch com 200s está no §4.1 do
evidence.

---

## P1 closeout (WS-01..WS-07) — 2026-09-01

> Programa de fechamento P1 do Plano Mestre (§9 "Gates de aceitação final").
> Evidências: `docs/evidence/ws-01-sales-dashboard-2026-09-01.md` …
> `ws-07-observability-2026-09-01.md`. Status: **P1 CLOSED 2026-09-01** — ressalvas
> R1–R4 encerradas pelos passos S1–S6 abaixo (veredito em
> `docs/evidence/p1-closeout-2026-09-01.md`).

| Item                                                                      | Status | Evidência                                                                                           |
| ------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| WS-01 Sales → BFF → Dashboard (create + list + summary + período)         | DONE   | `vendas.tsx`, `sales.functions.ts`, `dashboard.service.ts` (period), `inicio.tsx` (seletor período) |
| WS-02 DiagnosticService server-side                                       | DONE   | `diagnostic.service.ts` + `diagnostic.functions.ts`; cálculo canônico removido do browser           |
| WS-03 Snapshots com callers (diagnostic, pricing, simulation, break_even) | DONE   | migration 0008 (idempotency_key + UNIQUE); repos com `onConflictDoNothing`                          |
| WS-04 saveSimulation + UI + recálculo server-side                         | DONE   | `simulacoes.tsx` (salvar + listar); `simulation.service` recalcula e grava snapshot                 |
| WS-05 estimated_cost writer (unknown ≠ zero)                              | DONE   | `budget-ledger.settle` + `estimateModelCost`; `cost_status` explícito                               |
| WS-06 Conversation FSM + allowlist por estado                             | DONE   | `chat-fsm.server.ts`; gate por estado antes do tool runner                                          |
| WS-07 observabilidade + evidências                                        | DONE   | métricas/spans novas; 7 evidence files commitados                                                   |

### Gates locais executados (2026-09-01)

- `tsc --noEmit` 0 erros · `vitest` **353/353** (×2 estáveis) · `eslint .` 0 · `npm run build` ok · `check:bundle` PASS (entry 84.9 kB gzip; graph 148.9 kB gzip ≤ 500 kB).
- PostgreSQL 17 local: migrations do zero 0000→0008 OK; upgrade a partir de 0003 OK (downs de 0007/0008 adicionados); RLS + cross-tenant + rollback OK; tool security OK; chat semantics OK; orçamento IA T1–T10 OK.
- `drizzle-kit check`: "Everything's fine".

### Ressalvas rotuladas (vereditos em `p1-closeout-2026-09-01.md`)

1. ~~`test-auth-integration.ts` retorna 401 no ambiente local~~ → **R1 resolvida no S1**: raiz = drift better-auth 1.7.2 (committado no wave1) que casa credential accounts por `issuer` + `accountId`; teste tornado hermético + migration 0010 faz backfill de `accounts.issuer` (DATA_MIGRATION/SAFE, idempotente). CI nos tips publicados (1.6.27) permanece verde; merge-gate registra o changelog review (§2.2).
2. ~~"Margem consolidada" segue "—"~~ → **R2 resolvida no S5**: estado explícito com badge `DADOS INCOMPLETOS` + descrição do insumo faltante; mix real por produto permanece P2.
3. Custo de IA agregado por rodada de modelo (`ai_usage`) e não por tool — **R3 aceita com suporte**: coluna `ai_usage.tool_execution_id` nullable criada (0009) e nunca escrita (asserção de contrato); atribuição por tool fica para P2.
4. Estados `calculating/confirming/executing` do FSM — **R4 resolvida no S6 (ADR-026, caminho b)**: grafo executado declarado (`idle → collecting_context → completed|failed` + RESET); os três restantes marcados **RESERVED** com allowlist vazia (gate negativo) e CHECK mantido para forward-compat com M-04.

## S1–S7 — fechamento de ressalvas e closeout P1 (2026-09-01)

Formato por entrada: `id · módulo · tipo · ref plano · passo · testes · evidence · rollback · status`.

| id    | módulo  | tipo      | ref plano                          | passo | testes                                                                                                   | evidence                                           | rollback                                                       | status |
| ----- | ------- | --------- | ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | ------ |
| S1-01 | M-02    | fix+test  | §7.2–7.7 · §32 · INV-002           | S1    | `test-auth-integration.ts` (hermético; prova admin+app_runtime ×2)                                       | `s1-auth-hermetic-2026-09-01.md`                   | reverter commit do teste (auth runtime intocado)               | DONE   |
| S1-02 | M-02    | migration | §13.4 · §27 · F2                   | S1    | replay incremental + idempotência provados em scratch                                                    | incluída em `p1-closeout`                          | `0010_to_0009_down.sql`                                        | DONE   |
| S2-01 | M-02/DB | fix+test  | INV-012 · §27 · §34                | S2    | `test-migrations.ts` (downgrade 0010→0001 + replay, journal=11)                                          | `s2-migration-0002-rollback-2026-09-01.md`         | remover par de rollback (forward migration inalterada)         | DONE   |
| S3-01 | M-03    | fix+test  | §10.6 · §22 · INV-009              | S3    | `snapshot-idempotency.test.ts` + prova de replay em scratch                                              | `s3-snapshot-idempotency-2026-09-01.md`            | helper puro (ADR não requerida — regra documentada)            | DONE   |
| S4-01 | M-04    | fix+test  | §14.6 · §6.9 · §19.4 · INV-006/014 | S4    | `ai-estimated-cost.test.ts` (boot throw, redaction, tool_execution_id NULL)                              | `s4-ai-pricing-hardening-2026-09-01.md`            | flag de validação de boot (remover chamada em `src/server.ts`) | DONE   |
| S5-01 | M-02    | test+doc  | §8 BFF-001 · §11.7 · §18.1/2/4/5   | S5    | `e2e/sales-dashboard.spec.ts` (11/11 chromium; 12/12 ×4 projetos na prova A5) + badge R2 em `inicio.tsx` | `s5-sales-e2e-2026-09-01.md`                       | n/a (teste/evidência)                                          | DONE   |
| S6-01 | M-04    | ADR+test  | §14.1/14.2 · INV-002/009/014       | S6    | `chat-fsm.server.test.ts` (+5: walk executado, reserved gates)                                           | `s6-fsm-grafo-executado-2026-09-01.md` · `ADR-026` | comentários/marcadores (zero mudança de comportamento)         | DONE   |
| S7-01 | —       | doc       | §45 · §35                          | S7    | gates duplos: vitest 353/353 ×2 · db:test chain ×2 (exit 0) · e2e 11/11                                  | `p1-closeout-2026-09-01.md`                        | n/a                                                            | DONE   |

**P1 CLOSED — 2026-09-01** (commits locais: base `a495492` + trabalho desta janela ainda não commitado — push/PR pendente de decisão humana; Lovable sem conexão ativa).

### S8 — janela de estabilização (condições de entrada em S9)

- 1–2 semanas observando as 10 métricas `app.*` + KPIs §46; error budget §30: **zero tolerância** a erro financeiro crítico.
- Critérios: nenhum cross-tenant, nenhum unknown→zero, nenhuma regressão P0 (golden F0-03), CI verde na janela inteira.
- **Não iniciar S9/F10 antes de S8 cumprido.** Itens §39 permanecem bloqueados; HNSW somente após §44.

### S8-1 — higiene de estabilização B1/B2 (2026-09-03)

- **B1 (teardown determinístico do E2E)**: `scripts/e2e/seed-auth.ts` passou a limpar também `calculation_snapshots`, `sales`, `sales_items`, `ai_usage`, `purchase_price_history` e `rate_limits`. Causa-raiz do flake observado em re-execução encadeada (1/11 "Too many requests" no matrix de autorização): a tabela global `rate_limits` (sem tenant_id) das regras de 60s do Better Auth (`rate-limit-rules.server.ts`) vazava entre execuções. Prova de determinismo: DB zerado → 11/11; duas execuções `--project=chromium` **encadeadas** após o fix → 11/11 ×2 (resíduos canônicos de snapshots acumulados pela própria suíte são expurgados pelo seed).
- **B2 (veredito binário `format:check`)**: PASS. Detritos locais de sessões antigas (`.pi/`, `PLANO_OTIMIZADO_AUTENTICACAO_E_RETOMADA.md`, evidências perf/obs/manual de 28–30/08) foram apenas formatados no working tree e permanecem **não commitados**; `.prettierignore` sem novas entradas (nada é ignorado que não exista no repo).
- **Decisão de escopo**: forensic-kit (`scripts/forensic/`, `scripts/val/`, `docs/forensic-kit.md`) fica fora do PR (ferramenta de sessão anterior, fora do programa P1); o script órfão `forensic:test` foi removido de `package.json` para o branch fechar autoconsistente em fresh clone (nenhum workflow CI o referenciava).
- Gates desta janela (após B1/B2): `tsc` 0 · `eslint .` 0 · `vitest` **353/353** · `format:check` PASS · `build`+`check:bundle` PASS (entry 84.9 kB gzip; graph 148.9 kB ≤ 500 kB) · Playwright chromium **11/11 ×2 encadeadas**.
- **S8 status**: B1/B2 DONE · B3/B4 (janela temporal 1–2 semanas com métricas `app.*`/KPIs §46 no destino publicado) em curso · S9/F10 permanece BLOQUEADO até B4 (§39/§44 inalterados).

### A1/A2 — publicação PR #24 (2026-09-03)

- **A1**: `codex/wave1-neon-native` pushado (sem rewrite de histórico; base publicada inalterada) e **PR #24** aberto → `develop` com escopo completo (29 commits; inclui e subsume o draft #23). Commits locais: `87a5d39` (code: FSM gate, idempotência snapshot, backfill issuer 0010, E2E determinístico) + `db0b9a2` (docs: ADR-025/026, 14 evidências, ledger).
- **A2**: UI stack `verify` **PASS** no tip `db0b9a2` (run 33714878841: lint/tsc/vitest 353 + db:test completo + build + bundle + Playwright matriz) · Secretless Neon preview boundary **PASS** · **SonarCloud Code Analysis FAILURE** (32s; projeto privado — inspeção do quality gate exige acesso humano ao dashboard; histórico: PRs anteriores até 72 arquivos passaram). Sem branch protection, check é advisory — decisão de merge registrada como pendência humana por causa do Sonar + do cutover A4.
- **Pendências**: (i) triagem Sonar pelo dono da conta; (ii) confirmação de que push em develop não auto-deploya produção antes de A3; (iii) A4 ordem obrigatória: **0010 via URL direta ANTES de tráfego 1.7.2**; (iv) A6 changelog review 1.6→1.7 na conclusão.

### A3/A4 — merge #24, develop verde e migrations na produção Neon (2026-09-03)

- **A3**: PR #24 mergeado (`b7c98f4`); UI stack no push a develop **PASS** (run 33829965081). Release-readiness: `docs/evidence/release-readiness-develop-main-2026-09-03.md`. Confirmação humana: develop não auto-deploya produção.
- **A4 (metade 1 — migrations ANTES do tráfego 1.7.2)**: `npm run db:migrate` via URL direta unpooled no Neon de produção aplicado com sucesso (journal 8→**11**); colunas FSM + `idempotency_key` + UNIQUE + 5 colunas de custo verificadas pós-aplicação. **0010 foi no-op**: baseline `issuer IS NULL` = 0 de 4 credential accounts (já `local:credential`) → **reconciliação A5-parcial: diferença 0**. Rollbacks preparados (`0010_to_0009_down.sql` → …). Mudanças 100% aditivas: o código hoje publicado (1.6.27) não é afetado.
- **R5-open (novo resíduo)**: SonarCloud Code Analysis **FAILURE** reprodutível no PR #24 (32s e 53s em dois tips); todos os checks de workflow (UI stack, Neon boundary) verdes. Projeto privado — triagem do quality gate é ação humana no dashboard; sem branch protection, não bloqueou A3. Meres futuros devem registrar o estado do R5.
- **Pendências**: PR develop→main + CI; deploy Hostinger manual + smoke de login (checklist no release-readiness); janela A5 24–72h; B3/B4; A6 changelog review 1.6→1.7.

### Publicação confirmada + fechamento de R5 + A6 (2026-09-05)

- Latest state marker parent = `0bab6b7cc6fcf02d371ed7b9d7aec928ae6d22c3`
  (merge do PR #26 em develop); branch de trabalho: `develop`; publicação
  realizada por merges normais (sem rewrite de histórico).
- **Release wave1 em `main`**: PR #25 (`develop → main`) mergeado em
  2026-09-04 (`84030b6`); `verify` PASS ×2 (runs 33830777973, 33830760402);
  Sonar FAILURE reproduzido (R5).
- **R5 CLOSED**: causa-raiz identificada via anotações do check run — Reliability
  D (S3516 em `client.server.ts`, S2871 ×4 e complexidade 16/17 em
  `m02-matrix.ts`) e Security B (S4036 em `m02-state-check.ts`), mais S1192 na
  migration 0008 (imutável, já aplicada). Fix publicado: PR #26 → develop
  (`0bab6b7`; verify PASS 7m0s, run 33938333439; **Sonar Quality Gate passed**,
  0 issues novas) e PR #27 → main (`b1f9468`; verify PASS 6m36s após re-run —
  o 1º run foi cancelado com o passo `playwright install` travado 18 min;
  Sonar PASS). `.sonarcloud.properties` criado com `sonar.exclusions=drizzle/**`
  (migrations imutáveis + ~29k LOC de snapshots; protege a cota Free de 50k
  LOC). Evidência completa: `docs/evidence/pub-wave1-2026-09-05.md`.
- **A6 DONE (revisão)**: changelog review better-auth 1.6.27 → 1.7.2 (§2.2)
  registrado em `pub-wave1-2026-09-05.md` §3: das 18 breaking changes da 1.7.0,
  apenas a identidade `(issuer, accountId)` impacta o app — já mitigada por
  R1/S1 + migration 0010 (no-op na produção, diferença 0). Nenhuma ação de
  código adicional. Runtime publicado confirmado: better-auth **1.7.2**.
- **P1 CLOSED (published em git)**: main = `b1f9468` com CI verde
  (run 33940307955). Ressalva de honestidade de estado: o tráfego de produção
  (Hostinger) ainda roda a build anterior — **A4 metade 2 (deploy manual +
  smoke) permanece pendência humana/infra** (hPanel bloqueado por contratação
  de plano desde 2026-08-24); a janela A5 24–72h e, por consequência, B3/B4,
  só iniciam com o deploy. Fase C (S9/F10) permanece BLOQUEADA até B4
  (§39/§43/§44 inalterados).
- **Higiene de gates M-02**: drift pré-existente em `docs/specs/M-02/`
  (artefatos commitados defasados vs. árvore pós-wave1: contagens 30→28,
  31→32, 13→99, 21→31) corrigido por regeneração determinística
  (`npm run m02:matrix:generate`); `m02:matrix:check` volta a PASS.
  Refactor de `m02-matrix.ts` comprovado byte-idêntico ao baseline antes da
  regeneração.
- **Follow-ups registrados (não bloqueantes)**: (i) Sonar reporta "Quality
  Gate not computed" (neutral) na branch `main` — investigar configuração da
  análise automática da branch principal; (ii) 25 warnings Sonar restantes
  (structuredClone, ternários aninhados, imports não usados, regex
  super-linear em `format.ts`) — candidatos a PR de higiene; (iii) avaliar
  cache de browsers Playwright no workflow (hang de 18 min observado no run
  33938735859); (iv) ADR-025 (session cookie cache) ganhou dados novos na 1.7.x
  (JWKS + warnings de dados assinados inválidos) — insumos para a decisão.

### M-02 boundaries tratado por categoria + guarda do down 0010 (2026-09-05)

- Latest state marker parent = `bf356d862e3e8240e2f144f84c1b1fa37bc34f32`
  (commit docs do fechamento de publicação em develop).
- Entrada (relatório de checagens pós-publicação, 2026-09-05):
  `npm run m02:boundaries` FAIL com 26 ocorrências. Saída: **PASS**.
- **Tratamento por categoria** (detalhe em
  `docs/evidence/m02-boundaries-2026-09-05.md`): (i) 3 gaps documentais de
  `sales.functions.ts` corrigidos no overlay (entry policy + 2 operation
  mappings; endpoints já passavam por `requireDatabaseAuth`+`salesService`);
  (ii) 12 catalog paths repontados para os arquivos reais de implementação
  (status `consolidated` + fase-alvo) e checker ajustado para não exigir
  existência de entradas `contract-only` (M-04/M-05), sem criar stubs;
  (iii) 11 violações BFF→DB reais cobertas por exceções `transient-*` com
  razão e fase-alvo de remoção (M02-2/3/4), emendadas em
  `docs/specs/M-02/excecoes.md` + nota transitória em `spec.md` — a regra
  normativa permanece o alvo e nenhuma exceção autoriza novos acessos.
- **Guarda do rollback 0010**: `drizzle/rollback/0010_to_0009_down.sql` —
  registrado que o down NÃO é no-op (casa 4 contas em produção; forward foi
  no-op verificado), proibido executar automaticamente; pré-requisitos de
  reconciliação/versão/ledger documentados no próprio arquivo. SQL inalterado.
- Nenhum código de runtime alterado; schema/migrations intocados; nenhum down
  executado. Pendências inalteradas: A4 metade 2 (deploy Hostinger + smoke,
  BLOCKED-AUTH hPanel), janela A5, B3/B4, Fase C bloqueada até B4.

### Checagens pós-publicação — 2026-09-05

- Continuação solicitada conforme o Plano Mestre; usuário informou ausência de
  acesso ao hPanel e orientou seguir com as próximas checagens. IAB disponível;
  hPanel redirecionou ao login. A4 deploy/smoke, A5, B3/B4 e Fase C permanecem
  pendentes nos respectivos gates.
- GitHub autenticado como `Douglas0101`, permissão admin. Tips remotos
  confirmados: develop `bf356d8`, main `b1f9468`; runs `33941501282` e
  `33940307955` com verify success nos SHAs correspondentes. Runtime, scripts,
  testes, migrations, lockfile e workflows são idênticos entre esses tips.
- Gates locais: state marker PASS; matrix check PASS; **m02:boundaries FAIL**
  (26 ocorrências: 11 relações, 1 entry policy, 2 operation mappings e 12
  referências a 8 caminhos ausentes). Esse comando não integra o ui-stack.
  Typecheck, lint, format e 353 testes em 34 arquivos passaram.
- Neon production consultado somente por SELECT: 11 migrations, **11/11 hashes
  e timestamps reconciliados**, 4 credential accounts com issuer esperado e
  zero issuer nulo. Colunas, índice UNIQUE, CHECKs e configuração RLS selecionados
  confirmados. A consulta admin não substitui teste como app_runtime.
- **Correção do procedimento de rollback:** o down 0010 alteraria as 4 contas
  atuais; não é no-op mesmo com forward historicamente no-op. Não foi executado.
  Revisar rollback da aplicação/dados antes de A4. Retenção Neon informada de
  6h e lista de snapshots gerenciados vazia; backup/restore externo não verificado.
- Sonar main continua neutral/Quality Gate not computed; causa depende de painel
  autenticado. O log do hang Playwright localiza a demora em downloads APT do
  Ubuntu; cache de browsers não resolve essa etapa. ADR-025 já registra ACCEPTED,
  mas o marker não está implementado nos caminhos atuais de autenticação.
- Evidência e pacote de entrada A4/A5/B3/B4:
  `docs/evidence/checagens-pos-publicacao-2026-09-05/report.md`, com JSON, SELECT
  reproduzível e manifesto de integridade. Sem mudança de código, workflow,
  migration, refs Git ou dados de produção; arquivos preexistentes preservados.

---

## Auditoria de substrato Supabase→Neon — SDD — 2026-09-05

- Latest state marker parent = `26e4bcafe4d8a0a1f2cdb8db92f335330c5e8e28`
  (commit de artefatos da auditoria em `audit/substrato-2026-09-05`).
- **Veredito Leitura A/B:** nem A nem B como formuladas — **não existe runtime
  em tráfego** (Hostinger sem plano ativo, 0/11 hPanel); o substrato de dados
  vivo é o Neon production (`damp-forest-57346541`, PG 17.11, journal 11/11
  hashes reconciliados, última aplicação 2026-09-02T03:35Z); as "4 contas" são
  **fixture E2E/probe de 2026-08-30** (u2/u3 probe + qa.local.admin ×2, "Tenant
  E2E"), com 1 produto de teste, 2 despesas, 1 conversa e 2 sessões — zero
  usuário real. Cutover = **primeiro deploy**, não troca em vivo. Evidência:
  `docs/evidence/substrato-2026-09-05/report.md`.
- **Classificações:** CONFORME (journal/hashes, runtime sem Supabase, issuer=0);
  GAP-DOC ×3 → emendas `M02-D-006` (Storage sem sucedente/cláusula), `M02-D-007`
  (Realtime sem cláusula; chat é request/response), `M02-D-008` (paridade
  condicional a decisão de origem; fixture no destino); VIOLAÇÃO ×2 → **DB-01**
  (fixture no production; fase-alvo pré-A4, guard do down 0010 recontada após
  limpeza) e **DB-02** (credenciais live órfãs em `neon-storage.env`; revogação
  ou ratificação pré-produção); FALSO-ALARME ×2 (vars SUPABASE_* residuais;
  premissa "4 contas em tráfego"); DESCONHECIDO legítimo ×4 (origem Supabase,
  config de tráfego N/A, backup/restore §42, Sonar main neutral).
- **Artefatos spec-first:** `npm run smoke:substrate`
  (`scripts/smoke/substrate-smoke.ts`, read-only) — execução contra produção
  2026-09-05T19:00:40Z: **PASS 6/6** (major 17, journal count+hashes,
  app_runtime sem superuser/BYPASSRLS, RLS em 20 tabelas tenant, issuer IS NULL
  = 0). Runbook A5 (0h/24h/72h + 5 critérios de abort) e baseline B3 declarado
  **não mensurável (amostra zero)** em `docs/runbooks/migracao-supabase-neon.md`.
- **Drill rollback 0010 em sandbox:** branch `sandbox-drill-down-0010-20260905`
  (`br-summer-dream-ayewlgx2`, cópia da production, criada 2026-09-05T18:55:37Z);
  down → raio **4/4 contas** (confirma que o down NÃO é no-op); forward
  idempotente → **4/4 reconciliadas**. Produção intocada. Sandbox aguarda
  destruição (operação destrutiva condicionada a autorização do operador).
- **BLOCKER-EXT-01:** pedido de acesso hPanel redigido
  (`docs/evidence/substrato-2026-09-05/hpanel-request.md`) com escopo exato
  (deploy, env, logs, restart, confirmação negativa de DB local) e prazo 3 dias
  úteis. Caminho crítico: pré-A4 (DB-01 + M02-D-008 + §42) → A4 → A5 → B3 → B4
  ≈ 11–18 dias úteis pós-desbloqueio; recomendação de change freeze de deploys
  durante A5/B3 contra os refactors M02-2/3/4.
- Matriz de prontidão: schema PRONTO · dados PRONTO-COM-EXCEÇÕES (DB-01,
  paridade condicional) · auth PRONTO-COM-EXCEÇÕES (smoke produtivo pendente) ·
  storage NÃO-INICIADO (EM-01) · realtime PRONTO-COM-EXCEÇÕES (M-08 pendente) ·
  config/infra DESCONHECIDO (sem deploy; §42 aberto).
- Gates desta rodada: `npm run check` PASS (full), typecheck/lint PASS,
  `format:check` PASS sobre artefatos novos; `m02:matrix:check`,
  `m02:boundaries`, `m02:state:check` reexecutados pós-commit do ledger.
- Pendências inalteradas: A4 metade 2, A5, B3/B4, Fase C; novos pré-requisitos
  pré-A4: DB-01, DB-02, M02-D-008, snapshot/restore §42, destruição do sandbox.

---

## Rodada pré-A4 — higiene de segurança (DB-02, SEC-01) — 2026-09-05

- Latest state marker parent = `b970c8230a5bd63bcc49d618dcd3303dd9c51484`
  (merge do PR #29 — auditoria de substrato — em develop).
- **DB-02 (arquivo): RESOLVIDO.** `neon-storage.env` (5 chaves: AWS_* S3-compatible
  - OPENAI_API_KEY) comprovadamente sem consumidor em código/CI
    (`npm run m02:secrets-audit`: 24 definidos · 8 consumer · 2 docs-only · 14
    órfãos) e **removido do disco em 2026-09-05T19:58:45Z**. Evidência
    antes/depois: `docs/evidence/pre-a4-2026-09-05/secrets-hygiene.md`.
    **Revogação no emissor: pendente-humano** (console OpenAI + provedor S3
    identificado por `AWS_ENDPOINT_URL_S3`) → exceção **SEC-01** até confirmação.
- **Script novo:** `m02:secrets-audit` (`scripts/m02-secrets-audit.ts`,
  read-only) — inventário segredo→consumidor com flag de órfãos.
- Classificações da rodada: `SUPABASE_*`/`VITE_SUPABASE_*` residuais =
  FALSO-ALARME (limpeza local recomendada); `NEON_AUTH_*` = docs-only;
  `NEON_BRANCH`/`NEON_DATA_API_URL` = órfãos (limpeza local);
  `DATABASE_URL_UNPOOLED` = FALSO-ALARME (URL direct de operador, ADR-019).
  GitHub Secrets contém apenas `NEON_API_KEY`; var `NEON_PROJECT_ID` ok.
- **A1 (sandbox `br-summer-dream-ayewlgx2`): AGENDADO** — aguarda o workflow
  `neon-drill-ops` (PR #30) ser despachável em `main`; evidência de antes/depois
  entra no relatório consolidado da rodada.

## Pré-A4 — segurança executada, credenciais no emissor ainda pendentes (2026-09-05)

- Latest state marker parent = `53db301d2deedb4e05bbdd99a636f8c2cf4ed674`
- A1: sandbox `br-summer-dream-ayewlgx2` destruído com listas antes/depois; A2: arquivo local ausente, revogação não comprovada, DB-02/SEC-01 seguem abertos.
- `m02:secrets-audit` cobre env variantes/nested, distingue referências exatas e declara exclusões. Inventário: 39 definições, 28 consumidores lexicais, 11 para revisão, zero candidatos literais no escopo, nenhuma conclusão de liveness.
- Verificação local: `npm run check` PASS (357 testes); matrix/boundaries PASS. Artefatos em `docs/evidence/pre-a4-2026-09-05/implementation/security.md`. Prova local não equivale a CI/revogação/cutover.
- ESTADO DO SUBSTRATO: Tráfego não existe segundo ledger; Neon production preservada nesta etapa; Paridade DESCONHECIDO/G1 pendente; Blockers DB-01, DB-02/SEC-01, BAK-01, G1/G2, hPanel, Sonar.

## Rodada pré-A4 — §42 backup/restore comprovado (BAK-01) — 2026-09-05

- Latest state marker parent = `b970c8230a5bd63bcc49d618dcd3303dd9c51484`
  (merge do PR #29 em develop; base desta branch).
- **§42 classificado: VIOLAÇÃO de SDD §2446** (PITR ≥ 7 dias indisponível:
  retenção 6 h + zero snapshots) → exceção **BAK-01** com controles
  compensatórios + emenda de política vigente
  (`docs/decision-briefs/2026-09-05-bak-01-backup-restore-policy.md`):
  snapshot externo pré-deploy obrigatório, restore drill comprovado, cadência
  semanal manual até o plano suportar PITR ≥ 7 d.
- **Drill executado e verde** (`npm run m02:backup-verify`, script novo
  `scripts/db/backup-verify.ts`): dump custom 135.416 bytes
  (sha256 f5659573…) → restore em banco efêmero `drill_restore_20260905202420`
  (95,3 s, `--no-owner --no-privileges`) → verificação 27/27 contagens,
  journal 11/11 hashes, RLS 20/20 tabelas tenant + 25 policies → scratch
  destruído. Evidência: `docs/evidence/pre-a4-2026-09-05/backup-restore-drill.{md,json}`.
  Este dump é a rede de segurança que autoriza o purge DB-01 (A3).
- Limite registrado: ownership/GRANTs fora do escopo do restore (roles de
  serviço Neon); RPO/RTO observados válidos apenas para o volume atual.
- Falha intermediária documentada: `SET ROLE neon_service` → corrigida com
  `--no-owner --no-privileges` (1 falha, sem contorno de protocolo).

## Pré-A4 — snapshot e restore nativo reconciliados (2026-09-05)

- Latest state marker parent = `dbdde7adee6e6e2fcadd64d3e575ada30f78644e`
- Snapshot `snap-tiny-smoke-ayc382ji`, origem production `br-snowy-violet-aymcvvvv`, criado 22:37:46Z, validade 2026-10-10. Restore isolado `br-floral-pond-ayltjy2t`; sem finalize sobre origem.
- `m02:backup-verify`: PASS, 27 tabelas contagens/checksums, 11/11 migrations, catálogo e roles iguais. Identidade validada pelo servidor. Prova registrada em `docs/evidence/pre-a4-2026-09-05/implementation/backup.md` e JSON; recursos efêmeros terão cleanup após os drills.
- BAK-01 continua ABERTA: dump semanal não prova RPO, restore sem grants não prova privilégios e a prova nativa não substitui backup independente. Política histórica e veredito §42 corrigidos sem apagar histórico.
- Local: `npm run check` PASS (360 testes); matriz regenerada devido ao novo teste e boundaries PASS. CI e publicação ainda devem ser verificados no SHA publicado.
- ESTADO DO SUBSTRATO: Tráfego inexistente no ledger; Neon com snapshot e restore reconciliado, ainda fixture; Paridade DESCONHECIDO/G1 pendente; Blockers DB-01, DB-02/SEC-01, BAK-01 operacional, G1/G2, hPanel, Sonar.

## Pré-A4 — DB-01 verificação independente e publicação (2026-09-06)

- Latest state marker parent = `b735b79206fcab2bd8b56214a797fce4e619e567`
  (tip de `origin/develop`; branch `chore/pre-a4-db01-purge-guard` sem commits locais,
  só working tree da rodada).
- **Cronologia snapshot → purge (A3 CONFORME):** snapshot nativo
  `snap-tiny-smoke-ayc382ji` criado 2026-09-05T22:37:46Z (validade 2026-10-10) +
  dump externo `.artifacts/purge-drill/20260906T015217Z/dump.pgc` (135.416 B,
  sha256 `1e7aa351…`, 2026-09-06T01:52:17Z) → rehearsal scratch 02:00:29Z →
  production dry-run 02:01:34Z (`non_fixture_user_count: 0`) → production APPLY
  02:01:52–02:02:04Z (34 linhas, `users_total_remaining: 0`) → smoke 02:02:46Z
  PASS 7/7. Nenhum APPLY novo nesta rodada (A3: verificação + publicação).
- **Incidente da guard 0010 — local esclarecido:** a 1ª versão da guarda (RAISE sem
  transação única) foi derrotada em **scratch local** (`drill_purge`, rehearsal §2):
  `psql` em autocommit executou `UPDATE 4` após a exceção. Achado de drill, nunca
  executado em produção (o arquivo de rollback jamais rodou no Neon production).
  Correção: guarda + down em `BEGIN…COMMIT` único. Segunda falha intermediária
  (placeholders `$2`/`$3` sem `$1`) idem em scratch, transação com rollback íntegro.
- **Guard recalibrada:** `count(accounts) > 0 → RAISE EXCEPTION` + rollback da
  transação; com zero contas o down é no-op e o forward 0010 idempotente
  (`UPDATE 0`/`UPDATE 0` em scratch). Execução automática proibida; rollback de
  issuer pós-tráfego = restore de snapshot (BAK-01). Racional documentado no
  próprio arquivo: após o purge, qualquer conta é tráfego real (better-auth 1.7.x
  exige issuer).
- **Grants/RLS no restore (§42):** `inventory()` (`scripts/db/backup-verify.ts:67-77`)
  coleta grants (`role_table_grants`), policies, constraints, índices, RLS/owner e
  roles; `compareInventories()` compara catálogo + roles estritamente — ambos os
  drills passaram com catálogo/roles iguais. Limite residual: restore pg_dump com
  `--no-owner --no-privileges` não exercita ownership/GRANTs como enforcement, e o
  comportamento efetivo como `app_runtime` (negação cross-tenant) só será exercitado
  no smoke A4 em runtime. BAK-01 permanece ABERTA.
- **Gates desta rodada (árvore PR-2):** `npm run check` PASS (full: ui-stack,
  no-supabase, format, lint, typecheck, 353+ testes incl. `m02-purge-fixtures`,
  build, bundle); `m02:matrix:check` PASS (matriz regenerada pelo novo teste);
  `m02:boundaries` PASS; `m02:state:check` PASS após este registro.
  Detritos S8-1 (`.pi/`, `PLANO_OTIMIZADO_*`, `forensic-kit`, `scripts/forensic|val`,
  evidências perf/obs antigas, `checagens-pos-publicacao-2026-09-05/`) NÃO commitados;
  lista registrada no doc consolidado (PR-3).
- **Norma nova desta rodada** (nasce do bug da guard): todo script de mutação em
  banco = transação única + dry-run default + evidência timestamped (emenda
  normativa no doc consolidado, PR-3).
- ESTADO DO SUBSTRATO: Tráfego inexistente; Neon production fixture-free (26/26 zero,
  smoke 7/7); Paridade DESCONHECIDO/G1 pendente; Blockers SEC-01 (revogação humana),
  BAK-01 operacional, G1/G2, hPanel, Sonar main neutral.

## Pré-A4 — segurança reverificada + G1 instrumentado (2026-09-06, PR-1 #36, mergeado antes de PR-2 #35)

- Latest state marker parent = `b735b79206fcab2bd8b56214a797fce4e619e567`
  (branch `chore/pre-a4-security-g1`, de `origin/develop`).
- **Re-auditoria `npm run m02:secrets-audit` (2026-09-06T03:45:22Z):** 39 definidos ·
  28 com consumidor · 8 orphan-candidate · 3 docs-only; **zero ocorrências
  das chaves órfãs** (`AWS_*`, `OPENAI_*`) em `src/`, `scripts/`, `e2e/`, `.github/`; `neon-storage.env`
  ausente do disco (`ls` 03:45:15Z) e nunca versionado. Evidência:
  `docs/evidence/pre-a4-2026-09-05/secrets-audit-2026-09-06.json`.
- **Errata M02-D-006 (drift tabela/linha):** onde se lia `products.image`
  (`src/db/schema.ts:46`), leia-se `users.image` — a linha 46 pertence a `users`
  (Better Auth); `products` (`:191-230`) não tem coluna de imagem. Fato material
  inalterado (zero dependência de storage).
- **G1 instrumentado, NÃO assinado:** memo `M02-D-008-G1-memo.md` (fato, recomendação
  (a) greenfield com SUNSET 2026-09-20, riscos por ramo, bloco de assinatura).
  Paridade segue DESCONHECIDA; inferência de origem vazia proibida.
- **SEC-01 segue ABERTA (risco residual humano):** credenciais possivelmente live no
  emissor até revogação no console (OpenAI + provedor S3); mitigação vigente: arquivo
  destruído, zero consumidores, nunca versionado. A1 (sandbox
  `br-summer-dream-ayewlgx2`) agendado pós-release em `main` via `neon-drill-ops`.
- ESTADO DO SUBSTRATO: Tráfego inexistente; Neon production fixture-free (PR-2);
  Paridade DESCONHECIDO/G1 pendente; Blockers SEC-01, BAK-01, G1/G2, hPanel, Sonar.

## Pré-A4 — runbooks A4 + ADR-027 + doc consolidado (2026-09-06, PR-3)

- Latest state marker parent = `b735b79206fcab2bd8b56214a797fce4e619e567`
  (branch `chore/pre-a4-runbooks-a4`, de `origin/develop`; merge após PR-2 #35,
  em sequência com PR-1 #36).
- **Artefatos (dia do desbloqueio = só executar):** `docs/runbooks/hpanel-homologacao.md`
  (11 itens com comando/saída/FAIL) · `docs/runbooks/a4-a5-cutover.md` (A4 + A5
  0h/24h/72h + aborts + rollback via snapshot + template de ledger; ponteiro no
  runbook de migração) · `docs/runbooks/decommission-origem.md` (variantes G1(a)
  atestação / G1(b) verificação) · `M02-D-009` (freeze A5/B3 + roadmap M02-2/3/4
  pós-B4 + norma de mutação: tx única + dry-run + fail-closed + evidência).
- **ADR-027 (EM-01, G2 PENDENTE, sem código):** desescopo de storage pós-B4;
  alternativas A–D para RFC futura; sem assinatura vale M02-D-006.
- **Doc consolidado:** `docs/evidence/pre-a4-2026-09-06.md` (matrizes, timeline,
  3 lacunas respondidas, contagens 8/6/2/3/5, binário NÃO + declaração,
  ESTADO DO SUBSTRATO, top-3, detritos excluídos).
- **Binário:** zero desconhecidos de engenharia no caminho crítico;
  "pronto para cutover — aguardando desbloqueio externo".
- ESTADO DO SUBSTRATO: Tráfego inexistente; Neon fixture-free (PR-2) + snapshot até
  2026-10-10; Paridade DESCONHECIDA/G1; Blockers SEC-01, BAK-01, G1/G2, hPanel, Sonar.

## Pré-A4 — release + A1 reconfirmado (2026-09-06)

- Release PR #38 (`develop → main`) mergeado: `ac2e834`; UI stack em `main` **success**
  (run 34011022081, 6m32s). PRs #35/#36/#37 fechados como MERGED pelo GitHub.
- **A1 reconfirmado, sem delete necessário:** sandbox `br-summer-dream-ayewlgx2`
  já havia sido destruído em 2026-09-05 (commit `148c04d`, before/after em
  `implementation/branches-{before,after-sandbox-delete}.json`); `list-branches`
  via `neon-drill-ops` em `main` (run 34011025296, 2026-09-06T04:15Z) lista só
  `production` + `develop` — sandbox ausente; `br-floral-pond-ayltjy2t` idem (cleanup).
- ESTADO DO SUBSTRATO: Tráfego inexistente; Neon fixture-free, snapshot até
  2026-10-10; Paridade DESCONHECIDA/G1; Blockers SEC-01, BAK-01, G1/G2, hPanel, Sonar main neutral.

## C-03 — veredito BAK-01 pós-drill C-02 (2026-09-07, RAT S0; working tree, sem commit)

- Drill C-02 (seis passos): trio `dump.pgc` válido (N-6, sha verificado) +
  restore efêmero + reconcile 26/26 diff 0 + journal 11/11; `backup-verify`
  exit 1 por causa isolada (178 linhas `grant` ausentes no restore — artefato
  das flags sancionadas `--no-owner --no-privileges`; zero divergência em
  tabelas, policies, constraints, índices, roles). STOP ratificado aplicado:
  sem PS-S5; cleanup `always()` cumprido (só production+develop restantes).
- Veredito duplo: (1) compensatório NÃO COMPROVADO neste drill (reabrir por
  decisão humana: aceitar-com-causa + reparo de grants no runbook, ou
  re-drill com privilégios); (2) PITR VIOLAÇÃO ABERTA (6h; upgrade existe,
  não contratado).
- Cláusula N-10, verbatim:
  > Cláusula de tráfego DP2: BAK-01 reabre no carimbo "Tráfego: EXISTE"
  > salvo PITR≥7d ativo (dump lógico não satisfaz RPO≤15min com writes).
- Evidência: `docs/evidence/pós-rat-2026-09-07/` (C-02, C-03, PS-S1/PS-S6).

## C-02A/B - re-drill com grants e STOP RLS (2026-09-08, working tree, sem commit)

- A1 implementado em `scripts/db/grant-repair.ts`, derivado do coletor de
  `backup-verify.ts:67-77`: roles-before-grants, 178 grants faltantes,
  sem criação de senha/role LOGIN ausente; 5 testes unitários com tmpdir.
- Caso (a): nova branch `restore-2026-09-07-c02a-repair` criada com
  `expires-at`, restore sancionado, reparo **PASS**, `backup-verify` exit 0
  (`comparison.pass`, `journal.pass`, `read_only=true`), reconcile 26/26
  diff 0. Probe H-07 abortou na fase PROBE com `42P01` (**DESCONHECIDO**;
  negações RLS não comprovadas). Cleanup com prova concluído; só
  production+develop restantes.
- Duas falhas consecutivas (probe `42P01` + diagnóstico shell sem execução)
  acionaram STOP. Sem retry; caso (b) privilegiado **NÃO EXECUTADO** e sem
  resultado presumido. `PS-S5` **NÃO EMITIDO**; `PS-S6` permanece selo de
  parada. Evidências: `docs/evidence/pós-rat-2026-09-07/C-02A-repair-stop-report.md`,
  `C-02B-experiment-not-run.md`, `PS-S5-status.md`.
- N-10 permanece inalterado: BAK-01 reabre no carimbo "Tráfego: EXISTE"
  salvo PITR≥7d ativo. BAK-01a (restore/RLS) e BAK-01b (PITR/RPO) seguem
  abertas; T1-T3/T7/OP-H não iniciados.

## E-CUSTÓDIA — proveniência e reconstrução (2026-09-08, working tree, sem commit)

- **NOTA DE PROVENIÊNCIA E4 (permanente):** recebido = sistema + algoritmos
  fontes via handover do sócio. NÃO recebido = credenciais Supabase, conta
  Lovable, export de dados; custódia do domínio A VERIFICAR antes do dia-D.
  Origem Lovable/Supabase sob custódia de terceiro — o programa nunca a
  operou. Instância: `docs/evidence/custodia/E4-proveniencia-2026-09-08.md`;
  template: `docs/specs/M-02/decisions/M02-D-008-E4-nota-proveniencia-template.md`.
- **D2 FECHADO** (inobtenível por custódia) · **V2b APOSENTADO** (ressuscita
  pontualmente só em rodada de import ad hoc) · evidência `curl 000`
  SUPERSEDIDA pelo fato de custódia.
- **G1(a) pronta com causa CUSTÓDIA** (memo §6, `M02-D-008-G1-memo.md`):
  aguarda apenas assinatura do operador; SUNSET 20/09 DISSOLVIDO; template E3
  emitido (`M02-D-008-E3-declaracao-socio-template.md`, não-bloqueante).
- **Addendum E2** (`emenda-2026-09-08-42-13-reconstrucao.md`): §42 itens 2,3,6
  (acepção legacy) N/A-por-decisão; §§13.4/13.6 com semântica de
  reconstrução; fase C = declaração de limite de custódia. **E5**
  (addendum ADR-023): PG 17 vigente, PG 18 recusado.
- **Fase A:** A3 feito (`rls-probe-errors.mjs` fail-loud + 4 testes; causa
  42P01 segue DESCONHECIDA com dono); A1/A2 prontos e BLOQUEADOS (env sem
  `DATABASE_*`; branch efêmera exige autorização explícita). **Fase B:**
  BLOQUEADA até causa confirmada. **Fase C:** varredura 2026-09-08 concordante
  (2 branches, snapshot até 10/10 porém STALE p/ frescor, PITR 6h, 36 tabelas).
  **Fase D:** D1 publicada; D2 bloqueada até D0 (plano+token+MCP+domínio).
- Paridade: DESCONHECIDA por spec até assinatura G1(a); então NÃO-APLICÁVEL.
  N-10 verbatim inalterado. Sem commit (H1 é a ponte).

## Registro de operador — 2026-09-12 (cutover-window)

- **SEC-01 FECHADA** (atestação do operador, registro por delegação explícita
  autorizada em sessão): as 5 credenciais de `neon-storage.env` foram revogadas
  no emissor; risco residual encerrado para fins do gate `sec01-fechada`.
- **Change-freeze — errata 2026-09-13 (S-ALIN P1-5):** são **dois instrumentos distintos**, e a redação anterior os confundia:
  - **(i) freeze de deploys N-1 = `M02-D-009`** (`docs/specs/M-02/decisions/M02-D-009-change-freeze.md:6,8-10`): janela normativa **A5 0h → B3** (1–2 semanas), **NÃO INICIADA** — a A5 só abre com o dia-D. Merges em `develop` permitidos; exceção única = hotfix de segurança **com go/no-go do operador registrado no ledger**.
  - **(ii) guard de migração da Emenda #3** = janela de 2 h `2026-09-12T02:05:00Z–04:05:00Z` (`NEON_MIGRATION_FREEZE_START/END`) — **expirada**; é o guard do `db:migrate`, **não** o freeze.
  - **Redeploy de preview do H-6 (salvar env + Reimplantar):** fica **FORA** do `M02-D-009` (A5 não iniciada) e **FORA** da janela do guard (expirada). Registrado aqui como **go/no-go explícito do operador** para o redeploy de _preview_, com a ressalva expressa: **não** autoriza tráfego de produção nem apontamento de domínio — isso é CP-G3/dia-D.
  - **EXECUTADO** (2026-09-12T02:44Z): G1 transcrito por delegação explícita
    (registro abaixo); `db:migrate` com guard `ALLOW`/`cutover-window` **exit 0**
    — **0011 aplicada**; `m02:role-membership` exit 0 (`has_set_membership`
    `false→true`, sem superuser/BYPASSRLS); `smoke:substrate` **7/7 PASS**
    (`journal-count` 12/12, `journal-hashes` 12 reconciliados); `m02:readiness`
    **PASS 8/8** pós-migração. Evidências em `docs/evidence/cutover-2026-09-12/`.
  - **Estado:** Neon production em **12/12 migrations**; tráfego de aplicação
    **ainda NÃO EXISTE** (deploy/homologação hPanel pendente de env vars).
    `HEAD` = `5dae04cffd6f10ac7a42e192a6f4a81a9ca154ce`
    Latest state marker parent = `5dae04cffd6f10ac7a42e192a6f4a81a9ca154ce`
- **Nota operacional (2026-09-12T02:38Z):** o working tree voltou a apresentar
  `drizzle-kit ^0.18.1` + lock reescrito após o resume da sessão, sem log npm
  correspondente; restaurado ao HEAD + `npm ci` (0.31.10) antes deste registro.
  Causa não determinada; conferir `grep '"drizzle-kit"' package.json` antes de
  cada gate/commit.

## Rodada de produção — 2026-09-12 (F-GIT/F-VER/F-HP/F-NEON/F-REPO/F-CONS)

- **CP-G1 executado:** PR develop→main mergeado em 2026-09-12T03:15:40Z após checks
  verdes; **`main` = `ef2110e7315e568348d083c944ea6cc65778f646`** (SHA final do dia-D);
  CI verde nos 3 pushes da rodada (`34665381651`, `34668574247`, `34668707268`).
- **F-NEON:** 12/12 migrations; smoke 7/7; readiness 8/8; trio pós-cutover em
  `.artifacts/backup-drill/2026-09-12-pos-cutover/` (sha256 `a8d35646…`); snapshot
  nativo `snap-tiny-smoke-ayc382ji` válido até 2026-10-10.
- **F-VER (interino):** alias público `preco-que-da-lucro-sage.vercel.app` verde
  (live/ready/get-session 200, 03:07–03:08Z); alias canônico 404 DEPLOYMENT_NOT_FOUND;
  deployment medido sob SSO; inventário dependente de token (H-2).
- **F-HP:** DOCMAP parcial (3 páginas oficiais: itens 1, 2, 11 e parcial 6) + GAP-DOC
  material (Hostinger não tem rollback por commit); Web App n/12 aguardando
  `~/.config/hpanel-secrets.env` (H-1, watcher armado).
- **F-REPO:** dois episódios de drift `drizzle-kit ^0.18.1` (02:38:55Z e 02:58:54Z);
  causa não estabelecida — LIMITE DECLARADO (dono: Douglas); guard `m02:lockfile-guard`
  proposto (não wired); working tree restaurado ao HEAD + `npm ci` (0.31.10).
- **Supervisão:** S-SEC CLEAN; S-TEC OK com notas (1 P1 de janela PITR corrigido no memo);
  S-ALIN DESVIO parcial (2 P1 corrigidos). Artefatos em
  `docs/evidence/subagents/*-2026-09-12.md`.
- **Consolidação:** `docs/evidence/F-CONS-consolidacao-2026-09-12.md`; G-VER-v2 pronto
  para assinatura (H-3); fila humana H-1..H-5 instrumentada; dia-D sem data.
- **F-HP (parcial, 2026-09-12 04:2x–04:5xZ):** Web App Node **PREVIEW criado**
  (`darkgray-pony-545965.hostingersite.com`) com preset Nitro, branch `main`, Node 24.x,
  root `./`, build padrão Nitro e **11 env vars** (CP-G2 CLEAN pelo S-SEC; valor de
  `DATABASE_URL` mascarado no painel — evidência do item 11). 1º build **FAIL —
  `EBADENGINE`**: Node do alvo `v24.6.0` < `>=24.15.0` exigido pelo `engines` (item 1 do
  runbook; evidência `docs/evidence/hpanel-homologacao-2026-09-12/01-node-version.md`).
  Workaround documentado pendente de sessão: `NPM_CONFIG_ENGINE_STRICT=false` (env não-secreta).
- **F-HP LIMITE DE SESSÃO (H-6):** após a rajada de navegações, o Cloudflare passou a
  desafiar o contexto automatizado (headed + 45s não resolveram; cookies válidos até
  15/09) — sem contorno de autenticação. Detector `h6-watch.sh` armado; retomada
  automática quando o dono renovar a sessão no Firefox. Detalhe em
  `docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md`.
- **F-VER (token):** criação de token pela UI iniciada; o formulário exige scope+expiração
  e o combobox customizado resistiu ao clique automatizado — pendente de nova rodada
  (não bloqueia o dia-D).
- **F-NEON:** trio fresco pós-cutover `.artifacts/backup-drill/2026-09-12-fresco/`
  (`sha256 352f9ff4…`).

---

## Rodada de produção — 2026-09-12/13 (F-3 · F-6 · F-1 · F-2 · F-4 + supervisão)

- **F-3 NEON (prontidão):** journal **12/12**; RLS **26 tabelas / 30 políticas** (número canônico
  atual — a expectativa anterior "20/20" fica como GAP-DOC a reconciliar no docmap, não como falha);
  1 conexão (ocioso, só a sessão MCP); TTFF via MCP **630/635 ms**; `current_setting` de retenção
  indisponível por SQL (valor vigente **21600 s**, **BAK-01b ABERTO**); snapshot trio **agendado**
  para <24 h do go-live (não executado). Artefato `docs/evidence/neon-prontidao-2026-09-13.md`
  (sha256 `2aa31feb4db7…`).
- **F-6 VERCEL (probes sem token):** interina `-sage` live/ready/get-session **200/200/200**
  (2026-09-13T01:01:24–27Z; `ready` com `postgres: ok`); alias canônico **404 DEPLOYMENT_NOT_FOUND**
  (sem mutação); **SHA auto-deployado NÃO VERIFICADO** — depende de H-2. Artefato
  `docs/evidence/vercel-probes-interina-2026-09-13.md` (sha256 `e46fc7b396ed…`).
- **F-4 LEDGER/MEMÓRIA:** achado **INFRA-MEM-01** (warning do `pi-hermes-memory`; P1 operacional,
  ABERTO, dono Douglas) + regra permanente **estado crítico só em artefato versionado; memória do
  agente é redundância, nunca fonte**; arqueologia do lockfile `drizzle-kit` com timestamps e limite
  declarado (`docs/evidence/agent-infra-findings-2026-09-12.md`, sha256 `e0e0b77efcf4…`); substrato
  consolidado (`docs/evidence/substrato-estado-2026-09-12.md`, sha256 `9be8a79f00d4…`);
  `m02:matrix:check` **PASS**; `m02:state:check` FAIL-por-desenho até esta entrada.
- **F-1 ENGINES (ADR-028, PROPOSTA/DRAFT):** checklist 24.6→24.15 fechado com **2 blockers** — o `engines` **declarado** do root (`>=24.15.0`) e um **piso oculto em `jsdom@30.0.1`** (dev, `^22.22.2 || ^24.15.0 || >=26.0.0`), que **sobrevive** ao relaxamento do root; nenhuma API > 24.6.0 no código; runtime/build de produção compatível com 24.6.0. Artefatos: `docs/adr/ADR-028-node-engines-24-6-fallback.md` (sha256 `7f3fb2cff52d…`) e `docs/evidence/engines-reconciliation-2026-09-12.md` (sha256 `aa62292ca8a7…`, fonte da verdade do checklist). **Ratificação = ato humano H-7** (novo na fila); o fallback D3-ii só vale com H-7 ou com o critério de saída (a) — seletor do painel oferecer 24.15+.
- **F-2 RUNBOOK DIA-D:** ordem dura (vars → reimplantar → domínio → SSL → probes canônicos →
  integridade de e-mail) + rollback R1–R7 + template A5 0h/24h/72h com baseline numérica e
  critérios de abort por janela; status **ARMADO / NÃO EXECUTÁVEL**
  (`docs/runbooks/dia-d-2026-09-12.md`, sha256 `b4e478da1239…`).
- **F-HP (H-6 parcial):** em 2026-09-13T00:55:03Z o `jwt` mudou (dono renovou a sessão no Firefox),
  mas a sondagem automatizada foi **desafiada de novo** pelo Cloudflare → item **PARADO** por
  protocolo (2 falhas consecutivas) → caminho manual de ~2 min publicado em `SESSION-LIMIT.md`.
  Detectores armados: `app-live` (health 200) e `h6-watch` (mudança de `jwt`). Último poll do
  `app-live`: 2026-09-13T00:49:43Z, `http=404` (build ainda não sobe).
- **Supervisão transversal (2026-09-13):** S-SEC **CLEAN** — 0 P0/P1; 5 P2 de endurecimento, sendo 1 aplicado (janela de validade do `jwt` removida de `SESSION-LIMIT.md`; hash/valor nunca transcrito). S-ALIN **DESVIO: 0 P0 · 5 P1**, todos corrigidos nesta entrada: P1-1 → P9 (BAK-01b) + N-10 nos critérios de abort 0h do runbook; P1-2 → bullet F-1 + H-7 acima/na fila; P1-3 → proveniência do `matrix:check` (comando + timestamp + HEAD `e0c8ec44…`) corrigida em `agent-infra-findings`; P1-4 → **errata** na célula hPanel do `G-VER-v2-memo` (app criado + build FAIL), antes de qualquer coleta de assinatura H-3; P1-5 → errata do freeze acima. P2 fechados: pipes do ADR-028 escapados; `AGENTS.md` → ADR-028 (proposta); `GAP-DOC-RLS-01` nomeado; `GAP-DOC-ENGINES-01` no registro do docmap; vereditos anexados abaixo. Artefatos: `docs/evidence/subagents/S-{SEC,ALIN}-2026-09-13.md`.
- **F-7 CONSOLIDAÇÃO:** `docs/evidence/F7-consolidacao-2026-09-13.md` (sha256 `a33899bec59b…`) — tabela de frentes + vereditos, fila humana (H-2/H-4/H-5/H-6/**H-7**), dia-D estimado em **2026-09-15/16** e top-3 riscos (BAK-01b · sessão hPanel · rollback sem commit). Vereditos de supervisão arquivados: S-SEC `d3d963b8f129…` · S-TEC `7238e4c8135d…` · S-ALIN `b6a58489c4d4…`. **Nota de higiene de hash (S-ALIN §verificações item 2):** os prefixos acima foram **recalculados após todas as correções pós-supervisão** — hashes medidos antes de uma edição não valem para o arquivo entregue.
- **Versionamento de evidências (higiene de rastro):** os **124 artefatos** de rodadas anteriores em `docs/evidence/**` (2026-08-29..09-09) que estavam **fora do git** foram versionados em commit único — todos os 17 diretórios são **citados por docs rastreados** (1–6 refs cada) e 115 arquivos estavam órfãos de versão (CI não os via). Removidos os rascunhos locais `.m02-review-tmp{,2}/` (1 linha cada, apenas _nome_ de env var). Varredura de conteúdo antes do commit: nenhum valor de segredo/credencial; `.gitignore` segue excluindo `artifacts/logs/snapshots/raw/private/secrets/credentials` dentro de `docs/evidence/**`.
- **Trabalho ilhado inventariado (higiene de rastro):** o worktree aninhado `.p0-closeout-docker` (excluído pelo `.gitignore:57`; branch `codex/p0-closeout`, base `aed4c37` = 2026-08-15) carregava **24 pendentes** — 22 modificados + 2 novos, ~**+685/−118** linhas de um **lote P0 de 2026-08-19** (contratos financeiros, taxonomia de erro, logging/redaction, IA + 9 arquivos de teste), com **~81% (252/312) das linhas adicionadas ausentes de `develop`** e **sem branch remoto**. **Ação:** commit `c0ef351` + publicação do branch **WIP** `codex/p0-closeout` (não é PR; `main`/`develop` intocados; merge exigirá port/rebse sobre base 4 semanas mais nova). **Varreduras:** 0 credencial real (único hit = fixture de redaction em `db.example`); 0 artefato de build/pasta de política no staging; 2 adicionados + 22 modificados conferidos.
- **Risco residual (higiene separada, NÃO tratado nesta rodada):** 15 worktrees do Codex (`~/.codex/worktrees/*`, **82–115 pendentes cada**) e 3 em `~/pre-a4-work` (2–10) seguem como trabalho/artefato ilhado do mesmo tipo — inventário e triagem exigem rodada dedicada.
- **Vercel — deploy FAIL do WIP diagnosticado e corrigido (2026-09-13, frente paralela):** e-mail do Vercel ao dono disparou a inspeção no painel (sessão do dono, **um navegador**). Deployment `3uf5t5CtT4STAa4Dkj7EquVBjrRe` do branch `codex/p0-closeout` @ `c0ef351` = **Error em 13 s** com `Build Failed — No Output Directory named "dist" found after the Build completed`; **todos** os deploys de `develop` da rodada (`97d5f24`…`a3d5db7`) e o de produção (`ef2110e`, `main`) = **Ready** (13–19 s); alias interino `-sage` seguiu servindo. **Causa raiz [MEDIDO]:** a revisão do WIP (base 2026-08-15, 158 commits atrás) tinha `nitro: { preset: "node-server" }`; é o preset `vercel` sob `VERCEL=1` (commit `f386d72`, 2026-09-09) que emite a **Build Output API** (`.vercel/output`) — sem ela o preset de framework do projeto (`TanStack Start`, importado do Lovable) exige `dist` e o build falha. **Correção:** commit `49eaf2b` no WIP (só `vite.config.ts`, +3/−2) → novo deployment **Ready em 18 s** ✅; `develop`/`main` intocados; **nenhuma** mudança de configuração no painel (`Ignored Build Step` segue `Automatic`). **Config registrada:** Node `24.x` · Framework Preset `TanStack Start` · Build/Output/Install **sem override** · retenção de deploys com erro 30 dias. **Risco latente:** o projeto depende da Build Output API — qualquer caminho de build que não a emita reproduz o mesmo erro; a config vive só no painel (drift de repositório, registrar em evidência conforme AGENTS.md).
- **FASE J — PROGRESS-JOURNAL instituído (2026-09-13):** criado `docs/evidence/agent-state/PROGRESS.md` (handoff entre sessões; **apenas ponteiros** — caminhos, SHAs, timestamps, _nomes_ de env; nunca valores) com protocolo explícito: intenção `▶` **antes** da mutação, resultado `✔`/`✘` depois (append-only), intenção órfã ⇒ o próximo boot **reconcilia antes de agir**, marcos commitados a cada fronteira de fase (perda máxima = reexecutar desde o marco, declarada). Protocolo de boot (~30 s: journal → marcador parent-pinned → watchers → reconciliar → retomar) e a regra "**memória de agente é cache invalidável** — nada que vá para artefato/journal entra nela" gravados em `AGENTS.md`. Motivo: INFRA-MEM-01 (memória saturada — 497% no escopo de projeto e 322% no de falhas — com auto-review em `parse_error`/`timeout`); podagem (J5) pendente com métrica antes/depois.
  Latest state marker parent = `368ef37ec9536e5be90b5ff04b9e5a18020e2aef`,

### Back-merge obrigatório `main → develop` (AGENTS.md:12-14)

- **Verificação:** `git merge-base --is-ancestor origin/main develop` → **NÃO era ancestral** (main `ef2110e7`, merge do PR #44, tinha avançado a linha de release) ⇒ back-merge **PENDENTE** e exigido pela norma.
- **Ação:** merge `--no-ff origin/main` → **`6f2a392d648fc610953d00a4ddaa04f05715a41c`** (estratégia `ort`, sem conflito; árvore de conteúdo idêntica) — registrado nesta entrada. A partir daqui `main` é ancestral de `develop`.
- **Consequência imediata:** nenhuma de conteúdo; publica a sincronia e evita reploy de configuração defasada (incidente do PR #42 citado em `AGENTS.md:12-14`).

### Supervisão transversal — resultado e limite declarado (2026-09-13)

- **S-SEC:** **CLEAN** — 0 P0 / 0 P1; 5 P2 de endurecimento, 1 aplicado (janela de validade do `jwt` removida de `SESSION-LIMIT.md`; hash/valor nunca transcrito). Veredito independente replicado pelo orquestrador com `grep` (único hit = o próprio padrão de grep dentro do runbook) e `npm run m02:secrets-audit` = `COMPLETE_WITH_LIMITS` com `failures: []`. Artefato: `docs/evidence/subagents/S-SEC-2026-09-13.md`.
- **S-ALIN:** **DESVIO — 0 P0 / 5 P1 / 4 P2**, todos corrigidos ou endereçados nesta rodada: P1-1 → **P9 (BAK-01b) + N-10** nos critérios de abort 0h do runbook; P1-2 → bullet **F-1** + **H-7** (ratificação do ADR-028) registrados; P1-3 → **proveniência** do `matrix:check` (comando + timestamp + HEAD) corrigida em `agent-infra-findings`; P1-4 → **errata** na célula hPanel do `G-VER-v2-memo` (app criado + build FAIL) antes de qualquer coleta de assinatura H-3; P1-5 → **errata do freeze** (M02-D-009 = A5 0h→B3, não iniciado × guard de migração de 2 h, expirado) + go/no-go explícito do redeploy de preview do H-6. P2: pipes do ADR-028 escapados; `AGENTS.md` → ADR-028 (proposta); `GAP-DOC-RLS-01` nomeado; `GAP-DOC-ENGINES-01` registrado no docmap. Artefato: `docs/evidence/subagents/S-ALIN-2026-09-13.md`.
- **S-TEC:** **DESVIO — 0 P0 · 1 P1 material · 4 P2**, materialmente **corrigidos nesta rodada**: o **P1** derrubou a alegação central do probe de auth do runbook (`GET /api/auth/get-session` **não** prova a troca de `BETTER_AUTH_URL`: `originCheckMiddleware` do better-auth **retorna cedo em GET/HEAD/OPTIONS** — `node_modules/better-auth/dist/api/middlewares/origin-check.mjs:44` — e `auth-policy.ts:35-45` só exige existência + origem https, que o host de preview também satisfaz) → o runbook §1.6 foi reescrito para o que o probe **de fato** prova (`≠200 ⇒ ABORT` segue correto; `200` **não** é prova), com **asserção discriminante (c1)** obrigatória (host do link de reset pelo canônico) e **(c2)** explícita para o caso `RESEND_*` ausente (`auth_baseurl_verified: false` ⇒ critério de abort do 0h). P2 corrigidos: hipótese do `engine-strict` sobre nó `devOptional` rotulada em ADR-028 §2.1 e no checklist (com prova equivalente da via (ii) no §8.6); `reset`+push removido do GAP-DOC do R3 (vedado por ADR-017); regra herdada do drill reescopada (mutações via npm script; probes read-only sancionados). Veredito do ADR-028 isolado: **OK with notes** (§1–§8 conferem com o lock e o código; §8 executável). Artefato: `docs/evidence/subagents/S-TEC-2026-09-13.md`.
- **Gate local (pré-push):** `npm run check` executado no HEAD `6f2a392` — primeira passagem **reprovou em `format:check`** por **198 arquivos NÃO rastreados** (evidências de rodadas anteriores no worktree; o CI, que só vê rastreados, estava limpo) — corrigido com `prettier --write` no worktree; `m02:lockfile-guard` PASS; `m02:state:check` PASS em `d2cc4e9`. **Lição registrada:** `npm run check | tail -N` mascara o exit code (o 0 vinha do `tail`); conferir sempre `PIPESTATUS`/sem pipe.
