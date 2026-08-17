# G3-R1 — Neon readiness bloqueado

- Data: 2026-08-17
- Task ID: `G3-PR16-NEON-BLOCKED-2026-08-17`
- Estado: `BLOQUEADO`
- Responsável pela execução: Bohr / Orquestrador de Engenharia
- Revisores aprovadores: Aquinas (Git/CI/evidência), Newton (Segurança/Auth)

## Escopo e SHA

Esta evidência registra somente a pré-condição e os bloqueios do G3 para o
PR #16. Ela não declara readiness, não registra um dry-run concluído e não
autoriza G4 ou G5.

- Clone de trabalho: `/tmp/preco-pr16-g1-20260817`
- Branch: `codex/p1-tanstack-query`
- SHA local validado: `57f069efef869b55c01af330aa321693590c679d`
- PR: `16`, ainda draft
- Checkout principal: preservado e não utilizado para alterações

## Descoberta Neon sanitizada

O console Neon autenticado confirmou um alvo isolado criado para satisfazer o
gate de versão:

- Projeto: alvo Neon isolado de readiness (identificador redigido)
- Região: `AWS US East 2 (Ohio)`
- PostgreSQL major: `17`
- Branch inicial e default: `production`
- Branches visíveis no alvo: `1 / 10`
- Neon Auth: não habilitado

O projeto anterior inspecionado estava em PostgreSQL 18 e não atendia ao
contrato do workflow. Nenhum identificador de projeto, connection string,
secret, API key, senha, token ou PII foi registrado nesta evidência.

## Comandos de verificação

Os comandos abaixo foram executados sem imprimir valores sensíveis:

```text
git status --short --branch
git rev-parse HEAD
git ls-tree -r --name-only 57f069efef869b55c01af330aa321693590c679d .github/workflows
git show 57f069efef869b55c01af330aa321693590c679d:.github/workflows/neon-readiness.yml
gh pr view 16 --repo Douglas0101/preco-que-da-lucro --json isDraft,headRefName,headRefOid,statusCheckRollup,url
gh api repos/Douglas0101/preco-que-da-lucro/environments/neon-readiness/secrets --jq '{total_count: .total_count, names: [.secrets[].name]}'
gh api repos/Douglas0101/preco-que-da-lucro/environments/neon-readiness/variables --jq '{total_count: .total_count, names: [.variables[].name]}'
git check-ignore -v --no-index .neon neon-storage.env .env .env.local .env.example neon-storage.env.example
```

Resultados resumidos:

- O workflow exige `EXPECTED_POSTGRES_MAJOR: "17"`.
- O passo `Require develop ref` encerra o job quando `GITHUB_REF` não é
  `refs/heads/develop`; por isso o dispatch planejado usa `--ref develop`.
- O workflow usa `vars.NEON_PARENT_BRANCH || 'develop'`.
- O parent branch Neon real descoberto é `production`.
- A consulta `gh pr view` realizada durante a coleta reportou o PR #16 como
  draft no SHA `57f069e`; a referência de fetch local auxiliar não é usada
  como autoridade para esse estado.
- Verify/UI Stack e SonarCloud estavam verdes nesse SHA.
- A execução `migration` anterior falhou antes da criação da branch efêmera
  porque assumiu `develop` como parent Neon.
- O endpoint do environment protegido retornou `total_count: 0` para secrets e
  `total_count: 0` para variables.
- As regras de ignore cobrem `.neon`, artefatos `*.env` e `.env.local`,
  preservando os templates `.env.example`.

## Estado do G3

| Item obrigatório                     | Estado        | Evidência disponível                               |
| ------------------------------------ | ------------- | -------------------------------------------------- |
| Projeto Neon PG17                    | confirmado    | Console Neon; alvo isolado criado                  |
| Parent branch real                   | confirmado    | `production`, default                              |
| `NEON_API_KEY` no environment        | bloqueado     | Nenhum secret listado; valor nunca lido            |
| `NEON_PROJECT_ID` no environment     | bloqueado     | Nenhuma variable listada; valor nunca lido         |
| `NEON_PARENT_BRANCH=production`      | bloqueado     | Environment sem variables confirmadas              |
| Workflow dry-run com `--ref develop` | não executado | Não havia configuração protegida suficiente        |
| Branch efêmera criada/removida       | não executado | Não houve run elegível                             |
| URLs direta e pooled distintas       | não executado | Connection strings não foram coletadas             |
| `db:test`                            | não executado | Nenhum dry-run elegível                            |
| `db:check` sem drift                 | não executado | Nenhum dry-run elegível                            |
| PostgreSQL major 17 no workflow      | não executado | Alvo PG17 existe; workflow ainda não foi executado |
| RLS e privilégios                    | não executado | Nenhum dry-run elegível                            |
| Smoke autenticado                    | não executado | Nenhum dry-run elegível                            |
| Ausência de skips substantivos       | não executado | Nenhum artifact produzido                          |
| Acesso/escrita em produção           | não realizado | Nenhum banco de produção acessado                  |

## Segurança e limites

- Nenhum segredo foi lido, copiado, impresso ou persistido.
- Nenhuma URL de conexão foi aberta ou registrada.
- Nenhuma credencial foi colocada em `.env`, `.neon`, `neon-storage.env`,
  logs, prompts, diff ou commit.
- Nenhuma migration de dados, `apply`, backup/restore, rollback externo ou
  cutover foi executado.
- O projeto Neon criado é um alvo isolado de readiness; o projeto anterior e
  qualquer ambiente de produção não foram alterados.
- O checkout principal sujo permaneceu intocado.

## Revisão independente

Quatro revisores foram acionados em duas rodadas com escopos separados:

| Revisor | Escopo           | Resultado                              |
| ------- | ---------------- | -------------------------------------- |
| Arendt  | Git/CI/evidência | encerrado por timeout; não é aprovação |
| Euclid  | Segurança/Auth   | encerrado por timeout; não é aprovação |
| Aquinas | Git/CI/evidência | `APPROVE`                              |
| Newton  | Segurança/Auth   | `APPROVE`                              |

Os dois `APPROVE` são independentes e cobrem, respectivamente, consistência
do SHA/workflow/checklist e ausência de exposição de segredos. As revisões de
Arendt e Euclid foram encerradas por timeout e não contam como aprovação.

## Próxima ação segura

1. Configurar pelo environment protegido `neon-readiness`, sem expor valores:
   - secret `NEON_API_KEY`;
   - variable `NEON_PROJECT_ID`;
   - variable `NEON_PARENT_BRANCH=production`.
2. Confirmar novamente apenas a presença dos nomes/contagens.
3. Solicitar duas revisões independentes do preflight e do artifact.
4. Executar somente então:

   ```bash
   gh workflow run neon-readiness.yml \
     --repo Douglas0101/preco-que-da-lucro \
     --ref develop \
     -f migration_mode=dry-run \
     -f confirm_apply=false
   ```

5. Substituir esta evidência de bloqueio por uma evidência de dry-run somente
   se o checklist substantivo completo tiver artifact sanitizado e duas
   aprovações formais.

Decisão: `G3 BLOQUEADO`; `G4 NÃO INICIADO`; `G5 NÃO AUTORIZADO`.
