# Template de Work Package (SDD) — `docs/evidence/_templates/work-package.md`

> **Para que serve:** é o molde de todo WP. O autor copia a estrutura para
> `docs/evidence/<slug>-<data>/SPEC.md` (plano) e `README.md` (resultado/selo), preenche as
> seções e **demonstra o checklist anti-vacuoso** item a item antes do S6 adversarial.
> **Regra dura:** um WP sem o checklist demonstrado volta do S6 — a checklist não é prosa
> decorativa, é o contrato de prova. Origem: os defeitos de harness que o S6 forçou nos
> WPs 1–5 (ver apêndice A).

---

## 1. Seções obrigatórias do SPEC (S1)

| seção          | conteúdo mínimo                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Fato-fonte** | caminho e linha da fila/veredicto que abriu o WP (`QUEUE.md:NN`, veredicto, medição)               |
| **Problema**   | o defeito/lacuna **medido**, com arquivo:linha e trecho verbatim; o que o plano mestre diz do item |
| **Contrato**   | a invariante que passa a valer, em termos falsificáveis (o que tem de ser verdade após o fix)      |
| **Mudanças**   | lista fechada de arquivos e mudanças; o que **não** muda                                           |
| **DoD**        | critérios binários, cada um com o comando/artefato que o prova                                     |
| **Testes**     | RED/GREEN planejados e a **falsificação** (o par que reprova quando o defeito existe)              |
| **Riscos**     | o que pode dar falso verde, o que fica declarado e não corrigido                                   |
| **Rollback**   | como desfazer (branch/worktree/migration down) e o que não fica em `develop` antes do Gate C       |

## 2. Seções obrigatórias do README (S5, claim)

- Sumário do que mudou e por quê; tabela de arquivos com sha256 (ou ponteiro para `captures/hashes.txt`).
- **Evidência** por fase (RED, GREEN, bateria, gate, E2) com ponteiro para `captures/` e os números
  medidos.
- **Riscos e limites declarados** (defeitos novos declarados, com razão).
- **Auto-verificação pré-S6:** itens do checklist executados **pelo autor**, com evidência; somar o KPI
  `capturados pelo autor antes do S6 / total de achados` e a densidade de achados do S6 (série no
  journal). Sem esse número o checklist é medido só como detector, nunca como prevenção.
- Seção **S6 ADVERSARIAL** preenchida (claims × veredicto, CORR tratadas na §7, N declarados na §4).
- `MANIFEST.sha256` com `checked === discovered` (conjunto descoberto **não vazio**; gerado/conferido
  preferencialmente por `scripts/m02-seal.mjs`).

## 3. Checklist anti-vacuoso (obrigatório — demonstrar item a item)

Marque **como cada item foi satisfeito**, com ponteiro (arquivo:linha, captura, hash). Um item não
aplicável exige justificativa; "não se aplica" não substitui prova.

