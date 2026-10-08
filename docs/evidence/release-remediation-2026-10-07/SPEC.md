# SPEC — release-remediation-2026-10-07 (S6-R2/N01–N04)

## 1. Origem

O candidato 1 (`1ff8a77`, PR #60) passou pela matriz de PR (84/84 Playwright) e
pelo CE de PR (87,6% OK), mas a lane adversarial S6 recusou a segunda rodada
(L748): 9 ACCEPTED / 3 REJECTED / 0 U — N02 corrigido, N01/N03 com resíduos
(PGPORT, shell) e N04 novo. A reconciliação pós-compactação (L749) provou que as
correções citadas em L746/L747 não existiam nesta árvore (reflog vazio após
`1ff8a77`, fingerprints byte-idênticos ao pacote selado) — este WP é a execução
real dessas correções, em rodada própria.

## 2. Write-set declarado (14 fontes)

1. `AGENTS.md` — balas do veredito do CE e do provisionamento da fixture Neon.
2. `.github/workflows/sonar.yml` — passo do CE: `shell: bash` + `BASH_ENV: ""`.
3. `.github/workflows/neon-pr-branch.yml` — provisionamento REST no lugar da
   action `create-branch-action`; artefato inclui `neon-pr-provision.json`.
4. `scripts/lib/m02-ci-coverage.ts` — auditoria endurecida do passo do CE.
5. `scripts/sonar/gate-readout.ts` — N03 (observação preservada) + caminho de
   saída confinado e revalidado no write.
6. `scripts/ci/prepare-neon-fixture.ts` — sem mudança nesta rodada (superfície
   do par; fingerprint prova ausência de edição).
7. `scripts/ci/neon-resource.ts` — N01+PGPORT em `assertConnectionPair`.
8. `scripts/ci/provision-neon-fixture.ts` — novo: provisionador REST.
9. `src/test/m02-ci-coverage.test.ts` — 4 mutantes novos do N02.
10. `src/test/sonar-gate-readout.test.ts` — N03 + caminho de saída.
11. `src/test/neon-fixture.test.ts` — fixtures com porta explícita; teste do
    workflow atualizado ao provisionador REST.
12. `src/test/neon-resource.test.ts` — negativos de porta/query do par.
13. `src/test/neon-fixture-provision.test.ts` — novo: hermético do provisionador.
14. `docs/adr/ADR-042-cobertura-minima-60-publicacao.md` — sem mudança nesta
    rodada (fingerprint prova ausência de edição).

## 3. Correções (N01–N04) e controles

- **N01 + resíduo PGPORT:** `assertConnectionPair` exige porta **5432
  explícita** nas duas URIs (a porta efetiva deixa de depender de `PGPORT`) e
  query **somente-sslmode** (parâmetros `host`, `hostaddr`, `port`, `options` —
  qualquer um que mova o destino — são recusados; allowlist fail-closed, não
  denylist). O provisionador fixa 5432 nas URIs que grava.
- **N02 + resíduo shell:** o passo que nomeia a release fixa `shell: bash` e
  `BASH_ENV: ""` (BASH_ENV é lido por bash não interativo mesmo com
  `--noprofile --norc`; vazio = inócuo). A auditoria recusa no passo qualquer
  `continue-on-error` (literal **ou expressão**), shell divergente, `BASH_ENV`
  não vazio e comandos que engolem erro (`|| true`, `set +e`, `set +o errexit`).
- **N03:** `readoutReport` preserva no relatório NO-VERDICT a observação já
  validada (identidade do provider + veredito bruto do CE); sem observação
  validada, o relatório não inventa evidência. O caminho de saída do relatório é
  confinado (nome constante, `RUNNER_TEMP` absoluto, sem `..`, revalidado na
  escrita) — endereçamento do alto risco apontado pelo scan de segurança.
- **N04:** provisionador REST oficial — `init_source: "schema-only"` dentro de
  `branch` (a branch criada é ROOT), pai explícito (production p/ base main,
  develop caso contrário), TTL 24h **no POST**; `branch_id` vai ao
  `GITHUB_OUTPUT` imediatamente após a criação, **antes** de esperar
  compute/URI; sem retry que caia em cópia de dados. Cada URI recebe
  `::add-mask::` na chegada (antes de qualquer arquivo privado 0600) e todo
  valor já conhecido é redigido da mensagem de erro antes de persistir; erros do
  provedor expõem somente status/código (corpo nunca). A única ocorrência
  legítima do valor é o comando `::add-mask::` em si (testado).

## 4. Verificação de API externa (pré-implementação)

Corpos de create/connection-uri confirmados na documentação oficial Neon
(`docs/guides/branching-schema-only.md`, `docs/guides/branch-expiration.md` e
`api_spec/release/v2.json` — `getConnectionURI`: `branch_id`, `database_name`
e `role_name` obrigatórios, `pooled` opcional, resposta `{uri}`); role/banco do
projeto confirmados por leitura de **nomes** (`neondb_owner`, `neondb`). Nenhuma
credencial foi obtida ou exibida; nenhuma branch real foi criada nesta rodada —
a criação real é evidência do CI, não da bancada.

## 5. Protocolo

Testes negativos primeiro (RED), depois focados (GREEN 186/186), depois
`npm run check` completo (capture em `captures/check-r6.txt`). Lane S6 R3 de
contexto limpo com exigência de 0 REJECTED antes de commit/push. Commit/push
ordinários em `develop`; `main`, rulesets e promoção Vercel seguem sem mutação
(promoção automática de produção já suspensa em L743).

## 6. Limites declarados

- A prova do provisionador é hermética (fetch/fake clock/IO injetados); a
  criação real schema-only via REST é evidência do próximo run de CI.
- `exigirAlvoDeBanco` (`scripts/lib/db-target.ts`) fica fora do write-set: a
  superfície do par é coberta por `assertConnectionPair`, executado pela
  `fixtureIdentity` antes de qualquer uso de banco no CI.
- Bound de correção: as rodadas R1/R2 pertencem ao WP do candidato 1; este WP
  inicia sua própria primeira rodada com os achados herdados (L748).
