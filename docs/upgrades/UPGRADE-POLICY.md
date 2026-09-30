# Política de Atualização e Downgrade de Dependências

Documento que rege como uma dependência entra, sobe ou desbe no Preço que Dá Lucro. A matriz de
criticidade ([`DEPENDENCY-CRITICALITY-MATRIX.md`](./DEPENDENCY-CRITICALITY-MATRIX.md)) diz **o que**
está pinado; este diz **como se muda**.

## A regra que este documento existe para sustentar

> **Downgrade nunca é tácito.**

Um rebaixamento de versão não é uma alteração de lockfile como outra qualquer. Ele troca
comportamento sob os testes que já passaram, e a falha aparece tarde — no `typecheck`, no gate, no
runtime. O caso que motivou esta política é real: um WIP rebaixou `drizzle-kit` de `^0.31.10` para
`^0.18.1`, e a quebra só apareceu depois, em `npm run typecheck` e `npm run m02:lockfile-guard`.
Nada reprovou no momento da escrita.

Daí a regra: **rebaixar um pacote `critical` só é legítimo se houver um Downgrade Request
aprovado, em arquivo versionado, que diga quem aprovou, quando e por quê.** O guard verifica a
existência do arquivo, não o mérito da justificativa — a qualidade do argumento é humana.

## Quem pode aprovar o quê

| mudança                                            | quem aprova                            | o que é exigido                                                         |
| -------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Upgrade de pacote `critical` dentro da faixa       | o autor do PR                          | `typecheck`, suíte e `npm run guard:upgrade` verdes                     |
| Upgrade de pacote `critical` que **larga** a faixa | steward do domínio + MAESTRO           | amendment em `scripts/dependency-policy.json` no mesmo PR, com motivo   |
| **Downgrade** de pacote `critical`                 | MAESTRO                                | Downgrade Request aprovado + arquivo em `scripts/dependency-approvals/` |
| Upgrade de `high` / `medium`                       | o autor do PR                          | gates do projeto; finding informativo aceito                            |
| Downgrade de `high` / `medium`                     | o autor do PR, com justificativa no PR | finding informativo no relatório; **não** bloqueia                      |
| Adicionar pacote novo à matriz                     | MAESTRO                                | entrada completa em `scripts/dependency-policy.json` com motivo         |
| **Remover** pacote da matriz                       | MAESTRO                                | PR que justifique por que a dependência deixou de ser fronteira         |

A remoção é tratado como downgrade. Sair da toolchain é rebaixar a garantia por outro nome: o
guard reprova pacote listado e ausente do `package.json`, porque sumir com a dependência não pode
ser mais fácil do que atualizá-la.

## Taxonomia M1–M7

Toda alteração de dependência se classifica em exatamente uma classe. A classe determina o fluxo.

### M1 — Patch dentro da faixa

`drizzle-orm` de `0.45.2` para `0.45.7`. Sem mudança de contrato, sem risco de fronteira.

**Fluxo:** revisão normal de PR. `npm run guard:upgrade` verde é condição, não formalidade.
**Aprovador:** o autor do PR.

### M2 — Minor dentro da faixa, pacote `critical`

`zod` de `4.4.3` para `4.5.2`. Faixa de API preservada, mas mudança de validação pode alterar
quais entradas passam.

**Fluxo:** suíte completa + `typecheck`. Se a minor trxer mudança de comportamento observável
(mensagem de erro, coercão, `z.enum` mais estrito), o PR descreve o efeito.
**Aprovador:** o autor do PR; revisão humana se o changelog indicar breaking change.

### M3 — Minor dentro da faixa, pacote `high`/`medium`

`vite` de `8.0.16` para `8.2.2`, `typescript` de `5.8.3` para `5.9.3`. Risco menor, blast radius
menor — mas `typescript` continua sendo gate, e minor de compilador gera erro novo em todo o
projeto.

**Fluxo:** gates do projeto. O finding informativo de rebaixamento, quando aplicável, é aceito.
**Aprovador:** o autor do PR.

### M4 — Upgrade que larga a faixa (major novo)

`react` de `19.2.x` para `20.0.0`, `vite` de `8.x` para `9.x`. É a classe que mais consome
esforço e a que o guard reprova.

**Fluxo:** amendment em `scripts/dependency-policy.json` **no mesmo PR**, com a nova faixa e o
motivo. Changelog revisado. Testes de regressão da fronteira afetada. `npm run check` completo.
**Aprovador:** steward do domínio **e** MAESTRO.

### M5 — Downgrade dentro da faixa

`drizzle-kit` de `^0.31.10` para `^0.30.9`, `vite` de `8.0.16` para `8.0.1`. A versão nova é menor
que a do `HEAD`, mas ainda dentro do que a política permite.

**Fluxo:**

