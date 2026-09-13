# Round-state — PENDENTES-CLOSE (2026-09-07)

**Resultado: STOP-TRIGGER no Q0. STACK_MODE: `uncommitted`.**

Data/hora observada por `date -u`: `2026-09-07T03:09:16Z`.
Raiz: `/home/douglas-souza/preco-que-d-main`; branch `develop`;
HEAD observado nesta sessão: `8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f`.

## 1. Identidade e preservação

`git log --oneline -3` retornou:

```text
8d26a2c docs(program): release pre-A4 ac2e834 + A1 reconfirmado (sandbox ausente)
499ae31 chore(ledger): linha em branco antes do header PR-3 (prettier)
8229acd chore(ledger): remove marcador de conflito residual do merge PR-3
```

V0, Manifest 4 e Manifest 5 continuam pendentes no checkout. A árvore já
continha alterações em código, package.json, matrizes, scripts, workflow,
runbooks e evidências. Esta rodada escreveu somente o registro da parada
em `docs/evidence/pendentes-2026-09-07/`. Nenhum staging ou commit.

## 2. Verificação dos três bundles

Comandos executados diretamente, a partir da raiz:

```sh
sha256sum -c docs/evidence/cutover-2026-09-07/SHA256SUMS
sha256sum -c docs/evidence/cutover-prep-2026-09-07/SHA256SUMS
sha256sum -c docs/evidence/gsec-2026-09-06/SHA256SUMS
```

| Bundle  | Esperado pelo roteiro | Observado nesta sessão | Classificação                                       |
| ------- | --------------------- | ---------------------- | --------------------------------------------------- |
| cutover | 18/18                 | **15/18; 3 FAILED**    | **STOP-TRIGGER**, vermelho fora da exceção gsec     |
| prep    | 25/25                 | **25/25 OK**           | LOCAL-VERIFIED, integridade dos arquivos enumerados |
| gsec    | 12/14                 | **12/14; 2 FAILED**    | vermelho previsto até V0, nomes abaixo              |

Falhos do cutover:

1. `docs/runbooks/cutover-A4.md`;
2. `scripts/env-guard.mjs`;
3. `docs/specs/M-02/emenda-2026-09-07-env-guard.md`.

Os dois falhos do gsec são exatamente `scripts/env-guard.mjs` e
`docs/specs/M-02/emenda-2026-09-07-env-guard.md`.

Hashes esperados e atuais constam integralmente em `evidence.json` e
`artifacts/q0-checks-observed.txt`. Os selos anteriores foram preservados.
O retorno agregado dos três comandos foi exit 1; o transcript original
não capturou separadamente os códigos dos dois primeiros comandos.

## 3. Gatilho e proveniência

O anexo fornecido pelo usuário, linhas 138–141, exige parada para
“m02:sums vermelho não-rotulado em bundle não-gsec”. O gatilho foi
interpretado como aplicável à verificação equivalente `sha256sum -c`
obrigatória do Q0, antes de implementar `m02:sums`.

`docs/evidence/cutover-prep-2026-09-07/manifest-5.md:12` e as entradas de
staging desse manifest documentam alterações da rodada PREP nos mesmos
três caminhos: Emenda #4, selftest 12→13 e adições ao runbook. Isso é
**evidência documental de uma explicação plausível da deriva**, não uma
comparação dos bytes contra versões antigas, nem autorização para ampliar
a exceção exclusiva do gsec. Não foi declarado novo achado de segurança.

Condição de retomada: triagem desses três caminhos e decisão explícita
sobre a base de integridade do bundle cutover. A regeneração dos selos
não pode apagar a divergência inicial registrada aqui.

## 4. Consultas externas já concluídas

Neon MCP `list_branches`, projeto `damp-forest-57346541`, retornou somente:

| Nome       | ID                       | Estado   |
| ---------- | ------------------------ | -------- |
| production | br-snowy-violet-aymcvvvv | ready    |
| develop    | br-small-hill-aymcu14y   | archived |

Zero branch efêmera na resposta. Classificação: REMOTE-VERIFIED-METADATA.
Isso não implementa nem valida `m02-branch-audit`, T-0, guardrails de
console ou integridade de dados. Nenhuma SQL ou mutação Neon executada.

GitHub MCP `search_branches` confirmou o nome `develop` no repositório
`Douglas0101/preco-que-da-lucro`. A resposta não forneceu SHA: equivalência
HEAD local/remoto e CI do tip permanecem UNVERIFIED. Não houve navegação
nem interação com navegador após o gatilho.

## 5. Readiness e limitação de coleta

`npm run m02:readiness` **não executado nesta rodada**, em decorrência da
parada antecipada. O conjunto `m02-state`, `g1-assinada`, `sec01-fechada`,
`freeze-ativo`, `snapshot-fresco` foi reportado pela rodada PREP; aqui é
HISTORICAL, sem promoção para estado atual.

Ao preparar um coletor local para registrar novamente os resultados,
`spawnSync('sha256sum', ...)` retornou `EPERM`. A pasta de evidência foi
criada antes da falha, mas nenhuma verificação foi concluída pelo coletor.
O erro está transcrito em `artifacts/collector-error.txt`. Os resultados
acima vêm dos comandos diretos anteriores, que concluíram. Nenhuma
alternativa para contornar essa negação foi executada.

Q1–Q6 ficam suspensos; os documentos presentes constituem o relatório da
parada, sem declarar o aceite do fechamento da rodada.
