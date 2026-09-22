# Análise Avançada — Plano WP-R8 `F-ci-tiers`: validação, aritmética e sete adições

> **Proveniência:** transcrita do texto entregue na sessão (analista da série), originalmente datada de
> 2026-09-21, persistida em 2026-09-22 (`L155`). Continuação de
> `analise-avancada-ci-tiers-billing-2026-09-21.md` — esse predecessor **não está versionado** no
> repositório (lacuna declarada; nada foi reconstruído dele). O §7 é addendo posterior: valida cada uma
> das sete adições por comando contra o estado **landado** do WP-R8, que executou depois desta análise.

**Data:** 2026-09-21 · **Série:** continuação de `analise-avancada-ci-tiers-billing-2026-09-21.md`

---

## 1. Sumário executivo

1. **O plano é executável como está** — e a Parte E fecha o ciclo: as três recomendações da análise R5 (guard temporal da prosa viva, `.d.mts` gerado, regra de elegibilidade) landaram no R7; os 13 skips foram dispostos pelo R6 _antes_ da ratificação; e o R0b moveu o placar sob a régua conservadora sem promover um único item a DONE. A aritmética do R0b confere em todas as casas (§2).
2. **Duas lições de humildade para esta análise, registradas:** (a) minha preocupação com `retries` (pior caso 2×) foi **refutada por medição** — `playwright.config.ts:10,30` diz `retries: 0`, pior caso 1×; (b) o **A2 é um defeito que a análise não previu** porque aceitou a claim declarada ("base desconhecida ⇒ tudo roda") sem testar-lhe a identidade — exatamente o pecado que o programa caça. O comentário e o AGENTS.md mentiam sobre `crossbrowser`; só a leitura do ramo do script pegou. Claim sem identidade vale para o analista também.
3. **Sete adições ao plano, nenhuma bloqueante** (§4): a mais importante é o **caso de aceitação que falta no A2** — "base conhecida, push não-banco ⇒ `crossbrowser=false` explícito ⇒ matriz reduzida". Sem ele, a polaridade invertida (vazio ⇒ matriz cheia) transforma qualquer omissão no caminho feliz em custo dobrado silencioso: fail-closed para cobertura, **fail-open para cota**. É o padrão WP3 (fronteira nas duas direções: limites 3 e 5) aplicado ao escopo do CI.
4. O critério B4 tem uma propriedade que vale registrar por extenso: a banda inferior de ±15% (273,7 s) funciona como **detector de pulo indevido** — run rápido demais significa tier que não rodou. O ± é bilateral por construção, não por estética. E a banda superior absorve legitimamente o variante de banco (356 s = +10,5% < 15%) — o critério é auto-consistente.

---

## 2. Verificações de consistência (todas conferem)

### 2.1 Placar R0b — aritmética exata

|         | antes    | depois       | verificação                                                                                     |
| ------- | -------- | ------------ | ----------------------------------------------------------------------------------------------- |
| D       | 150      | 150          | nenhuma promoção ✓ (régua conservadora)                                                         |
| P       | 23       | 29           | +6 (NS→P com delta nomeado) ✓                                                                   |
| NS      | 12       | 8            | −6 (para P) +2 (de UNV) = 8 ✓                                                                   |
| UNV     | 2        | 0            | −2 (API responde ⇒ mensurável ⇒ NS, não UNV) ✓ semântica estreita de U aplicada retroativamente |
| Soma    | 187      | 187          | ✓ denominador estável (cláusula 2)                                                              |
| Parcial | 86,3636% | **87,9679%** | (150 + 29/2)/187 = 164,5/187 = 0,8796791… ✓ exato                                               |
| Cru     | 80,2139% | 80,2139%     | 150/187 ✓ — e ambos exibidos lado a lado (transparência anti-placebo)                           |

As 5 cláusulas da régua visíveis no resultado: conjunção (nada virou D), denominador estável (187), P com delta nomeado (6 transições), UNV só para inverificável de princípio (os 2 viraram NS quando a API os tornou mensuráveis), fórmula congelada (exibição dupla cru × parcial).

### 2.2 Janela sem verificação

