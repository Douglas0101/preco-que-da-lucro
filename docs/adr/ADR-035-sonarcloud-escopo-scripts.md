# ADR-035 — Escopo de `scripts/**` no SonarCloud: exclusão por cota, fechamento não decidido

- **ID:** ADR-035 · **Rastro:** Ciclo 20 / `DBT-58` ← `DBT-55` ← `DBT-40` · **Data:** 2026-09-30
- **Estado:** **PROPOSTA** — a exclusão vigente fica registrada com limite declarado; a **escolha
  entre as duas vias de fechamento** (subir o plano da organização **ou** reduzir LOC reais de
  `scripts/**`) é reservada ao MAESTRO. Nenhuma das duas foi executada, nenhum gasto foi
  autorizado e nenhuma linha de código foi tocada por este ADR.
- **Tipo:** conformidade / escopo de análise estática
- **Precedente de forma:** `ADR-034-sonarcloud-escopo-por-cota.md` (precedente imediato),
  `ADR-030-boundary-guard-dbt19.md`

---

## 1. Fato

A organização `douglas0101` está no plano gratuito do SonarCloud, cujo teto é **50.000 linhas de
código**. Medição local em `fd9449f` (`docs/evidence/sonar-dbt55-unblock-2026-09-30.md` §2):

| superfície                   | LOC        | observação                                 |
| ---------------------------- | ---------- | ------------------------------------------ |
| `scripts/**`                 | **34.972** | sozinho cabe na cota, com folga de 15.028  |
| `src/**` (sem `src/test/**`) | **23.864** | é o escopo que roda hoje                   |
| soma                         | **58.836** | não cabe: excedente projetado de **8.836** |

**`scripts/` é maior que toda a aplicação.** O que estoura a cota não é `scripts/**` sozinho — é a
soma dele com `src/**`. E isso não é estimativa: o servidor **rejeitou duas análises**, com o erro
literal (`/api/ce/activity`):

```text
This analysis will make your organization 'douglas0101' reach the maximum allowed lines limit of
50000. Current LOC usage is: 0.
LOC count in this analysis: 55028.
Language distribution: css=135, js=9230, plsql=366, py=2100, shell=1036, ts=40940, yaml=1221
```

A distribuição por linguagem fecha exatamente com o total: `135 + 9.230 + 366 + 2.100 + 1.036 +
40.940 + 1.221 = 55.028`. A segunda tentativa, excluindo `docs/**` e `.github/**`, mediu
**53.134** — e a cadeia também fecha: `55.028 − 1.894 = 53.134`, porque essas duas árvores são
sobretudo `.md` e `yaml`.

Para que **qualquer** análise landasse, `scripts/**` teve de sair do escopo: o analyze roda com
`sonar.sources=src`. O que se ganhou e o que se perdeu:

- **Ganhou-se veredito onde não havia nenhum.** `projectStatus.status = ERROR` — não `NONE`. Das
  **6** condições do gate built-in _Sonar way_, **5 passam**; a única que reprova é
  `new_coverage` = **0** contra `< 80`, causa distinta, registrada em `DBT-57` (nenhum relatório de
  cobertura era enviado — a condição nunca tivera valor antes).
- **Perdeu-se cobertura estática sobre a maior superfície do repositório.** **53 dos 69** achados
  de confiabilidade triados no `DBT-40` (regras `shelldre:S7688` em `scripts/local-ci.sh` e
  `scripts/verify-mcp-relaunch.sh`) passaram a ficar **fora do gate**. Conta nominal:
  `69 − 1` (a exclusão do `ADR-034`, `e2e/visual/visual-capture.ts`) `− 53` (`scripts/*.sh`)
  `= 15` achados da triagem que seguem medidos. O total de achados de **outras** regras que saiu
  junto com `scripts/**` **não** foi enumerado no registry — este ADR **não** o estima.

## 2. Decisão

### 2.1 O que vigora

`scripts/**` (34.972 LOC) fica **fora** do escopo da análise estática. A razão é **cota**, não
qualidade, e a exclusão é declarada — nunca silenciosa. **Não é uma escolha de qualidade, e não
pode ser lida como uma:** é a condição para que exista análise de qualquer coisa. A superfície
excluída continua exercitada por execução (`npm run check` e os pipelines, que rodam as próprias
guardas de `scripts/`), mas análise estática de terceiro sobre ela não existe hoje.

