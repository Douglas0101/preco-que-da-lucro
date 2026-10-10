# SPEC — pacote de evidência do candidato de publicação de 2026-10-09

Slug do pacote: `publication-candidate-2026-10-09`
Data de escrita: 2026-10-09 (UTC)

## 1. Fato-fonte

O relatório de execução de 2026-10-08 (`docs/evidence/production-runtime-incident-2026-10-08/`)
deixou três coisas abertas, e este pacote existe para fechar o que é fechável sem
autorização externa:

1. a identidade do candidato de publicação (o SHA mínimo que contém todas as
   correções e nenhuma alteração indevida);
2. a prova do piso de segurança `@tanstack/*` na árvore transitiva e no lockfile
   do candidato, contra a revisão que hoje serve produção;
3. a ausência de um artefato **discriminante** no log de readiness — a linha
   `health.readiness_failed` passava o objeto `Error` cru a `logJson`, que
   serializa só `name`/`message`; o `error.cause`, onde vive o SQLSTATE, nunca era
   escrito. Foi isso, e não apenas a retenção, que deixou a causa raiz do 503 de
   2026-10-08 não isolada.

Estado de partida medido hoje (VERIFIED, `captures/vercel-readonly-inventory.txt`):

- o alias público `preco-que-da-lucro-sage.vercel.app` aponta para
  `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` (sha `d4b9395`, `READY`);
- `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` (sha `fa45632`, production) existe e está
  `READY`, sem o alias público;
- `dpl_4vNYvd5xcXRBjVRyRcp9Fri7mhxz` (sha `d4b9395`) permanece `ERROR` /
  `BLOCKED_PACKAGE` — a recusa do fornecedor a reconstruir a revisão vulnerável;
- **nenhum** deployment existe para `852dcaf` (HEAD local) nem para `974581a`
  (`origin/develop`).

## 2. Problema

O candidato informado pelo relatório anterior era `fa45632`. A pergunta que este
pacote responde é: **`fa45632` continua sendo o candidato correto?**

A resposta medida é **não**: `fa45632` não contém as correções que o próprio
incidente de 2026-10-08 indicou. Entre `fa45632` e o HEAD local de `develop` há
cinco commits — quatro deles nunca enviados ao remoto
(`captures/git-state.txt`):

- `445b49a` `.gitignore` (higiene do pacote de evidência PR-60);
- `09dfeba` correção de "definido e vazio" em env fora do caminho de IA,
  inclusive `DATABASE_URL` em `src/db/client.server.ts`;
- `0807115` remoção dos sinks inline que tornavam a CSP inaplicável
  (`eval` do zod, `<style>`/`onclick` da página 500, estilo do sonner);
- `852dcaf` o pacote de evidência do incidente + ADR-043.

`fa45632` também carrega o sintoma observável do incidente sob uma forma que o
próprio pacote do incidente já media: `src/routes/api/health/ready.ts` em
`fa45632` é byte-idêntico ao de `d4b9395` (blob `2cdd37e1…`) e passa o `Error`
cru a `logJson`.

## 3. Contrato (termos falsificáveis)

1. Todo fato afirmado no `README.md` carrega uma das marcações **VERIFIED**
   (reproduzido hoje por comando cuja saída está em `captures/`), **INFERRED**
   (derivado de fatos verified, com a derivação declarada), **UNDOCUMENTED**
   (ausente; a ausência é nomeada), **BLOCKED** (existe obstáculo externo
   identificado, com o obstáculo nomeado) ou **NOT APPLICABLE**.
2. Nenhuma captura é fabricada. O que não pode ser medido aparece como falha real
   de comando ou como arquivo explicando por que não é reprodutível.
3. **Nenhum valor de ambiente, credencial, token ou connection string foi lido,
   impresso ou versionado.** As ferramentas Vercel que devolvem valores de env
   não foram chamadas.
4. Nenhuma mutação de produção foi executada: nenhum deployment, alias, domínio,
   env var, branch Neon ou credencial foi criado, alterado ou removido. Nenhum
   push, merge, deploy, promoção de alias ou rollback.
5. `MANIFEST.sha256` é verificável com `sha256sum -c` e cobre a lista
   **descoberta** — `checked === discovered`, sem allowlist de legado.