| #   | item                                       | como demonstrar                                                                                                                                                                                                                                                                                                                                                               | origem (S6)                        |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **Controle negativo obrigatório**          | a prova central tem um par que **reprova** quando o defeito existe; o par roda os **bytes do pai** ou mutação restaurada por sha256                                                                                                                                                                                                                                           | WP3 C5/N1; WP5 C2/N1               |
| 2   | **Fronteira nas duas direções**            | ao pinar limite/constante, o teste distingue os **dois** lados (descer e subir) e a suíte antiga passa nos dois                                                                                                                                                                                                                                                               | WP3 C4                             |
| 3   | **Identidade, não cardinalidade**          | o veredicto nomeia **o caso** que falhou, ancorado na linha de falha, e exige queda **única**; contagem igual não distingue revisões                                                                                                                                                                                                                                          | WP3 C5/N1; TRILHO C §2.1; WP2 §9   |
| 4   | **Proibido exit-code-only**                | verde não se decide só por `exit 0`; exige **zero do sintoma** (ex.: `23503 == 0`, requisição ausente)                                                                                                                                                                                                                                                                        | WP4 C5/N2                          |
| 5   | **Proibido sleep fixo como sincronização** | espera por **marcador observável** (ex.: `__reactContainer$`); sem o sinal, a medição **falha alto**                                                                                                                                                                                                                                                                          | WP5 C2/N1                          |
| 6   | **Sem valor degenerado na identidade**     | a asserção compara valor **serializável e distinto** nos dois estados; nada que serialize para `undefined`/constante                                                                                                                                                                                                                                                          | WP5 C2/N2                          |
| 7   | **Precondição de estado compartilhado**    | fases que compartilham estado **assertam** a precondição (container, trigger, linhas semeadas); fase isolada não passa vazio                                                                                                                                                                                                                                                  | WP4 N3                             |
| 8   | **Sentinela real por cenário**             | a prova usa dado semeado de fato (id fixo/trigger/linha real) por cenário, não inferência de lista                                                                                                                                                                                                                                                                            | WP4 C4; WP4 SPEC §5                |
| 9   | **Fingerprint de revisão**                 | cada fase fixa `HEAD` + sha256 dos bytes; o RED **asserta** que roda os bytes do pai                                                                                                                                                                                                                                                                                          | WP4 N5                             |
| 10  | **`checked === discovered`**               | o selo declara o conjunto descoberto (não vazio: 0 = 0 reprova) e o listado; manifesto conferido; sem allowlist de legado                                                                                                                                                                                                                                                     | AGENTS.md; TRILHO C §2.1; WP2 §9   |
| 11  | **S6 adversarial de contexto limpo**       | veredicto por claims com `0 REJECTED`; `UNVERIFIABLE` exige declaração na §4 e **não** conta como verificado; CORR tratado                                                                                                                                                                                                                                                    | WPs 1–5                            |
| 12  | **Falha alta (fail-closed)**               | nenhum `try/catch` compensatório converte erro em sucesso vazio; guards/runner/piso reprovam com mensagem nomeada                                                                                                                                                                                                                                                             | WP3 N2/N3; INV-013                 |
| 13  | **Isolamento de bancada assertado**        | `:5432` intocada, container efêmero removido, zero credencial herdada e `origin/main` conferido — **assertado**, não só impresso                                                                                                                                                                                                                                              | WP3 N4; WP4 N7; WP5 N7             |
| 14  | **Todo check impresso tem gate e captura** | exits de scaffold/cleanup viram asserção; as capturas exigidas pelo DoD (gate, bateria, H-9) existem no selo                                                                                                                                                                                                                                                                  | WP4 N4; WP5 N7                     |
| 15  | **Run de CI atado ao commit selado**       | o run citado tem `headSha` **igual ou descendente** do commit selado e **≥ 1 check aplicável** (não-no-op) com `conclusion=success`; run no-op só é citável como "cobertura delegada ao heavy do mesmo commit"; conferido por `gh run list`/`gh run view` filtrado por SHA; se o trigger não se aplica, registrar `N/A-trigger <motivo>; último verde = <run> em <commit>`    | achado da Fase 0 (WP-R3)           |
| 16  | **Descoberta multi-sítio**                 | correção/purga/instrumentação multi-sítio enumera os sítios por **descoberta** (catálogo, grep de workflows, `pg_catalog`) e asserta `checked === discovered`; sítio novo **falha por default** (nenhuma lista fixa de sítios)                                                                                                                                                | WP4 N1; WP-R3 N4; selo do R3       |
| 17  | **Precondição de estado ambiente**         | toda ferramenta de evidência (selo, guard, parser) declara suas precondições de ambiente (worktree limpo, profundidade de clone, deps, rede) e as verifica em runtime, falhando **fechado** com mensagem **distinta de veredito** (`exit 2` = precondição, `exit 1` = relação provada falsa); teste que depende de estado de repo constrói fixture própria (padrão `8a981f6`) | WP-R5; incidente `81cc7ed`; `L137` |

## 4. Taxonomia de veredicto (fixar no journal do land)

- **CORR** = _claim_ do autor corrigida pelo S6 (o claim dizia A, o fato dizia B).
- **N** = **defeito novo** encontrado pelo S6, latente ou material (pode existir com `0 CORR`).
- **"Correções forçadas"** = CORR + N corrigidos antes do selo. Contar só CORR subnotifica o custo do
  S6; contar os dois sem separar confunde auditoria. Usar sempre os dois números, nomeados.
