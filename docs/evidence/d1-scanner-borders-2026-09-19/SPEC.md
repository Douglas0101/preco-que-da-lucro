# SPEC — WP1 `F-D1-scanner-borders` (Bloco 3)

- **Trilho:** D (restante do C3) · **WP:** `F-D1-scanner-borders`
- **Branch:** `mission/wp1-scanner-borders` · **Worktree:** `.worktree-wp1-scanner`
- **Base:** `55b0090dd9d2deed2493208e0047e7af4998b0d6` (= `origin/develop`)
- **Data:** 2026-09-19 · **Ciclo SDD:** S1 SPEC (S0 executado em `L114` do journal)

---

## 1. Problema

O scanner `scripts/lib/m02-transaction-sites.ts` declara, no cabeçalho do módulo, uma
**semântica precisa** de contagem. Três cláusulas dessa declaração **não são verdadeiras**
no código. Não é um bug de contagem — é um **documento que mente**: a contagem que o
scanner alimenta (`matrix.yaml`, contador `transactionSites`) é uma evidência de auditoria
da fronteira transacional e da leitura de atomicidade do ADR-029 / `reconciliation-r5.md`,
e uma cláusula falsa invalida a leitura que dela depende.

O veredicto adversarial do TRK-D1 (18/09) mediu as três e recomendou, no item 3 da sua
recomendação de land: _"Fechar ou declarar os 3 limites semânticos (D1 tipo, D2 sombreamento
aninhado, D3 `??` à esquerda) e os 2 menores (D4)"_, com a razão explícita de que
_"o risco é de documento que mente, não de número errado"_.

**Decisão de escopo:** fechar (corrigir), não apenas declarar. Corrigir torna a cláusula
verdadeira; declarar-limite obrigaria a **enfraquecer a prosa** de que outros documentos
dependem. A correção é neutra em contagem (§5), então o custo é zero e o ganho é a prosa
voltar a ser verdadeira.

## 2. Fato-fonte (medido, não herdado)

### 2.1 As três cláusulas falsas, com o mecanismo exato

| #      | cláusula declarada no módulo                                                                                             | mecanismo do defeito                                                                                                                                                                                                                                                              | ponto               |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **D2** | _"Sombreamento por nome homônimo é respeitado."_                                                                         | `bindingReferences` faz `if (declaresName(node, name)) return;` — o `return` poda **apenas a subárvore da própria declaração sombreadora**, não os **irmãos seguintes** do bloco. Em `{ const tx = local; tx.b(); }`, o `tx.b()` continua sendo contado para o alias **externo**. | `bindingReferences` |
| **D1** | _"`typeof context.transaction` é posição de tipo, então nenhum dos três conta."_ (e a cláusula geral de posição de tipo) | `inTypePosition` é aplicado **apenas** ao `PropertyAccessExpression` do handle, em `sitesForModule`. As referências **ao alias** passam por `isValueReference`, que nunca consulta posição de tipo ⇒ `type H = typeof tx;` produz um site fantasma.                               | `isValueReference`  |
| **D3** | *"`executor-fallback`: … ou o **lado direito** de `??`/`                                                                 |                                                                                                                                                                                                                                                                                   | `"*                 | `siteShape(host)` só recebe o hospedeiro sintático, **não o handle**, logo não sabe de que lado está: qualquer `??`/` |     | `vira`executor-fallback`. Além disso `QuestionQuestionEqualsToken`/`BarBarEqualsToken`**não estão no predicado**, então`x ??= context.transaction`cai em`direct-use`. | `siteShape` |

### 2.2 As três são **latentes** — provado por dois métodos independentes

1. **Sonda própria desta rodada** (`.artifacts/wp1-probe-defeitos.ts`, read-only, 132 arquivos
   de `src/**` excluindo `src/test/**`): **0** ocorrências de `A-nested-shadow`,
   `B-typeof-alias`, `C1-left-operand-of-nullish` e `C2-assignment-fallback`.
2. **Varredura do veredicto** (§2.E, método e sessão diferentes): `typeof` em sites novos →
   nenhum; handle à esquerda de `??`/`||` → nenhum; `??=`/`||=` → nenhuma em `src/`;
   re-declaração homônima de nome de alias em 14 arquivos com alias → nenhuma.

### 2.3 O baseline é imutável e conferido por terceiro

O hash do scanner na base é `d60ad757a757f41daaab1302a591fe30a4623c383ab8c453a0ba9913141b8659`.
Ele **bate** com o hash que o veredicto do TRK-D1 registrou ter medido (`git show
6b62a29:scripts/lib/m02-transaction-sites.ts`), o que prova por um terceiro método que o
arquivo não mudou entre `6b62a29` (18/09) e `55b0090` (hoje). Cópia imutável do pai
preservada em `.artifacts/scanner-parent.ts`, mesmo sha256.

## 3. Âncoras

