# Memo instrumentado — BAK-01b: PITR ≥ 7 dias na Neon

**Título operacional:** memo instrumentado para H-4 decidir com número, não adjetivo.
**Data:** 2026-09-12 · **Rodada:** produção preco-que-da-lucro · **Frente:** F-NEON
**Caminho vinculado:** `docs/evidence/neon-pitr-memo-2026-09-12.md`
**Projeto medido (informado no mandato):** `damp-forest-57346541`, org `free_v3`, `history_retention_seconds=21600` (6 h)

### Registro de revisão deste artefato

| Versão | Data       | Mudança                                                                                                                                                                                                                                                                                                          |
| ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1     | 2026-09-12 | Redigido em **modo LIMITAÇÃO DECLARADA**: sem ferramenta web no runtime do subagente, nenhum número oficial de plano/preço foi afirmado; campos reservados ao DOC-FIRST do parent.                                                                                                                               |
| v2     | 2026-09-12 | **DOC-FIRST fechado pelo orquestrador via web** (mesma data). Números oficiais de planos/preços/janela de histórico e a semântica de restore do PITR foram incorporados com URL de origem; **GAP-DOC encerrado** (§2.2). O runtime do subagente permaneceu sem web — nenhuma URL foi buscada por este subagente. |

**Legenda de classes de evidência:**

- `[DOC-FIRST-ORQUESTRADOR]` número/afirmação obtida pelo **orquestrador via web** em 2026-09-12, com URL de origem registrada neste memo; **não re-verificada** pelo subagente que redigiu o texto.
- `[LOCAL-VERIFICADO]` evidência direta em arquivo do repositório, com caminho exato.
- `[MEDIDO-ORQUESTRADOR]` medição de ambiente informada no mandato, não re-verificada aqui.
- `[INFERÊNCIA]` dedução do pesquisador sobre evidência citada — nunca apresentada como texto de fonte.
- `[NÃO VERIFICADO]` residual que ainda depende de doc/medição.

**Regra de uso:** números sem classe acima não podem entrar na decisão. Fontes oficiais usadas pelo orquestrador (verbatim, como fornecidas): `neon.com/docs/introduction/plans` · `neon.com/docs/postgres/backup-restore/history-window` · `neon.com/docs/introduction/branch-restore` · `neon.com/pricing`. **[INFERÊNCIA]** os anchors de seção não foram repassados a este subagente; se o orquestrador os tiver, anexá-los ao lado de cada linha da §6 fecha a rastreabilidade no nível de seção exigido pela regra DOC-FIRST.

---

## 1. Resposta direta

1. **Exigência normativa:** PITR mínimo de 7 dias em produção, com controle alternativo capaz de cumprir RPO de 15 min quando indisponível — **SDD §16.6** (não o §42 do Plano Mestre). [LOCAL-VERIFICADO]
2. **Estado medido:** `history_retention_seconds=21600` (6 h) no projeto `damp-forest-57346541` → **VIOLAÇÃO ABERTA** (BAK-01b / PITR/RPO). [MEDIDO-ORQUESTRADOR] + [LOCAL-VERIFICADO]
3. **Qual plano atende:** entre os planos consultados, **Launch é o menor plano que atende ao mínimo de 7 dias** (Free = 6 h; Launch = 7 dias; Scale = 30 dias) — e somente com a **janela de histórico configurada em 7 dias**: o default de planos pagos é 1 dia e 7 dias é o teto do Launch. A opção A inclui, obrigatoriamente, o passo de configuração da janela + re-medição de `history_retention_seconds` (esperado 604800). [DOC-FIRST-ORQUESTRADOR]
4. **Custo:** Launch é **usage-based sem mínimo mensal** (compute US$0,106/CU-h; storage US$0,35/GB-mês; history storage US$0,20/GB-mês). Com o uso atual (37.268 s ativos desde 17/08, ~0,03 GB), a ordem de grandeza é **US$1–3/mês**, variável com o uso. [DOC-FIRST-ORQUESTRADOR] + aritmética [INFERÊNCIA] na §4.
5. **Achado decisivo para H-4:** com ΔP na ordem de US$1–3/mês, **não existe justificativa econômica para permanecer não conforme** — o custo do plano que atende fica abaixo do custo de atenção do controle manual semanal, e muito abaixo do risco residual de RPO (§7).
6. **Ressalva material (não mascarar):** o PITR restaura **apenas branches raiz e sobrescreve a branch**. [DOC-FIRST-ORQUESTRADOR] Logo, o upgrade **não substitui** o dump externo verificado nem o restore isolado exigidos por SDD §16.6 / NFR-RES-004/005 (§5.6).

