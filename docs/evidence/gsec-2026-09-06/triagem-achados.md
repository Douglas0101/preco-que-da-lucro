# G-SEC T0+T1 — Inventário reconciliado e triagem decision-grade (2026-09-06)

Rodada analítica: **nenhum fix de código**; read-only sobre `src/`; a triagem É a
spec da rodada de fix. Evidência reproduzível: comandos + saídas + timestamps;
scan selado fresco como âncora.

## T0.1 — Scans e reconciliação (o primeiro achado da rodada)

| Superfície                                                            | Quando                 | Total  | High   | Medium | Loc. únicas | Divergência                                                                     |
| --------------------------------------------------------------------- | ---------------------- | ------ | ------ | ------ | ----------- | ------------------------------------------------------------------------------- |
| Gate inline L3 (mensagem de `git commit`)                             | 18:12–20:59 (repetido) | 12     | 11     | 1      | 11          | INCLUI `src/test/auth-policy.test.ts:48/55` · EXCLUI `forensic_validate.py:154` |
| Scan selado 18:35 (`scan-…c16585454925`, seal `ee81f4d2…`)            | 18:35:03Z              | 11     | 10     | 1      | 10          | idem do selado                                                                  |
| **Scan selado fresco 20:57 (`scan-…52eec2a0353a`, seal `c3eb7dfd…`)** | 20:57:46Z              | **11** | **10** | **1**  | **10**      | idem                                                                            |

- **Discrepância 11/12 resolvida:** 11 = total do scan selado; 12 = total da
  mensagem do gate inline. As superfícies usam escopos de regra diferentes: o
  gate inline varre **testes** (`auth-policy.test.ts` aparece; o selado exclui —
  mesma convenção de exclusão do `m02:secrets-audit`), e o selado cobre o
  arquivo Python (`scripts/forensic/`) que o inline não reportou.
- **Discrepância 7/8 resolvida:** era contagem narrativa da rodada anterior
  (triagem vs falso-alarme sem base exata). Inventário canônico desta rodada:
  **13 instâncias de finding @ 12 localizações únicas** (união das duas
  superfícies; `chat.functions.ts:144` tem 2 findings: high `fetch ssrf` +
  medium taint cross-file).
- Consequência prática: o que bloqueia o commit é a **lista do gate inline**
  (12). Limpar só o selado pode não limpar o gate se os testes seguirem no
  escopo dele — a rodada de fix deve iterar contra AMBAS as superfícies (o gate
  roda a cada tentativa de commit; o selado via MCP custa ~5 s/iteração).

## T0.2 — Bind do hook (com evidência; sem burlar)

| Pergunta          | Evidência                                                                                                                                                  | Conclusão                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Onde o gate vive? | `hooks.json` do plugin Mimosa 1.0.3: hooks **PreToolUse** com matcher `Bash` e `Edit\|Write\|MultiEdit` — executam só dentro de tool calls do agente ZCode | Gate = camada do agente   |
| Hook git nativo?  | `ls .git/hooks/` (2026-09-06 ~20:58): **apenas `*.sample`**, nenhum hook ativo                                                                             | Nenhum gancho git         |
| `core.hooksPath`? | `git config --get core.hooksPath` → vazio (exit 1)                                                                                                         | Sem redirect de hooks     |
| Teste documentado | `git commit` pelo agente negado repetidamente (finding-ledger `batch-pretooluse-*`); nenhum commit executado                                               | Comportamento consistente |

**Conclusão: o gate bloqueia SOMENTE o ambiente do agente.** Um committer humano
(terminal próprio, GitHub UI) não passa por ele. **Opção (b) do garfo é viável.**
Nota: os findings continuam na árvore — qualquer scan futuro os vê até a fix.

## T1 — Triagem por achado (13 instâncias @ 12 localizações)

Formato: veredito sob leitura adversarial · blast radius · menor correção segura ·
teste da correção.