- **Definição do WP:** `docs/evidence/agent-state/QUEUE.md:83` (as três imprecisões) e `:87` (o WP irmão).
- **Veredicto que as nomeou:** `docs/evidence/agent-state/CLAIMS-INBOX/TRK-D1/F-C5-2-F-C5-3-VERDICT.md` §3 (tabela D1–D5), §2.E (as varreduras de latência) e §6.3 item 3 (a recomendação).
- **Contrato do projeto:** `AGENTS.md` — _"o gerado `docs/specs/M-02/matrix*.yaml` é o record; nunca hand-edit"_; o scanner é a fonte do contador `transactionSites`.
- **Autoridade do registry:** `docs/specs/M-02/matrix.overlay.yaml` (`status: DRAFT`, `authority: docs/specs/M-02/spec.md`) — o `matrix.yaml` é **gerado**, não editado.
- **Gate que guarda o contador:** `package.json` (`npm run m02:matrix:check`, passo 2 do `npm run check`) e `.github/workflows/ui-stack.yml` (passo imediatamente após `npm ci`).

## 4. DoD

- [ ] As três cláusulas do cabeçalho do módulo passam a ser **verdadeiras** (e a prosa é atualizada para descrever o que o código faz, incluindo `??=`/`||=`).
- [ ] `bindingReferences` respeita sombreamento por declaração aninhada **no resto do bloco**.
- [ ] Referência ao alias em **posição de tipo** não conta.
- [ ] `siteShape` recebe o handle e decide o lado: só o **lado direito** de `??`/`||`/`??=`/`||=` é `executor-fallback`.
- [ ] Teste novo cobrindo cada um dos quatro casos, no idioma do arquivo existente (`scan(path, lines([...]))`), com o caso do pai virado em **controle negativo**.
- [ ] **Neutro em contagem:** diff da lista completa de sites antes/depois **identicamente vazio**.
- [ ] `npm run m02:matrix:check` **verde sem regenerar** a matriz (prova direta de que o contador não se move).
- [ ] `npm run check` exit 0; `npx tsc --noEmit` exit 0; `prettier --check` nos arquivos tocados exit 0.

## 5. Testes

| test                                    | o que prova                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| sombreamento aninhado                   | `tx.a(); { const tx = local; tx.b(); } tx.c();` → 2 sites (linhas do `a` e do `c`), **não** 3                                |
| sombreamento aninhado — controle do pai | o mesmo código com o **scanner do pai** dá 3 sites (`.artifacts/scanner-parent.ts`): a correção muda um resultado observável |
| `typeof tx`                             | alias referenciado só em tipo → menos sites do que antes; `type H = typeof tx;` não cria site                                |
| lado direito continua fallback          | `run(executor ?? context.transaction)` → `repository-fallback` (regressão do caso existente)                                 |
| **lado esquerdo deixa de ser fallback** | `const e = context.transaction ?? fallback;` → **não** é `executor-fallback`                                                 |
| `??=`/`                                 |                                                                                                                              | =`  | `executor ??= context.transaction;` → `executor-fallback` |
| determinismo                            | os bytes de duas execuções e da ordem invertida continuam iguais                                                             |

## 6. Riscos

| risco                                                                                            | mitigação                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a correção muda a contagem e quebra a matriz                                                     | **medido ausente**: 0 ocorrências das três formas na árvore. Provado pelo diff antes/depois **e** por `m02:matrix:check` verde sem regenerar.                                                                                                                                                     |
| a correção quebra os 14 casos existentes                                                         | rodar a suíte inteira, não só os casos novos                                                                                                                                                                                                                                                      |
| `inTypePosition` no alias exclui demais                                                          | `inTypePosition` para no primeiro `Statement`/`SourceFile`. Efeito colateral declarado: `class A extends tx {}` é excluído (o nó `ExpressionWithTypeArguments` é `TypeNode` no AST do TS) — o mesmo já acontecia com o **handle**, então é **consistente**, não regressão. Declarado como limite. |
| sombreamento por `function`/`class` aninhados é hoisted (sombra o bloco inteiro), não só o resto | a regra implementada ("o bloco que declara o nome em escopo próprio é podado por inteiro") cobre isso **corretamente** para TDZ e hoisting.                                                                                                                                                       |
| `getChildren()` inclui tokens/JSDoc                                                              | a varredura por `forEachChild` continua para os filhos; só a decisão de poda usa a lista de instruções do bloco.                                                                                                                                                                                  |

## 7. Rollback

`git worktree remove .worktree-wp1-scanner --force && git branch -D mission/wp1-scanner-borders`.
Nenhuma migration, nenhum schema, nenhum dado, nenhuma credencial. O `develop` só é tocado no
S9 (land), e `origin/main` **não é tocado em momento algum**.

## 8. Fora de escopo (declarado, não silenciado)

- **D4 completo** (`context!.transaction` não é site, porque `handleBase` só olha o nó) — a
  fila nomeia apenas `??=`/`||=` como o "somado" de D3; a asserção não-nula no **base** fica
  como limite declarado, endereçável em WP próprio.
- **D5** (o gate reprova deriva legítima de `src/**`) — é o **WP2** (`F-D1-gate-ux`).
- **`F-D1-raw-sha`** (a linha de hash trocada no `RAW-parent-baseline.txt`) — está com o
  MAESTRO/ESCRIVÃO na fila (`QUEUE.md:88`), não é deste WP.
