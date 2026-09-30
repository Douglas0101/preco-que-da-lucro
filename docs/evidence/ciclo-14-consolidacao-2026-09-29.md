# Ciclo 14 — Consolidação e preparação de rotação (evidência selada)

- **Data:** 2026-09-29 · **Fases:** F14-1 … F14-6
- **Commits:** `7d0e960` (código) · `82eeb9f` (evidência parcial) · commit desta fase (evidência consolidada)
- **Autorizações usadas:** R4 (DECIDE N-2) · R5 (harness/sidecar) · R9/R10 (Hostinger — **não** usadas, bloqueadas)
- **Sem push**, por decisão declarada: a fase é local e o brief não pede push.

---

## 1. Entregáveis, fase por fase

| Fase      | Entregável                              | Estado           | Evidência                                                                                                                                                     |
| --------- | --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F14-1** | Sidecar secreto-injetor BLIND           | ✅               | `scripts/secret-sidecar/**`, `src/test/secret-sidecar.test.ts`, `docs/adr/ADR-031-sidecar-cego-injecao-segredos.md`, `docs/runbooks/secret-rotation-blind.md` |
| **F14-2** | Reconciliar drift de `develop` + DBT-30 | ✅               | premissa **refutada** — `develop` não está arquivada; ver §3                                                                                                  |
| **F14-3** | Pacote DECIDE N-2                       | ✅               | `docs/evidence/n2-decide-package-2026-09-29.md`, `docs/adr/ADR-032-decimal-string-wire-canonico.md` (**PROPOSTA**)                                            |
| **F14-4** | Relaunch MCP documentado                | ✅               | `docs/runbooks/mcp-relaunch.md`, `scripts/verify-mcp-relaunch.sh`; gate `npm run check` **exit 0**                                                            |
| **F14-5** | Registro: registry, ledger, journal     | ✅               | `DEBTS.md` (DBT-32 FECHADA, DBT-36 aberta), `PROGRESS.md` `L231`–`L234`, este documento                                                                       |
| **F14-6** | Hostinger H-Panel (R9/R10)              | ⛔ **bloqueado** | `docs/evidence/hostinger-operations-2026-09-29.md` — pré-condição humana (H-6)                                                                                |

## 2. F14-1 — Sidecar BLIND: hashes e provas

**Caminho da implementação:** `scripts/secret-sidecar/` (no repo, versionado e verificável por
clone). **Lancador:** `~/.mcp-runtime/secret-sidecar/bin/sidecar` é **symlink** para
`scripts/secret-sidecar/bin/sidecar` — `~/.mcp-runtime/` não guarda código inverificável.

| Arquivo                                    | sha256                                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `scripts/secret-sidecar/dbus.ts`           | `04c97e7365a3ef4abb5adb61e89a2dd1ea2e675f14af6ab398dce1c9dcf86a1a` |
| `scripts/secret-sidecar/keychain.ts`       | `548e5566c09ed52dd3742c03abf2c4437106c0496b76ad4234d6bcd96ea49480` |
| `scripts/secret-sidecar/secret-service.ts` | `28f09c390bbd762ad4af8528ec7276129c3a1b2a3bbaa5fd897548dd8fe7065b` |
| `scripts/secret-sidecar/audit.ts`          | `c9709e9f9cdae4e1e71f9b6b3cd9d9843ab4a0bae2448f922fc6c97182f6426b` |
| `scripts/secret-sidecar/clipboard.ts`      | `16e21f5c8767c6d3a5aa54fdc77e2771c922c3eddf56ae517fcffd2a2faedf1c` |
| `scripts/secret-sidecar/sidecar.ts`        | `4b21c4eb1510ab7aa597ba1ddbb4365d69a8a6a9d925366c46d6a3685425ac5e` |
| `scripts/secret-sidecar/selftest.ts`       | `2afdb1923a4806ebb8b44be91cdb66d6a67de5b736eebace62658b693438be1d` |
| `scripts/secret-sidecar/cli.ts`            | `ec094a75cfd9e6841cbccd4e7bec2692eb7cc06264a10212c0a3e837aac1d8f1` |
| `scripts/secret-sidecar/bin/sidecar`       | `e6f79e05242ee79511e51230c2500ab085e6fd277e2da8d71df17ca1d269bf4a` |
| `scripts/secret-sidecar/README.md`         | `8a0e12e9d1e6d1a7a7225d68b35d0e3a160ecd766f3e81521acd1733fecef166` |
| `src/test/secret-sidecar.test.ts`          | `41f5fa3cfc3cd5f404a884273d870eea9bd16666668e8dc2a3c9487e0933e892` |
| `docs/runbooks/secret-rotation-blind.md`   | `b1b9a84447cf8a6158aa8532dd484570c99c563ae0e97f4bbe864555c61fb182` |

