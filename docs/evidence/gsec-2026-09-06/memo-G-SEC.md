# G-SEC T3 — Memo de decisão: garfo BLOCKER-GOV-01 (2026-09-06)

## Contexto em uma linha

O git-gate Mimosa L3 impede commits do AGENTE enquanto houver findings high;
a triagem T1 concluiu 13/13 FALSO-ALARME técnico (união gate-inline 12 + selado
11), e o gate **só liga no ambiente do agente** (bind provado em
`triagem-achados.md` §T0.2).

## G-SEC SIGNATURE (preencher para destravar)

```
- Decisão: [ ] (a) rodada de fix   [ ] (b) commit manual agora   [ ] (c) reconfig gate
- Combinação (se (b)+(a)): [ ] b-then-a
- Nome (humano, legível): ____________________
- Data (UTC): ____________________
- Assinatura: ____________________
```

## Opções — custo, risco e calendário (números, não adjetivos)

### (b) Commit manual pelo operador — AGORA

- **Custo humano**: ~10–15 min (2 commits + 1 bloco de ledger mecânico —
  `manifests-commit.md` traz os comandos prontos).
- **Risco**: baixo — os artefatos já passaram gates locais (check completo em
  main; lint/typecheck/prettier nos novos arquivos); zero segredo nos manifests
  (conferido contra `m02:secrets-audit`).
- **Destrava**: Fase 0 versionada HOJE (06/09); matriz H-xx passa a ser a spec
  oficial do dia do cutover; `m02:state:check` volta a PASS após o bloco de
  ledger.
- **NÃO destrava**: commits futuros do agente — o gate continua negando até os
  findings saírem da árvore (aqui entra (a)).
- **Calendário**: cutover segue pôlo hPanel (10–11/09) → A4 estimado 11–12/09;
  G1 sunset 20/09 seguro.

### (a) Rodada de fix (consome a triagem como spec) — na sequência de (b)

- **Custo agente**: ~2–4 h de rodada, distribuídas: SSRF host-allowlist em
  `chat.functions.ts` (~30 min + testes) · SSL `rejectUnauthorized` em 2
  scripts (~15 min) · refactors cosméticos para zero-finding em
  testes/auth.tsx/kit python (~1–2 h, **opcional — só se o critério for
  zero-finding**) · ENV-GUARD + POOL + WARN-NITRO (specs T2, ~1 h).
- **Loop de verificação barato**: o scan via MCP custa **~5 s por iteração e
  não exige commit** — a rodada itera `security_scan` até `findingCount = 0`
  ANTES de pedir commit humano.
- **Risco**: moderado-baixo — toca 6–8 arquivos, nenhum em caminho de pagamento;
  testes 368/368 como rede;auth.tsx não muda comportamento.
- **Destrava**: autonomia de commit do agente (fim do BLOCKER-GOV-01 como
  classe); rodadas futuras (rls-probe, env-guard, pool) viram PRs normais.
- **Calendário**: cabe em 1 dia útil (07/09); não empurra o cutover (pólo
  continua hPanel).

### (c) Reconfiguração/exclusão do gate

- **Custo**: desconhecido — a documentação do plugin (`commands/mimosa-scan.md`)
  não prevê triagem/baseline: "高危: 必须修复". Explorar config não documentada
  = esforço aberto + risco de enfraquecer proteção real (os 12 achados são
  falsos-positivos HOJE, mas a regra pega casos genuínos — ver eficácia no
  momento em que bloqueou `m02-readiness.ts` com command-injection de verdade
  durante a Fase 0).
- **Risco**: alto de policy-drift; recomendado NÃO como caminho primário.
- **Se ainda assim escolhida**: documentar exclusão por regra+arquivo (nunca
  global), com emenda datada e revisão pós-A4.

## Recomendação

**(b) agora + (a) em seguida** — compõem-se: (b) entrega a Fase 0 em 15 min
sem esperar a fix; (a) elimina o blocker como classe e mantém o gate útil (ele
já demonstrou valor real ao barrar command-injection genuína durante a Fase 0).
(c) descartada como primária.

## Loop declarado (estado esperado, não regressão)

Até o commit landing: `m02:state:check` = **FAIL** (marker parent-pinned
ausente — a entrada proposta em `manifests-commit.md` o conserta) e
`m02:readiness` = **INCOMPLETE (exit 2)** (substrate DESCONHECIDO sem
`DATABASE_ADMIN_URL` no env do agente; g1/sec01/freeze FAIL reais). Nenhuma
rodada deve "corrigir" esses vermelhos por atalho — são o estado honesto do
congelamento.

## Calendário consolidado (recompute do caminho crítico)

| Data         | Evento                                                                   | Ramo        |
| ------------ | ------------------------------------------------------------------------ | ----------- |
| 06/09 (hoje) | Bloco humano 30 min: hPanel login + SEC-01 revogação + G1 assinatura     | todos       |
| 06–07/09     | (b) commit manual dos manifests → Fase 0 versionada                      | todos       |
| 07/09        | (a) rodada de fix (se aprovada) → BLOCKER-GOV-01 encerrado               | recomendado |
| 07–10/09     | PRs normais do agente: rls-probe, env-guard, pool, WARN-NITRO            | (a)         |
| 10–11/09     | Desbloqueio hPanel (prazo do pedido) — PÓLO do caminho crítico           | todos       |
| 11–12/09     | **Cutover A4** (T-0: readiness verde + matriz impressa + snapshot dupla) | todos       |
| 20/09        | **G1 sunset** — seguro em todos os ramos (assinatura no bloco de 06/09)  | todos       |
| +24h/72h     | A5 janelas + B3 (keep-warm: opção (i) aceitar; revisar com dados)        | todos       |

Se o hPanel não desbloquear até 11/09: NO-GO persiste, sem regressão — abort
documentado continua sendo entrega válida; G1 sunset em 20/09 passa a ser o
segundo pólo.