| #   | Localização (regra, sev)                                                                            | Veredito                                                 | Justificativa                                                                                                                                                                                       | Blast radius                           | Fix mínimo                                                                                                            | Teste                              |
| --- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `src/routes/auth.tsx:223` (hardcoded-credential CWE-798, high)                                      | **FALSO-ALARME**                                         | `<Input type="password" value={password} autoComplete="current-password">` — binding de formulário; nenhum literal de credencial                                                                    | Nenhum (UI)                            | Nada essencial; se o critério for zero-finding, refactor cosmético (extração do literal)                              | typecheck + e2e auth               |
| 2   | `src/test/auth-policy.test.ts:48` (hardcoded-credential, high — só no gate inline)                  | **FALSO-ALARME**                                         | Senhas-fixture de teste unitário (`hashSync("senha-legada-segura", 4)`) — vetores do teste de migration de hash, não segredos                                                                       | Nenhum (teste)                         | Cosmético: constantes geradas/helper                                                                                  | `npm run test`                     |
| 3   | `src/test/auth-policy.test.ts:55`                                                                   | **FALSO-ALARME**                                         | idem                                                                                                                                                                                                | idem                                   | idem                                                                                                                  | idem                               |
| 4   | `scripts/forensic/forensic_validate.py:154` (insecure-deserialization CWE-502, high — só no selado) | **FALSO-ALARME**                                         | `yaml.load(block, Loader=UniqueSafeLoader)` com `class UniqueSafeLoader(yaml.SafeLoader)` (linha 82) — semântica de `safe_load` (sem construção de objetos) + detecção de chave duplicada           | Nenhum (validador local, sem rede)     | Cosmético se exigido zero-finding                                                                                     | Suite do kit (`unittest discover`) |
| 5   | `scripts/db/backup-verify.ts:159` (sql-injection advisory, high)                                    | **FALSO-ALARME**                                         | Interpola SOMENTE identificadores do catálogo (`pg_tables`) com escape `quote()`; valores nunca interpolados; taint apontada = connection string (env), que define o alvo, não o texto SQL          | Scripts admin read-only                | Opcional: assert regex de identificador antes do `quote()`                                                            | `m02:backup-verify` em drill       |
| 6   | `scripts/db/backup-verify.ts:160`                                                                   | **FALSO-ALARME**                                         | idem                                                                                                                                                                                                | idem                                   | idem                                                                                                                  | idem                               |
| 7   | `scripts/db/explain-evidence.ts:158` (sql-injection advisory, high)                                 | **FALSO-ALARME**                                         | `drop index if exists ${index}` com `index` de array **constante do próprio script**; `query.params` ligado à parte                                                                                 | Script de diagnóstico local            | Opcional: assert de identificador                                                                                     | Execução local docker              |
| 8   | `scripts/db/migrate.ts:91` (sql-injection advisory, high)                                           | **FALSO-ALARME**                                         | `prepareLegacySalesTotals` = SQL 100% literal; único `format('%I')` usa `current_user` (valor do servidor)                                                                                          | Migração admin idempotente             | Nada essencial                                                                                                        | `db:test`                          |
| 9   | `src/middleware/request-context.ts:63` (sql-injection, high — input HTTP real)                      | **FALSO-ALARME**                                         | `x-tenant-id` → `uuid.safeParse` (Zod) ANTES da query → drizzle `sql` template = **parametrizado**; nenhum `sql.raw`; zona allowlistada M-02 (`auth`)                                               | Path de auth (mais crítico) — mitigado | Nada essencial; testes adversariais existem                                                                           | Manter cross-tenant tests verdes   |
| 10  | `src/lib/chat.functions.ts:144` (fetch ssrf, high)                                                  | **FALSO-ALARME no estado atual + hardening recomendado** | `endpoint = process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions"` — fonte é env de operador, não input HTTP; SSRF exigiria atacante no env (== servidor comprometido) | Chamada de saída do chat               | **Host allowlist** na origem: `new URL(endpoint)` → host permitido + negar loopback/privado — um guard derruba #10–13 | Unit: nega `169.254.169.254` etc.  |
| 11  | `src/lib/chat.functions.ts:192`                                                                     | **FALSO-ALARME + hardening idem**                        | Mesmo endpoint repassado                                                                                                                                                                            | idem                                   | idem                                                                                                                  | idem                               |
| 12  | `src/lib/chat.functions.ts:234`                                                                     | **FALSO-ALARME + hardening idem**                        | idem (2 hops = mesma origem)                                                                                                                                                                        | idem                                   | idem                                                                                                                  | idem                               |
| 13  | `src/lib/chat.functions.ts:144` (medium, taint p/ `src/server.ts:54`)                               | **FALSO-ALARME**                                         | `server.ts:54` é o handler do servidor Nitro — a cadeia confunde o `fetch` do handler com sink; fonte segue env                                                                                     | Nenhum                                 | Cai com o guard do #10                                                                                                | idem                               |

