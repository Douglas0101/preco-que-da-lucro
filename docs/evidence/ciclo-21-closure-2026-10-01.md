# Ciclo 21 — Modo Fechamento: relatório de fechamento

- **Data:** 2026-10-01 · **Base:** `2d73fa3` (develop) · **Gate medido por MCP** no fechamento
- **Lista de fechamento:** `DBT-57` · `DBT-58` · workflow Sonar automatizado · estratégia de chaves
- **Placar:** **2 FECHADAS** · **2 ESCALADAS** (com o número medido que a decisão precisa) · **0 consertadas
  fora de escopo**

---

## 1. O resultado que importa: `new_coverage` saiu de 0 e chegou a 63,3

A única condição que reprovava o gate era `new_coverage` = **0** contra limite `< 80`, e ela reprovava
porque **nenhum relatório de cobertura era enviado** — não porque o código fosse mal testado. Isso
mudou, e a prova é a medição do próprio gate:

| momento             | `new_coverage` | como                                                  |
| ------------------- | -------------- | ----------------------------------------------------- |
| antes               | **0,0**        | nenhum relatório enviado                              |
| depois de `2d73fa3` | **63,3**       | workflow novo rodou em CI e o scanner consumiu o lcov |

As outras cinco condições seguem **OK**: `reliability` 1, `security` 1, `maintainability` 1,
duplicação 1,1, hotspots 100.

**Cobertura medida pela suíte** (`npm run test:coverage`, 114 arquivos, 1380 testes, exit 0):
linhas **65,5 %** (5888/8989), statements 64,7 %, branches 59,8 %, funções 65,0 %. O lcov tem
289.837 bytes e 153 registros `SF`.

**Correção de premissa, medida:** o `DBT-57` cita `sonar.coverageReportPaths`, mas essa propriedade
espera o **formato genérico de cobertura do SonarQube (XML)**, não lcov. Para lcov em JS/TS a
propriedade correta é `sonar.javascript.lcov.reportPaths` — é ela que está no workflow e na
configuração versionada.

---

## 2. Tarefa a tarefa

### ✅ FECHADA — workflow Sonar automatizado

- **Artefato:** `.github/workflows/sonar.yml`.
- **Closure test:** o workflow roda e o scanner sobe a análise. **Medido:** run **`36807917872`** em
  `2d73fa3`, conclusão `success`, com os 8 passos verdes — incluindo `Suíte com cobertura (lcov)`,
  `Conferir o relatório antes de enviar` e `sonar-scanner`.
- **Controle negativo embutido:** o passo de conferência **falha** se `coverage/lcov.info` estiver
  ausente ou vazio (`exit 1`), e o passo do scanner **falha** se `SONAR_TOKEN` faltar. Ou seja: o
  modo de falha que produziu o `DBT-57` (analyze medindo 0 % em silêncio) não pode se repetir como
  "verde".
- **Limite declarado:** o gatilho `pull_request` está configurado mas **não foi exercitado** — não há
  PR aberto no momento do fechamento. O que foi medido é o gatilho de push.

### ✅ FECHADA — estratégia de chaves documentada

- **Artefato:** `docs/security/CREDENTIAL-STRATEGY.md`.
- **Conteúdo:** as 6 credenciais **por nome** (Neon, Vercel, GitHub PAT, Sonar, Context7, DeepSeek),
  onde vivem, quem consome, o que a rotação exige; o procedimento cego (`ADR-031` + runbook); e o
  estado honesto `DBT-36` **ABERTA / P0-DEFERRED**.
- **A regra que sobreviveu ao incidente**, escrita sem eufemismo: _a inspeção cuidadosa de um arquivo
  de segredo é ela mesma a superfície de exposição; a regra é **não abrir o arquivo**_ — porque um
  redactor escrito às cegas erra o formato e **falha aberto**.
- **Controle negativo:** nenhum valor, prefixo, sufixo, tamanho ou hash de credencial aparece no
  documento; o próprio arquivo foi escrito **sem abrir** `Keys.txt`/`Sonar.txt`.

### ⛔ ESCALADA — `DBT-57` (cobertura ≥ 80)

- **O que ficou pronto:** o mecanismo, de ponta a ponta, provado em CI (`new_coverage` 0 → 63,3).
- **O que bloqueia:** **63,3 < 80**. Fechar exigiria subir ~17 pontos percentuais de cobertura **no
  código novo** — escrever muitos testes, o que é exatamente a expansão de escopo que o Modo
  Fechamento proíbe.
- **Decisão que só o MAESTRO toma** (a dívida já previa as duas rotas, e nenhuma é de agente):
  (a) manter 80 e pagar a cobertura em ciclo dedicado; ou (b) **fixar o limite no número medido**,
  com a decisão registrada — o 80 é o padrão do "Sonar way", não um alvo calibrado para este projeto.
- **Por que não escolhi:** §4.4 do protocolo — critério ambíguo escala, não se interpreta para
  facilitar o verde.