---

## 2. Fato normativo local (citação direta, caminho exato)

### 2.1 Requisito de PITR

`SDD.md` §16.6 ("Backup e recuperação") — itens verbatim:

- "PITR mínimo de 7 dias é obrigatório em produção; indisponibilidade exige controle alternativo capaz de cumprir RPO de 15 minutos."
- "Backup imutável diário mantém retenção inicial de 35 dias, sujeita à política LGPD e ADR-008."
- "Restauração em projeto isolado." / "Verificação de RLS e migrations após restore." / "RPO/RTO medidos e aprovados."
- "Chaves necessárias para decriptação possuem backup/escrow seguro e teste de recuperação."
- "Restore não prolonga retenção expirada e reaplica o ledger de exclusões."

`SDD.md` §6.4 — NFR-RES-003/004/005 [LOCAL-VERIFICADO]:

- **NFR-RES-003:** "Meta inicial: RPO máximo de 15 minutos e RTO máximo de 4 horas; **alteração exige ADR-008 e aceite de risco**."
- **NFR-RES-004:** "Backup DEVE ser criptografado, imutável e **protegido do mesmo domínio administrativo**."
- **NFR-RES-005:** "Restauração isolada DEVE ser exercitada e comprovar Auth, RLS, migrations e reconciliação."

### 2.2 §42 do Plano Mestre — GAP-DOC **encerrado**

`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` §42 ("Gate antes de Neon production") lista: migrations do zero; migrations em cópia de produção; schema diff revisado; tenant tests; RLS tests; reconciliation report; **backup/restore testado**; direct e pooled URLs configuradas; rollback documentado; smoke tests automatizados.

**Resolução (v2, 2026-09-12):** o §42 **não menciona PITR nem janela de 7 dias**; a exigência é do **SDD §16.6**. O GAP-DOC fica **encerrado como correção de referencial**, com o histórico preservado: o mandato e o brief de 2026-09-05 (que cita "SDD §2446", aparentemente número de linha) usavam a referência "§42"; a redação normativa correta para artefatos novos é **"SDD §16.6"**. Nenhuma das duas fontes locais contradiz a outra quanto ao conteúdo — apenas quanto à numeração. [LOCAL-VERIFICADO]

### 2.3 Histórico do achado (verbatim do ledger)

`EXECUTION-STATE-PROGRAM.md`, "Rodada pré-A4 — §42 backup/restore comprovado (BAK-01) — 2026-09-05":

- "**§42 classificado: VIOLAÇÃO de SDD §2446** (PITR ≥ 7 dias indisponível: retenção 6 h + zero snapshots) → exceção **BAK-01** com controles compensatórios + emenda de política vigente (...): snapshot externo pré-deploy obrigatório, restore drill comprovado, cadência semanal manual até o plano suportar PITR ≥ 7 d."

`EXECUTION-STATE-PROGRAM.md`, "C-03 — veredito BAK-01 pós-drill C-02 (2026-09-07)":

