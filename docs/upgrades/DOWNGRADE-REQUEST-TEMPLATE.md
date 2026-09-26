# Template de Downgrade Request

Preencher **um arquivo por rebaixamento**, em
[`scripts/dependency-approvals/`](../../scripts/dependency-approvals/), com o nome determinístico:

```text
<pacote com @ e / trocados por _>__<versão antiga>__<versão nova>.json
```

O guard procura exatamente esse nome. `drizzle-kit` de `0.31.10` para `0.18.1` vira
`drizzle-kit__0.31.10__0.18.1.json`; `@neondatabase/serverless` de `1.1.0` para `1.0.0` vira
`_neondatabase_serverless__1.1.0__1.0.0.json`.

A aprovação vale para **aquele par de versões**. Um arquivo não autoriza outra versão — é para
isso que o nome carrega as duas.

Política e taxonomia: [`UPGRADE-POLICY.md`](./UPGRADE-POLICY.md).

---

## O template

```json
{
  "package": "<nome exato do pacote>",
  "from": "<versão que está no HEAD>",
  "to": "<versão pretendida>",
  "criticality": "<critical | high | medium>",
  "approvedBy": "<quem aprovou, com identidade legível>",
  "approvedAt": "<AAAA-MM-DD>",
  "reason": "<por que o rebaixamento é necessário agora>",
  "alternativesConsidered": ["<o que foi avaliado e por que não serve>"],
  "impact": {
    "breakingChanges": "<o que muda para quem consome>",
    "migrations": "<afeta schema, migrations ou o formato de saída?>",
    "security": "<altera algo de sessão, cookie, validação ou sanitização?>",
    "blastRadius": "<qual superfície do produto é alcançada>"
  },
  "riskResidual": "<o que continua errado depois do rebaixamento>",
  "rollback": {
    "plan": "<como voltar, e em quanto tempo>",
    "deadline": "<AAAA-MM-DD | null, com justificativa se null>",
    "condition": "<o que dispara o rollback antes do deadline>"
  }
}
```

### Campos que o guard lê

O guard **verifica a existência do arquivo pelo nome** — ele não parseia o conteúdo. Ainda assim,
`package`, `from` e `to` têm de corresponder ao nome do arquivo e à mudança real: divergência entre
o que o arquivo declara e o que o `package.json` faz é motivo para o revisor recusar, e é o que a
revisão humana existe para pegar.

`approvedBy` e `approvedAt` são o que transforma o arquivo em aprovação em vez de arquivo de
intenção.

### Campos que a revisão humana lê

`alternativesConsidered` e `riskResidual` são os campos que carregam o peso. Uma requisição sem
alternativas avaliadas não é uma decisão, é uma preferência.

---

## Exemplo preenchido — o incidente real do `drizzle-kit`

> **Isto é exemplo de formato, não uma aprovação.** O incidente abaixo foi resolvido por **reverter
> o rebaixamento**: `drizzle-kit` voltou para `^0.31.10` e o repositório está em `^0.31.10`. O
> arquivo existe aqui para mostrar como o documento se preenche; **não** é um Downgrade Request
> válido, e copiá-lo para `scripts/dependency-approvals/` autorizaria um rebaixamento que ninguém
> aprovou.

```json
{
  "package": "drizzle-kit",
  "from": "0.31.10",
  "to": "0.18.1",
  "criticality": "critical",
  "approvedBy": "NÃO APROVADO — exemplo de formato, o rebaixamento foi revertido",
  "approvedAt": "2026-09-26",
  "reason": "Conflito de resolução durante uma troca de dependências: a versão antiga de drizzle-kit foi escolhida pelo resolvedor. Não havia intenção de rebaixar, e o efeito apareceu depois, em npm run typecheck e npm run m02:lockfile-guard. Este exemplo existe para documentar o formato da requisição, não para aprovar a mudança.",
  "alternativesConsidered": [
    "Pin do range: declarar ^0.31.10 no package.json e regra de resolução que impeça queda de major — caminho que não exige rebaixar nada.",
    "Remover a dependência de conflito e re-resolver o lockfile a partir de um estado limpo.",
    "Isolar o conflito com overrides de npm em vez de aceitar a versão rebaixada."
  ],
  "impact": {
    "breakingChanges": "defineConfig, exigido por drizzle.config.ts, não existe em 0.18.x. db:generate e db:check param de funcionar.",
    "migrations": "gera migration com formato incompatível com o drizzle-orm 0.45 do runtime; INV-012 (migrations reproduzíveis) fica sem garantia.",
    "security": "sem efeito direto, mas derruba o gate que impediria um rebaixamento acidental.",
    "blastRadius": "toolchain de migration inteira: db:generate, db:check e o pipeline de CI que os invoca."
  },
  "riskResidual": "Nenhum aceito: o rebaixamento quebra o typecheck e o guard de lockfile. Por isso foi revertido em vez de aprovado.",
  "rollback": {
    "plan": "git checkout -- package.json package-lock.json e npm ci --ignore-scripts; conferir npm run typecheck e npm run m02:lockfile-guard.",
    "deadline": null,
    "condition": "já revertido — o incidente virou origem da política de dependências e do guard de upgrade, não de um rebaixamento"
  }
}
```

O que este exemplo ensina sobre o formato:

- **`approvedBy` diz que não foi aprovado.** Um template que mostra o incidente real "aprovado"
  ensinaria exatamente o errado: que incident��� basta para virar aprovação.
- **`riskResidual` responde a pergunta que a aprovação deveria fazer.** Aqui a resposta é "nenhum
  aceito", e é ela que leva à reversão.
- **`rollback.deadline` é `null` com justificativa**, não `null` silencioso. Campo opcional que some
  é campo que ninguém leu.

---

## Checklist antes de abrir o PR

- [ ] O nome do arquivo segue `<pacote>__<de>__<para>.json`, com `@` e `/` trocados por `_`.
- [ ] `package`, `from` e `to` correspondem ao nome do arquivo **e** à mudança no `package.json`.
- [ ] `approvedBy` é uma pessoa, não um time ou um "CI".
- [ ] `approvedAt` está no formato `AAAA-MM-DD`.
- [ ] `alternativesConsidered` lista ao menos uma alternativa avaliada e por que não serve.
- [ ] `impact.breakingChanges` foi conferido contra o changelog, não contra a intuição.
- [ ] `riskResidual` responde o que continua errado **depois** da mudança.
- [ ] `rollback.plan` é executável por outra pessoa, e `deadline` tem data ou justificativa.
- [ ] O arquivo está **versionado** no mesmo PR da mudança.
- [ ] `npm run guard:upgrade` verde no commit.