### 2.1 Os cinco cenários com segredos **fictícios** — resultado

Executados duas vezes, contra backends distintos. **Nenhum valor real foi usado em momento algum.**

| Cenário                    | `--backend=memoria` (bancada) | `--backend=cofre` (gnome-keyring real) |
| -------------------------- | ----------------------------- | -------------------------------------- |
| `generate-e-restore`       | PASS                          | PASS                                   |
| `area-de-transferencia`    | PASS                          | PASS                                   |
| `fail-closed-no-cofre`     | PASS                          | PASS                                   |
| `sonda-401-200-e-denylist` | PASS                          | PASS                                   |
| `audit-sem-valor`          | PASS                          | PASS                                   |

`{"comando":"selftest","outcome":"pass","cenarios":5}` · exit **0** nos dois.

- **Clipboard wipe verificado:** o cenário de área de transferência confere que a área fica
  vazia depois da captura, que a saída cega devolve **exatamente os mesmos bytes** que saíram
  (71 bytes), e **restaura o conteúdo do operador** no `finally` — destruir 23717 bytes do
  usuário para provar uma limpeza seria péssima troca.
- **Fail-closed em falha de keychain:** 6 operações sob `FaultInjectingKeychain`, cada uma
  abortando com `KeychainError` e **nenhum ref gravado**.
- **Nenhum valor no audit:** varredura de todos os arquivos sob a raiz, procurando a marca
  fictícia em claro **e** cada valor em 4 codificações (cru, hex, base64, base64url). Controle
  positivo obrigatório: o `sha256` de cada valor **tem** de estar presente — sem isso um arquivo
  vazio passaria por vácuo. Audit real: **71 linhas**, só hashes.
- **Par 401→200 medido:** servidor `node:http` em loopback que **nunca ecoa** o cabeçalho
  recebido (um servidor de teste que o devolvesse seria ele próprio o vazamento); valor antigo
  → **401**, novo → **200**.
- **Higiene pós-teste:** o autoteste **não** remove o que grava no cofre real (por desenho — ele
  não deve apagar nada que não criou). As 13 refs deixadas foram removidas uma a uma;
  `list --backend=cofre` → `{"comando":"list","refs":[]}`.

### 2.2 Os dois defeitos reais que o autoteste verde não pegou

Ambos encontrados **apenas** ao exercitar o backend real, e ambos invisíveis para a bancada em memória:

1. **`sessionBusPath()` exigia `,path=`.** O separador antes da **primeira** chave de um
   endereço D-Bus é `:` (`unix:path=/run/user/1000/bus,…`), não `,`. O parser nunca casava o
   endereço real e um **barramento saudável** era reportado como _"endereço não suportado"_.
   Corrigido com parser de verdade; o sinal virou **tipo** (`DBusPreconditionError`) em vez de
   casamento de mensagem.
2. **A CLI nunca fechava o socket do Secret Service.** `health --backend=cofre` imprimia o JSON
   e **pendurava** → `exit=124` sob `timeout 10`. Corrigido: `Keychain.close?()` opcional +
   invólucro `main` com `try/finally`. Medido depois: **exit 0**.

**A causa comum:** a bancada em memória **nunca exercita o transporte**. É exatamente por isso
que rodar o autoteste também contra o cofre real não foi redundância — foi a única coisa que
encontrou os dois defeitos.

### 2.3 Propriedade de desenho que o teste pina