6. A causa raiz do 503 **não** é declarada isolada em nenhum ponto deste pacote.
7. O candidato de publicação é identificado por SHA exato, e a decisão de
   publicar ou não é **NO-GO** enquanto as precondições Via A não estiverem
   fechadas.

## 4. Mudanças no repositório (escopo fechado)

Criado, e somente isto:

- `docs/evidence/publication-candidate-2026-10-09/**` (este pacote);
- `src/lib/db-failure-classifier.ts` — classificador de falha de conectividade
  Postgres, puro, com saída de chave fixa;
- `src/lib/deployment-identity.server.ts` — `deploymentId`/`commitSha` para logs
  de runtime + `requestCorrelationId`;
- `src/routes/api/health/ready.ts` — a linha de log passa a carregar a
  classificação fechada e a identidade do artefato, em vez do `Error` cru;
- `src/test/db-failure-classifier.test.ts` — 37 testes de regressão do
  classificador, incluindo os de não-vazamento;
- `src/test/health-readiness-logging.test.ts` — 7 testes da rota: linha
  discriminante, não-vazante, resposta pública genérica e fail-closed;
- um teste novo em `src/test/model-gateway.test.ts` — recusa de valor opaco de
  registro de painel no destino nativo DeepSeek;
- `docs/specs/M-02/matrix.generated.yaml` e `docs/specs/M-02/matrix.yaml` —
  regenerados por `npm run m02:matrix:generate` (duas identidades novas na lista
  de imports de `src/routes/api/health/ready.ts`).

**Fora de escopo, explicitamente:**

- `script-src`/`style-src` da CSP: **não** alterados. A política continua
  congelada e report-only; o ADR-043 permanece PROPOSTA sem ratificação.
- Nenhuma alteração em `AGENTS.md`, contratos, migrações ou workflows.
- Nenhum commit, push, merge, deploy, promoção de alias ou rollback.
- Nenhuma leitura de valor de ambiente.

## 5. Limites declarados

1. **A causa raiz do 503 de 2026-10-08 permanece NÃO isolada.** O sintoma não é
   reprodutível hoje (o alias público não serve o deployment que falhou) e o
   experimento decisivo — reconstruir os bytes de `d4b9395` com o ambiente atual —
   está bloqueado pelo fornecedor (`BLOCKED_PACKAGE`). O que este pacote entrega
   é o instrumento que teria discriminado a causa, mais a prova de que ele
   discrimina (cinco formas de falha, cinco classificações distintas).
2. **`AI_MODEL`, `AI_GATEWAY_URL` e `DATABASE_URL` de produção são BLOCKED**: os
   valores não foram lidos. O runbook
   (`docs/runbooks/vercel-prod-env-admin.md` §3) os classifica como
   pré-requisito duro de publicação, e a confirmação é operação Via A.
3. **A chamada real ao provedor de IA não foi executada.** Nenhuma credencial de
   provedor existe neste ambiente; o fluxo de chat com dados sintéticos é
   coberto com provedor falso pelas suítes de `db:test`.
4. **SSO continua habilitado** e nenhum link de bypass de autenticação foi usado.
   A verificação de runtime do candidato em ambiente protegido fica, portanto,
   sem evidência própria — está declarada como **BLOCKED**, não como verificada.
5. **A primeira execução do `npm run db:test` foi RECUSADA, e a recusa é
   específica.** O guarda em `drizzle/rollback/0010_to_0009_down.sql:26-37`
   (mesma transação do `UPDATE` destrutivo) recusa com SQLSTATE `P0001` quando
   `count(*)` de `accounts` é `> 0` — **qualquer** linha, sem filtro; o volume
   nomeado `preco-que-d-main_postgres-data` sobrevive a `npm run db:down` e
   carregava 2 contas de rodada anterior da própria bancada. A assinatura é a
   mesma já registrada como DBT-96. **A recusa não foi contornada:** nenhuma
   conta foi apagada à força; o volume foi zerado pelo procedimento documentado
   no runbook e a cadeia passou. Medido que a cadeia, quando passa, deixa
   `accounts=0` — ou seja, é **reexecutável** sobre o estado que ela própria
   produz; medido também, em sonda isolada, que o **aborto deixa drift**
   (9 downs commitados sem a poda do journal; `schema != journal`) e uma
   reexecução sem zerar não se cura (`captures/db-test-reproducibility.txt` e
   `captures/db-test-abort-drift.txt`, quatro execuções: RECUSADA, VERDE,
   VERDE, DRIFT).
