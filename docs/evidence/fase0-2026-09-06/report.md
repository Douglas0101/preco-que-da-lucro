# Fase 0 A4 — Período de espera investigativo + Portão GO/NO-GO (2026-09-06)

Rodada executada sob "INVESTIGAR SEM IMPROVISAR": toda investigação pré-declarada
(matriz H-xx), todo resultado classificado em SDD, saída válida = relatório de
prontidão com abort documentado. **Veredito do portão: NO-GO.** Fase 1 (cutover)
não inicia. Nenhuma escrita no Neon de produção; única mutação remota = branch
efêmera Neon (criada → medida → deletada).

## 1. GO/NO-GO e o que travou

| Critério do portão        | Estado    | Detalhe                                                                                                                                                                                                                                                                      |
| ------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hPanel acessível          | **NO**    | BLOCKER-EXT-01: BLOCKED-AUTH (`auth.hostinger.com/login`); pedido ao operador com prazo de 3 dias úteis (enviado 2026-09-05, vence ~10–11/09)                                                                                                                                |
| G1 assinada               | **NO**    | Bloco `G1 SIGNATURE` do memo M02-D-008 vazio (verificado por `m02:readiness`); sunset **2026-09-20**                                                                                                                                                                         |
| SEC-01 fechada            | **NO**    | Revogação no emissor (OpenAI + S3) das 5 credenciais de `neon-storage.env` — ação humana pendente                                                                                                                                                                            |
| Runbook A4 publicado      | **YES**   | `a4-a5-cutover.md` + `hpanel-homologacao.md` (11 itens) + rollback app-level                                                                                                                                                                                                 |
| Gates verdes              | **YES\*** | Em main/ac2e834: ui-stack, no-supabase, format, lint, typecheck, **test 368/368**, build, bundle, m02:matrix, m02:boundaries (0 ocorrências), secrets-audit — todos PASS; \*exceto `m02:state:check` (higiene de ledger — marker ausente para HEAD; entrada proposta pronta) |
| Snapshot executável AGORA | **YES**   | Dump externo em `.artifacts/backup-drill/20260905202420/` (22,1h, sha256 `f5659573…1893`); snapshot nativo `snap-tiny-smoke-ayc382ji` válido até 2026-10-10; `m02:backup-verify` + drill completo = passo T-0 do dia                                                         |
| G2                        | pendente  | Não bloqueia (ADR-027 §6; sem assinatura vale M02-D-006) — declarado                                                                                                                                                                                                         |

**Bloqueio adicional da rodada (achado fora da matriz):** o git-gate Mimosa L3
bloqueia **qualquer `git commit`** do agente enquanto houver 11 achados high + 1
medium **pré-existentes** no projeto (scan selado
`scan-2026-09-06T18-35-03.677Z-c16585454925`, seal `sha256:ee81f4d2…fcf`, não
serve de baseline; documentação do plugin exige correção + re-scan). Entrega
versionada (PRs/ledger) abortada e documentada — bundle em
`bundle-gate-mimosa-l3/`. Dono do desbloqueio: operador (rodada de triagem
dedicada, commit manual ou reconfig do gate).

## 2. Cobertura da matriz H-xx

Matriz publicada em `docs/runbooks/a4-matriz-hipoteses.md` (H-01…H-14), com
sonda exata, esperado, slot de evidência e mapeamento 11/11 itens de homologação

- smoke A4 a–e. **Nenhum H sem sonda desenhável**; nenhum improviso. Execução
  das sondas de homologação exige hPanel (bloqueado) — H-01…H-11 permanecem
  PENDENTES para o dia do cutover. Sondas de parâmetros já executadas:

- H-08 (cold start Neon): TTFF via pooler, 3 amostras com compute suspenso
  confirmado antes de cada uma: **1637 / 1727 / 2480 ms** (branch efêmera
  `br-dark-dust-ayz5vfeg`, criada 18:13:49Z e deletada 19:54:27Z; produção
  intacta). Alvo de cold start ainda não fixado → B3.
- H-06 (parâmetros de pool): `max_connections = 901`, PG **17.11**,
  `history_retention_seconds = 21600` (6h — BAK-01 reconfirmada), auto-suspend
  observado ~304–322 s (default 300 s). Pool do runtime segue sem `max`
  explícito (`src/db/client.server.ts`, default 10) — pré-configurar valor no
  PR-B subsequente. `pg_stat_activity` = 10 conexões na sonda.
- H-12/H-13 (journal/fixture-free): smoke 7/7 PASS como parte do `test`/gates em
  main é substituto local; verificação remota oficial segue sendo
  `smoke:substrate` no dia (DATABASE_ADMIN_URL ausente do env local →
  `DESCONHECIDO` honesto no readiness).
- DESCONHECIDO declarado: suspend via API (POST proibido — só GET; mitigado com
  auto-suspend observado); rota direta `/endpoints/{id}` do CLI (rota
  `/projects/{id}/endpoints` usada); domínio de produção + TTL (sem nome
  documentado — dono: humano).

## 3. Tabela SDD

