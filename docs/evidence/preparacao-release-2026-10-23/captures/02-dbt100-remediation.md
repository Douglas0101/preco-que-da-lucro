# DBT-100 — causa raiz e remediação proposta (sem aplicar)

## 1. O que falhou, exatamente

As duas execuções do PR #68 falharam no mesmo step e com a mesma mensagem:

- run `40046519246` (push), job `verify` (job `120733448724`);
- run `40046525035` (pull_request), job `verify-release` (job `120735366555`);
- step `Verify kit identity and install Linux packages offline`;
- mensagem: `precondition: kit identity mismatch: imageVersion`;
- exit `2` (precondição), **antes** de instalar browsers ou rodar Playwright.

Os jobs `prepare browsers and Linux packages` das duas execuções terminaram **SUCCESS** (61 s e 93 s). O step de verificação recusou o kit porque o `ImageVersion` do runner do `verify` não era o mesmo do runner que preparou o kit.

## 2. Por que a hipótese do prompt não se aplica

O prompt afirma que a causa é uma tag mutável de imagem Docker do Playwright (`noble`) e propõe pinar `mcr.microsoft.com/playwright:v1.53.1-noble`. Medição:

- `grep -rn "mcr.microsoft.com/playwright\|image:" .github/workflows/*.yml` → a única imagem é `postgres:17-alpine` (serviço do job `verify`). **Não há imagem Docker de Playwright.**
- O pipeline usa `runs-on: ubuntu-24.04`, `npx playwright install --with-deps chromium firefox webkit` e um kit de browsers + pacotes `.deb` empacotado, atestado e reutilizado.
- A versão instalada é `@playwright/test 1.62.1` (lockfile). A tag citada (`v1.53.1`) não corresponde a esta versão.
- O catálogo MCR tem `v1.62.1-noble`, mas adotá-la é uma mudança de arquitetura, não um pin de tag.

A identidade do kit é definida em `scripts/ci/playwright-kit.ts` (`KitIdentity`): `lockSha256`, `imageOS`, **`imageVersion`**, `architecture`, `playwrightVersion`. O `verify` compara a atestação com `runIdentity()` do job atual; `ImageVersion` diferente ⇒ recusa. É exatamente o DBT-100 do registry:

> “a atestação do kit vincula runner ImageOS/ImageVersion e, em janelas de rollout da imagem ubuntu-24.04, prepare-browsers e verify podem cair em imagens diferentes; a verificação reprova como precondição (exit 2, Playwright skipped) mesmo com os testes passando no mesmo SHA.”

## 3. Remediação medida (não é patch)

**Reexecução completa do workflow**, criando um novo `runAttempt` no mesmo SHA:

```bash
# NÃO EXECUTADO — exige G1
gh run rerun 40046519246     # push / verify
gh run rerun 40046525035     # pull_request / verify-release
```

Regras:

- **Não** usar `--failed`: a atestação vincula `runAttempt` e o job `prepare-browsers` precisa ser reexecutado para re-atestar o kit no novo attempt.
- O rerun completo pode passar se `prepare` e `verify` caírem na mesma `ImageVersion`. Se a janela de rollout continuar, o mesmo exit 2 se repete — e isso é detecção, não regressão de código.
- O `verify-release` do PR é o gate de release; o `verify` do push não o substitui.

Essa é a closure test já declarada no DBT-100: “rerun completo do workflow (novo attempt, prepare+verify) com ambos os jobs na mesma imagem passa no mesmo SHA, revalidando os orçamentos de 12 min”.

## 4. Correção estrutural (opcional, exige ADR)

Se o DBT-100 se repetir com frequência, a única forma determinística de garantir a mesma imagem nos dois jobs é **fixar o ambiente por container**, não por `ubuntu-24.04`:

```yaml
# ESBOÇO — NÃO APLICAR. Exige ADR e medição de orçamento.
jobs:
  prepare-browsers:
    runs-on: ubuntu-24.04
    container:
      image: mcr.microsoft.com/playwright:v1.62.1-noble@sha256:<digest>
      options: --user 1001
  verify:
    runs-on: ubuntu-24.04
    container:
      image: mcr.microsoft.com/playwright:v1.62.1-noble@sha256:<digest>
      options: --user 1001
```

Por que **não** é um patch trivial:

1. A imagem já traz os browsers; o kit (`prepare-browsers`, cache, atestação, download de artifact) se torna redundante ou precisa ser removido — uma deleção grande, não um pin.
2. O job `verify` usa `services: postgres` e o app aponta para `127.0.0.1:5432`. Em container job, o serviço não fica em loopback do container; seria necessário rework de rede e de `DATABASE_URL`/`DATABASE_ADMIN_URL`.
3. O orçamento de 12 min do `verify` (A5) e o de 12 min do `prepare` precisam ser remedidos; pull de imagem + setup pode consumir a folga.
4. DBT-68/DBT-79 são contratos de cache/atestação; mudar a topologia sem ADR renegocia esses contratos por omissão.
5. A tag `v1.62.1-noble` deve ser fixada por **digest**, não por tag, para ser imutável.

**Decisão proposta:** manter o DBT-100 aberto, executar G1 (rerun completo) agora, e só abrir ADR se houver recorrência medida. Não aplicar o esboço acima nesta janela.

## 5. O que NÃO foi feito

- Nenhum arquivo de workflow alterado.
- Nenhum `gh run rerun` executado.
- Nenhum cache limpo, nenhum timeout aumentado, nenhum guard afrouxado.
- Nenhum commit/push.

## 6. Pedido de decisão

> **G1:** “Aprovo a reexecução completa do workflow do PR #68” — autoriza os dois `gh run rerun` acima (novo attempt), e nada mais.