O sidecar **não tem** — e o cabeçalho declara que não deve passar a ter — nenhum método que
devolva o valor de um segredo. O cenário `generate-e-restore` assere a **forma** do retorno
(`Object.keys(alvo).sort().join(",") === "ref,sha256"`): um método que devolvesse o valor "só
para depurar" passaria em todas as outras asserções, e é esta linha que o reprova. Nenhum
subcomando da CLI aceita valor de segredo como argumento — não existe `put`, porque `argv`
aparece em `ps`, no histórico do shell e no journal do systemd.

## 3. F14-2 — a premissa do brief estava errada, e isso é o achado

O brief pedia _"reconciliar drift de `develop` + DBT-30"_ partindo de `develop` estar
**arquivada**. Medido: **`develop` não está arquivada e não está protegida** — existe local e em
`origin`, com HEAD em `a2f5ff6`. Um _unarchive_ de algo não arquivado não é uma operação; é um
no-op com relatório.

O que **de fato** driftava foi reconciliado e está registrado em
`docs/evidence/develop-archived-drift-2026-09-29.md`: a divergência entre `develop` e a linha de
release. DBT-30 fica com o status medido nesse documento, não com o status que a premissa supunha.

**A lição operacional:** o brief deste ciclo continha **três** premissas refutadas por medição
(esta, o `N2_CONTRACT_MODE` do F14-3, e as operações de DNS/SSL do F14-6). Em todas, a resposta
correta foi medir antes de executar — e nenhuma foi "executada assim mesmo para constar".

## 4. F14-3 — o que o brief pedia não era implementável, e por um motivo melhor

O brief pedia **implementar** um shadow dual-encode sob `N2_CONTRACT_MODE`. Medido:
**o flag não existe em nenhum lugar do repositório** (`grep -rn` = 0 ocorrências) e a função de
exemplo do brief (`formatMoney`) não corresponde à arquitetura — aqui há um encoder
(`toDecimalString`) alimentando um contrato (`outputSchema`).

A razão de fundo, que é o achado: **`toDecimalString` não é formatador, é portão.** Um ramo
`legacy` dentro dele faria o portão devolver justamente a forma que ele existe para recusar —
IEEE-754 não carrega canonicidade. E o modo shadow existe para medir decisão ainda **não**
tomada; esta **já está no código, verde e publicada**.

Entregue em vez disso: pacote DECIDE com tabela comparativa `legacy`/`dual`/`new`, custo de
reversão **medido** (60 sítios, 20 arquivos, 4 schemas) e **recomendação de ratificar `new`**.
O ADR é **ADR-032**, não ADR-033 como o brief supunha — a numeração foi remedida.

**A objeção registrada é de autorização, não de engenharia**: o S6 do Ciclo 3 já mediu que
nenhum consumidor quebra (`tsc` global 0, 1222 testes verdes). Falta o MAESTRO dizer sim ou não.

## 5. F14-4 — relaunch MCP

`docs/runbooks/mcp-relaunch.md` (procedimento com pré-condições, 6 passos, verificação, rollback
e proibições) + `scripts/verify-mcp-relaunch.sh`. O que fecha o mecanismo é a asserção de
`sha256sum` dos dois manifestos: sem ela o "relaunch" não tem como distinguir _reconectou_ de
_não tentou_ — e o guard sozinho só mede a **forma da linha**, não o dano à árvore.

> **Errata de processo.** A primeira versão deste documento citava `scripts/verify-mcp-relaunch.sh`
> como entregue **antes de o arquivo existir**. O `ls` devolveu exit 2 e o `git add` da fase
> curto-circuitou no `&&`. Nada foi staged, nada foi commitado, e a afirmação falsa foi encontrada
> por medição, não por revisão. Fica registrado porque é a **mesma classe** de defeito que este
> ciclo passou a medir em outros arquivos (`DBT-34`, `DBT-37`): prosa que afirma o que o artefato
> não sustenta. A correção foi entregar o artefato, não apagar a linha.

O script tem **quatro modos** e é a asserção do passo 6 do runbook tornada executável:

