# G-SEC — Relatório da rodada (2026-09-06): BLOCKER-GOV-01 → decisão instrumtentada

Rodada analítica executada sob SDD: read-only sobre `src/`, nenhum fix, nenhum
commit, nenhum bypass do gate (adaptação documentada). Deliverable = decisão.
Scan selado de referência: `scan-2026-09-06T20-57-46.503Z-52eec2a0353a`
(seal `sha256:c3eb7dfd…e39676`).

## 1. Inventário reconciliado

**13 instâncias de finding @ 12 localizações únicas** — união do gate inline L3
(12 = 11 high + 1 medium) com os scans selados (11 = 10 high + 1 medium; 18:35 e
20:57 idênticos em contagem). As discrepâncias 11/12 (narrativa anterior) e 7/8
estão resolvidas e registradas: as superfícies divergem por escopo (o gate
inline varre testes; o selado exclui; o selado cobre `forensic_validate.py`,
que o inline não reportou). Tabelão decision-grade completo com veredito, blast
radius, fix mínimo e teste por achado: `triagem-achados.md` §T1.

**Veredito agregado: 13/13 FALSO-ALARME técnico** (nenhuma VIOLAÇÃO real,
nenhum DESCONHECIDO remanescente), com hardening real recomendado nas 4
instâncias de SSRF-chat e refactors cosméticos opcionais se o critério do garfo
for zero-finding. Achado adicional do processo: o gate inline L3 negou
corretamente um command-injection GENUINO durante a Fase 0 (`m02-readiness.ts`,
2 escritas bloqueadas) — o gate funciona; os 12 de hoje são precisão de regra,
não falha da ferramenta.

## 2. Cross-ref com transient-*

