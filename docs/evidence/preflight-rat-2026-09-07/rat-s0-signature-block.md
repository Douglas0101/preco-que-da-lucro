# RAT S0 — bloco de assinatura (preencher à mão — ato humano exclusivo)

> Documento de apoio ao §6 da proposta
> `docs/evidence/ps01-entry-2026-09-07/rat-dp5-emenda6-draft.md` e ao
> ADD-OPS transcrito neste bundle (`sdd-exec-ps01-add-ops.md`).
> Nenhum agente preenche este bloco. Preenchido o bloco, o registro vai
> para o PS-01 §6 e o selo PS-S0 para o ledger (via H1).

## 1. RAT da proposta PS-01 + ADD-OPS (fecha a lacuna 3 como "RAT S0 + Emenda #6")

- [ ] **APROVO** a proposta PS-01 §1–§5 (DP5 = opção **(b)** + Emenda #6 em
      DRAFT → vigente a partir deste RAT) e o addendum
      **SDD-EXEC-PS01-ADD-OPS** (correções §0.1 e §0.2, bateria §2, NAV-AUTH
      §3, D-INF §4, sequência §5).

| Campo          | Valor                                        |
| -------------- | -------------------------------------------- |
| Nome           | ______________________________               |
| Data (UTC)     | ******-******-______                         |
| Assinatura     | ______________________________               |
| Selo atribuído | PS-S0 = ____________ (pelo scribe no ledger) |

## 2. OK explícito ao constraint §0.2 (produção read-only até o carimbo)

- [ ] **OK** — toda a bateria pré-cutover (T1–T3, T7 e refinamentos de T2/T4)
      roda **somente** em app preview + branch Neon dedicada
      `preview-bateria-<data>` com seed seguro; contra produção **só probes
      read-only sancionados**; RUM dia-0 (T5) e janela de 1h de tráfego (T4)
      ficam rotulados para a A5-0h pós-cutover, até o carimbo
      **`Tráfego: EXISTE`** no ledger.

## 3. D-INF — 4 respostas de uma linha (fatos de conta; defaults renunciáveis)

| ID      | Pergunta                                                          | RESPOSTA (preencher)           | Default recomendado (renunciável)                                    |
| ------- | ----------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| D-INF-1 | Domínio canônico + registrador atuais?                            | ______________________________ | manter registrador atual; DNS gerenciado onde cair D-INF-2           |
| D-INF-2 | Usar Cloudflare?                                                  | ______________________________ | **SIM, DNS-only (grey cloud) pré-cutover**; orange só pós-cutover    |
| D-INF-3 | Remetente Resend (endereço)?                                      | ______________________________ | `noreply@<domínio>` com DKIM/SPF/DMARC verificados no DNS de D-INF-2 |
| D-INF-4 | Tier hPanel/Cloud garante Node ≥24.15 + proxy >60s + egress Neon? | ______________________________ | tier que não garanta = **ABORT** de homologação, sem gambiarra       |

> Consequência por resposta: cada linha vira item de homologação OP-H e
> registro DNS/DKIM (`dns-records-<data>.md`). Resposta conflitante com item
> OP-H (ex.: tier com Node <24.15) = ABORT da homologação naquele item.

## 4. O que este RAT libera (e o que ele NÃO libera)

**Libera (🤖, pós-RAT):** implementação de S1 exatamente no escopo §3 da
proposta PS-01 — produtor `m02:snapshot` com trio no modo `--out-dir`,
consumidor `snapshot-fresco` com N-5/N-6, 5 grupos de teste do produtor,
testes do consumidor, retificações documentais datadas. Selagem de S1 só
após testes pertinentes verdes.

**NÃO libera:** commit/push (H1, humano), mudanças de `.env` (H1/B-02),
operações de banco remotas (S5+ sob seus selos), C-02 antes de S1 selado,
publicação de ledger e cutover (H5, com GO/NO-GO identificado).

## 5. Ato separado (não é este RAT): assinatura do memo G1

O gate `g1-assinada` só vira com o bloco `## G1 SIGNATURE` preenchido em
`docs/specs/M-02/decisions/M02-D-008-G1-memo.md` (sunset 20/09). É ato
próprio, com arquivo e norma próprios — não se subestima por estar no mesmo
dia do RAT.
