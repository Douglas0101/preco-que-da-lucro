# EXECUÇÃO ONDA 0 — painel de supervisão (2026-09-13)

**Plano:** `docs/evidence/plan-partials-2026-09-13/PLANO.md` · **Base:** C1 `42d4b76` · **Fechamento:** HEAD da onda.
**Método:** enxame com 3 operadores (WIP), 1 worktree/branch por operador, manifests exclusivos do supervisor,
verificador adversarial independente por integração (V1–V5), token DB e marcador parent-pinned por commit. Sem push.

## 1. Integrações

| Int. | Item                                | Operador | Commit do operador | Merge em develop | V         | Gates de integração                                     | Evidência                                                        |
| ---- | ----------------------------------- | -------- | ------------------ | ---------------- | --------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| I1   | §27 registry + checker + runbook    | O2       | `bf6fa77`          | `a3ba381`        | V1 PRONTO | 12/12, 3 testes, prettier, lockfile                     | `migration-classification-2026-09-13.md`                         |
| I2   | §35 template + gate                 | O3       | `53f09e4`          | `f29e3da`        | V2 PRONTO | 3 testes (negativo reproduzido), prettier               | `_templates/performance-evidence.md`                             |
| I3   | F0-04 baseline + `ai.model_attempt` | O1       | `ee4855d`          | `f765406`        | V3 PRONTO | prettier, typecheck, 11 testes, raw versionado          | `perf-controlled-2026-09-13/report.md`                           |
| I4   | §32 SQLi adversarial                | O4       | `ffc23e3`          | `0d07260`        | V4 PRONTO | 6 payloads × 2 caminhos, controle positivo, idempotente | `sql-injection-2026-09-13.md`                                    |
| I5   | §32 fixação + AUTH-005 A+B          | O5       | `c032c00`          | `29804a6`        | V5 PRONTO | auth OK, OAuth boundary OK, 8 testes, zero outbound     | `session-fixation-2026-09-13.md`, `oauth-boundary-2026-09-13.md` |

**Gates finais no HEAD** (com override local `127.0.0.1` exigido pelo env-guard): `npm run check` **EXIT 0**;
`npm run db:test` **EXIT 0** (8 suítes, incluindo os 2 testes novos na cadeia).

## 2. Resultado

- **5 PARTIALs fechados**: F0-04, §27, §35, §32 SQLi, §32 fixação → crédito **77,8% → ~79,1%**.
- **AUTH-005**: verificação de runtime A+B concluída (state/PKCE/redirect/scopes/origem, zero rede);
  **residual D** (OAuth client real no Google Cloud) segue humano.
- `AGENTS.md` atualizado com os dois gates novos; `db:test` agora roda `db:classify:check` + SQLi + OAuth boundary.

## 3. BUG-CHAT (descoberto pelo O1, confirmado por V3 — pré-existente, severidade alta)

- **Sintoma:** chat 100% quebrado no runtime HTTP; erro responde **200** e mascara a falha.
- **Causa:** `AbortSignal.any([identity.signal, …])` com `identity.signal === undefined`
  (`src/lib/chat-execution.server.ts:488`); `RequestIdentity.signal` vem de `src/middleware/request-context.ts:70`
  e o dispatch HTTP de server function do TanStack não injeta `signal` (o tipo do framework declara, o runtime não).
- **Fix mínimo sugerido:** `signal: options.signal ?? request.signal` em `request-context.ts:70` (e no mesmo ponto
  de `requireDatabaseAuth`, `:119`), + e2e que clique em "Enviar" no `/novo-produto` (hoje nenhum teste cobre o caminho HTTP).
- **Fora do escopo da Onda 0** — registrado aqui para hotfix imediato.

## 4. Resíduos e observações

1. **Higiene do banco local:** o `e2e:prepare` do harness F0-04 deixa usuários `example.test` no DB de teste e o
   down da 0010 é fail-closed (`2 conta(s) presentes`); `db:test` local exige DB limpo — recriado nesta rodada.
   Próximo harness deve usar schema/DB próprio ou purgar ao final.
2. **Preview/build:** split circular de `createCsrfMiddleware` exige pré-import do chunk SSR no harness (meta.json);
   não aparece renderizado no `report.md` (só em `meta.notes`) — corrigir no renderer quando o F0-04 repetir.
3. **AUTH-005 D** e **H-4/H-6** continuam na fila humana (sem mudança).
4. `AGENTS.md` é prettier-ignored (pré-existente); o teste do §27 fixa a contagem 12 — ao criar a 0012, atualizar
   registry + literatura do teste no mesmo passo (a schema lane da Onda 1 já prevê).
5. Trabalho de código da onda: `src/lib/chat.functions.ts` (log), `src/test/*` (2 testes), `scripts/db/*` e
   `scripts/perf/*`; nenhuma dependência nova; lockfile intocado.

## 5. Próximos passos

1. **Hotfix BUG-CHAT** (operador único, escopo 2 arquivos + e2e) — aguardando aprovação.
2. **Onda 1** (dados/arquitetura): 9.2 → Audit → 14.3 (migration 0012) → Conversation → T2 (0013) → BFF split → Pricing → contracts.
3. **Ondas 2–4** conforme `PLANO.md`, decisões abertas: RUM persistido, spike schema-only, exports N/A.

## 6. Hotfix BUG-CHAT (I6) — executado após a aprovação

| Int. | Item                                      | Operador | Commit do operador | Merge     | V         | Gates                                                                                |
| ---- | ----------------------------------------- | -------- | ------------------ | --------- | --------- | ------------------------------------------------------------------------------------ |
| I6   | BUG-CHAT: fallback `request.signal` + e2e | O6       | `bd0a768`          | `d6f5706` | V6 PRONTO | e2e vermelho→verde reproduzido por V6 (4/4, exit 0); 444 testes, typecheck, prettier |

- **Fix:** `request-context.ts` — `signal: options.signal ?? request.signal` e `signal: signal ?? request.signal`; cobre
  chat e tool-runner (únicos construtores de contexto); `??` preserva signal existente (inclusive abortado).
- **Regressão:** e2e `BUG-CHAT` em `e2e/ui-stack.spec.ts` (POST `/_serverFn/` com probe único; assere ausência de
  `signals[0]`/`TypeError`, status < 500 e recuperação da UI); vermelho pré-fix registrado (200 mascarando TypeError).
- **Evidência:** `docs/evidence/bug-chat-fix-2026-09-13.md`. Residual: gateway real não coberto (verde usa `DEPENDENCY_ERROR`).