9 SHAs enumerados (`d9bc810, 5539226, 8f260f5, 011c7e3, 7e719bc, ff4c379, 4be813c, 8ecb584, 9f521ed`) com fronteira verde em `f293368` — contagem confere (9), e o alvo de revert (`4be813c`) está dentro da janela ✓.

### 2.3 Critério B4 — propriedades numéricas

- Banda: 322 × [0,85 · 1,15] = [273,7 · 370,3] s.
- Variante de banco legítima: 356 s = +10,5% → **dentro** da banda ✓ (o critério não dá revert falso se pushes de banco entrarem na amostra).
- Banda inferior como detector de skip: um push não-docs mínimo ainda roda tier 1 (151 s) + tier 3 + e2e reduzido → ~322 s; algo muito abaixo de 273,7 s indica tier que não rodou ✓.
- `updated_at − run_started_at` exclui tempo de fila — escolha correta para comparar _desenho_ (o desenho afeta execução, não fila); declarar isso no SPEC para ninguém "corrigir" a métrica depois.

### 2.4 Timeout A5

570 s medidos + `retries: 0` ⇒ pior caso 1×; 12 min = 720 s ⇒ ~2,5 min de folga ✓. Nota: com `retries: 0`, flake vira vermelho imediato — comportamento alinhado à doutrina (retry-green mascara flake; vermelho é tratado). Se o flake-rate subir pós-desbloqueio, a resposta correta **não** é adicionar retries reflexivamente.

---

## 3. Confirmações que fecham pontos abertos da análise anterior

- **§4 (coerência do contrato de cobertura):** leitura 1 confirmada por medição — `on:` intocado, disjunção preservada, `m02-ci-coverage` 9/9 verde **localmente contra o YAML novo**. A combinação proibida (YAML novo + guard velho + check verde) está descartada.
- **C2 (precisão de "sempre"):** a ambiguidade que a análise apontou vira texto exato ("sempre que a heavy é disparada").
- **C1 (protocolo de bloqueio):** item 17 estendido ao ambiente externo, com alertas de spending — a lacuna de doutrina que o episódio revelou, fechada como regra.
- **C3 (`cancelled` ≠ evidência):** fecha o ciclo do run@sha ≥1 aplicável.
- **A2 em duas camadas** (produtor emite os dois `true`; consumidor trata vazio como matriz cheia): defesa em profundidade correta — as duas camadas precisariam falhar juntas para haver skip silencioso.

---

## 4. Sete adições ao plano (nenhuma bloqueante; a primeira entra na Aceitação A)

### 4.1 (A2) Falta o caso de aceitação na direção da economia

Os casos listados são "output vazio ⇒ roda" e "base desconhecida ⇒ crossbrowser=true" — ambos na direção _caro-seguro_. Falta a direção que **protege a projeção**: **"base conhecida, push não-docs não-banco ⇒ `crossbrowser=false` explícito ⇒ chromium+mobile apenas"**. Com a polaridade invertida, um caminho feliz que esqueça de emitir `false` roda matriz cheia em todo push (~570 s em vez de 322 s) sem nenhum sintoma de erro — a cota morre em silêncio. Fronteira nas duas direções, como o WP3: limite que não roda quando deve **e** limite que roda quando não deve. (O mesmo vale para o caso banco-conhecido: `db=true` explícito + notice ausente.)

### 4.2 (D1) Duas portas de base desconhecida, não uma

"Base desconhecida" chega ao script por dois caminhos distintos: (a) **primeiro push de branch nova** — `event.before` = SHA todo-zeros; (b) **force-push com história reescrita** — `before` existe como valor mas não resolve no clone raso. São ramos de código diferentes; a falsificação deve cobrir os dois. O caminho (a) é mais barato e não perturba histórico nenhum: criar branch de teste, primeiro push, conferir `db=true` **e** `crossbrowser=true` no log do escopo. Manter (b) como segundo caso. E garantir que os runs da branch de teste **não entrem na amostra B4** (seleção: `event=push`, `branch=develop`).

### 4.3 (B3) A regra "nenhum SHA da janela foi selado" pede prova mecânica

