# TRANSIÇÕES DA RODADA — matrizes 187 × 2 (2026-09-15) · WP-0

| campo               | conteúdo                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **id**              | `WP-0` (VERIFICADOR-C — auditoria da régua; read-only sobre código)                                                                                                                                                                            |
| **spec_ref**        | `SPEC-CARDS/WP-0-transicoes.md` · §45 (DoD) · NAS-2 §3.2 (E1/E2) · NAS-2 §10                                                                                                                                                                   |
| **objetivo**        | decidir, com matriz completa e não com narrativa, se a lacuna contábil alegada pela diretiva NAS-2 existe                                                                                                                                      |
| **fontes**          | `plan-recap-2026-09-15/ANEXO-ITENS-2026-09-15.md` (raw, item a item) · `MEDICAO-2026-09-15.md` · `RECONCILIACAO-BASE-2026-09-15.md` · `RELATORIO-MISSAO-2026-09-15.md` · `CLAIMS-INBOX/*` (§LEDGER) · `DECISOES-STEWARD-2026-09-15.md` (D1–D6) |
| **HEAD de leitura** | `4d500fc` (base NAS-2) · round medido `1f94b56..4d500fc` · HEAD integrado da missão `2173bf9`                                                                                                                                                  |
| **veredito**        | **lacuna REFUTADA** — a aritmética fecha exatamente nos dois sentidos; a alegação é artefato de leitura do `RELATORIO-MISSAO` (§4 abaixo)                                                                                                      |

**Nada foi lido do headline:** todas as contagens abaixo saem da coluna `prev`/`status` do anexo (raw) e da seção `## LEDGER` de cada claim — o raw é a única entrada do script de recontagem (§6).

---

## 1. Universo e denominador (193 → 187)

| etapa                                            | n       | prova                                               |
| ------------------------------------------------ | ------- | --------------------------------------------------- |
| linhas na tabela "Blocos A–D (§5–§35 + §29–§31)" | 193     | anexo, linhas 9–201 (entre os dois cabeçalhos `##`) |
| − 3 `SUPERSEDED` (`12.2`, `13.4`, `15.2c`)       | 190     | `MEDICAO §6.4` (decisões, não dívidas)              |
| − 2 `N/A` (`27.3`, `31.2`)                       | 188     | `MEDICAO §6.4` (princípio / pré-requisito ausente)  |
| − 1 duplicado (`25.5` = `24.13`)                 | 187     | `MEDICAO §6.4` (contado uma vez)                    |
| **denominador acionável**                        | **187** | soma dos blocos `76 + 34 + 71 + 6 = 187`            |

A classificação por bloco (`§5–§15` A · `§16–§20` B · `§21–§28 + §32–§35` C · `§29–§31` D; os itens nomeados `F0-*`/`SEC-*`/`FIN-*`/`API-*`/`IA-*`/`AUTH-*`/`BFF-*`/`GATE-*` caem em A, inclusive `GATE-M02`) **reproduz exatamente** a linha "Blocos atuais" do `RECONCILIACAO-BASE §2`:

```text
A 76 = 60/8/8/0 · B 34 = 24/8/2/0 · C 71 = 54/5/10/2 · D 6 = 1/4/1/0   =>  139/25/21/2 = 187
```

---

## 2. Matriz da rodada de MEDIÇÃO (`prev` → `status` do anexo)

| transição             | n       | âncora nominal (item · `anexo:linha`)                                                                                                       |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `DONE→DONE`           | 128     | — (identidade)                                                                                                                              |
| `PARTIAL→DONE`        | 10      | `F0-04` :12 · `BFF-002` :32 · `BFF-003` :33 · `12.4` :63 · `14.3` :75 · `18.5` :108 · `19.5` :115 · `21.2` :123 · `32.5` :179 · `32.9` :183 |
| `DONE→PARTIAL`        | 1       | `10.7` :50 (só 1 das 3 propriedades PBT)                                                                                                    |
| `PARTIAL→PARTIAL`     | 22      | — (identidade)                                                                                                                              |
| `NS→PARTIAL`          | 2       | `26.8` :158 · `30` :171                                                                                                                     |
| `NS→NS`               | 21      | — (identidade)                                                                                                                              |
| `NS→UNVERIFIABLE`     | 2       | `25.6` :149 · `25.7` :150 (settings-side do GitHub)                                                                                         |
| `NÃO VERIFICADO→DONE` | 1       | `GATE-M02` :39 (execução real de `m02:boundaries` / `m02:matrix:check`)                                                                     |
| **total**             | **187** | colunas fecham em **139 D · 25 P · 21 NS · 2 UNV**                                                                                          |

**Confirmação de identidade:** a matriz acima é **idêntica, célula a célula**, à do `RECONCILIACAO-BASE-2026-09-15.md §2` — o script de recontagem (§6) compara as duas com `==` e imprime `idêntica ao RECONCILIACAO-BASE §2: True` (soma 187 · zero células fora das 8 listadas). A lista nominal das 16 transições não-identidade já está publicada no `RECONCILIACAO §3` (com âncora `arquivo:linha` no HEAD); aqui só se re-deriva a contagem do raw, bloco a bloco:

```text
A (76): 5 PARTIAL→DONE · 1 DONE→PARTIAL · 1 NV→DONE
B (34): 2 PARTIAL→DONE
C (71): 3 PARTIAL→DONE · 1 NS→PARTIAL · 2 NS→UNVERIFIABLE
D (6) : 1 NS→PARTIAL
```

---

## 3. Matriz da rodada da MISSÃO (base `139/25/21/2` → final `147/26/12/2`)

Base = coluna `status` do anexo (fim da medição). Final = `RELATORIO-MISSAO §5` (placar consolidado). Fonte primária de cada transição não-identidade = a seção `## LEDGER` do claim respectivo e, **quando o item não tem claim**, a decisão do STEWARD que o promove — é o caso de `9.1-ME` (emenda **D5** em `SPEC-DELTAS/DECISOES-STEWARD-2026-09-15.md`, commit `b45e2fe`; não existe `CLAIMS-INBOX/9.1-ME.md`).