### ⛔ ESCALADA — `DBT-58` (escopo de `scripts/**`)

- **Artefato:** `docs/adr/ADR-035-sonarcloud-escopo-scripts.md` (186 linhas, `PROPOSTA`).
- **O que ficou pronto:** a decisão vigente registrada como **exclusão por cota com limite
  declarado**; a conta de LOC que fecha (`53.134 − 50.000 = 3.134` LOC de piso medido; projeção local
  de 8.836 LOC, declaradamente **não** decisória porque diverge 5.702 LOC da medição do servidor); e
  8 alternativas registradas como inviáveis.
- **Gap que o ADR encontrou e que foi fechado neste ciclo:** o recorte `sonar.sources=src` — o que faz
  qualquer análise landar — vivia **só na linha de comando do scanner**, ou seja, um limite real do
  gate que não estava versionado. Agora está em `.sonarcloud.properties`.
- **Decisão que só o MAESTRO toma:** subir o plano da organização **ou** reduzir LOC reais de
  `scripts/**`. Envolve dinheiro ou um refactor grande; o ADR sai como `PROPOSTA`.

---

## 3. Descobertas registradas, não consertadas (regra de não-expansão)

1. **Limite de ambiente do scanner local:** rodar o `sonar-scanner` nesta máquina **falha** — o
   bridge JS/TS morre por timeout/heap (`Failed to get response from analysis`, heap padrão 2240 MB),
   mesmo com `--network=host`, 7 GB de heap e `maxspace=7168`. A análise **funciona em CI** (run
   `36807917872`). Consequência prática: a verificação do gate se faz por CI, não localmente.
2. **Efeito colateral de lockfile:** `@vitest/coverage-v8` entra no grafo de produção por peer
   opcional (`better-auth` → `vitest`), e `supports-color`/`has-flag` perderam `dev:true`. Nada
   importa esses pacotes em runtime; registrado para não virar surpresa.
3. **`Automatic Analysis` × scanner convivem:** a análise que vale é a **última que landar**. Enquanto
   as duas coexistem, o resultado do gate depende da ordem. Desligar a Automatic Analysis é ação de
   UI do SonarCloud — **não executada** por ser fora do alcance do agente.
4. **`DBT-36` agravada:** o incidente do Ciclo 18 pôs as 6 credenciais no transcript de uma sessão. A
   rotação segue `P0-DEFERRED` por decisão do MAESTRO, e o token do Sonar agora também é um **secret
   de CI** — rotacionar exige atualizar o secret no mesmo ato.

---

## 4. Limites deste relatório

- O gate **não está verde**: `new_coverage` = 63,3 contra 80. Nada aqui afirma o contrário.
- O gatilho de `pull_request` do workflow novo **não foi exercitado** (não há PR aberto).
- `ADR-035` está em `PROPOSTA`; `DBT-58` e `DBT-57` seguem **ABERTAS** no registry.
- As duas escaladas não são falhas de execução: são decisões que o protocolo reserva ao MAESTRO.

---

## ERRATA — Ciclo 22 (2026-10-01)

Três correções ao que este documento afirmou. Nenhuma delas muda o que foi **medido**; todas mudam
o que foi **inferido**.

**(a) "CI falha com a Automatic Analysis ligada" era citação de doc apresentada como predição.**
O §3.3 afirmou que a Automatic Analysis e o scanner "convivem", com base no run `36807917872` — mas a
frase de apoio veio da documentação oficial, que declara que CI-based analysis _deve_ desligá-la. A
medição mostrou **não-falha**, não "coexistência declarada". A diferença importa: o run prova que
_naquele_ evento não houve colisão; **não** prova o estado do toggle, nem que não haverá colisão em
outro evento. O `DBT-59` foi reescrito para nomear o desconhecido.

**(b) A atribuição "o valor efetivo é o default da organização" (`sonar-baseline-2026-09-30.md:236-239`)
é inválida.** Ela foi inferida de `GET /api/settings/values` devolver `{"settings":[]}` para
`sonar.leak.period`. Medido no Ciclo 22: `sonar.leak.period` **não aparece** em
`GET /api/settings/list_definitions` — **258 definições, nenhuma contendo "leak"**. Ou seja, a
resposta vazia **não** é oráculo de validade da chave: a chave simplesmente não é exposta por essa
API. O correto é "não legível por esta API", não "default da organização".

**(c) O tratamento do `DBT-57` como "decidir o _new code period_" já estava consumido no Ciclo 20.**
A janela de 30 dias foi o que derrubou os 408 achados para 24
(`docs/evidence/sonar-dbt55-unblock-2026-09-30.md:86`). O que resta no `DBT-57` é o **limiar de
cobertura** (`63,3` contra `80`), não o período — e o denominador real por linhas é o que a Fase 4 do
Ciclo 22 entrega (`docs/evidence/ciclo-22-dbt57-data.md`).