É uma claim — e claims pedem identidade. Comando no bloco do ledger: grep dos 9 SHAs contra todos os diretórios de selo ⇒ **0 ocorrências**, com o comando registrado. E o ledger da janela deve nascer **vivo** (append): os commits do próprio WP-R8 (fixes A, SPEC, doutrina) vão landar durante o bloqueio e **entram na janela** — o bloco deve prevê-los em vez de congelar a lista em 9.

### 4.4 (B4) Precisão da amostra

Definir no SPEC: 5 primeiros pushes **pós-desbloqueio, `event=push`, branch `develop`, não-docs**, excluídas branches de teste (D1) e runs de PR (`event=pull_request`, matriz 570 s — outra população). Sem isso, a mediana mistura cenários e o critério perde sentido.

### 4.5 (A4) SHA do `actions/cache`: resolver da plataforma, nunca da memória

O método: `gh api repos/actions/cache/git/ref/tags/v4.x.y` → dereferenciar `object.sha` até o commit SHA de 40 chars (ou copiar da página oficial de releases). **Nem eu nem ninguém fornece SHA de memória** — é exatamente o "inventar SHA" que o plano recusa, e a recusa está correta. Manter como pendente declarado tem custo zero enquanto o billing bloqueia (a verificação do cache só aconteceria na Parte D de qualquer forma).

### 4.6 (E) Follow-through do R0b — duas pontas soltas mensuráveis

1. **P-delta ↔ registry:** agora existem 29 P, cada um com delta nomeado. Cada delta deve ter dono no `DEBTS.md`/backlog (DBT/F-*) — delta sem item de registry é dívida que o placar exibe e ledger nenhum cobra. Cross-ref barato (o parser de DEBTS já existe; falta o join com a tabela de transições).
2. **Os 8 NS com comando executável:** os 2 ex-UNV existem justamente porque "a API responde o estado dos recursos" — ou seja, têm comando de medição conhecido. NS com comando conhecido é medição agendável, não estado permanente. Incluir os 8 na próxima re-medição (R0c ou equivalente), que agora é barata: a régua e o parser já estão pagos.

### 4.7 (KPI) Canal de captura dos 10 CORR do R0b

10 CORR é o maior volume da série (série: WPs 3–5 ≈ 2 CORR; R1 = 2; R3 = 1; R4 = 1; R5 = 2; R0b = **10**). O padrão que emerge: **artefatos de prosa/medição têm taxa de defeito de claim muito maior que WPs de código** (R1: 4 REJ; R0b: 10 CORR — contra R3/R5: 0 REJ em código). Duas consequências: (a) registrar o canal de captura (autor/gate/S6) dos 10 — se todos vieram do S6, a auto-verificação pré-S6 não está pegando erro de claim em artefato de medição, e o KPI precisa disso para existir; (b) o comando pré-registrado por linha (que a tabela do R0b já tem) é o mitigador certo — registrar no journal o padrão "prosa de medição ⇒ claim por linha com comando", como regra de authoring da classe.

---

## 5. Leitura dos riscos declarados

A tabela de riscos está honesta e as disposições são adequadas. Duas notas:

1. **"Corrigir YAML sem CI verde é corrigir às cegas"** — a mitigação é real (parse + `bash -n` + testes de escopo + coverage 9/9 + S6 sobre alvo congelado), mas o nome correto do residual é: **erro de runtime do step só aparece no runner**. D1 é a falsificação certa; adicionar 4.2 (duas portas) fecha o residual conhecido.
2. **"S6 sem runner pode não pegar erro de runtime"** — declarado corretamente. Reforço: o S6 do B2 deve receber explicitamente os casos 4.1/4.2 como _claims a falsificar_ ("o caminho feliz emite false? os dois caminhos de base desconhecida emitem true?"), não só o texto do YAML — é revisão de identidade de claims, o que o S6 faz de melhor.

---

## 6. Veredicto