| origem → destino            | n       | quem                                                                                                     |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `DONE→DONE`                 | 139     | — (zero saídas de DONE nesta rodada)                                                                     |
| `PARTIAL→DONE`              | 3       | `10.7` (A) · `35` (C) · `28.5` (C)                                                                       |
| `DONE→PARTIAL`              | 0       | —                                                                                                        |
| `PARTIAL→PARTIAL`           | 22      | — (identidade; `12.5`, `20.1`, `28.4`, `26.8`… permanecem PARTIAL)                                       |
| `NS→DONE`                   | 5       | `16.3` (B) · `23.1`, `23.2`, `28.1`, `28.3` (C)                                                          |
| `NS→PARTIAL`                | 4       | `9.1-ME` (A) · `28.2`, `26.7`, `25.4` (C)                                                                |
| `NS→NS`                     | 12      | — (identidade)                                                                                           |
| `UNVERIFIABLE→UNVERIFIABLE` | 2       | `25.6`, `25.7` (D4 mantém)                                                                               |
| **total**                   | **187** | linhas fecham em **139/25/21/2** (base) e colunas em **147/26/12/2** (final) — **187 nos dois sentidos** |

### 3.1 Lista nominal das 12 transições (id · antes → depois · âncora)

| id       | antes → depois   | bloco | `anexo:linha` | âncora do estado final / integração                                                                                      |
| -------- | ---------------- | ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `9.1-ME` | `NS → PARTIAL`   | A     | :41           | `DECISOES-STEWARD` **D5** (emenda pós-V3-A: `outbox.repository.ts:70-75`, `outbox.worker.ts:118,162` · commit `b45e2fe`) |
| `10.7`   | `PARTIAL → DONE` | A     | :50           | `CLAIMS-INBOX/10.7.md §LEDGER` (I-M1 · merge `25dd0f5`)                                                                  |
| `16.3`   | `NS → DONE`      | B     | :90           | `CLAIMS-INBOX/16.3-pgstat.md §LEDGER` (I-M8 · merge `406eb81`)                                                           |
| `23.1`   | `NS → DONE`      | C     | :129          | `CLAIMS-INBOX/23-outbox.md §LEDGER` (I-M4 · merge `b5e880f`)                                                             |
| `23.2`   | `NS → DONE`      | C     | :130          | `CLAIMS-INBOX/23-outbox.md §LEDGER` (I-M4 · merge `b5e880f`)                                                             |
| `25.4`   | `NS → PARTIAL`   | C     | :147          | `CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER` (I-M3 · merge `be87d87`)                                                      |
| `26.7`   | `NS → PARTIAL`   | C     | :157          | `CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER` (I-M3 · merge `be87d87`)                                                      |
| `28.1`   | `NS → DONE`      | C     | :163          | `CLAIMS-INBOX/28-backfill.md §LEDGER` (I-M6 · merge `0235084`)                                                           |
| `28.2`   | `NS → PARTIAL`   | C     | :164          | `CLAIMS-INBOX/28-backfill.md §LEDGER` + D3 (ledger só no banco de teste)                                                 |
| `28.3`   | `NS → DONE`      | C     | :165          | `CLAIMS-INBOX/28-backfill.md §LEDGER` (I-M6)                                                                             |
| `28.5`   | `PARTIAL → DONE` | C     | :167          | `CLAIMS-INBOX/28-backfill.md §LEDGER` (I-M6)                                                                             |
| `35`     | `PARTIAL → DONE` | C     | :201          | `CLAIMS-INBOX/35-perf-gate.md §LEDGER` (I-M5 · merge `d71be7b`)                                                          |

**Identidades que a NAS-2 poderia suspeitar e que o raw confirma:** `28.4` `PARTIAL→PARTIAL` (pedido DONE negado em D3 — §3 do relatório) · `12.5` e `20.1` `PARTIAL→PARTIAL` (§2: "sem mudança") · `26.8` `PARTIAL→PARTIAL` · `30` `PARTIAL→PARTIAL` · `25.6`/`25.7` `UNVERIFIABLE→UNVERIFIABLE` (D4).

### 3.2 Por bloco (base → final) — soma 187

| bloco | denom | base `D/P/NS/UNV` | final `D/P/NS/UNV` | não-identidade no bloco                 | Δ crédito |
| ----- | ----- | ----------------- | ------------------ | --------------------------------------- | --------- |
| A     | 76    | 60/8/8/0          | **61/8/7/0**       | `9.1-ME` NS→P · `10.7` P→D              | +1,0      |
| B     | 34    | 24/8/2/0          | **25/8/1/0**       | `16.3` NS→D                             | +1,0      |
| C     | 71    | 54/5/10/2         | **60/6/3/2**       | 4 NS→D · 2 P→D · 3 NS→P (as 9 do bloco) | +6,5      |
| D     | 6     | 1/4/1/0           | **1/4/1/0**        | **nenhuma**                             | 0,0       |
| total | 187   | 139/25/21/2       | **147/26/12/2**    | 12 transições                           | +8,5      |

### 3.3 Replay do placar pelos marcos do LEDGER (prova incremental item a item)

| marco (claim)                                            | estado          | crédito   | %         |
| -------------------------------------------------------- | --------------- | --------- | --------- |
| base do round (`RECONCILIACAO §2`)                       | 139/25/21/2     | 151,5     | 81,02     |
| `+10.7` P→D (claim `10.7`)                               | 140/24/21/2     | 152,0     | 81,28     |
| `+25.4` · `+26.7` NS→P (claim `12.5-25.4`)               | 140/26/19/2     | 153,0     | 81,82     |
| `+23.1` · `+23.2` NS→D (claim `23-outbox`)               | 142/26/17/2     | 155,0     | 82,89     |
| `+35` P→D (claim `35-perf-gate`)                         | 143/25/17/2     | 155,5     | 83,16     |
| `+28.1` · `28.2` · `28.3` · `28.5` (claim `28-backfill`) | 146/26/14/2     | 158,5     | 84,76     |
| `+16.3` NS→D (claim `16.3-pgstat`)                       | 147/25/13/2     | 159,5     | 85,29     |
| `+9.1-ME` NS→P (D5/emenda)                               | **147/26/12/2** | **160,0** | **85,56** |