- "Veredito duplo: (1) compensatório NÃO COMPROVADO neste drill (...); (2) **PITR VIOLAÇÃO ABERTA (6h; upgrade existe, não contratado)**."
- Cláusula N-10, verbatim: "**Cláusula de tráfego DP2: BAK-01 reabre no carimbo "Tráfego: EXISTE" salvo PITR≥7d ativo (dump lógico não satisfaz RPO≤15min com writes).**"

`EXECUTION-STATE-PROGRAM.md`, "C-02A/B - re-drill com grants e STOP RLS (2026-09-08)":

- "N-10 permanece inalterado: BAK-01 reabre no carimbo "Tráfego: EXISTE" salvo PITR≥7d ativo. **BAK-01a (restore/RLS) e BAK-01b (PITR/RPO) seguem abertas**; T1-T3/T7/OP-H não iniciados."

`EXECUTION-STATE-PROGRAM.md`, "Registro de operador — 2026-09-12 (cutover-window)":

- "Estado: Neon production em **12/12 migrations**; tráfego de aplicação **ainda NÃO EXISTE** (deploy/homologação hPanel pendente de env vars)."
- "freeze ativo: deploys congelados da janela A4→B3 (exceção única: hotfix de segurança)" com `NEON_MIGRATION_FREEZE_START=2026-09-12T02:05:00Z` · `NEON_MIGRATION_FREEZE_END=2026-09-12T04:05:00Z`.

**[INFERÊNCIA]** Como o carimbo "Tráfego: EXISTE" ainda não ocorreu, a janela de decisão de H-4 é **agora, pré-A4**: depois do primeiro deploy com writes, N-10 exige PITR ≥ 7 d ativo para manter BAK-01 fechada.

---

## 3. Números oficiais (DOC-FIRST) — planos, janela e preços

| Plano      | Preço/mês base                                            | Janela de histórico | Atende SDD §16.6 (≥ 7 d)? | Rate de compute | Storage        | History storage | Extra citado       |
| ---------- | --------------------------------------------------------- | ------------------- | ------------------------- | --------------- | -------------- | --------------- | ------------------ |
| **Free**   | US$0                                                      | 6 h                 | **NÃO** (6 h < 7 d)       | —               | —              | —               | —                  |
| **Launch** | **usage-based, sem mínimo mensal**                        | **7 dias**          | **SIM** (no limite exato) | US$0,106/CU-h   | US$0,35/GB-mês | US$0,20/GB-mês  | —                  |
| **Scale**  | usage-based (rate maior; mínimo mensal **não informado**) | **30 dias**         | SIM (com folga)           | US$0,222/CU-h   | US$0,35/GB-mês | US$0,20/GB-mês  | SLA / rede privada |

Todos os valores e janelas desta tabela: **[DOC-FIRST-ORQUESTRADOR]** (web, 2026-09-12), fontes `neon.com/docs/introduction/plans`, `neon.com/docs/postgres/backup-restore/history-window`, `neon.com/docs/introduction/branch-restore`, `neon.com/pricing`.

**Fato semântico crítico (mesma origem):** **PITR restaura apenas branches raiz e sobrescreve a branch.** [DOC-FIRST-ORQUESTRADOR] → ver §5.6.

**[INFERÊNCIA]** Scale custa **2,09×** o rate de compute do Launch (0,222 / 0,106). Para o requisito de 7 d, Scale é sobre-especificado, salvo se o SLA/rede privada tiver valor próprio para H-4 — decisão que este memo não assume.

---

## 4. Custo do upgrade com o uso real do projeto (aritmética explícita)

Insumos: uso atual **37.268 s ativos desde 17/08** e **~0,03 GB** [DOC-FIRST-ORQUESTRADOR]; rates da §3.