**Pode executar.** O plano fecha os três riscos agudos da análise anterior (polaridade, contrato de cobertura, land sem cadeia), transforma o primeiro push pós-billing em cerimônia com critério numérico pré-comprometido, e a Parte E demonstra que o R0b operou exatamente sob a régua combinada — placar movido sem placebo, com os dois percentuais exibidos e transições linha a linha com comando. As sete adições são baratas e uma delas (4.1 — caso de aceitação na direção da economia) deveria entrar na Aceitação A **antes** de qualquer push, porque é a única que protege o objetivo que originou o desenho: a cota. O resto encaixa como linhas de SPEC, comandos de ledger e casos de D1. E fica o registro: esta análise errou duas vezes nesta rodada (retries, A2) e ambas as refutações vieram do mesmo lugar — medição contra texto. O processo está corrigindo o analista, que é o sinal definitivo de que deixou de depender dele.

---

## 7. Addendo §V — validação das sete adições contra o estado LANDADO (2026-09-22)

O WP-R8 executou **depois** desta análise (land `9f521ed` → `94e49aa`, journal `L150`–`L154`). Cada adição foi medida por comando nesta data; nada foi aceito por leitura de prosa.

| adição                               | status medido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | prova (comando/arquivo)                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 aceitação na direção da economia | **JÁ SATISFEITA no landado** — o caso executado existe (`push com diff comum: db=false e crossbrowser=false (explícitos, não vazios)`), o lado banco existe (`push com diff de banco: db=true`), e o `::notice` correspondente é provado estruturalmente pelo teste N5 (negação exata derivada do gate). O selo do R8 consagra a fronteira nas duas direções no item 2 do checklist. Nenhum selo foi editado.                                                                                               | `src/test/m02-ci-tiers.test.ts` (describe "o script de escopo real, executado"); `wp-r8-ci-tiers-2026-09-21/README.md` §5 item 2 |
| 4.2 duas portas de base desconhecida | **PORTA-A já coberta** (SHA todo-zeros, executada); **PORTA-B era lacuna e foi fechada**: caso executado novo com `before` = commit existente mas não-ancestral (ramo irmão no fixture — é o disjuntor `merge-base --is-ancestor` que decide, não o `cat-file`). As duas portas ficam registradas na Parte D do ledger para o D1.                                                                                                                                                                           | teste novo `A2: base existente mas NÃO-ANCESTRAL …`; ledger "Parte D"                                                            |
| 4.3 prova mecânica da janela         | **EXECUTADA, COM ERRATA** — a previsão "0 ocorrências" não se sustentou e o tamanho da janela estava subdeclarado. Ver §7.1.                                                                                                                                                                                                                                                                                                                                                                                | comandos e resultados §7.1                                                                                                       |
| 4.4 precisão da amostra B4           | **REGISTRADA no ledger** (Parte D): `event=push` (PR já fora), `head_ref=develop`, branches `mission/*` (D1) fora, `conclusion=success` (cancelled fora desde o N2), não-docs.                                                                                                                                                                                                                                                                                                                              | ledger "Parte D"                                                                                                                 |
| 4.5 SHA do `actions/cache`           | **JÁ RESOLVIDA no R8** pelo método exigido: `gh api repos/actions/cache/git/ref/tags/v4` → `0057852bfaa89a56745cba8c7296529d2fc39830`, pinado em `ui-stack.yml:207`; S6 C1 confirmou. Nada a fazer.                                                                                                                                                                                                                                                                                                         | `wp-r8…/captures/tiers.log.txt` §5                                                                                               |
| 4.6 follow-through do R0b            | **JOIN FEITO** sobre os 6 deltas P da tabela de transições: `15.1`/`15.3`/`15.4` cobertos por **DBT-10** (família "entrypoint de runtime"); `15.2`/`15.7`/`29.1` sem dono ⇒ **DBT-20/21/22** abertas agora. Os 8 NS entram na **R0c** (agendada no journal; comandos já pré-registrados no SPEC do R0b). Escopo declarado: os outros 23 P anteriores têm delta nos artefatos de origem de suas rodadas, fora desta tabela — join deles é trabalho da R0c, não lacuna silenciosa.                            | `agent-state/DEBTS.md` (DBT-20/21/22); `wp-r0b…/README.md` §4                                                                    |
| 4.7 canal dos 10 CORR do R0b         | **REGISTRADO: 10/10 S6 · 0 autor · 0 gate** — pela taxonomia do programa, CORR é por definição correção vinda do S6, e o R0b não tinha coluna de canal (diferente do selo R8, que publica §6/KPI `3 autor / 22`). Leitura: a auto-verificação pré-S6 do R0b pegou defeitos de instrumento (D1–D8, declarados pelo próprio autor) e **nenhum** erro de claim — mesma assinatura que o KPI do R8 depois quantificou. Regra de autoria adotada no journal: **prosa de medição ⇒ claim por linha com comando**. | `wp-r0b…/README.md` §7 (`14 C · 10 CORR · 1 REJ`); `wp-r8…/README.md` §6; journal `L156`                                         |