| Categoria                          | Qtde | Itens                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CONFORME                           | 8    | Runbook A4 c/ snapshot obrigatório + validade; emenda B3/B4 já existente (alvos §29/§46); gates de main (10 PASS, 368 testes); pooler confirmado; secrets-audit sem chaves novas; dump externo + snapshot nativo executáveis; branch efêmera criada/deletada com leak-check 0 hits; matriz H-xx publicada                   |
| FALSO-ALARME                       | 5    | "baseline Supabase stale" (emenda já existe); "boundaries FAIL 26" (resolvido: 0 em ac2e834); "main ac2e834" (correto p/ origin/main — drift era main local, corrigido por ff); 4–5 achados do scan Mimosa (senhas-fixture de teste ×2, `<Input type="password">` ×1, identifier-quoting com `quote()` em backup-verify ×2) |
| GAP-DOC                            | 4    | Categoria "probe de monitoramento" (→ emenda escrita em `excecoes.md`); `m02:readiness` inexistente (→ script pronto); domínio/DNS/TTL não documentados (dono humano); **WARN-NITRO-001 expirado em 2026-09-01** (build quebra se o warning retornar — re-registrar com data)                                               |
| VIOLAÇÃO                           | 0    | —                                                                                                                                                                                                                                                                                                                           |
| DESCONHECIDO                       | 4    | Suspend explícito via API; rota CLI `/endpoints/{id}`; alvo de cold start (B3); H-06 sob tráfego real (baseline 0h do dia)                                                                                                                                                                                                  |
| ACHADO FORA DA MATRIZ (bloqueante) | 1    | Gate Mimosa L3 bloqueia commits do agente (detalhe: `artifacts/mimosa-l3-block.md`)                                                                                                                                                                                                                                         |

Fail de homologação com bundle: nenhum (homologação nem iniciou — hPanel).

## 4. RLS — residual §42 (com evidência?)

**Não respondido em runtime — declarado.** A negação cross-tenant como
`app_runtime` só se exercita no smoke A4 a (grants não são provados por
pg_dump `--no-privileges`). A sonda `m02:rls-probe` está **desenhada** na
matriz (design + cleanup + purge + re-verificação fixture-free; alternativa
zero-escrita documentada) e é o candidato a script da próxima rodada
pré-cutover. Evidência indireta do dia: role `app_runtime` sem superuser/BYPASSRLS
e RLS 20/20 tabelas tenant (smoke em main); `neondb_owner` tem `rolbypassrls =
true` (esperado para admin — sonda 0.3). O residual §42 permanece **aberto até
o smoke A4**.

## 5. Baseline 0h

**Não aplicável** (sem cutover). Referências pré-cutover já coletadas e
utilizáveis: TTFF Neon suspenso 1,6–2,5 s; `max_connections` 901; bundle 272.793 B
min / 84.888 B gzip (initial graph 468.038 B min); 368 testes; snapshot externo
`20260905202420` (sha256 `f5659573…`); snapshot nativo até 2026-10-10.

## 6. Checklist pós-operatório

**N/A — declarado** (não há 0h sem cutover). O checklist completo
(A–F) está no protocolo da rodada e será executado no dia com `m02:readiness`
verde + matriz impressa + bundle pronto.

## 7. Deltas das janelas A5

**N/A** — A5 não iniciou (sem deploy). Zero escritas em produção nesta rodada
(únicas sondas: SELECT/SHOW read-only + branch efêmera já deletada).

## 8. ESTADO DO SUBSTRATO (bloco fixo)

> ESTADO DO SUBSTRATO: Tráfego inexistente; Neon production fixture-free (26/26
> zero, smoke 7/7, journal 11/11, PG 17.11; snapshot válido até 2026-10-10);
> Paridade DESCONHECIDA/G1; Blockers SEC-01, BAK-01, G1/G2, hPanel, Sonar main
> neutral. **Inalterado nesta rodada.**

## 9. Top-3 riscos das próximas 72h

1. **G1 sunset 2026-09-20 (T-14d):** sem assinatura, paridade permanece
   DESCONHECIDA e o A4 não tem decisão de origem. Mitigação: assinar o bloco
   `G1 SIGNATURE` no memo M02-D-008 (5 min, humano).
2. **Gate Mimosa L3 bloqueia commits do agente:** qualquer rodada que precise
   versionar está travada. Mitigação: rodada de segurança dedicada para triar
   os 12 achados (5 prováveis falsos-positivos + 7 triagem: SSRF ×3+1, SQL ×4)
   - re-scan; **ou** commit manual pelo operador; **ou** reconfig do gate.
     Inclui `substrate-smoke.ts`/sondas com `rejectUnauthorized: false` na triagem.
3. **Prazo do hPanel (pedido 09-05, 3 dias úteis ≈ 10–11/09) + SEC-01:** sem
   login no hPanel, cutover slippa; SEC-01 segue risco residual humano.
   Mitigação: único bloco humano — login hPanel (com o texto pronto de
   `hpanel-request.md`), revogação OpenAI/S3, assinatura G1.

## Anexos — entregáveis e evidência

**Prontos no working tree (não commitados — gate L3):**
`docs/runbooks/a4-matriz-hipoteses.md` (matriz H-xx) · `docs/specs/M-02/excecoes.md`
(emenda "probe de monitoramento") · `scripts/m02-readiness.mjs` ·
`scripts/m02-forensic-bundle.ts` · `package.json` (2 scripts). Locais:
`docs/forensic-kit.md` §10 (addendum bundle operacional) · este diretório
(`artifacts/`, `bundle-gate-mimosa-l3/`, `SHA256SUMS`).

**Comandos prontos (pós-desbloqueio):**
`git checkout -b docs/pre-a4-fase0-matriz` + commit dos 2 docs → PR-A;
`git checkout -b scripts/m02-readiness-gate` + commit dos 2 scripts +
package.json → PR-B; depois entrada no ledger com
`Latest state marker parent = <HEAD^>` e ESTADO DO SUBSTRATO inalterado
(entrada proposta: "Fase 0 A4 — prontidão + portão NO-GO (2026-09-06)").

**Estado do `m02:readiness` hoje:** `INCOMPLETE` (exit 2) — substrate
DESCONHECIDO (sem `DATABASE_ADMIN_URL` local), matrix/boundaries/snapshot PASS,
state/g1/sec01/freeze FAIL (estados reais). É o gate do dia do cutover: PASS
só com tudo verde.