- pacote `critical` → Downgrade Request aprovado, conforme M7. O guard exige o arquivo
  `<pacote>__<versão antiga>__<versão nova>.json` em `scripts/dependency-approvals/`;
- pacote `high`/`medium` → finding informativo no relatório, justificativa no PR, sem aprovação
  formal. O guard **não** bloqueia, e a mensagem do finding diz isso explicitamente para o veredito
  não ser ambíguo.

**Aprovador:** MAESTRO para `critical`; o autor do PR para `high`/`medium`.

### M6 — Remoção de dependência

O pacote sai do `package.json`. A política continua listando o nome.

**Fluxo:** o guard reprova, com o finding `(package.json): observado ausente`. O PR tem de remover
o pacote da política no mesmo commit, com justificativa de por que a dependência deixou de ser
fronteira — ou degradá-lo para uma classe menor de criticidade, se for o caso.
**Aprovador:** MAESTRO.

### M7 — Downgrade Request (o artefato, não a mudança)

Aprovação formal para rebaixar um pacote `critical`. É o que o guard verifica.

Um arquivo por rebaixamento, em [`scripts/dependency-approvals/`](../../scripts/dependency-approvals/),
com nome determinístico:

```text
<pacote com @ e / trocados por _>__<versão antiga>__<versão nova>.json
```

Exemplo do incidente real: `drizzle-kit__0.31.10__0.18.1.json`. Para pacote com escopo,
`@neondatabase/serverless` vira `_neondatabase_serverless__1.1.0__1.0.0.json`.

O conteúdo segue o template em
[`DOWNGRADE-REQUEST-TEMPLATE.md`](./DOWNGRADE-REQUEST-TEMPLATE.md). O guard **só verifica a
existência do arquivo com o nome certo** — ele não avalia a qualidade da justificativa. Um arquivo
vazio aprova o rebaixamento: por isso o campo `approvedBy` é humano e responsável, e por isso o
revisor de PR tem de abrir o arquivo, não só ver o check verde.

> Aprovação válida é para **aquele** par de versões. `drizzle-kit__0.31.10__0.18.1.json` não
> autoriza `0.18.0` nem `0.17.3`: o nome carrega as duas versões justamente para que a aprovação
> não escorra.

**Aprovador:** MAESTRO, com `approvedBy` e `approvedAt` preenchidos.

## O que o guard faz e o que ele não faz

```bash
npm run guard:upgrade
```

**Confere:** estrutura da política (schema, campos, `min <= max`, faixas não degeneradas, nomes
únicos); presença de cada pacote no `package.json`; versão base da spec dentro da faixa; versão
resolvida no `package-lock.json`; versão instalada em `node_modules`; rebaixamento contra o
`HEAD`, que exige Downgrade Request para pacote `critical`.

**Não confere:** se a mudança é boa, se o changelog foi lido, se a justificativa do Downgrade
Request se sustenta, se a licença mudou, se existe vulnerabilidade conhecida. Isso é revisão humana
e o [`dependency-review` do GitHub](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action).
O guard fecha a classe mecânica; ele não substitui o julgamento.

**Fail-closed nas duas direções:** ausência também é violação. Política sem o pacote, pacote
listado e removido, faixa invertida ou degenerada, marca ilegível — tudo reprova. Quando não dá
para ler (lock sem a entrada, `node_modules` não instalado, git indisponível), o check sai `skip`
**nomeado**, nunca `pass`. Um `skip` é "não conferido", e o relatório diz qual.

**Códigos de saída:** `0` pass · `1` violação · `2` precondição (política ausente ou malformada,
manifest ilegível, git indisponível). Precondição nunca é `pass` — um guard que não conseguiu ler
não pode dizer que está tudo bem.

## Onde a política é alterada

A política é [`scripts/dependency-policy.json`](../../scripts/dependency-policy.json) e só muda
por amendment no mesmo PR da mudança que a justifica:

- **subir** um piso (`min`) — endurecimento, exige a evidência que justifies;
- **alargar** uma faixa ou **narrowar** um teto — downgrade disfarçado de política, tratado como
  M5/M7;
- **adicionar ou remover** pacote — M6/M7;
- **mudar `criticality`** — rebaixar `critical` para `high` é a forma mais barata de contornar M5,
  então exige MAESTRO.

O guard é fail-closed também contra a própria política: entrada malformada não degrada para
"sem verificação", ela reprova. Uma política que não pode ser lida é um build vermelho, não um
build silenciosamente permissivo.

## Gravidade e retorno

Um rebaixamento de `critical` aprovado e depois revertido porque quebrou produção tem custo
assimetria a favor de não rebaixar. A política assume que o rebaixamento de `critical` é a exceção
que precisa ser justificada, não o caminho conveniento. Quando a urgência for real, o caminho é o
Downgrade Request com prazo de retorno explícito no campo `rollback` — não o rebaixamento
silencioso.
