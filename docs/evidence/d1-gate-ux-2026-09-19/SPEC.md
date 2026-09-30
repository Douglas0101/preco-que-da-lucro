# SPEC — WP2 `F-D1-gate-ux` (Bloco 3)

## 1. Problema

O passo `m02:matrix:check` do `npm run check` (e o 3º passo do job `verify` da CI) reprova
quando qualquer contador gerado da matriz M-02 se move sob `src/**`. A mensagem que ele
imprime, porém, não diz **o que** mudou:

```text
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.
```

Duas consequências medidas:

1. **O `review the result` é opaco.** A matriz vai de 41 KB (`matrix.generated.yaml`) a 58 KB
   (`matrix.yaml`); o comando sugerido reescreve ambos, e quem chega agora precisa **descobrir
   por conta própria** qual dos seis contadores andou — ou ler um diff de dezenas de KB.
   A mensagem é acionável ("rode o generate") mas não é **diagnóstica**.
2. **O atrito recai sobre quem não fez nada de errado.** `directDatabaseFiles` inclui
   `src/test/**` — 20 das 49 entradas. Um PR que **só adiciona um teste** que importa `@/db`
   reprova `check` e CI até regenerar a matriz. Medido no §2.E do veredicto do TRK-D1
   (cenário E2a: teste novo com import `@/db` → `check` exit 1; E2b: teste novo sem db → 0).

O desconforto do item 2 **não é um defeito a corrigir**: um teste que importa `@/db` é, de
fato, um arquivo com acesso direto ao banco, e a matriz mede a árvore real. O que falta é a
mensagem dizer isso — nomear o contador que se moveu e quais entradas entraram ou saíram.

## 2. Fato-fonte

`docs/evidence/agent-state/CLAIMS-INBOX/TRK-D1/F-C5-2-F-C5-3-VERDICT.md`:

- **§3, item D5** — "o gate novo transforma qualquer deriva de `src/**` (p.ex. teste novo
  importando `@/db` → `directDatabaseFiles`) em falha do `check`/CI"; evidência:
  `package.json:77` + `ui-stack.yml:54`; `directDatabaseFiles` inclui `src/test/**`; veredicto
  do verificador: **"mitigar (doc de 1 linha no `AGENTS.md`/CONTRIBUTING **ou** mensagem que
  nomeie o contador)"**.