- **Bounds do SDD** (S6→S5 e S6→S3) limitam **rodadas de correção de um WP**, não a quantidade de
  claims corrigidas num veredicto: um veredicto com 3 CORR (WP1) não viola bound nenhum; viola se o
  mesmo WP voltar ao S6 além da segunda rodada.
- **Onde cada coisa mora no selo:** CORR tratadas na §7 (S6 ADVERSARIAL); N corrigidos na §7; N
  **declarados** (não corrigidos) na §Riscos.

## Apêndice A — rastreabilidade do checklist (por que cada item existe)

| item | defeito real que o item pega                                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | WP3: o veredicto da falsificação aceitava qualquer falha desde que o nome do caso aparecesse; WP5: a metade `window.va` não tinha par que reprovasse                                                                                                                              |
| 2    | WP3: a suíte era cega para limite 3 e 5; só a fronteira nos dois lados pina o valor                                                                                                                                                                                               |
| 3    | WP3: o grep contava o nome do caso em qualquer linha (inclusive `✓`); qualquer falha alheia passava                                                                                                                                                                               |
| 4    | WP4: o veredicto GREEN decidia só por `exit==0`; um caminho que engolisse 23503 passaria verde                                                                                                                                                                                    |
| 5    | WP5: `waitForTimeout(1500)` como única margem; hidratação mais lenta ⇒ o gate divergente não aparecia na janela                                                                                                                                                                   |
| 6    | WP5: `expect(window.va).toBeUndefined()` era inerte porque `page.evaluate` não serializa funções                                                                                                                                                                                  |
| 7    | WP4: o GREEN assumia "mesmo estado do RED" sem asserir container/trigger/trilha; num banco limpo passaria vazio                                                                                                                                                                   |
| 8    | WP4: a trilha existia de fato (pré-semeio por id fixo + trigger de probe), não numa lista                                                                                                                                                                                         |
| 9    | WP4: o instrumento rodava o working tree; a honestidade do RED dependia de forense de stack trace                                                                                                                                                                                 |
| 10   | TRILHO C §2.1 (guard comparava cardinalidade, não identidade); WP2 §9 (manifesto verde sobre a revisão errada, conforme o relato do próprio selo)                                                                                                                                 |
| 11   | Todos: o S6 de contexto limpo pegou o que a suíte do autor não pegava (a suíte testava as strings escolhidas pelo autor)                                                                                                                                                          |
| 12   | WP3: o runner encadeado saía 0 com a prova de banco apagada (F-D2-runner-failopen)                                                                                                                                                                                                |
| 13   | WP3 N4 (H-9/runtime impressos sem asserção); WP4 N7 (container residual); WP5 N7 (portas sem captura)                                                                                                                                                                             |
| 14   | WP4 N4 (exits do scaffold só ecoados); WP5 N7 (captura de gate/cleanup ausente)                                                                                                                                                                                                   |
| 15   | Fase 0 (WP-R3): a célula de CI do WP-R2 citou `35484327532` (de `1aad70c`) como se fosse do land `c9d1740`; run ID é claim e exige identidade                                                                                                                                     |
| 16   | WP4 N1 (purga cobrindo 5 de N sítios) e WP-R3 N4 (guard em 2 de 3 superfícies): lista fixa de sítios deixa o sítio novo descoberto; o antídoto é a enumeração por descoberta com `checked === discovered`                                                                         |
| 17   | WP-R5: três incidentes em cinco WPs foram a mesma classe — pressuposto de ambiente não declarado (R0 worktree sem `npm ci`, R4 clone raso + negativo vacuoso, `.gitignore` derivado). A vacuidade de asserção já era mecanizada; a de **ambiente** dependia de descoberta reativa |

## Apêndice B — layout do selo

```
docs/evidence/<slug>-<data>/
├── SPEC.md                 # plano (S1), com o checklist preenchido na §3
├── README.md               # resultado (S5), com S6 preenchido
├── MANIFEST.sha256         # checked === discovered (ferramenta do selo)
└── captures/               # *.txt: logs, scripts, auditoria, hashes — nunca bytes reformatados
```

O journal (`docs/evidence/agent-state/PROGRESS.md`) registra `▶` antes da mutação e `✔`/`✘` depois,
com o sha do merge no commit de land.