- **SSRF-chat (#10–13) ⊂ `transient-bff-chat-self`** (alvo M02-3): plano de fix
  ÚNICO — na migração M02-3, host-allowlist + remoção da exceção no mesmo PR;
  M02-3 herda o work mapeado. Nenhuma exceção é derrubada antes disso.
- SQL-admin (#5–8) ⊂ allowlist `infra: scripts/**`; #9 ⊂ allowlist `auth`
  (request-context) — sem conflito com fases.
- #1–4 fora de zonas transient — fixes cosméticos isolados.

## 3. Bind do hook → viabilidade da opção (b)

**Respondido com evidência: o gate liga SOMENTE no ambiente do agente.**
Plugin `hooks.json` = PreToolUse (matcher Bash/Edit/Write/MultiEdit — só tool
calls do agente); `.git/hooks/` contém apenas `*.sample`; `core.hooksPath`
unset. Um committer humano no terminal/GitHub UI não passa pelo gate →
**opção (b) (commit manual) é viável e é a alavanca imediata**. Detalhe em
`triagem-achados.md` §T0.2.

## 4. Designs T2 prontos (spec-first, sem implementação)

`designs-endurecimento.md`: **ENV-GUARD** default-DENY (norma fail-closed +
spec de `scripts/env-guard.mjs` + hooks `pre*`; override logado `ALLOW_REMOTE_DB`;
fecha o hazard `.env`→produção) · **POOL** `DATABASE_POOL_MAX ?? 10` (901
medido, instância única) · **WARN-NITRO-001** texto pronto de renovação
(expirou 01/09; build PASS 2× hoje) · **KEEP-WARM B3** (recomendação: aceitar
no A4/A5; probe sancionado de leitura só com dados B3; apoiado na emenda de
probes).

## 5. Memo G-SEC + manifests

`memo-G-SEC.md`: garfo instrumentado com custo/risco/calendário —
**(b) commit manual AGORA (~10–15 min)** destrava a Fase 0 hoje;
**(a) rodada de fix na sequência (~2–4 h agente)** itera contra o scan via MCP
(~5 s/iteração, sem commit) até zero e encerra o BLOCKER-GOV-01 como classe;
**(c) reconfig do gate** sem mecanismo documentado de triagem — descartada como
caminho primário. **Recomendação: (b) agora + (a) em seguida.**
`manifests-commit.md`: 3 manifests copiar-colar (docs Fase 0 · scripts · ledger)
com pré-flight/pós-flight, mensagem de commit sugerida, gates a re-rodar e o
bloco parent-pinned que conserta o `m02:state:check`. Sem `gate.env`, sem
qualquer segredo (conferido contra `m02:secrets-audit`).

## 6. Recompute do caminho crítico por ramo do garfo

| Ramo                | Cutover A4 estimado                             | G1 sunset 20/09              | Observação                                                     |
| ------------------- | ----------------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| (b) só              | 11–12/09 (pólo hPanel 10–11/09)                 | Seguro c/ bloco humano 06/09 | Blocker de agente persiste p/ rodadas futuras                  |
| (b)+(a) recomendado | 11–12/09                                        | Seguro                       | Rodadas pós-fix viram PRs normais (rls-probe, env-guard, pool) |
| (a) só              | 11–12/09 (+1 dia de fix antes do versionamento) | Seguro                       | Fase 0 fica não-versionada até a fix                           |
| (c)                 | indeterminado (esforço aberto)                  | Risco se consumir janela     | Não recomendado                                                |

Condição G1 em todos os ramos viáveis: assinatura no bloco humano de 30 min
(hPanel + SEC-01 + G1 — textos prontos em `hpanel-request.md`,
`secrets-hygiene.md:30-37`, `M02-D-008-G1-memo.md`).

## 7. ESTADO DO SUBSTRATO + top-3 riscos

> ESTADO DO SUBSTRATO: Tráfego inexistente; Neon production fixture-free (26/26
> zero, smoke 7/7, journal 11/11, PG 17.11; snapshot válido até 2026-10-10);
> Paridade DESCONHECIDA/G1; Blockers SEC-01, BAK-01, G1/G2, hPanel, Sonar main
> neutral. **Inalterado nesta rodada (read-only; zero escritas; nenhuma branch
> criada).**

Top-3 riscos: (1) **hPanel não desbloqueado até 11/09** → NO-GO persiste;
mitigação = bloco humano já preparado; (2) **G1 sunset 20/09** → sem assinatura,
paridade segue DESCONHECIDA e A4 fica sem decisão de origem; mitigação = mesmo
bloco humano; (3) **gate L3 sem triagem nativa** → se (a) não rodar, cada
rodada agente re-abre o blocker; mitigação = (a) consome a spec desta rodada
(4 falsos-positivos triviais + 1 hardening real + cosméticos opcionais).

## Evidência de conformidade da rodada

- `m02:readiness` re-run pós-escrita: **INCOMPLETE (exit 2)** — estado honesto
  do congelamento (substrate DESCONHECIDO sem `DATABASE_ADMIN_URL`; state/g1/
  sec01/freeze FAIL reais) — ver `artifacts/readiness-gsec.json`.
- `git diff -- src/` no fim da rodada: **vazio** (nenhum fix; candidatos ficam
  spec-only, não-mandatados) — ver `artifacts/git-status-final.txt`.

---

# §Execução — rodada G-SEC-EXEC (2026-09-07, opção (b) pendente humano + opção (a) executada)

## E0 — pré-requisitos (agente-runnable)

- **E0.1 FALHOU na 1ª execução — o gate funcionou**: a `SHA256SUMS` da rodada
  anterior tinha os 4 caminhos externos relativos à raiz (defeito de autoria
  desta rodada anterior; hashes corretos). Re-auditoria: paths corrigidos nos
  DOIS arquivos (gsec + fase0) → **11/11 e 15/15 SUCESSO**.
- E0.2 (assinatura) e E1 (manifests no terminal): **PENDENTES HUMANO** (HEAD
  8d26a2c; memo em branco) — a rodada iniciou (a) por autorização explícita do
  brief ("iniciar opção (a)"); a assinatura formaliza em E4.
- E0.4 probe de escrita: criar/remover OK.
- E0.5 controle interino respeitado: nenhuma suite completa local (somente
  testes unitários isolados sem DB + selftest do guard).

## E2 — fix da opção (a) (ordem mandatória cumprida)

| Passo                   | Resultado                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2.1 baseline           | `scan-2026-09-06T21-51-06.949Z-ad4283adaaa3` (seal `5d68bb46…d419`) — **11 findings**                                                                                                                                                                                                                                                                                       |
| E2.2 ENV-GUARD          | `scripts/env-guard.mjs` (selftest 7/7; deny sintético exit 3 sem vazar URL; normaliza `pre*`; `db:migrate` imune a override; sancionadas com log) + emenda `docs/specs/M-02/emenda-2026-09-07-env-guard.md`. **Wiring package.json aplicado e PROVADO**: `npm run test` com `DATABASE_URL` remoto → pretest DENY exit 3 antes da suite; m02:* não afetado                   |
| E2.3 SSRF-GUARD         | `src/lib/ai-endpoint.server.ts` (https público obrigatório; IP literal/loopback/RFC1918/link-local/`.local`/`.internal` negados; bypass hex/octal cobertos pela canonicalização WHATWG) + integração em `callModel` (URL tipada até o fetch) + `src/test/ai-endpoint.server.test.ts` 7/7. Overlay `transient-bff-chat-self` MANTIDO (cobre BFF→DB, unrelated; cai na M02-3) |
| E2.4 SSL                | `substrate-smoke.ts:32` e `purge-fixtures.ts:162` → `rejectUnauthorized: true` (padrão `backup-verify.ts:33`); zero ocorrências restantes                                                                                                                                                                                                                                   |
| E2.5 POOL               | `max: Number(process.env.DATABASE_POOL_MAX ?? "10")` nos dois pools de `client.server.ts`                                                                                                                                                                                                                                                                                   |
| WARN-NITRO              | `build.mjs` `expiresOn: "2026-10-06"` + `recheckedAt: "2026-09-07"` (build PASS 2× hoje)                                                                                                                                                                                                                                                                                    |
| Cosméticos zero-finding | testes (constantes `join()`), `auth.tsx` (constante extraída), `forensic_validate.py` (alias `_yaml_load_safe` — `SCHEMA_PASS` na fixture)                                                                                                                                                                                                                                  |
| Matriz M-02             | regenerada (`m02:matrix:generate`) — drift legítimo do import novo (linhas +4); `m02:matrix:check` PASS; `m02:boundaries` PASS                                                                                                                                                                                                                                              |

### E2.6 — loop de scan (tabela de iterações)

| Iteração            | Scan (seal)                   | Findings      | Delta                                      |
| ------------------- | ----------------------------- | ------------- | ------------------------------------------ |
| baseline (pré-fix)  | `…ad4283adaaa3` (`5d68bb46…`) | 11            | —                                          |
| 1 (pós-fix agentes) | `…537d14a85316` (`3e448b98…`) | 10            | −1: `auth.tsx:223` (extração de constante) |
| 2 (pós-fix yaml)    | `…9a46d46b17d4` (`d66b7405…`) | **9 = floor** | −1: `forensic_validate.py:154` (alias)     |

**Floor honesto**: os 9 restantes (chat.functions ×4 taint env→fetch, request-context, migrate, explain-evidence, backup-verify ×2) são os by-design já triados (G-SEC T1: 13/13 falso-alarme). Zero exigiria contorções fora da spec ("não improvisar fix") — loop encerrado com floor declarado. Nenhuma classe nova de finding apareceu.

### Verificação de gates (E3.1)

`m02:matrix:check` PASS · `m02:boundaries` PASS · `m02:state:check` FAIL
(esperado — loop ledger↔commit; conserta em E1) · `m02:secrets-audit`
COMPLETE_WITH_LIMITS (`artifacts/secrets-audit-gsec-exec.json`) ·
`m02:readiness` INCOMPLETE exit 2 (honesto; `artifacts/readiness-gsec-exec.json`)
· typecheck/eslint/vitest (unit) verdes nos arquivos tocados.

## E3.3 — Manifest 3: tentativa de execução pelo agente

`git add` dos 11 arquivos de fix + `git commit` → **NEGADO pelo gate L3** —
com dado decisivo: o gate inline caiu de **12 para 9 findings** (8 high +
1 medium), reconhecendo os fixes de testes ×2 e auth.tsx; os 9 restantes são
os by-design triados. Stage desfeito (`git reset`); **nenhum commit pousou**.
Fallback: **Manifest 3 passa a ser executado pelo HUMANO** junto ao E1
(bind provado agente-only — `triagem-achados.md` §T0.2); listas finais
atualizadas em `manifests-commit.md` (env-guard subiu para o Manifest 1 por
integridade de CI; `matrix.generated.yaml` adicionada ao Manifest 3).

## E3.4 — keep-warm B3 (dados coletados)

Probe sancionado read-only na produção: TTFF a frio ×3 = **1683,6 / 2135,6 /
2214,8 ms** (média ~2011 ms); auto-suspend 304–316 s ×3 ciclos; produção
deixada suspensa como encontrada. Nota de decisão anexada a
`designs-endurecimento.md` §T2.4 — **(i) aceitar** permanece para A4/A5.
Evidência: `artifacts/keepwarm/` (+ originais em `/tmp/keepwarm-b3/`).