| #   | Cálculo                                                                 | Resultado                            | Classe                                                |
| --- | ----------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| 4.1 | 37.268 s ÷ 3600                                                         | **10,35 h ativas** no período        | [INFERÊNCIA] (aritmética)                             |
| 4.2 | Período 17/08 → 12/09                                                   | ≈ 26 dias (~3,7 semanas)             | [INFERÊNCIA]                                          |
| 4.3 | Compute: 10,35 h × US$0,106/CU-h                                        | **≈ US$1,10 por CU** no período      | [INFERÊNCIA]                                          |
| 4.4 | Storage: 0,03 GB × US$0,35/GB-mês                                       | **≈ US$0,011/mês**                   | [INFERÊNCIA]                                          |
| 4.5 | History storage: 0,03 GB × US$0,20/GB-mês (retenção efetiva não medida) | **≈ US$0,006/mês (limite inferior)** | [INFERÊNCIA] / volume de history **[NÃO VERIFICADO]** |
| 4.6 | Ordem de grandeza mensal informada pelo orquestrador                    | **US$1–3/mês**                       | [DOC-FIRST-ORQUESTRADOR]                              |

**Leituras instrumentadas:**

1. **A linha dominante é compute** (4.3), não storage nem history storage — e compute só cresce com tráfego real. Como **Launch não tem mínimo mensal** [DOC-FIRST-ORQUESTRADOR], `ΔP` **não é um custo fixo**: é uma função do uso. [INFERÊNCIA]
2. `ΔP` **não pode ser declarado como número único** no memo de decisão; deve ser declarado como **faixa + natureza usage-based**, com o gatilho de revisão sendo a entrada de tráfego (mesmo gatilho N-10). [INFERÊNCIA]
3. **[NÃO VERIFICADO]** existência de teto/alerta de gasto (spend cap / budget alert) no plano; se H-4 quiser custo limitado por contrato, isso precisa de campo próprio (§6.13).

---

## 5. O que exatamente muda no projeto ao fazer upgrade (Launch)

### 5.1 Muda no estado a re-medir depois do upgrade (instrumentação obrigatória)

Nenhum destes valores é afirmado aqui; são os campos a medir/confirmar:

1. `history_retention_seconds` após a mudança (esperado 604800 para 7 d) — confirmar na medição, não presumir da doc. [NÃO VERIFICADO na medição]
2. Lista de snapshots gerenciados (`neon-drill-ops` → `snapshot-list`).
3. Mecanismo/limites do restore (ver §5.6).
4. Se a janela é por projeto, branch ou organização (§6.4) — decide se outros projetos da org `free_v3` também passam a reter 7 d.
5. Efeito sobre endpoints/branches existentes (`production`, `develop`) — importa porque `env-guard`, `m02:snapshot` e `backup-verify` dependem de URLs direct/pooled atuais. [NÃO VERIFICADO]

### 5.2 Mudanças verificáveis no repositório/gov

| Item                  | O que muda                                                                                       | Evidência                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Registro de evidência | ação feita no console fora do repo deve ser registrada em `docs/evidence/`                       | `AGENTS.md` ("Record every dashboard-side change in `docs/evidence/`"); **[INFERÊNCIA]** por analogia ao console Neon |
| Custo                 | nova linha mensal **usage-based** (US$1–3/mês na ordem de grandeza atual)                        | §4                                                                                                                    |
| Freeze                | upgrade na janela congelada é ação de infraestrutura (a exceção declarada é hotfix de segurança) | `EXECUTION-STATE-PROGRAM.md` 2026-09-12 (M02-D-009)                                                                   |
| BAK-01b               | passa de "exceção por indisponibilidade" para **requisito atendido**, se efetivado e medido      | SDD §16.6 + §2.3                                                                                                      |

### 5.3 **Não** muda (não confundir com benefício do upgrade)

- O **backup externo continua obrigatório**: o gate `m02:readiness` exige trio `dump.pgc` de `source=production`, `connection_kind=direct`, idade < 24 h. Upgrade não revoga esse gate. [LOCAL-VERIFICADO]
- `m02:backup-verify` continua exigindo branch de restore isolada e dois endpoints direct distintos. [LOCAL-VERIFICADO]