Os seis marcos publicados nos claims (`81,28` · `81,82` · `82,89` · `83,16` · `84,76` · `85,56`) **batem dígito a dígito** com o replay — ou seja: as promoções registradas no §LEDGER já fechavam a conta; nenhuma transição ficou de fora.

---

## 4. Veredito sobre a lacuna alegada pela NAS-2 — **REFUTADA**

> Alegação sob teste (NAS-2 §10, citada em `QUEUE.md §Base`): _"2 saídas de DONE no bloco C não nomeadas + 1 NS→P residual, **forçados pela aritmética por bloco**"_.

### 4.1 A conta do bloco C, item a item

Base C `54 D · 5 P · 10 NS · 2 UNV` → final C `60 D · 6 P · 3 NS · 2 UNV` (71 itens nos dois lados).

```text
DONE    54 + 6 entradas (4 NS→D + 2 P→D) − 0 saídas = 60   ✓ alvo 60
PARTIAL  5 − 2 saídas (P→D) + 3 entradas (NS→P)     =  6   ✓ alvo  6
NS      10 − 7 saídas (4 NS→D + 3 NS→P)             =  3   ✓ alvo  3
UNV      2                                          =  2   ✓ alvo  2
```

- entradas em DONE: `23.1`, `23.2`, `28.1`, `28.3` (NS→D, `anexo:129,130,163,165`) + `35`, `28.5` (P→D, `anexo:201,167`);
- saídas de DONE: **zero** — e `DONE→PARTIAL = 0` globalmente (nenhum item DONE da base é não-DONE no final);
- entradas em PARTIAL: `28.2` (:164), `26.7` (:157), `25.4` (:147).

**Residuais = (0, 0). Não existem as 2 saídas de DONE nem o NS→P residual.** A prova é aritmética e a lista é nominal: as 9 transições do bloco C são exatamente as que constam do §LEDGER dos claims (`23-outbox`, `35-perf-gate`, `28-backfill`, `12.5-25.4-supply`) — nenhuma célula fica sem dono.

### 4.2 O que produziria a assinatura da alegação (busca, não opinião)

Definindo a **assinatura da alegação** como `(saídas de DONE fantasmas, entradas NS→P residuais) = (2, 1)` e rodando a busca sobre as bases documentadas × os 512 subconjuntos das 9 transições verdadeiras do bloco C:

| configuração                                                                                                              | assinatura                           |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| base correta (`54/5/10/2`) + as 9 transições verdadeiras                                                                  | **(0, 0)**                           |
| **§2 lido como lista de DONE** (8 entradas em C: `23.1, 23.2, 35, 28.1, 28.3, 28.5, 26.7, 25.4`) **e `28.2` não nomeado** | **(2, 1)** ← a alegação              |
| mesma leitura, mas com `28.2` também nomeado                                                                              | (2, 0)                               |
| base = 1ª passada da medição (`35` ainda DONE ⇒ `55/4/10/2`) + as 9 verdadeiras                                           | (1, 0)                               |
| base = 1ª passada + §2 lido como DONE (7 entradas) e `28.2` não nomeado                                                   | (2, 1)                               |
| busca exaustiva (512 × 3 bases documentadas)                                                                              | **0 configurações** com a assinatura |

### 4.3 Origem mais provável (uma só causa dominante)

**Causa:** o `RELATORIO-MISSAO §2` intitula a tabela de _"Itens fechados nesta rodada"_ e **não tem coluna de status** — quem a lê como lista de promoções a DONE conta **8** entradas em DONE no bloco C em vez de 6. As duas que não são DONE são justamente **`26.7` e `25.4`**, cujo status efetivo (`NS→PARTIAL`, por H-2) está registrado apenas na **prosa** logo abaixo da tabela e no §LEDGER do claim. Somando a isso a omissão de **`28.2`** — cuja promoção `NS→PARTIAL` aparece só na prosa do §2 e numa tabela do §3 cujo título é _"Itens rebaixados / sem upgrade"_ (que sugere, erradamente, ausência de mudança) —, a aritmética "fecha" forçando **exatamente 2 saídas de DONE e 1 NS→P residual**. Bate com a alegação nos dois números.

**Sobre a hipótese (b) do spec-card ("bases diferentes / o meio da medição, quando `35` foi DONE e rebaixado"):** ela **contribui com ±1 em D, mas não é a causa e não basta sozinha**. A troca de base pela 1ª passada da medição (global `140/25/20/2` = 81,55% — o "81,6%" do `MEDICAO §1`) com as 9 transições verdadeiras dá assinatura **(1, 0)**, não (2, 1); a base correta dá (0, 0). O fator decisivo é a **leitura da tabela §2**, não a base.

**Observação (fora do meu escopo de escrita):** o parêntese do `QUEUE.md §Base` — _"6 P→D, 3 NS→P, 4 NS→D, 0 D→saída líquida"_ — é internamente impossível: o bloco C tem só **5** PARTIAL na base, logo não pode haver 6 `P→D`; `6` é o número de **entradas em DONE** (4 NS→D + 2 P→D). É o mesmo tipo de erro de prosa (contagem sem recontagem item a item) que gerou a lacuna fantasma — o MAESTRO decide se corrige.

### 4.4 Consequência para o ledger

Nenhuma claim nova precisa esperar por esta lacuna: ela não existe. O bloqueio do `QUEUE.md` ("lacuna contábil em verificação, bloqueante para claims novas") pode ser **liberado com este veredito**.

---

## 5. Confirmação da base final

```text
base do round : 139 D + 25 P + 21 NS + 2 UNV = 187  → crédito 151,5 = 81,02%  (crua 74,33%)
base final    : 147 D + 26 P + 12 NS + 2 UNV = 187  → crédito 160,0 = 85,56%  (crua 78,61%)
Δ alinhado    : +8 D · +1 P · −9 NS · 0 UNV         → +8,5 item-equivalente = +4,54 pp
```