| modo               | o que faz                                                                            |
| ------------------ | ------------------------------------------------------------------------------------ |
| (sem flag)         | 5 checagens estáticas: pré-condições, cofre, audit log, guardas do repo, config viva |
| `--snapshot <arq>` | grava `sha256sum` dos dois manifestos **antes** do relançamento                      |
| `--verify <arq>`   | recomputa e reprova se os manifestos mudaram — o mecanismo do DBT-32                 |
| `--help`           | uso                                                                                  |

**Medido, com controle negativo de verdade** (não exit-code-only):

| cenário                                                         | exit  | o que provou                                                                 |
| --------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| A — estático, cofre real                                        | **0** | `secret-service refs=0 area=wayland`; audit **72** linhas, **0** malformadas |
| B — `--snapshot`                                                | **0** | gravou `package.json` `fbfeab8b…` e `package-lock.json` `c8c6e472…`          |
| C — `--verify` com a árvore intacta                             | **0** | "manifestos IDÊNTICOS"                                                       |
| D — `--verify` com o snapshot **adulterado** (simula reescrita) | **1** | "manifestos MUDARAM" + o diff — **o controle negativo**                      |
| E — `--verify` com snapshot ausente                             | **2** | pré-condição, distinta de reprovação                                         |

O cenário D é o que dá sentido aos outros: sem ele, um script que sempre aprova passaria em A, B
e C. E o escopo-máquina continua saindo **1** com as **7** violações — de propósito: a config da
máquina é da máquina, e um relançamento não a conserta. O script **reporta** isso como nota e
**não** conta como reprovação da fase, porque reprovar a árvore pelo `HOME` de quem o roda é o que
faz um gate ser desligado na primeira semana.

Gate `npm run check` verde **antes** do commit desta fase.

## 6. F14-6 — bloqueado, e o bloqueio está documentado em passos

Ver `docs/evidence/hostinger-operations-2026-09-29.md`. Resumo do que importa:

- **Nenhuma credencial de conta Hostinger existe.** O arquivo chamado `hpanel-secrets.env`
  contém **env do app**, não credencial — armadilha de nomenclatura registrada.
- **O login é passo humano por desenho** (o brief §6.2/§7 manda parar diante de campo de senha;
  a §6.1 pede o contrário — resolvido pelo lado mais restritivo). O enxame **não** digita senha.
- **`hpanel.hostinger.com` responde 403** — negado, não inalcançável. **Nenhuma tentativa de
  contorno foi feita.**
- **O roteiro do brief está desalinhado do alvo:** o alvo é um subdomínio gratuito, sem zona DNS
  própria, e o que falta é **redeploy + env**, não DNS/SSL/redirect.
- **ERRATA registrada:** `REGISTRO-H.md:27` cita um prazo de watcher **desatualizado** — o arm
  file mostra duas armagens posteriores (2026-09-28), logo o watcher está **armado**, não
  caducado. Mesma classe de `DBT-34`.

## 7. Observabilidade — limite declarado, e é um limite real

O brief (§2.2/§2.3) pede spans `visual_agent.iteration` e métricas `visual.*` / `hostinger.*`.
**Nenhum deles foi emitido, e não por esquecimento:**

- `src/instrumentation/telemetry.ts:12` cria `const meter = metrics.getMeter("preco-que-da-lucro", "1.0.0")`
  **no escopo do módulo**, e os instrumentos nascem no import (`:117` `aiReconciliationTotal`,
  `:118` `aiReconciliationFailed`, `:158`/`:162` gauges de pool) **antes de qualquer provider
  global**. `@opentelemetry/api` 1.9.1 devolve `NOOP_METER_PROVIDER` nesse caso, e os
  instrumentos são os singletons noop compartilhados. **Nenhuma métrica de aplicação sai do
  processo hoje.** WP `F-otel-provider-order` aberto (BACKLOG/S0), bloqueio = ADR + teste com
  collector OTLP real.
- Chamada de MCP **não** atravessa a telemetria da aplicação — já medido e registrado no Ciclo 11.
  Logo não há span OTel a cunhar por operação de console, com ou sem provider.