### 2.2 O que fecha a dívida, quantificado — duas vias, e só duas

O fechamento **não** se resolve excluindo mais nada (`DBT-58`). As duas vias são **medidas**, e as
contas saem dos números acima:

**Via (a) — upgrade do plano da organização (fora do código).** Preserva **100 % do escopo**:
`scripts/**` volta à análise e os 53 achados de `shelldre:S7688` voltam ao gate, junto com o
restante de `scripts/**`; nenhuma linha de código muda. O teto contratado tem de cobrir a soma
medida — o piso conhecido é **53.134** LOC (medida do servidor, com `docs/**` e `.github/**` já
fora) e a projeção local é **58.836**. A suficiência do plano exato **se verifica pela API do
compute engine depois de contratado**, com a mesma régua dos números acima; este ADR **não**
estima preço, tier nem teto de plano pago — isso é decisão de organização, não de repositório.

**Via (b) — redução real de LOC de `scripts/**`, com disciplina de prova.** Duas contas, e a que
decide é a segunda:

| conta                       | desenvolvimento                                                                                                                                                      | resultado                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| piso medido (decide)        | última análise medida: `53.134 − 50.000`                                                                                                                             | **3.134** LOC                            |
| projeção local (não decide) | soma projetada: `23.864 + 34.972 = 58.836`; excedente `58.836 − 50.000`; teto de `scripts/` com `src/` congelado `50.000 − 23.864 = 26.136`; queda `34.972 − 26.136` | **8.836** LOC (**25,3 %** de `scripts/`) |

A divergência entre as duas contas é ela própria um achado: `58.836 − 53.134 = 5.702` LOC. Decidir
pela projeção local fixaria um alvo **5.702 LOC maior** que o piso medido (8.836 contra 3.134) —
exatamente o modo de falha que o controle negativo (ii) do `DBT-58` nomeia.

"Redução real" significa **apagar ou consolidar código**, nunca reclassificar arquivo (§4, o
caminho "Reduzir LOC por reclassificação"). E fechar raspando em 50.000 deixa **zero** de folga: a decisão do Ciclo 18 operou com folga de
`50.000 − 35.666 = 14.334` LOC sobre o `main`; uma recomendação de margem, e qual margem, é parte
da ratificação, não deste registro.

### 2.3 O que este ADR não decide

Não escolhe entre (a) e (b). Não autoriza gasto, não autoriza refactor, não declara `DBT-58`
quitada e não altera o escopo vigente. A escolha envolve dinheiro ou um refactor grande — nenhum
dos dois é decisão de agente — e fica **aguardando ratificação do MAESTRO** no ledger.

`ADR-034` §4 registrou "subir o plano" como alternativa **não** escolhida no Ciclo 18, quando a
decisão foi não pagar _naquele momento_. Isso **não** é veto permanente: o `DBT-58`, escrito
depois, mantém o upgrade como **uma das duas** vias de fechamento. Reabrir ou encerrar a via por
precedente — em qualquer direção — é decisão nova, não herdada.

## 3. Contratos e invariantes

1. **A redução de escopo é declarada, nunca silenciosa:** nomeada neste ADR, em `DBT-58` e na
   configuração versionada do projeto. Medição de 2026-09-30: `.sonarcloud.properties` declara
   `sonar.exclusions=drizzle/**,src/test/**,e2e/**` (do `ADR-034`), e o recorte que faz a análise
   landar — `sonar.sources=src` — vive na invocação do scanner
   (`docs/evidence/sonar-dbt55-unblock-2026-09-30.md` §5 e §9), **não** no arquivo versionado.
   **Invariante:** enquanto o recorte não estiver onde um clone o leia, uma análise disparada sem o
   flag volta a ser `REJECTED` — e uma análise que não fixa escopo não é auditável por leitura.
2. **A contagem que decide é a do Sonar (`ncloc`), nunca a local.** Aqui as duas divergem em
   **5.702** LOC (58.836 local contra 53.134 do servidor); no `DBT-54` já divergiram em escala de
   milhares. Medir a coisa errada reabre a dívida que se quis fechar.
3. **"Sem veredito" ≠ "vermelho" ≠ "verde".** Rejeição por cota aborta antes de inspecionar
   arquivo algum: não é gate vermelho nem aprovação. Confundir os estados, em qualquer direção, é o
   defeito que este ADR existe para impedir.