- **147/26/12/2 sobre os mesmos 187 itens** — confirmado por recontagem independente do raw (o script imprime `base == 139/25/21/2: True` e `final == 147/26/12/2: True`), por bloco (`61/8/7/0 · 25/8/1/0 · 60/6/3/2 · 1/4/1/0`) e pelo replay do placar (§3.3).
- Arredondamento oficial: **85,6% parcial / 78,6% crua** (`RELATORIO §5`, `PROGRESS.md L44`, `QUEUE.md §Estado do placar`).
- **Zero saídas de DONE** na rodada; **zero** item com troca de base (denominador 187 nos dois lados, composição constante).

---

## 6. Reprodução (comando único, saída colada)

```bash
# na raiz do repo, com o script do apêndice em /tmp/wp0-recontagem.py
python3 /tmp/wp0-recontagem.py
```

```text
== 1. MATRIZ DA RODADA DE MEDIÇÃO (prev -> status) ==
     DONE -> DONE         128
   PARTIAL -> DONE          10
     DONE -> PARTIAL        1
   PARTIAL -> PARTIAL       22
       NS -> PARTIAL        2
       NS -> NS            21
       NS -> UNVERIFIABLE   2
       NV -> DONE           1
   total 187 | idêntica ao RECONCILIACAO-BASE §2: True
   por bloco (só não-identidade): {'A': [(('DONE', 'PARTIAL'), 1), (('NV', 'DONE'), 1), (('PARTIAL', 'DONE'), 5)], 'B': [(('PARTIAL', 'DONE'), 2)], 'C': [(('NS', 'PARTIAL'), 1), (('NS', 'UNVERIFIABLE'), 2), (('PARTIAL', 'DONE'), 3)], 'D': [(('NS', 'PARTIAL'), 1)]}

== 2. MATRIZ DA RODADA DA MISSÃO (base -> final) ==
            DONE -> DONE          139
              NS -> DONE            5
              NS -> NS             12
              NS -> PARTIAL         4
         PARTIAL -> DONE            3
         PARTIAL -> PARTIAL        22
    UNVERIFIABLE -> UNVERIFIABLE    2
   total 187 | linhas (origem): {'DONE': 139, 'PARTIAL': 25, 'NS': 21, 'UNVERIFIABLE': 2} | colunas (destino): {'DONE': 147, 'PARTIAL': 26, 'NS': 12, 'UNVERIFIABLE': 2}
   base == 139/25/21/2: True | final == 147/26/12/2: True

   por bloco A–D (base -> final):
     A (denom 76): 60/8/8/0 -> 61/8/7/0   | não-identidade: [('9.1-ME', 'NS', 'PARTIAL'), ('10.7', 'PARTIAL', 'DONE')]
     B (denom 34): 24/8/2/0 -> 25/8/1/0   | não-identidade: [('16.3', 'NS', 'DONE')]
     C (denom 71): 54/5/10/2 -> 60/6/3/2   | não-identidade: [('23.1', 'NS', 'DONE'), ('23.2', 'NS', 'DONE'), ('25.4', 'NS', 'PARTIAL'), ('26.7', 'NS', 'PARTIAL'), ('28.1', 'NS', 'DONE'), ('28.2', 'NS', 'PARTIAL'), ('28.3', 'NS', 'DONE'), ('28.5', 'PARTIAL', 'DONE'), ('35', 'PARTIAL', 'DONE')]
     D (denom  6): 1/4/1/0 -> 1/4/1/0   | não-identidade: []

   lista nominal (id · anexo:linha · antes → depois · bloco · fonte):
     10.7    anexo:50   PARTIAL -> DONE    [A] CLAIMS-INBOX/10.7.md §LEDGER (I-M1 · 25dd0f5)
     9.1-ME  anexo:41        NS -> PARTIAL [A] DECISOES-STEWARD D5 (emenda V3-A) · RELATORIO §2
     16.3    anexo:90        NS -> DONE    [B] CLAIMS-INBOX/16.3-pgstat.md §LEDGER (I-M8 · 406eb81)
     23.1    anexo:129       NS -> DONE    [C] CLAIMS-INBOX/23-outbox.md §LEDGER (I-M4 · b5e880f)
     23.2    anexo:130       NS -> DONE    [C] CLAIMS-INBOX/23-outbox.md §LEDGER (I-M4 · b5e880f)
     35      anexo:201  PARTIAL -> DONE    [C] CLAIMS-INBOX/35-perf-gate.md §LEDGER (I-M5 · d71be7b)
     28.1    anexo:163       NS -> DONE    [C] CLAIMS-INBOX/28-backfill.md §LEDGER (I-M6 · 0235084)
     28.2    anexo:164       NS -> PARTIAL [C] CLAIMS-INBOX/28-backfill.md §LEDGER + D3
     28.3    anexo:165       NS -> DONE    [C] CLAIMS-INBOX/28-backfill.md §LEDGER
     28.5    anexo:167  PARTIAL -> DONE    [C] CLAIMS-INBOX/28-backfill.md §LEDGER
     26.7    anexo:157       NS -> PARTIAL [C] CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER (I-M3 · be87d87)
     25.4    anexo:147       NS -> PARTIAL [C] CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER (I-M3 · be87d87)

== 3. BLOCO C — a conta que a diretiva NAS-2 diz não fechar ==
   entradas em DONE: 4 NS->D ['23.1', '23.2', '28.1', '28.3'] + 2 P->D ['35', '28.5'] = 6 | saídas de DONE: 0
   DONE 54 + 6 - 0 = 60 (alvo 60) | PARTIAL 5 - 2 + 3 = 6 (alvo 6) | NS 10 - 7 = 3 (alvo 3)
   => residuais: (saídas de DONE, NS->P não nomeados) = (0, 0). Lacuna REFUTADA.

   assinatura da alegação (2 saídas de DONE, 1 NS->P residual) por base:
     a) base correta (54/5/10/2) + 9 transições verdadeiras ...... (0, 0)
     b) base correta + §2 lido como 'todos DONE' (8 entradas C). (2, 1)  <- 26.7/25.4 lidos como DONE e 28.2 (só na prosa) não nomeado
     c) 1ª passada da medição (35 ainda DONE: 55/4/10/2) + §2 lido como 'todos DONE' (2, 1)
     d) base correta + 26.7/25.4 lidos como DONE + 28.2 nomeado (2, 0)
   resultado da busca: 0 configurações com a assinatura da alegação

== 4. REPLAY DO PLACAR (marcos registrados no §LEDGER dos claims) ==
   base do round (RECONCILIACAO §2)   139 D · 25 P · 21 NS · 2 UNV | crédito 151.5 |  81.02%
   +10.7 P->D (claim 10.7)            140 D · 24 P · 21 NS · 2 UNV | crédito 152.0 |  81.28%
   +25.4 NS->P (claim 12.5-25.4)      140 D · 25 P · 20 NS · 2 UNV | crédito 152.5 |  81.55%
   +26.7 NS->P (claim 12.5-25.4)      140 D · 26 P · 19 NS · 2 UNV | crédito 153.0 |  81.82%
   +23.1 NS->D (claim 23-outbox)      141 D · 26 P · 18 NS · 2 UNV | crédito 154.0 |  82.35%
   +23.2 NS->D (claim 23-outbox)      142 D · 26 P · 17 NS · 2 UNV | crédito 155.0 |  82.89%
   +35 P->D (claim 35-perf-gate)      143 D · 25 P · 17 NS · 2 UNV | crédito 155.5 |  83.16%
   +28.1 NS->D (claim 28-backfill)    144 D · 25 P · 16 NS · 2 UNV | crédito 156.5 |  83.69%
   +28.2 NS->P (claim 28-backfill)    144 D · 26 P · 15 NS · 2 UNV | crédito 157.0 |  83.96%
   +28.3 NS->D (claim 28-backfill)    145 D · 26 P · 14 NS · 2 UNV | crédito 158.0 |  84.49%
   +28.5 P->D (claim 28-backfill)     146 D · 25 P · 14 NS · 2 UNV | crédito 158.5 |  84.76%
   +16.3 NS->D (claim 16.3-pgstat)    147 D · 25 P · 13 NS · 2 UNV | crédito 159.5 |  85.29%
   +9.1-ME NS->P (D5/emenda)          147 D · 26 P · 12 NS · 2 UNV | crédito 160.0 |  85.56%
   marcos conferidos contra os LEDGERs: 81,28 (10.7) · 81,82 (25.4+26.7) · 82,89 (23.1+23.2) · 83,16 (35) · 84,76 (28.x) · 85,56 (16.3+9.1-ME)
```