### 5.4 Antes/depois do requisito, em uma linha cada

- **Antes:** 6 h de janela; RPO limitado pelo orçamento de detecção de 6 h; BAK-01b aberta com exceção assinada.
- **Depois (Launch):** janela de 7 dias; a cláusula PITR do §16.6 fica satisfeita; **permanecem** backup imutável 35 d e backup fora do domínio administrativo (NFR-RES-004) e o restore isolado (NFR-RES-005).

### 5.5 O que o upgrade resolve e o que não resolve (enunciado correto para H-4)

**[INFERÊNCIA sobre §2.1 + §3]** "Contratar Launch **fecha a cláusula PITR**" é verdadeiro. "Contratar Launch **fecha o §42 / fecha a conformidade de backup**" é **falso**: continuam em aberto, por texto normativo, o backup imutável diário de 35 dias, a independência de domínio administrativo (NFR-RES-004) e a prova de Auth/RLS no restore (NFR-RES-005).

### 5.6 Restauração do PITR é destrutiva na branch — consequência operacional

Fato oficial: **PITR restaura apenas branches raiz e sobrescreve a branch.** [DOC-FIRST-ORQUESTRADOR]

Consequências (todas [INFERÊNCIA] sobre fato citado + textos locais):

1. **PITR não é restore isolado.** NFR-RES-005 exige "restauração isolada ... comprovar Auth, RLS, migrations e reconciliação"; um restore que sobrescreve a branch raiz **não** é isolado. Portanto o drill em branch de restore (`m02:backup-verify`) **continua sendo o único mecanismo que satisfaz NFR-RES-005**, e o fluxo de snapshot + branch isolada continua necessário.
2. **O runbook de rollback muda de natureza:** com PITR, o rollback app-as-usual vira operação destrutiva sobre a raiz; o texto do runbook A4/A5 (`docs/runbooks/a4-a5-cutover.md`) deve registrar que PITR é ação de último recurso com aprovação, e não o caminho primário de verificação.
3. **Risco de configuração a validar antes de contratar:** se o PITR só atua na branch raiz, é preciso confirmar se a branch `production` do projeto é raiz e o que acontece com branches filhas (`develop`) após um restore — **[NÃO VERIFICADO]**, campo a fechar com a doc oficial.

---

## 6. Campos oficiais — status após o DOC-FIRST

| #    | Campo                                                       | Status                                                                | Valor                                                                                                          | Fonte oficial (URL)                                    |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 6.1  | Planos com histórico ≥ 7 dias                               | ✅ **FECHADO**                                                        | **Launch (7 d)**; Scale (30 d) excede                                                                          | `neon.com/docs/introduction/plans`                     |
| 6.2  | Janela exata por plano                                      | ✅ **FECHADO**                                                        | Free **6 h** · Launch **7 d** · Scale **30 d**                                                                 | `neon.com/docs/postgres/backup-restore/history-window` |
| 6.3  | Preço por plano                                             | ✅ **FECHADO (usage-based, sem mínimo no Launch)**                    | compute Free US$0 · Launch US$0,106/CU-h · Scale US$0,222/CU-h; storage US$0,35/GB-mês; history US$0,20/GB-mês | `neon.com/pricing`                                     |
| 6.4  | Escopo da janela (org/projeto/branch)                       | ⚠️ **RESIDUAL**                                                       | —                                                                                                              | —                                                      |
| 6.5  | Itens de cobrança acoplados                                 | ✅ **FECHADO (compute + storage + history storage)**                  | §3                                                                                                             | `neon.com/pricing`                                     |
| 6.6  | Semântica do PITR: até quando se pode voltar                | ✅ **FECHADO** (7 d no Launch; 30 d no Scale)                         | §3                                                                                                             | `neon.com/docs/postgres/backup-restore/history-window` |
| 6.7  | Mecanismo de restore                                        | ✅ **FECHADO** — **restaura só branches raiz e sobrescreve a branch** | §5.6                                                                                                           | `neon.com/docs/introduction/branch-restore`            |
| 6.8  | Retenção de snapshots manuais / billing de snapshots        | ⚠️ **RESIDUAL**                                                       | — (history storage US$0,20/GB-mês informado)                                                                   | —                                                      |
| 6.9  | Reversibilidade/downgrade e efeito na janela                | ⚠️ **RESIDUAL**                                                       | —                                                                                                              | —                                                      |
| 6.10 | Efeito do upgrade em projetos/branches/endpoints existentes | ⚠️ **RESIDUAL**                                                       | —                                                                                                              | —                                                      |
| 6.11 | SLA/suporte por plano                                       | ✅ **PARCIAL** — Scale cita SLA/rede privada; Launch não citado       | §3                                                                                                             | `neon.com/docs/introduction/plans`                     |
| 6.12 | Regra para org já no free tier                              | ⚠️ **RESIDUAL**                                                       | —                                                                                                              | —                                                      |
| 6.13 | Teto/alerta de gasto (spend cap / budget alert)             | ⚠️ **RESIDUAL** (novo, decorrente de usage-based sem mínimo)          | —                                                                                                              | —                                                      |
| 6.14 | Anchor de seção de cada citação                             | ⚠️ **RESIDUAL** — URLs recebidas sem anchor                           | anexar se disponível                                                                                           | —                                                      |

