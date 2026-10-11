# SPEC — pacote de evidência do incidente de runtime de produção de 2026-10-08

Slug do pacote: `production-runtime-incident-2026-10-08`
Data de escrita: 2026-10-08 (UTC)

## 1. Fato-fonte

`docs/evidence/agent-state/PROGRESS.md` termina em uma intenção **aberta** —
`| L794 | 2026-10-08T18:34:00Z | ▶ |` — sem marcador de resultado. O diretório
`docs/evidence/production-runtime-incident-2026-10-08/` existia só com
`captures/` vazio e **não era rastreado pelo git** (`git ls-files` devolvia
vazio). A intenção registrada era: conter (devolver o alias ao deployment
anterior), registrar capturas neste diretório e entregar a correção do valor
de ambiente à Via A. Nenhuma das três partes tinha evidência versionada.

O sintoma que originou o incidente está registrado em `PROGRESS.md` L793:
`/api/health/ready` devolvia `503 {"status":"not_ready","dependencies":
{"postgres":"unavailable"}}` e `/api/auth/get-session` devolvia `500` no
deployment `dpl_6h2LTZX57soGiPP2oTurws7NsgVd`.

## 2. Problema

Duas contradições de estado coexistiam no journal e nenhuma estava fechada:

1. **L792** (17:46Z) afirma que `preco-que-da-lucro-sage.vercel.app` **ainda**
   resolvia para `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`.
2. **L793** (18:01:25Z) e **L794** (18:34:00Z) tratam o alias como **já movido**
   para `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` e registram o incidente.

E a contenção prometida em L794 não tinha confirmação: o journal ficou em `▶`.

Além disso, duas afirmações amplamente repetidas sobre este incidente não
estavam medidas e se revelaram **parcialmente falsas** quando medidas:

- (a) "o log de runtime não está disponível no plano Hobby" — medido: o limite
  é a **janela**, não o plano (`7d` e `1h` falham; `30m` funciona). A superfície
  de clusters de erro (`get_runtime_errors`) responde a `7d` e **devolveu** o
  artefato decisivo.
- (b) "`src/db/client.server.ts` não guarda valor definido-e-vazio" — medido:
  o predicado `!connectionString` **pega** `""`. O que não existe é validação de
  formato; `"   "`, `"undefined"` e URI malformada passam pelo guard.

## 3. Contrato

Este pacote é **documentação e evidência**, não correção. O contrato, em
termos falsificáveis:

1. Todo fato afirmado no `README.md` carrega uma das três marcações
   **VERIFIED** (reproduzido hoje por comando cuja saída está em `captures/`),
   **INFERRED** (derivado de fatos verified, com a derivação declarada) ou
   **UNDOCUMENTED** (ausente; a ausência é nomeada, não preenchida).
2. Nenhuma captura é fabricada. O que não pode ser medido aparece como falha
   real ou como arquivo explicando por que não é reprodutível.
3. A causa raiz **não** é declarada isolada em nenhum ponto do pacote.
4. A contenção **não** é declarada confirmada pelo repositório.
5. `MANIFEST.sha256` é verificável com `sha256sum -c` e cobre a lista
   descoberta, sem allowlist de legado.
6. Nenhum valor de ambiente é lido, nenhum segredo é impresso, nenhuma mutação
   de produção é executada.

## 4. Mudanças (escopo fechado)

Criado, e somente isto:

- `docs/evidence/production-runtime-incident-2026-10-08/SPEC.md`
- `docs/evidence/production-runtime-incident-2026-10-08/README.md`
- `docs/evidence/production-runtime-incident-2026-10-08/MANIFEST.sha256`
- `docs/evidence/production-runtime-incident-2026-10-08/captures/*` (ver MANIFEST)
- Um append em `docs/evidence/agent-state/PROGRESS.md` (fechamento do `▶` L794 e
  entrada nova). **Somente append.**

**Fora de escopo, explicitamente:**

- Nada em `src/`, `scripts/`, `e2e/`, `.github/`, manifests ou ADRs.
- Nenhuma criação/alteração de deployment, alias, env var, domínio, branch Neon
  ou snapshot.
- Nenhuma leitura de valor de ambiente (`vercel_filter_project_envs`,
  `vercel_get_project_env`, `vercel_get_shared_env_var` **não foram chamados**).
- Nenhum link de bypass de autenticação (`vercel_get_access_to_vercel_url`,
  `vercel_web_fetch_vercel_url` **não foram chamados**).
- Nenhuma ferramenta Neon MCP foi chamada.

## 5. Limites declarados

1. **A causa raiz não está isolada.** O artefato que discrimina é o
   `error.cause` do driver, e ele não é serializado pelo `logJson` em
   `src/routes/api/health/ready.ts:14`. Portanto, mesmo com o log recuperado, a
   mensagem disponível é `"Failed query: select 1 as ready\nparams: "` — o
   invólucro genérico do drizzle, sem SQLSTATE, host ou endpoint.
2. **O experimento decisivo "reconstruir os bytes antigos" está bloqueado pelo
   fornecedor.** Um redeploy do sha `d4b9395` já foi tentado e recusado com
   `BLOCKED_PACKAGE` por `@tanstack/react-start@1.168.49`. Não existe como
   reconstruir os bytes antigos hoje sem habilitar o bypass do fornecedor, o que
   este pacote não fará.