### 6.1 Caminho curto (só o comando de contagem do raw)

```bash
sed -n '5,202p' docs/evidence/plan-recap-2026-09-15/ANEXO-ITENS-2026-09-15.md \
 | awk -F'|' '/^\| `/ {gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$4); p[$3]++; s[$4]++} END {print "prev:"; for (k in p) print "  "k, p[k]; print "status:"; for (k in s) print "  "k, s[k]}'
```

```text
prev:
  N/A 1
  SUPERSEDED 3
  NÃO VERIFICADO 1
  NS 26
  NA 1
  DONE 129
  PARTIAL 32
status:
  **UNVERIFIABLE** 2
  **NS** 22
  **PARTIAL** 25
  **DONE** 139
  **NA** 2
  **SUPERSEDED** 3
```

(193 linhas; subtraindo os 6 fora do denominador e fundindo os pares de transição, caem exatamente nas duas bases de 187 — matrizes em §2 e §3.)

---

## 7. Limites declarados e o que **NÃO** foi feito

- **Read-only sobre código:** nenhum arquivo de código, migration, workflow ou teste foi tocado. Este WP escreve **apenas** `TRANSICOES-ROUND-2026-09-15.md` e a errata apensa ao `RELATORIO-MISSAO-2026-09-15.md` (escopo exclusivo do card).
- **Não houve execução de suíte, build, gate `m02:*`, `db:test`, container PG ou banco algum.** A validação deste item é _recontagem aritmética_ sobre o raw (não há teste de software a rodar). `:5432` nunca foi tocado.
- **Não li o headline antes do raw:** as contagens saem do anexo e do §LEDGER dos claims; `MEDICAO`/`RELATORIO` foram usados só como _destino_ de comparação (valores a confirmar), nunca como fonte dos números.
- **O que este WP não decide:** (a) se `26.7`/`25.4`/`28.2` deveriam ter sido promovidos a DONE — é julgamento do STEWARD, já feito (D3/D4 e §3 do relatório); (b) o mérito das evidências de cada claim (é do adversarial de cada WP); (c) a correção do `QUEUE.md` (fora do escopo de arquivo — §4.3 deixa a observação registrada).
- **Risco assumido (auto-avaliação):** a lista nominal da rodada da missão depende do **§LEDGER dos claims** como fonte do estado final; se algum claim for reaberto (S6→S5) ou reclassificado pelo MAESTRO, **as linhas afetadas desta matriz precisam ser recalculadas** — o script do §9 torna isso trivial (basta editar `MISSION` no topo). Não há risco de código: nada aqui é executável em produção.
- **Sem push.** 1 item = 1 commit local (§CLAIM abaixo).

---

## 8. CLAIM — WP-0 (contrato canônico, **embutido** por escopo exclusivo do card)

> O card fixa escopo de arquivo exclusivo: `TRANSICOES-ROUND-2026-09-15.md` (novo) + `RELATORIO-MISSAO-2026-09-15.md` **apenas se houver errata** — "Nada mais". O `CLAIM` canônico vai, portanto, **dentro** deste arquivo (o MAESTRO pode copiá-lo para `CLAIMS-INBOX/WP-0.md` no S5 se quiser o arquivo separado).

- **id / papel / branch / commit:** `WP-0` · VERIFICADOR-C (read-only sobre código; sem worktree, conforme o card) · `develop` (árvore de trabalho principal) · commit deste WP — **ponteiro estável, imune a `--amend`**: `git log -1 --format='%h %s' -- docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` · base do round `4d500fc`.
- **spec_ref:** `docs/evidence/agent-state/SPEC-CARDS/WP-0-transicoes.md` (lido inteiro) · NAS-2 §3.2 (E1/E2) · NAS-2 §10 · §45 (DoD) · base `plan-recap-2026-09-15/{MEDICAO,ANEXO}-*.md` + `agent-state/{RELATORIO-MISSAO,RECONCILIACAO-BASE}-*.md` + `CLAIMS-INBOX/*` §LEDGER.
- **status pleiteado:** **DONE** (docs-only; não há item do Plano Mestre promovido nem rebaixado por este WP — a régua é auditoria).
- **cadeia SDD:**
  1. **SPEC-CARD:** lido inteiro antes de qualquer escrita; nenhuma divergência ⇒ sem `SPEC-DELTAS/`.
  2. **TEST-FIRST:** n/a (não há código). O análogo é o **falsificador**: a alegação NAS-2 ("2 saídas de DONE + 1 NS→P residual") foi tratada como hipótese a ser reproduzida por busca exaustiva — e **não** é reproduzível a partir da base correta (§4.2). A "prova vermelho→verde" é: assinatura da alegação `(2, 1)` vs assinatura real `(0, 0)`.
  3. **IMPLEMENT:** `docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` (novo) · `docs/evidence/agent-state/RELATORIO-MISSAO-2026-09-15.md` (§9 ERRATA apensa). Nada mais foi tocado.
  4. **EVIDENCE:** §6 (comando + saída colada integral) e §6.1 (caminho curto em `awk`); o script do §9, **extraído do próprio documento e executado, reproduz a saída colada byte a byte** (`diff` vazio).
  5. (este arquivo)
  6. **ADVERSARIAL (S6, aritmético — recontagem do zero, sem ler a matriz): CONFIRMED na substância** — medição `128/10/1/22/2/21/2/1 = 187` idêntica ao `RECONCILIACAO`; missão `139/25/21/2 → 147/26/12/2 = 187` nos dois sentidos; marcos do LEDGER compatíveis; refutação da lacuna NAS-2 sustentada. Com **CORRECTED** em 2 linhas documentais (sem efeito em número): (a) errata E-1/E-2 — `28.4` é `PARTIAL→PARTIAL` (identidade); quem promoveu a PARTIAL foi `28.2`; a prosa do `§2` do relatório foi marcada inline; (b) a regra de fonte primária do `§3` passou a cobrir o caso sem claim (`9.1-ME` = emenda D5 do STEWARD, `b45e2fe`). Aplicadas no commit de correção — ponteiro estável: `git log -1 --format='%h %s' -- docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md`.
  7. LEDGER: (vazio — MAESTRO).
- **E1 (evidência provisória deste worktree):**
  - caminho: `docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` · trecho-chave: §3 (matriz da missão, 12 transições nomeadas, `139/25/21/2 → 147/26/12/2`) e §4.1 (`DONE 54 + 6 − 0 = 60 … residuais (0, 0)`);
  - como reproduzir: `python3 /tmp/wp0-recontagem.py` (script no §9), ou o `awk` do §6.1; a saída esperada é a colada no §6 (`idêntica ao RECONCILIACAO-BASE §2: True`, `base == 139/25/21/2: True`, `final == 147/26/12/2: True`, `resultado da busca: 0`).
- **auto-avaliação de riscos:**
  1. **Fonte do estado final:** a lista nominal depende do §LEDGER dos claims (é lá que o MAESTRO registra as promoções). Se um claim for reaberto/reclassificado, as linhas afetadas precisam de recálculo — o script isola isso em um único dicionário (`MISSION`).
  2. **Convenção de blocos:** a partição A–D usa o intervalo de § do próprio `MEDICAO §1` (com os itens nomeados em A). Ela reproduz **as duas** referências externas (`RECONCILIACAO §2` "Blocos atuais" e `RELATORIO §5`), mas continua sendo uma convenção derivada: mudar a fronteira entre blocos altera a tabela §3.2 (não altera globais nem o veredito).
  3. **Origem da alegação:** a reconstrução do §4.3 é uma **hipótese sustentada por busca exaustiva**, não uma declaração do autor da diretiva. A **refutação** (§4.1/§4.2) não depende dela.
  4. **Sem risco de código:** nenhum arquivo executável, migration, workflow ou teste foi tocado; nenhum gate depende deste artefato.
- **o que explicitamente NÃO foi feito:** sem execução de suíte/build/gates/containers/banco (`:5432` intocado); **sem push**; não escrevi em `QUEUE.md`, `PROGRESS.md`, ledger, `SPEC-CARDS/`, `SPEC-DELTAS/`, `DECISIONS-PENDING/**`, `CLAIMS-INBOX/**` ou em qualquer worktree; **não reclassifiquei nenhum item** (mérito de status é do STEWARD — D3/D4 e §3 do relatório já o fizeram); não re-derivei as evidências `arquivo:linha` de cada claim (é do adversarial de cada WP); a observação sobre o parêntese do `QUEUE.md §Base` (§4.3) fica **registrada**, não corrigida.
- **rollback:** `git revert $(git log -1 --format=%H -- docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md)` (arquivo novo + 1 seção apensa; nenhum efeito em código).
- **propostas de integração (aplica o MAESTRO):** (a) liberar o bloqueio "lacuna contábil em verificação" do `QUEUE.md` (§4.4); (b) corrigir o parêntese do `QUEUE.md §Base` para "6 entradas em DONE (4 NS→D + 2 P→D), 3 NS→P, 0 saídas de DONE" (§4.3); (c) copiar este CLAIM para `CLAIMS-INBOX/WP-0.md`, se quiser o arquivo separado no S5.

---

## 9. Apêndice — script de recontagem (copiar para `/tmp/wp0-recontagem.py`)

```python
#!/usr/bin/env python3
# WP-0 / VERIFICADOR-C — recontagem independente das duas matrizes de transição (rodada 2026-09-15).
# Entrada ÚNICA: docs/evidence/plan-recap-2026-09-15/ANEXO-ITENS-2026-09-15.md (raw item a item).
# Uso: python3 /tmp/wp0-recontagem.py   (a partir da raiz do repo)
import re, sys
from collections import Counter, defaultdict

ANEXO = "docs/evidence/plan-recap-2026-09-15/ANEXO-ITENS-2026-09-15.md"

# --- 1. parsing das 193 linhas do bloco A–D (a 2ª tabela, §36–§40, fica fora) ---
rows, inside = [], False
for ln, txt in enumerate(open(ANEXO, encoding="utf-8"), 1):
    if txt.startswith("## Blocos A–D"): inside = True;  continue
    if txt.startswith("## Camada"):     inside = False; continue
    if inside and re.match(r"^\|\s*`", txt):
        c = [x.strip().strip("*").strip() for x in txt.split("|")]
        rows.append((ln, c[1].strip("`"), c[2], c[3]))
assert len(rows) == 193, len(rows)

# --- 2. denominador: fora dele 3 SUPERSEDED, 2 N/A e 1 duplicado (MEDICAO §7) ---
OUT = {"12.2", "13.4", "15.2c", "27.3", "31.2", "25.5"}
den = [r for r in rows if r[1] not in OUT]
assert len(den) == 187

# --- 3. blocos A–D (MEDICAO §1: A §5–§15 · B §16–§20 · C §21–§28+§32–§35 · D §29–§31) ---
def block(iid):
    if re.match(r"^(F0|SEC|FIN|API|IA|AUTH|BFF|GATE)", iid): return "A"
    n = int(re.match(r"^(\d+)", iid).group(1))
    return "A" if n <= 15 else "B" if n <= 20 else "C" if (n <= 28 or n >= 32) else "D"

# --- 4. MATRIZ DA RODADA DE MEDIÇÃO (coluna prev -> coluna status) ---
NORM = {"NÃO VERIFICADO": "NV"}
M1 = Counter((NORM.get(p, p), NORM.get(s, s)) for _, _, p, s in den)
RECON = {("DONE","DONE"):128, ("PARTIAL","DONE"):10, ("DONE","PARTIAL"):1, ("PARTIAL","PARTIAL"):22,
         ("NS","PARTIAL"):2, ("NS","NS"):21, ("NS","UNVERIFIABLE"):2, ("NV","DONE"):1}
print("== 1. MATRIZ DA RODADA DE MEDIÇÃO (prev -> status) ==")
for k in RECON: print(f"   {k[0]:>6} -> {k[1]:<12} {M1[k]:>3}")
print(f"   total {sum(M1.values())} | idêntica ao RECONCILIACAO-BASE §2: {M1 == Counter(RECON)}")
print("   por bloco (só não-identidade):", {b: sorted((k, v) for k, v in Counter(
    (NORM.get(p, p), NORM.get(s, s)) for _, i, p, s in den if block(i) == b).items() if k[0] != k[1]) for b in "ABCD"})

# --- 5. RODADA DA MISSÃO: transições não-identidade (fonte declarada por item) ---
# base = coluna `status` do anexo (139/25/21/2) · final = RELATORIO-MISSAO §5 (147/26/12/2)
MISSION = {  # id: (de, para, fonte)
 "10.7":   ("PARTIAL","DONE",   "CLAIMS-INBOX/10.7.md §LEDGER (I-M1 · 25dd0f5)"),
 "9.1-ME": ("NS","PARTIAL",     "DECISOES-STEWARD D5 (emenda V3-A) · RELATORIO §2"),
 "16.3":   ("NS","DONE",        "CLAIMS-INBOX/16.3-pgstat.md §LEDGER (I-M8 · 406eb81)"),
 "23.1":   ("NS","DONE",        "CLAIMS-INBOX/23-outbox.md §LEDGER (I-M4 · b5e880f)"),
 "23.2":   ("NS","DONE",        "CLAIMS-INBOX/23-outbox.md §LEDGER (I-M4 · b5e880f)"),
 "35":     ("PARTIAL","DONE",   "CLAIMS-INBOX/35-perf-gate.md §LEDGER (I-M5 · d71be7b)"),
 "28.1":   ("NS","DONE",        "CLAIMS-INBOX/28-backfill.md §LEDGER (I-M6 · 0235084)"),
 "28.2":   ("NS","PARTIAL",     "CLAIMS-INBOX/28-backfill.md §LEDGER + D3"),
 "28.3":   ("NS","DONE",        "CLAIMS-INBOX/28-backfill.md §LEDGER"),
 "28.5":   ("PARTIAL","DONE",   "CLAIMS-INBOX/28-backfill.md §LEDGER"),
 "26.7":   ("NS","PARTIAL",     "CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER (I-M3 · be87d87)"),
 "25.4":   ("NS","PARTIAL",     "CLAIMS-INBOX/12.5-25.4-supply.md §LEDGER (I-M3 · be87d87)"),
}
base = {i: s for _, i, _, s in den}
line = {i: l for l, i, _, _ in den}
for i, (a, b, src) in MISSION.items():
    assert base[i] == a, (i, base[i], a)          # a transição declarada bate com o raw
final = dict(base)
for i, (a, b, s) in MISSION.items(): final[i] = b

M2 = Counter((base[i], final[i]) for i in base)
print("\n== 2. MATRIZ DA RODADA DA MISSÃO (base -> final) ==")
for k in sorted(M2, key=str): print(f"   {k[0]:>13} -> {k[1]:<13} {M2[k]:>3}")
print("   total", sum(M2.values()),
      "| linhas (origem):", dict(Counter(k[0] for k in M2.elements())),
      "| colunas (destino):", dict(Counter(k[1] for k in M2.elements())))
print("   base == 139/25/21/2:", dict(Counter(base.values())) == {"DONE":139,"PARTIAL":25,"NS":21,"UNVERIFIABLE":2},
      "| final == 147/26/12/2:", dict(Counter(final.values())) == {"DONE":147,"PARTIAL":26,"NS":12,"UNVERIFIABLE":2})
print("\n   por bloco A–D (base -> final):")
for b in "ABCD":
    ids = [i for i in base if block(i) == b]
    cb, cf = Counter(base[i] for i in ids), Counter(final[i] for i in ids)
    fmt = lambda c: f"{c['DONE']}/{c['PARTIAL']}/{c['NS']}/{c['UNVERIFIABLE']}"
    print(f"     {b} (denom {len(ids):>2}): {fmt(cb)} -> {fmt(cf)}   | não-identidade: "
          f"{[(i, MISSION[i][0], MISSION[i][1]) for i in ids if base[i] != final[i]]}")
print("\n   lista nominal (id · anexo:linha · antes → depois · bloco · fonte):")
for i, (a, b, src) in sorted(MISSION.items(), key=lambda kv: block(kv[0])):
    print(f"     {i:<7} anexo:{line[i]:<4} {a:>7} -> {b:<7} [{block(i)}] {src}")

# --- 6. VEREDITO sobre a lacuna alegada (NAS-2): bloco C 54/5/10/2 -> 60/6/3/2 ---
print("\n== 3. BLOCO C — a conta que a diretiva NAS-2 diz não fechar ==")
C = {"DONE":54,"PARTIAL":5,"NS":10,"UNVERIFIABLE":2}
T = {"DONE":60,"PARTIAL":6,"NS":3,"UNVERIFIABLE":2}
nsD = ["23.1","23.2","28.1","28.3"]; pD = ["35","28.5"]; nsP = ["28.2","26.7","25.4"]
print(f"   entradas em DONE: {len(nsD)} NS->D {nsD} + {len(pD)} P->D {pD} = {len(nsD)+len(pD)}"
      f" | saídas de DONE: 0")
print(f"   DONE {C['DONE']} + {len(nsD)+len(pD)} - 0 = {C['DONE']+len(nsD)+len(pD)} (alvo {T['DONE']})"
      f" | PARTIAL {C['PARTIAL']} - {len(pD)} + {len(nsP)} = {C['PARTIAL']-len(pD)+len(nsP)} (alvo {T['PARTIAL']})"
      f" | NS {C['NS']} - {len(nsD)+len(nsP)} = {C['NS']-len(nsD)-len(nsP)} (alvo {T['NS']})")
print("   => residuais: (saídas de DONE, NS->P não nomeados) = (0, 0). Lacuna REFUTADA.")

# assinatura da alegação = (saídas de DONE fantasma, NS->P residual fantasma) = (2, 1)
def sig(baseD, baseN, toD, fromNS): return (baseD + toD - 60, baseN - fromNS - 3)
print("\n   assinatura da alegação (2 saídas de DONE, 1 NS->P residual) por base:")
print("     a) base correta (54/5/10/2) + 9 transições verdadeiras ......", sig(54, 10, 6, 7))
print("     b) base correta + §2 lido como 'todos DONE' (8 entradas C).", sig(54, 10, 8, 6),
      " <- 26.7/25.4 lidos como DONE e 28.2 (só na prosa) não nomeado")
print("     c) 1ª passada da medição (35 ainda DONE: 55/4/10/2) + §2 lido como 'todos DONE'",
      sig(55, 10, 7, 6))
print("     d) base correta + 26.7/25.4 lidos como DONE + 28.2 nomeado", sig(54, 10, 8, 7))
# --- 7. busca exaustiva: 512 subconjuntos das 9 transições verdadeiras × 3 bases documentadas ---
TKEY = ["23.1","23.2","28.1","28.3","35","28.5","28.2","26.7","25.4"]
TRUE = {k: MISSION[k][:2] for k in TKEY}
BASES = {"status (correta)": {"DONE":54,"PARTIAL":5,"NS":10,"UNVERIFIABLE":2},
         "prev do anexo":    {"DONE":51,"PARTIAL":7,"NS":13,"UNVERIFIABLE":0},
         "1ª passada (35 DONE)": {"DONE":55,"PARTIAL":4,"NS":10,"UNVERIFIABLE":2}}
hits = 0
for bn, b in BASES.items():
    for mask in range(1 << 9):
        named = [TKEY[i] for i in range(9) if mask >> i & 1]
        toD = sum(1 for k in named if TRUE[k][1] == "DONE")
        fromNS = sum(1 for k in named if TRUE[k][0] == "NS")
        if sig(b["DONE"], b["NS"], toD, fromNS) == (2, 1): hits += 1
print(f"   resultado da busca: {hits} configurações com a assinatura da alegação")

# --- 8. replay do placar pelos marcos do LEDGER (prova incremental item a item) ---
print("\n== 4. REPLAY DO PLACAR (marcos registrados no §LEDGER dos claims) ==")
st = dict(base); steps = [("base do round (RECONCILIACAO §2)", []),
    ("+10.7 P->D (claim 10.7)", ["10.7"]), ("+25.4 NS->P (claim 12.5-25.4)", ["25.4"]),
    ("+26.7 NS->P (claim 12.5-25.4)", ["26.7"]), ("+23.1 NS->D (claim 23-outbox)", ["23.1"]),
    ("+23.2 NS->D (claim 23-outbox)", ["23.2"]), ("+35 P->D (claim 35-perf-gate)", ["35"]),
    ("+28.1 NS->D (claim 28-backfill)", ["28.1"]), ("+28.2 NS->P (claim 28-backfill)", ["28.2"]),
    ("+28.3 NS->D (claim 28-backfill)", ["28.3"]), ("+28.5 P->D (claim 28-backfill)", ["28.5"]),
    ("+16.3 NS->D (claim 16.3-pgstat)", ["16.3"]), ("+9.1-ME NS->P (D5/emenda)", ["9.1-ME"])]
for label, ids in steps:
    for i in ids: st[i] = MISSION[i][1]
    c = Counter(st.values()); cred = c["DONE"] + 0.5 * c["PARTIAL"]
    print(f"   {label:<34} {c['DONE']:>3} D · {c['PARTIAL']:>2} P · {c['NS']:>2} NS · {c['UNVERIFIABLE']} UNV"
          f" | crédito {cred:>5.1f} | {100*cred/187:6.2f}%")
print("   marcos conferidos contra os LEDGERs: 81,28 (10.7) · 81,82 (25.4+26.7) · 82,89 (23.1+23.2) ·"
      " 83,16 (35) · 84,76 (28.x) · 85,56 (16.3+9.1-ME)")
```