**Residuais (6.4, 6.8–6.10, 6.12–6.14):** não bloqueiam a decisão principal (qual plano atende e quanto custa na ordem de grandeza), mas bloqueiam **efeitos colaterais** — custo de snapshots, irreversibilidade, impacto em endpoints e teto de gasto. H-4 decide o "sim/não upgrade" com 6.1–6.7 fechados; os residuais entram no plano de execução do upgrade, não na escolha do plano.

---

## 7. Regra de decisão de H-4 (agora com número)

**Opções:**

| Opção                        | ΔP/mês                                                                        | Fecha a cláusula PITR? | Residual                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| **A — Launch (recomendada)** | **≈ US$1–3/mês, usage-based, sem mínimo** [DOC-FIRST-ORQUESTRADOR]            | **SIM** (7 d)          | exige dump externo + restore isolado (NFR-RES-004/005); PITR destrutivo (§5.6) |
| B — Scale                    | ≈ 2,09× o rate de compute do Launch [INFERÊNCIA]; mínimo **[NÃO VERIFICADO]** | SIM (30 d)             | custo maior; ganho só se SLA/rede privada tiver valor                          |
| C — Exceção formal renovada  | US$0 + custo de controle manual                                               | NÃO                    | risco residual de RPO declarado; reabre no carimbo de tráfego (N-10)           |

**Break-even do controle manual (opção C):** `C_manual = 4,3 × H × R` (4,3 = conversão semanas/mês [ARITMÉTICA]; `H` = horas humanas por drill; `R` = tarifa/hora). Igualando a `ΔP = US$3`:

```text
H_break-even = 3 × 60 / (4,3 × R)  minutos por semana
  R = US$9/h   → ~4,7 min/semana
  R = US$30/h  → ~1,4 min/semana
```

`H` e `R` são **[NÃO VERIFICADOS]** (inputs de H-4). **Leitura instrumentada:** para qualquer tarifa minimamente realista, **se o controle manual semanal consumir mais de ~1,5–5 minutos de atenção humana por semana, ele já custa mais que o upgrade** — antes mesmo de contabilizar `E[perda]`. [INFERÊNCIA]

**Conclusão instrumentada (não adjetivada):** com `ΔP` na ordem de **US$1–3/mês**, sem mínimo mensal, e com break-even manual na casa de **minutos por semana**, **a opção A domina a opção C no eixo econômico**. O que resta a H-4 não é uma comparação de custo, e sim: (i) aceitar `ΔP` **usage-based** (custo cresce com tráfego; §4 leitura 2 e campo 6.13) e (ii) aceitar que o upgrade **não** fecha os demais itens de §16.6/NFR-RES-004/005 (§5.5).