**Contagem final: 13/13 FALSO-ALARME técnico**, com **hardening real barato
recomendado em #10–13** (host allowlist) e refactors cosméticos opcionais em

# 1–4 **somente se** o critério do garfo for zero-finding no scanner. Nenhuma

VIOLAÇÃO real; nenhum DESCONHECIDO remanescente (proofGaps dos advisories
fechados por inspeção de dataflow).

## T1.B — Inventário extra (achados da rodada, fora do scan)

| Item                                        | Onde                                                                                                                            | Por quê                                                                                                                          | Plano                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `rejectUnauthorized: false`                 | `scripts/smoke/substrate-smoke.ts:32` · `scripts/db/purge-fixtures.ts:162` (não-local) · sondas `/tmp` da Fase 0 (fora do repo) | MitM na conexão admin ao Neon (scripts; o runtime `src/db/client.server.ts` NÃO — serverless TLS default)                        | Alinhar ao padrão `backup-verify.ts:33` (`rejectUnauthorized: true` p/ não-local; cadeia Let's Encrypt no trust store do Node). Rodada de fix |
| `.env` do checkout aponta para **produção** | `.env` (gitignored): `DATABASE_URL`/`DATABASE_URL_UNPOOLED` → `ep-long-violet-aye9g0bn(-pooler)`                                | Hazard estrutural: `vite dev` e scripts que auto-carregam `.env` tocam produção; proteção atual = checagem manual (insuficiente) | **ENV-GUARD default-deny (T2, prioridade máxima)** + recomendação de split/renome do `.env`                                                   |
| `gate.env` do agente de gates               | `/tmp/pqd-main-wt-gates/gate.env` (fora do repo; segredo gerado)                                                                | Risco zero de versionamento; higiene                                                                                             | Não versionar; destruído com o worktree                                                                                                       |

## T1.C — Cross-ref com exceções M-02 (`matrix.overlay.yaml` + `excecoes.md`)

| Achado                       | Zona M-02                                                       | Plano único                                                                                                                |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| #10–13 (SSRF chat)           | `transient-bff-chat-self` (`chat.functions.ts`, alvo **M02-3**) | **Fix único**: na migração M02-3, aplicar host-allowlist e remover a exceção no mesmo PR — M02-3 herda o work mapeado aqui |
| #5–8 (SQL admin scripts)     | allowlist `infra: scripts/**` ("tooling/migrations, nunca UI")  | Sem conflito; hardening opcional não altera exceções                                                                       |
| #9 (request-context)         | allowlist `auth: src/middleware/request-context.ts`             | idem                                                                                                                       |
| #1–4 (UI/testes/kit forense) | Fora de zonas transient                                         | Fixes cosméticos isolados                                                                                                  |

## Comandos de reprodução (evidência T1)

```
sed -n '48,58p' src/test/auth-policy.test.ts           # #2/#3 fixture de hash
sed -n '215,228p' src/routes/auth.tsx                  # #1 input de senha
sed -n '82,107p' scripts/forensic/forensic_validate.py # #4 UniqueSafeLoader(yaml.SafeLoader)
sed -n '21,38p' scripts/db/backup-verify.ts            # #5/#6 quote() + rejectUnauthorized:true
sed -n '25,60p' scripts/db/explain-evidence.ts         # #7 constantes locais
sed -n '25,60p' scripts/db/migrate.ts                  # #8 SQL literal
sed -n '19,45p' src/middleware/request-context.ts      # #9 Zod + sql template parametrizado
sed -n '120,248p' src/lib/chat.functions.ts            # #10-13 endpoint de env
grep -rn "rejectUnauthorized" src scripts --include="*.ts"
```

Leituras executadas 2026-09-06 20:58–21:05 (−03). Referência selada:
`scan-2026-09-06T20-57-46.503Z-52eec2a0353a` (seal `sha256:c3eb7dfd…e39676`),
findings.json com 11 findings, `totals: {high: 10, medium: 1}`.