### 7.1 Errata da 4.3 — identidade da claim da janela e tamanho da janela

Comandos executados em 2026-09-22 (somente leitura):

```text
# (a) arquivos de selo tocados por cada SHA da janela declarada
for s in <13 SHAs>; do git show --name-only --format= $s | sed -n '/MANIFEST\|wp-r/p'; done
# (b) pares sha@run com SHA da janela em toda a evidência
grep -E '(d9bc810|…|a2f5ff6)@[0-9]{6,}' docs EXECUTION-STATE-PROGRAM.md
# (c) composição real depois da fronteira verde
git log --oneline f293368..HEAD            → 21 commits
gh api repos/Douglas0101/preco-que-da-lucro/commits/<sha>/check-runs   (para os 8 não listados)
```

Resultados medidos:

1. **A janela tem 18 SHAs, não 13.** Dos 21 commits `f293368..HEAD`: `90d12f9` tem 2/2 runs verdes (fora da janela, corretamente), `41e776b` e `e61c9f4` não são pushados (classe separada — commits locais, entram na varredura pós-desbloqueio por não-verificados, mas não são "push sem verificação"). Restam **18 pushed com 0 check-runs**: os 13 declarados + `9237d01`, `a95254b`, `4eed127`, `974426b`, `f4edb66`.
2. **"Nenhum SHA da janela foi selado" é falso literalmente:** 8 dos 18 tocam arquivos de selo — `8f260f5` e `7e719bc` (captures do R7), `011c7e3` e `ff4c379` (reseal do R7), `6e9dac9`, `94e49aa` e `a2f5ff6` (selo do R8), e `974426b` (que **cria** o selo do R8). A previsão da própria adição 4.3 ("grep ⇒ 0 ocorrências") também não se sustenta: os SHAs da janela são citados legitimamente como base/ancestralidade e como forense do incidente.
3. **O invariante que sustenta a varredura é outro, e ele é verdadeiro e medido:** todo par `sha@run` com SHA da janela está rotulado como precondição falha — `8f260f5@35613943429`, `8f260f5@35613943354`, `011c7e3@35613977835`, `398a77c@35682256860`, `398a77c@35682256839` — **0 citáveis como verificação**, e nenhum selo afirma run verde para a janela (o `run@sha` do selo do R8 está em branco por protocolo, item 15/L1).
4. A claim corrigida (18 SHAs; "nenhum com run verde citável"; 2 locais não-pushados à parte) está no ledger (Parte D) e no journal. Os selos **não** são reescritos — errata append-only, como manda a convenção da série.

### 7.2 Nota sobre §2.3 (centro de B4)

A defesa numérica da banda em §2.3 usou o centro **322 s**, que o S6 do WP-R8 depois **refutou e re-centrou em 425 s** (banda 361–489 s; `captures/janela.log.txt`): o modelo "~60 s por projeto" não era medição, e os 4 projetos do Playwright correm em série (1 worker em runner de 2 núcleos), então a economia real de cortar firefox+webkit é 124 s, não 217 s. A propriedade estrutural que §2.3 defendeu vale integralmente com o centro novo, re-derivada: `425 × [0,85; 1,15] = [361,25; 488,75]` ⇒ banda publicada `[361; 489]` (arredondamentos exatos), o variante de banco projetado (459 s = +8%) cabe na banda, e a banda inferior segue como **detector de pulo indevido**: mediana abaixo de 361 s significa tier que não rodou.