6. Nenhum teste foi removido, ignorado ou afrouxado para obter verde.

## 6. DoD (critérios binários)

| #   | critério                                                                            | prova                                                          |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | SHA mínimo com todas as correções identificado e justificado                        | `captures/git-state.txt`                                       |
| 2   | Piso de segurança verificado em spec, lockfile e `node_modules`, sem cópia aninhada | `captures/version-inventory.txt`                               |
| 3   | Advisory primário conferido (faixa afetada × patched)                               | `README.md` §E                                                 |
| 4   | Cadeia `npm run check` verde, integral versionada                                   | `captures/gate-check-summary.txt`, `gate-check-full.log.txt`   |
| 5   | Cadeia `npm run db:test` (18 suítes) verde e **reexecutável** na bancada efêmera    | `captures/db-test-summary.txt`, `db-test-reproducibility.txt`  |
| 6   | `SELECT 1` real pelo caminho da aplicação contra banco isolado                      | `captures/db-connectivity-probe.txt`                           |
| 7   | Classificador discrimina cinco formas de falha sem vazar credencial                 | `captures/db-connectivity-probe.txt`                           |
| 8   | Controle negativo do classificador: GREEN → RED → RESTORED                          | `captures/negative-control.txt`, `probes/negative-control.mjs` |
| 9   | Contrato de IA auditado por código, com cobertura dos nove comportamentos           | `captures/ai-contract-audit.txt`                               |
| 10  | Identidade de produção reconciliada por leitura read-only                           | `captures/vercel-readonly-inventory.txt`                       |
| 11  | `MANIFEST.sha256` verificado com `sha256sum -c`                                     | saída registrada no `README.md`                                |

## 7. Testes (RED/GREEN e falsificação)

- **RED:** em `fa45632`, o log de readiness não discriminava. A reprovação é por
  **leitura de código**, não por teste: `captures/ai-contract-audit.txt` e o
  blob idêntico `2cdd37e1…` entre `d4b9395` e `fa45632`
  (`docs/evidence/production-runtime-incident-2026-10-08/captures/blob-identity-verification.txt`).
- **GREEN:** com o classificador, cinco formas de falha produzem cinco
  classificações distintas, e o log carrega `component`, `category`, `step`,
  `code`, `transient`, `correlationId`, `deploymentId`, `commitSha` — com
  `AUTOVERIFY=ok` no probe.
- **Controle negativo:** `probes/negative-control.mjs` injeta a mensagem do erro
  na saída e reprova 21 dos 44 testes; com o módulo restaurado, voltam a passar 44. Sem esse controle, um classificador que passa a vazar seria
  indistinguível de um que não vaza.
- **Falsificação do escopo:** se qualquer arquivo fora da lista da §4 tiver sido
  alterado, este pacote está inválido.

## 8. Riscos

- O candidato correto é o HEAD local. Ele **nunca foi construído pela
  plataforma**, e portanto não tem evidência de runtime própria. Verde local não
  é verde de produção.
- A contenção atual mantém produção em `d4b9395`, que resolve
  `@tanstack/react-start@1.168.49` — afetada por GHSA-qx66-fv34-fjm8 /
  CVE-2026-102989. Isto **não** é resolvido por este pacote: exige publicar o
  SHA novo, o que exige Via A.
- O lockfile resolve `@tanstack/react-start` **exatamente** em `1.168.60`, o piso
  da faixa afetadapatched — margem zero. Qualquer downgrade acidental reabre a
  vulnerabilidade.
- `m02:matrix:generate` foi necessário depois da mudança na rota de readiness.
  Isso é o processo documentado, não um afrouxamento.

## 9. Rollback

Nada para reverter em produção: nenhuma mutação foi feita. No repositório, os
arquivos da §4 podem ser descartados sem efeito em produção. O alvo de rollback
documentado continua sendo `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`
(`d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`), com a ressalva já registrada em
`docs/runbooks/vercel-prod-env-admin.md` §8: voltar a ele **não** restaura o chat.