4. **Escopo incompleto não é gate completo.** Enquanto `DBT-58` estiver aberta, nenhum documento
   pode afirmar que o repositório tem análise estática completa.
5. **Nenhum achado foi silenciado.** Os 53 saíram por **escopo**, nomeados; nenhum foi marcado como
   falso positivo nem aceito.
6. **Bloqueios distintos não se confundem.** O gate reprova hoje por `new_coverage` = 0
   (`DBT-57`), não por escopo. Fechar a cobertura **não** devolve `scripts/**` ao escopo, e devolver
   `scripts/**` **não** move `new_coverage`.
7. **Controle negativo — o que reprova esta decisão:**
   - (i) **Re-incluir `scripts/**` sem fechar a cota** reprova a análise por `REJECTED`
     (`55.028` / `53.134`): o estado é **sem veredito**, e chamá-lo de vermelho ou de verde reprova
     duas vezes.
   - (ii) **Declarar "resolvido" com `scripts/**` fora do escopo sem nomear o limite** reprova o
     próprio ADR — é a mesma classe de defeito que a prosa viva do `AGENTS.md` já teve de corrigir
     contra o registry (`DBT-34`).
   - (iii) **Decidir exclusão ou expansão por contagem local** (`cloc`, `wc -l`, contagem por
     `git ls-files`) reprova o controle negativo (ii) do `DBT-58`.
   - (iv) **Fechar apagando ou aceitando os 53 achados** reprova: marcar issue não reduz `ncloc`
     (não fecha cota nenhuma) e silencia em vez de medir.
   - (v) **Reduzir `ncloc` sem reduzir complexidade** (minificar, colapsar linhas, mover código
     para fora do recognizer, ampliar `sonar.exclusions`) reprova a via (b): é a via proibida
     "excluir mais" disfarçada de refactor.
   - (vi) **Tratar o escopo como se fosse o `DBT-57`** (ou o inverso) reprova o invariante 6.

## 4. Alternativas

Vias de fechamento — **não** são inviáveis, são a decisão reservada ao MAESTRO:

| via                                | o que exige                                                                                                    | o que preserva / o que custa                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **(a) Upgrade do plano**           | elevar o teto acima da soma medida; suficiência verificada pelo `ncloc` do Sonar, não estimada aqui            | preserva 100 % do escopo e devolve os 53 achados ao gate; custo recorrente, decisão de organização, fora do código     |
| **(b) Redução real de `scripts/`** | cair **≥ 3.134** LOC medidos pelo Sonar (piso), 8.836 na projeção local; código apagado/consolidado, com prova | mantém o plano gratuito; ao voltar a caber, `scripts/**` volta ao escopo e os 53 voltam ao gate; exige refactor grande |

Caminhos considerados e **inviáveis**:

| Alternativa                                                                                                          | Por que não                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-incluir `scripts/**` sem fechar a cota                                                                            | `REJECTED` pelo servidor (`55.028`, `53.134`): produz **ausência de veredito**, o estado que o `ADR-034` e o `DBT-54` existem para impedir.                                                                |
| Excluir mais superfície para caber (`docs/**`, `.github/**`, produção)                                               | O `DBT-58` proíbe como fechamento, e a medição mostra que é insuficiente: `docs/**` + `.github/**` valem **1.894** LOC contra excedentes de 3.134 e 5.028. Excluir produção é gate teatral (`ADR-034` §4). |
| Analisar `scripts/**` e largar `src/**`                                                                              | Inverte a prioridade — o gate existe para o código de runtime — e trocar superfície não é fechar cota: é o caminho anterior com outro nome.                                                                |
| Marcar os 53 como falso positivo / aceitos                                                                           | Não reduz `ncloc`, logo **não** fecha a cota, e silencia em vez de medir; recusado no `ADR-034` §4 e pela cultura do repositório.                                                                          |
| Reduzir LOC por reclassificação (minificar, colapsar linhas, mover para gerado/`.prettierignore`, renomear extensão) | Não é a "redução real" da via (b); trapaceia a métrica em vez de reduzir complexidade, e reprova o controle negativo (v).                                                                                  |
| Decidir o escopo por contagem local (`cloc`, `wc -l`)                                                                | Controle negativo (ii) do `DBT-58`: a contagem local já divergiu do Sonar em 5.702 LOC aqui e em milhares no `DBT-54`.                                                                                     |
| Declarar quitado porque "existe veredito" (`ERROR`, não `NONE`)                                                      | Confunde os três estados do invariante 3 — e o veredito atual nem sequer é verde (`new_coverage` = 0).                                                                                                     |
| Esperar _Automatic Analysis_ / trocar de analisador                                                                  | Medido no Ciclo 19: _Automatic Analysis_ **não** era o bloqueio; o bloqueio era a cota. Não move uma linha de LOC e não fecha nada.                                                                        |