- **§6, item 2** — a mitigação, entre as duas oferecidas: a linha em `AGENTS.md` **já existe**
  ("`npm run check` runs `m02:matrix:check`: a change under `src/**` that moves any generated
  counter (`transactionSites`, `directDatabaseFiles`, …) fails the gate until you run
  `npm run m02:matrix:generate` and review the diff"). Falta a **outra**: a mensagem que nomeia
  o contador.
- **§2.G** — o gate já foi medido RED/GREEN em cópia: `check` exit 1 com deriva injetada e
  exit 0 após `rm`; cenários E2a–E2e.

`docs/evidence/agent-state/QUEUE.md:87` define o WP e o squad (**SQUAD-INFRA**), com o
arquivo-alvo `scripts/m02-matrix.ts`.

## 3. Âncoras

- `scripts/m02-matrix.ts:344-352` — `function checkOutputs(outputs)` é hoje o gate inteiro:
  serializa o esperado, lê os dois arquivos, e no primeiro sinal de diferença imprime a
  mensagem fixa. **Não há comparação estrutural nenhuma.**
- `scripts/m02-matrix.ts:357-360` — a guarda de entrypoint: `--check` chama `checkOutputs`,
  qualquer outra execução chama `writeOutputs`. Importar o módulo **não** grava nem valida.
- `docs/specs/M-02/matrix.generated.yaml` — `counts` com seis chaves (`bffModules` 8,
  `createServerFnDeclarations` 35, `concreteOperations` 36, `apiRoutes` 5,
  `transactionSites` 113, `directDatabaseFiles` 49) e quatro listas (`bffs`, `routes`,
  `transactionSites`, `directDatabaseFiles`).
- `docs/specs/M-02/matrix.yaml` — o mesmo documento **mais** `policy`, `entryPolicies` e
  `transactionPolicies` vindos do overlay.
- INV-014 (matriz derivada, determinística, nunca editada à mão) e o contrato do `AGENTS.md`:
  "a change under `src/**` that moves any generated counter fails the gate until you run
  `npm run m02:matrix:generate`".

## 4. DoD

- [ ] A mensagem de deriva **nomeia cada contador que mudou**, com valor antes → depois.
- [ ] Ela diz **em qual dos dois arquivos** a deriva está (um, o outro, ou ambos).
- [ ] Quando os contadores estão iguais mas uma **lista** mudou, ela nomeia a lista e as
      entradas que entraram/saíram, **com teto de linhas** (nunca despeja o arquivo).
- [ ] Quando o arquivo está **ausente** ou **ilegível**, ela diz isso — e não "drift".
- [ ] Quando tudo o que difere é o **overlay/policy**, ela diz isso, em vez de silenciar.
- [ ] `writeOutputs` **não muda**: a mensagem é diagnóstico, não comportamento de escrita.
- [ ] `m02:matrix:check` continua **exit 0** na árvore intacta, **sem regenerar** nada.
- [ ] O descritor de deriva é uma **função pura** e exportada, testável sem I/O.
- [ ] A mensagem responde na **direção** da pergunta: o que a árvore mudou em relação ao que
      está commitado — arquivo **adicionado** aparece como `+`, e o contador lê disco → árvore.
- [ ] Teste que **falsifica**: com a mensagem vazia ou com o contador errado, o teste reprova.
- [ ] `npm run check` exit 0 e suíte verde.

## 5. Testes

**Divergência declarada da SPEC.** O texto original previa um bloco novo em
`src/test/m02-transaction-sites.test.ts` (o arquivo que já cobre a guarda de entrypoint). A
implementação pôs o descritor em módulo próprio — `scripts/lib/m02-matrix-drift.ts` — e a
suíte em `src/test/m02-matrix-drift.test.ts`, por uma razão medida: importar o descritor de
`scripts/m02-matrix.ts` carregaria o **módulo inteiro do gerador**, que faz a varredura pesada
de `src/**` no escopo de módulo (é por isso que o teste existente usa import dinâmico). O
descritor é puro e não depende de nada disso. Mesmo padrão que o gerador já usa para
`./lib/m02-transaction-sites`. A cobertura prometida é a mesma; o arquivo é que mudou.

Dez casos em `src/test/m02-matrix-drift.test.ts`:

1. árvore intacta → descritor **vazio** (nenhuma linha de deriva);
2. **direção da mensagem**: uma sonda nova em `src/lib/` → `counts.bffModules: 8 -> 9` e
   `+ src/lib/…`, nunca o inverso. Este caso nasceu de um defeito real: a primeira versão
   chamava a árvore de `expected` e o arquivo de `actual` e por isso dizia `9 -> 8` com `-`
   numa sonda que havia sido **adicionada** — a mensagem respondia o contrário da pergunta;
3. e o simétrico: arquivo removido da árvore → `9 -> 8` e `-`;
4. um contador movido → a linha nomeia **o contador certo** e o par `antes -> depois`, e
   **nenhum outro** contador aparece;
5. duas listas movidas → uma linha por lista, com as entradas `+` / `-`;
6. diferença de multiconjunto → `2 -> 1 (0 added, 1 removed)`, contando repetições;
7. só o overlay divergindo → a linha diz que os contadores estão iguais;
8. arquivo ausente e arquivo com JSON inválido (e array no topo) → mensagens distintas,
   nenhuma delas "drift";
9. dois artefatos → só o que derivou é nomeado, e diz **em qual arquivo**;
10. lista muito maior que o teto → a saída é **truncada com o total declarado**, não completa.

Além da suíte, o gate é falsificado **de ponta a ponta** por `.artifacts/zz-wp2-falsifica.sh`:
planta uma sonda, exige `exit 1`, exige que a mensagem nomeie contador, lista, entrada e
arquivo, exige que a primeira linha seja **byte a byte** a de antes, remove a sonda e exige
`exit 0` de volta. Uma mensagem que só aparece em teste unitário não prova a fiação.

## 5.1 O que o falsificador expôs

A direção invertida (caso 2 acima) **não** teria sido pega pelos testes unitários: eles
verificavam as strings que eu mesmo escolhi. Foi a corrida de ponta a ponta, com um arquivo
realmente adicionado à árvore, que mostrou a resposta contrária à pergunta do leitor. A
correção não foi inverter a saída — foi renomear os dois lados para o que eles **são**
(`fromTree` e `onDisk`), o que torna a direção auto-documentada em vez de depender de um
rótulo ambíguo.

## 6. Riscos

| risco | mitigação |
| o descritor virar segunda fonte de verdade da matriz | ele **lê** a matriz esperada e a comitada e as compara; não recalcula nada próprio |
| a mensagem crescer e virar o próprio despejo que ela combate | teto de linhas por lista, com o total declarado quando truncar |
| a comparação estrutural divergir da comparação por string | a string continua sendo o critério de **gate** (é ela que decide exit 0/1); o descritor é só diagnóstico |
| `JSON.parse` lançar sobre arquivo corrompido | o caminho de ilegível/ausente é explícito e testado |
| tocar o gerador e mover um contador por acidente | `m02:matrix:check` verde **sem regenerar** é critério de DoD |

## 7. Rollback

`git revert` do commit do WP. Nenhuma migration, nenhum dado, nenhum arquivo gerado é
alterado: a mudança é confinada a `scripts/m02-matrix.ts` e à suíte. O worktree é descartável.

## 8. Fora de escopo

- **Mudar o que é contado.** `src/test/**` continua contando em `directDatabaseFiles`. A
  matriz mede a árvore; o teste que importa `@/db` é um arquivo de banco direto.
- **`F-D1-raw-sha`** (§6 item 4 do mesmo veredicto: a linha de hash do `RAW-parent-baseline.txt`
  registra o arquivo da **entrega**, não o do pai). Está com o MAESTRO/ESCRIVÃO na fila.
- **Os três limites semânticos** (§6 item 3) — fechados no WP1.
- **Regenerar a matriz** (§6 item 1) — já está em dia: `m02:matrix:check` passa sem regenerar.
- Qualquer mudança em `writeOutputs`, no overlay ou no formato dos arquivos gerados.
