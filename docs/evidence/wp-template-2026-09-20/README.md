# WP-R2 — checklist anti-vacuoso no template de work package

**Work package:** `WP-R2` (Fase 0 do plano pós-Bloco 3, primeira da ordem aprovada)
**Fato-fonte:** veredictos S6 selados dos WPs 3–5 (ponteiros na §3) + análise do Bloco 3 × Plano
Mestre (2026-09-20, a ser persistida em `docs/evidence/analise-avancada-...` no WP-R0)
**Base:** `1aad70cbc` (develop pós-fecho do Bloco 3)
**Branch:** `mission/r2-wp-checklist`

---

## 1. Problema

O S6 adversarial virou **carga estrutural**: os defeitos que ele força a corrigir são, quase todos,
de **identidade do harness de prova**, não de código de produto. Só entre os WPs 3–5, o recorte de
**7 defeitos materiais de harness** está na §3; pela taxonomia do template (CORR + N corrigidos),
o custo total dos três WPs foi **17 correções forçadas — 3 CORR + 14 N corrigidos** (WP3: 2 CORR +
3 N; WP4: 0 CORR + 5 N; WP5: 1 CORR + 6 N), além dos N declarados. Sem um contrato de prova no WP,
cada rodada paga as mesmas lições de novo.

## 2. O que muda

| #   | arquivo                                    | mudança                                                                                                                 |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | `docs/evidence/_templates/work-package.md` | template do WP (SPEC S1 + README S5 + layout do selo) com o **checklist anti-vacuoso de 14 itens** e origens rastreadas |
| 2   | `AGENTS.md`                                | seção **Work packages (contrato de prova)**: template obrigatório, checklist, taxonomia CORR×N, bounds e onde N mora    |
| 3   | `docs/evidence/wp-template-2026-09-20/`    | este selo (SPEC + README + captures + MANIFEST)                                                                         |

Hashes dos bytes finais (R_b, pós-correções do S6; conferidos pela captura `hashes.txt`):

| arquivo                                        | sha256                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `docs/evidence/_templates/work-package.md`     | `e358638d06d05dd8e7440435806db746b859f778b92ee05d93b784bd6e97548b` |
| `AGENTS.md`                                    | `26dae6c13ad6daf91cf8b8eb18b713cc19b7326d9b7ed32198189775e6e0e034` |
| `docs/evidence/wp-template-2026-09-20/SPEC.md` | `177767d88ac5cb5d4262342054bdd971d9cf28467d12e5594f1af14c8c5791e3` |

**Nenhuma mudança de código.** O diff é documental: `docs/**` + `AGENTS.md`.

## 3. Validação — o checklist tem dentes (falsificação)

O critério não é "o template existe": é **o checklist pegar os defeitos reais que o S6 pegou**.
Rastreabilidade fiel, item a item, com a citação do veredicto:

| defeito forçado pelo S6                                       | item do checklist | citação (veredicto selado)                                                |
| ------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| WP3 — identidade da falsificação aceitava qualquer falha (N1) | **#1**, **#3**    | `d2-depth-pin-2026-09-20/captures/adversarial-wp3-verdict.md.txt` (C5/N1) |
| WP3 — restauro do runner passava com `PISO=-1` (N3)           | **#12**           | idem (N3)                                                                 |
| WP4 — GREEN decidia só por `exit==0` (N2)                     | **#4**            | `f-b-mem-purge-2026-09-20/captures/adversarial-wp4-verdict.md.txt` (N2)   |
| WP4 — GREEN sem precondição de estado (N3)                    | **#7**            | idem (N3)                                                                 |
| WP4 — revisão dos bytes não fixada (N5)                       | **#9**            | idem (N5)                                                                 |
| WP5 — sleep fixo como sincronização (N1)                      | **#5**            | `f-b1-e2e-2026-09-20/captures/adversarial-wp5-verdict.md.txt` (C2/N1)     |
| WP5 — asserção `window.va` inerte (N2)                        | **#6**            | idem (C2/N2)                                                              |

**Controle positivo (sem falso positivo):** os itens #2, #8, #10, #11, #13 e #14 foram satisfeitos
pelos próprios WPs 3–5 **depois** das correções — fronteira nas duas direções (falsificação final do
WP3), sentinela real (pré-semeio + trigger do WP4), `checked === discovered` (selos 3–5),
`0 REJECTED`/`0 UNVERIFIABLE` (os três veredictos), isolamento assertado (S7 da bateria do WP4 e do
WP5) e exits/capturas com gate (correções N4/N7 dos dois). O checklist não inventa exigência que um
WP correto não cumpra: ele nomeia o que os WPs corretos já fizeram.