3. **A árvore de trabalho mudou durante a escrita.** Outra tarefa é dona de
   `src/` e editou três arquivos enquanto este pacote era escrito. Os números de
   linha no `captures/source-facts.txt` são da árvore de trabalho no momento da
   captura, com o blob de disco registrado no topo do arquivo. As afirmações de
   identidade entre as duas revisões **implantadas** são comparações de objetos
   git e não são afetadas.
4. **O sintoma não é reprodutível.** O alias público não serve mais o deployment
   quebrado, e os domínios próprios do deployment estão atrás de SSO.
5. **`d4b9395` está em risco de segurança conhecido.** O deployment que hoje
   serve produção carrega `@tanstack/react-start@1.168.49`, que o próprio
   fornecedor classifica como vulnerável (`GHSA-qx66-fv34-fjm8`). A contenção
   atual mantém produção nessa revisão. Isso não é resolvido por este pacote e
   está declarado como risco aberto.
6. **`checked === discovered` do `format:check`.** Este pacote está limpo, mas o
   repositório já tinha avisos de formatação em outros caminhos
   (`docs/evidence/pr-60-publication-2026-10-07/captures/**` e
   `src/test/env-*.test.ts`, estes últimos da tarefa concorrente). Não foram
   tocados.

## 6. DoD (critérios binários)

| #   | critério                                                                           | prova                                                                          |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Identidade do alias público e dos três deployments registrada                      | `captures/vercel-alias-sage.json`, `vercel-deployment-*.json`                  |
| 2   | `health/live`, `health/ready` e `get-session` medidos hoje com código HTTP e corpo | `captures/health-{live,ready}.txt`, `captures/get-session.txt`                 |
| 3   | Sign-in inválido medido em dois caminhos independentes (curl e navegador real)     | `captures/sign-in-invalid-401.txt`, `captures/browser-sign-in-invalid-401.txt` |
| 4   | Falha de retenção do log de runtime registrada com o valor real da resposta        | `captures/vercel-runtime-logs-retention-boundary.txt`                          |
| 5   | Artefato decisivo do incidente recuperado e citado                                 | `captures/vercel-runtime-errors-7d.txt` cluster 03                             |
| 6   | Exoneração do código por identidade de blob git                                    | `captures/blob-identity-verification.txt`                                      |
| 7   | Controle negativo do predicado do guard de `DATABASE_URL`                          | `captures/guard-negative-control.txt` + `.mjs`                                 |
| 8   | Não-reprodutibilidade do sintoma explicada em arquivo próprio                      | `captures/incident-symptom-not-reproducible.txt`                               |
| 9   | Journal fechado: `▶` L794 recebe resultado e nova entrada datada é acrescentada    | `docs/evidence/agent-state/PROGRESS.md` (append)                               |
| 10  | `MANIFEST.sha256` verificado com `sha256sum -c`                                    | saída do `sha256sum -c` registrada no `README.md`                              |

## 7. Testes (RED/GREEN e falsificação)

Não há código a testar; a falsificação aqui é **de claim**:

- **RED:** afirmar "a causa raiz é o valor da `DATABASE_URL` de produção"
  reprova, porque o valor não foi lido e o sintoma é idêntico para endpoint
  morto, credencial inválida e endpoint inexistente
  (`hostinger-recovery-2026-10-06/captures/fingerprint-negativo.txt:5-7`).
- **GREEN:** afirmar "o artefato decisivo estava indisponível" reprova em parte,
  porque a superfície de clusters o devolveu; afirmar "a contenção foi executada
  às 18:34Z" reprova, porque o alias mudou às 19:00:33.986Z.
- **Falsificação do escopo:** se qualquer arquivo fora de
  `docs/evidence/production-runtime-incident-2026-10-08/` e do append do
  `PROGRESS.md` tiver sido alterado, o pacote está inválido.

## 8. Riscos

- Um lerador pode ler "contenção consistente" como "contenção confirmada". O
  pacote separa as duas coisas em toda ocorrência.
- O `readEnv` que a tarefa concorrente está ligando ao `DATABASE_URL` já existia
  na revisão que falhou (`src/lib/env.server.ts` está em `fa45632` e não em
  `d4b9395`) e **não** estava aplicado a ele. Isso é observação, não veredito de
  correção: o gate daquela tarefa não foi executado por este pacote.
- A hipótese de "definida e vazia" tem corroboração indireta forte
  (`AI_GATEWAY_URL=""` quebrou todo turno de chat no preview
  `dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8`, conforme o comentário de
  `src/lib/env.server.ts:8-12`), mas **não** é evidência de que `DATABASE_URL`
  está vazia em produção.

## 9. Rollback

Nada para reverter: este pacote só cria arquivos de documentação e acrescenta
linhas ao journal. Reverter = apagar o diretório e remover as linhas
acrescentadas do `PROGRESS.md`, o que destruiria evidência append-only e portanto
**não** é o caminho previsto. Nenhuma alteração de produção existe para desfazer.