**Gatilho temporal:** decidir **antes do primeiro deploy com writes** — depois disso N-10 exige PITR ≥ 7 d ativo (§2.3). [INFERÊNCIA sobre evidências citadas]

---

## 8. Contradições registradas (não resolvidas silenciosamente)

1. **"§42 exige PITR ≥ 7 dias" vs. texto do §42 local** → **ENCERRADA em v2** como GAP-DOC de referencial: a norma é SDD §16.6 (§2.2).
2. **"zero snapshots gerenciados" (auditoria 2026-09-05) vs. snapshot `snap-tiny-smoke-ayc382ji` (2026-09-05T22:37:46Z).** Ambas locais; **[INFERÊNCIA]** o snapshot foi criado após a auditoria — `backup.md` já corrige a conclusão anterior ("a ausência prévia de snapshots não provava indisponibilidade"). Contradição temporal, não erro de fonte.
3. **Brief de política BAK-01 marcado como SUPERSEDIDO** por `docs/evidence/pre-a4-2026-09-05/implementation/backup.md`. Uso correto: os controles do brief não são política vigente.
4. **PITR oficial vs. exigência de restore isolado.** O PITR sobrescreve a branch raiz (§5.6) e o SDD §16.6/NFR-RES-005 exige restauração **isolada**. Não é contradição entre fontes, mas **tensão real de desenho**: o upgrade precisa coexistir com o fluxo de branch isolada; registrar no runbook.
5. **Free com snapshots manuais (evidência local) vs. Free sem PITR ≥ 7 d (doc oficial).** Compatível: snapshot manual é ponto de recuperação pontual, não janela contínua. Mantido como distinção explícita para não sugerir que Free atende §16.6.
6. **Snapshot nativo e o gate de frescor < 24 h.** O gate **não** aceita snapshot nativo como prova (`scripts/m02-readiness.mjs`); portanto nem Free nem Launch mudam esse gate.

---

## 9. Evidência faltante (residual)

- **6.4** escopo org/projeto/branch da janela de histórico.
- **6.8** retenção de snapshots manuais e seu billing por plano.
- **6.9** reversibilidade/downgrade e o que ocorre com a janela retida.
- **6.10** impacto do upgrade em projetos/branches/endpoints existentes.
- **6.12** regra para org já existente no free tier.
- **6.13** existência de teto/alerta de gasto (mitigação do risco de custo usage-based).
- **6.14** anchors de seção das citações oficiais.
- **ADR-008**: citado por SDD NFR-RES-003/§16.6; arquivo não localizado por leitura direta neste runtime (sem listagem de diretório).
- **Prova comportamental de RLS/Auth no restore**: DESCONHECIDA (`42P01`).
- **RPO/RTO operacionais medidos** com writes reais: inexistentes (não há tráfego).

**Limites declarados do controle vigente** (`scripts/db/backup-verify.ts`, campo `limits`, verbatim):

> "Read-only comparison of public/drizzle at independent REPEATABLE READ snapshots. Requires source quiescence or comparison to the snapshot-time manifest. **Does not prove RPO, Auth runtime, recovery key custody, external retention, or cross-tenant behavior.** No credentials, row contents, or roles passwords are emitted. No resources are created or deleted."

**[INFERÊNCIA]** Este texto permanece válido **depois** do upgrade: ele descreve o que o _script_ prova, não o que o _plano_ oferece. Nenhuma redação de exceção ou de conformidade pode citar esse script como prova de RPO.

---

## 10. Fontes

**Documentação oficial (via DOC-FIRST do orquestrador, 2026-09-12):**