**Contraprova de vacuidade:** no WP3 o par de falsificação **existia**, mas o critério de aceitação
era fail-open (item #3); no WP5 a metade `window.va` não tinha par que reprovasse (item #6) e a
detecção só valia sob o timing local (item #5). Os itens #1 e #3 existem para exigir, no ato da
escrita, o que o S6 teve de exigir depois.

## 4. Gate local e isolamento

`npm run check` exit 0 sobre os bytes finais (captura `gate-local.log.txt`), incluindo
`format:check` dos `.md` novos. Isolamento assertado pelo S7 (`s7-guard.log.txt`): sem credencial
herdada, `:5432` com 0 listeners, `origin/main` = `9724d2c`, escopo apenas `AGENTS.md` +
`docs/**`.

## 5. Riscos e limites declarados

| item                                                                       | situação                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| o checklist é prosa — não é gate automático                                | **declarado**: o enforcement é humano/S6; automatizar exigiria interpretar artefatos e viraria linter frágil |
| o template não impede reincidência sozinho                                 | declarado: ele move a lição para o autor; o S6 continua sendo a lane que reprova o que passar                |
| templates irmãos (performance-evidence, SPEC-CARDS) têm contratos próprios | declarado: este template é para **work packages** do SDD; os outros seguem onde estão definidos              |
| N6 do S6 (lacunas de cobertura: secrets/boundaries)                        | declarado: `m02:secrets-audit`/`m02:boundaries` são gate global do `AGENTS.md` e não entram no checklist     |
| `.artifacts/` fora do `ignores` do ESLint 9 flat config                    | segue declarado (WPs 1–5)                                                                                    |

## 6. Como reproduzir

```bash
# o template (14 itens + apêndices) e o pointer
sed -n '1,140p' docs/evidence/_templates/work-package.md
grep -n 'Work packages' -A4 AGENTS.md

# gate
npm run check
```

## 7. S6 ADVERSARIAL

**Revisão auditada (R_a):** template `5f901796…`, `AGENTS.md` `6a832b8a…`, README `a318704c…`.
**Método:** auditoria read-only por **subagente de contexto limpo** (substituição declarada da lane
`.pi/delegate`), veredicto selado verbatim em `captures/adversarial-r2-verdict.md.txt`.

**Veredicto:** **5 CONFIRMED · 2 CORRECTED (C2, C3) · 0 REJECTED · 0 UNVERIFIABLE.** O S6 validou os
manifests dos WPs 3–5 (16/16, 36/36, 22/22) e confirmou que os 12 itens originais tinham dentes
sobre os 7 defeitos mapeados — mas provou que **o próprio pacote contava errado** e que o selo não
cumpria o template que introduz.

**Defeitos novos e tratamento (correções na revisão final R_b):**

| achado                                                                     | tratamento                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **N1** — "7/6/0" sem aritmética; o 7º nunca nomeado; total real 17         | §1 reescrita: recorte de 7 material de harness **na §3** + total pela taxonomia (3 CORR + 14 N)            |
| **N2** — rastreabilidade §3 × apêndice inconsistente (#1 e #2)             | origens corrigidas: #1 = WP3 C5/N1 + WP5 C2/N1; #2 = WP3 C4 (sem N1); #3 = WP3 C5/N1                       |
| **N3** — "canário de memória" sem lastro                                   | rótulo trocado por **sentinela real** (pré-semeio por id fixo + trigger de probe)                          |
| **N4** — citação de "WP1 N3" (refutado no próprio selo do WP1)             | removida; #10 fica com TRILHO C §2.1 + WP2 §9 (relato do próprio selo, declarado)                          |
| **N5** — "bound 2" contradito pelo WP1 e sem consequência                  | §4 do template e AGENTS: bounds limitam **rodadas de correção de um WP**, não claims num veredicto         |
| **N6** — lacunas (H-9/isolamento, exits, capturas)                         | checklist vai a **14 itens**: #13 isolamento assertado e #14 todo check impresso com gate e captura        |
| **N7** — item #11 aceitava `UNVERIFIABLE`                                  | #11 passa a exigir `UNVERIFIABLE` declarado na §4 e não contado como verificado                            |
| **N8** — o selo não cumpria o template (sem SPEC/captures/MANIFEST/hashes) | **corrigido**: `SPEC.md` incluído, captures + `MANIFEST.sha256` no selo, tabela de hashes na §2            |
| **N9** — risco de leitura como gate automático; ambigüidade de onde N mora | AGENTS explicitou: N **corrigidos** na §7, **declarados** na §Riscos; §5 declara que não é gate automático |

As correções **não afrouxam** nenhum item do checklist: as duas de taxonomia (#11/#5 do template) e
as duas de cobertura (#13/#14) o deixam mais estrito. O SPEC do WP-R2 foi escrito na abertura e
versionado no selo.