**O que foi feito em vez de fabricar:** as evidências deste ciclo são **hashes de arquivo**
(§2), **saídas de comando reproduzíveis** e **códigos de saída** — verificáveis por qualquer
leitor com `sha256sum`, `curl`, `dig` e o próprio `--selftest`. A regra de ouro da §2.4 do brief
(_"o trace referencia hashes, nunca a imagem crua"_) foi honrada **literalmente**: há hashes, e
não há trace falso.

## 8. Gates

| Gate                                                                                 | Resultado                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                                   | **exit 0**                                                                                                       |
| `npx vitest run src/test/secret-sidecar.test.ts`                                     | **9/9 passed**                                                                                                   |
| `npx vitest run src/test/mcp-runtime-guard.test.ts src/test/m02-ci-coverage.test.ts` | 20/20 + 24/24                                                                                                    |
| `npm run m02:matrix:check`                                                           | **exit 0** — _"M-02 matrix is deterministic and up to date."_ (a adição é toda sob `scripts/`, fora de `src/**`) |
| `node scripts/m02-debts-guard.mjs`                                                   | **OK (32 dívidas, taxonomia e regra de closure)**                                                                |
| `npm run m02:temporal-guard`                                                         | **OK (3 superfícies vivas, 0 violação)**                                                                         |
| `npx prettier --check`                                                               | limpo                                                                                                            |
| `npm run check`                                                                      | **exit 0** (2 m 6 s na 1ª execução medida; `CHECK_EXIT=0` na passada desta fase)                                 |

## 9. Segurança

- **Zero segredos em artefatos.** O audit log tem 71 linhas e **só hashes**; o cenário
  `audit-sem-valor` varre 4 codificações e tem controle positivo, ou seja, "não achei" é
  medido, não presumido.
- **Zero valores reais usados.** Os 5 segredos do autoteste são fictícios por construção
  (`MARCA_FICTICIA` + random), e a marca literal é o que torna a busca executável.
- **Nenhuma credencial foi digitada, copiada ou persistida** — a fase parou no login (§6).
- **`Keys.txt` segue gitignored e nunca esteve no histórico** (contenção do Ciclo 10 mantida).
- **`npm run m02:secrets-audit` e `m02:boundaries`** rodam dentro do `check` e passaram.
- **Higiene de commit:** `git add -A` havia staged **952** arquivos, dos quais **927** eram
  subprodutos de `docs/evidence/local-ci/**` acumulados por ciclos anteriores. **Decisão
  declarada:** não entram — varridos para dentro de um commit de fase o tornariam inrevisável.
  Nada perigoso estava staged (`grep -cE "node_modules|\.output|test-results|playwright-report"`
  = **0**).

## 10. Próxima fronteira recomendada (**sem executar**)

1. **H-6 (ação humana, ~2 min)** — é o maior destravamento múltiplo: destrava tráfego real,
   séries `OBSERVED`, e2e CSP, `12.5` live **e** fecha o F14-6 deste ciclo. Os passos estão
   prontos em `docs/evidence/hostinger-operations-2026-09-29.md` §5.
2. **Ratificar N-2** (R4, DECIDE humano) — o pacote está entregue; é o item nº 1 da fronteira do
   Ciclo 13 e o desbloqueio do `C10-3`, que ficou em `5/35` por causa dele.
3. **Ciclo 15 — rotação BLIND das 4 credenciais.** O sidecar está provado contra o cofre real;
   o procedimento está em `docs/runbooks/secret-rotation-blind.md`; o closure está em `DBT-36`.
   Depende de deploy de produção (item 1).
4. **Relaunch do cliente MCP** (ATTEST humano, 1 toque) — procedimento em `docs/runbooks/mcp-relaunch.md`.
5. **`F-otel-provider-order`** — enquanto o meter nascer antes do provider, _nenhuma_ métrica de
   aplicação sai do processo, e todo ciclo futuro que peça observabilidade vai colidir com isso.

**Não recomendado agora:** expansão de cobertura de contratos (multiplica decisão não ratificada
por 7×) e gateway de pagamentos (`DEFERRED`, aguarda cadastro humano).