- `neon.com/docs/introduction/plans` — catálogo de planos, rates e diferenças (SLA/rede privada no Scale).
- `neon.com/docs/postgres/backup-restore/history-window` — janelas de histórico por plano (6 h / 7 d / 30 d).
- `neon.com/docs/introduction/branch-restore` — semântica de restore (PITR restaura **apenas branches raiz** e **sobrescreve a branch**).
- `neon.com/pricing` — compute US$0,106/CU-h (Launch), US$0,222/CU-h (Scale), storage US$0,35/GB-mês, history storage US$0,20/GB-mês, Launch sem mínimo mensal.

**Evidência local (caminhos exatos):**

- `SDD.md` §6.4 e §16.6 — norma do requisito.
- `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` §42 — gate pré-Neon production (base do GAP-DOC encerrado).
- `EXECUTION-STATE-PROGRAM.md` — entrada 2026-09-05 (VIOLAÇÃO/exceção), C-03 2026-09-07 (N-10 verbatim), C-02A/B 2026-09-08 (BAK-01a/b abertas), 2026-09-12 (12/12 migrations, tráfego inexistente, freeze).
- `docs/decision-briefs/2026-09-05-bak-01-backup-restore-policy.md` — histórico da exceção (SUPERSEDIDO).
- `docs/evidence/pre-a4-2026-09-05/implementation/backup.md` — veredito vigente + prova nativa.
- `scripts/db/backup-verify.ts` — `limits` verbatim + contrato de endpoints isolados.
- `scripts/m02-readiness.mjs` — gate de frescor < 24 h e exigências do trio.
- `scripts/m02-snapshot.mjs` — contrato do dump (direct, motivo, fail-closed, sha256).
- `.github/workflows/neon-drill-ops.yml` — snapshot-list/create e branch de drill.

**Rejeitadas/despriorizadas:** nenhuma fonte web foi usada pelo subagente (runtime sem web); a URL `neon.com/docs/ai/ai-database-versioning`, registrada em `backup.md`, não foi re-verificada e não sustenta nenhuma afirmação deste memo.

---

## 11. Próximos passos

1. **H-4:** decidir **A (Launch)** vs. B vs. C com os números das §3–§4 e §7; registrar explicitamente que o custo é **usage-based sem mínimo** e que a ordem é US$1–3/mês no uso atual.
2. **Execução do upgrade:** registrar a ação de console em `docs/evidence/` (§5.2), re-medir `history_retention_seconds` **depois** da mudança e anexar a medição ao fechamento de BAK-01b.
3. **Fechar residuais 6.4/6.8–6.10/6.12–6.14** antes de operar com tráfego; 6.13 (teto de gasto) é o principal controle do risco de custo variável.
4. **Atualizar o runbook A4/A5** com a semântica destrutiva do PITR (§5.6): PITR como último recurso com aprovação; restore isolado permanece via snapshot + branch (`m02:backup-verify`).
5. **Manter no fechamento o enunciado correto:** upgrade fecha a cláusula PITR do SDD §16.6; **não** fecha NFR-RES-004 (imutabilidade/independência) nem NFR-RES-005 (restore isolado comprovando Auth/RLS).

---

## Coordenação com o supervisor

Cronologia da rodada: (i) bloqueio de capacidade reportado — runtime do subagente sem ferramentas web, com a regra DOC-FIRST permanente em vigor; (ii) supervisor autorizou **modo LIMITAÇÃO DECLARADA** (v1, sem citação/URL inventada); (iii) o orquestrador **fechou o DOC-FIRST via web** e repassou planos, preços, janelas e a semântica de restore com URLs de origem; (iv) este memo foi atualizado para **v2**, incorporando os números com atribuição explícita (`[DOC-FIRST-ORQUESTRADOR]`) e encerrando o GAP-DOC. Nenhuma citação foi inventada em nenhuma das duas versões, e nenhum secret ou valor de env foi impresso (apenas nomes de variáveis e estados).