## 5. Consequências

**Positivas.** Existe veredito onde antes não havia nenhum (`ERROR`, 6 condições, 5 verdes) e o
código da aplicação passou a ser medido: `new_violations` = **24**, todos _code smells_, com
**0 bugs** e **0 vulnerabilidades** no código novo. A redução de escopo é auditável por clone:
está neste ADR, em `DBT-58` e na evidência de 2026-09-30, com os números que a sustentam.

**Negativas e limites.** `scripts/**` — a **maior** superfície do repositório (34.972 LOC contra
23.864 de `src/**` sem testes) — está fora do gate, e com ela os 53 achados de `shelldre:S7688`.
O gate **continua vermelho**, por outra condição (`new_coverage`, `DBT-57`), e isso não se resolve
por escopo. A folga que a exclusão deixa é de `50.000 − 23.864 = 26.136` LOC: qualquer crescimento
de `src/**` a consome, e o problema é de **crescimento**, não de um pico — a cota volta à mesa na
primeira soma que a alcance. O piso de redução (3.134 LOC) é uma **medida do servidor** e tem de
ser reconferido pelo `ncloc` a cada tentativa; a projeção local (8.836) serve de aviso, não de
alvo.

**Dívida declarada.** `DBT-58` carrega o teste de fechamento e os dois controles negativos
(análise que inclui `scripts/**` e estoura a cota tem de **reprovar**; a contagem que decide tem de
ser a do Sonar). `DBT-54` está fechada e a exclusão dela segue vigente e declarada. `DBT-57` é a
condição vermelha corrente e **não** se confunde com esta. Enquanto `DBT-58` estiver aberta,
nenhum documento pode afirmar que o repositório tem análise estática completa.

---

## 6. Emenda — Ciclo 22: a terceira via medida (licença OSI)

O §4 registrou duas vias de fechamento (subir o plano ou reduzir LOC reais de `scripts/**`). Falta
uma, e ela é a única que alcança o objetivo **sem recortar escopo e sem pagar**:

| via                                             | o que faz                                                                                                                                                         | custo                                                      | decisão                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------- |
| (a) subir o plano                               | devolve `scripts/**` ao gate com o escopo completo                                                                                                                | recorrente, em dinheiro                                    | MAESTRO                          |
| (b) reduzir LOC de `scripts/**`                 | devolve `scripts/**` ao gate sem pagar                                                                                                                            | refactor grande (≈ 8.836 LOC / 25,3 %)                     | MAESTRO                          |
| **(c) licenciar o repositório com licença OSI** | o programa OSS do SonarCloud **dissolve a cota de 50k** para repositório **público com licença OSI**; `scripts/**` volta inteiro e nada mais precisa ser excluído | **zero** — mas abre o código-fonte de um produto comercial | **MAESTRO (decisão de negócio)** |

**Fato medido que sustenta (c):** o repositório `Douglas0101/preco-que-da-lucro` é **público**, mas
**não tem `LICENSE`** e o `README.md:127` declara _"Repositório privado. Todos os direitos
reservados."_. Público sem licença OSI **não** é elegível ao programa OSS — a cota de 50.000 LOC
segue **ativa**, com as cinco recusas medidas que este ADR documenta. A distância entre "free com
cota" e "free sem cota" é, literalmente, um arquivo `LICENSE` com MIT ou Apache-2.0.

**Controle negativo de (c):** licenciar **sem** tornar o repositório público não move nada (o
programa exige público **e** OSI); tornar público **sem** licença OSI também não move nada — é o
estado atual, medido. As duas condições são necessárias, e nenhuma das duas foi executada.

**Por que esta emenda não decide:** abrir o código de um produto comercial é decisão de negócio, e
`DBT-60` registra que a visibilidade atual já diverge do que o README declara. As três vias ficam
registradas com o mesmo status: **abertas, aguardando o MAESTRO**.
