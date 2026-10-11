# README — recusa por divergência de fonte: causa, correção e verificação

- **Data:** 2026-10-11. **Base:** `develop` `82a2372ee8b00dd5ea93c0ff5e527f4dc8a1739e`
  (HEAD da PR #61); `main` `fa45632391ad9ffe1d20d3bad5264a53b565638e`.
- **Dívida:** `DBT-102` (aberta, closure test próprio). Limite correlato já declarado em
  `DBT-101`.

## 1. Veredito da investigação

**Causa comprovada, classe (a)+(b): recusa legítima e esperada por divergência válida de
fontes, com classificação defeituosa (f).** Não é falha de segurança, não é aprovação
falsa, não é violação de gate obrigatório.

A transição `MAPPED -> NO-VERDICT -> EXECUTION/EVIDENCE FAILURE` foi produzida assim:

1. O candidato altera **3 dos 94 arquivos com unidades elegíveis** —
   `src/db/client.server.ts`, `src/instrumentation/telemetry.ts`, `src/router.tsx` — e
   mais 3 arquivos do censo sem unidades. Medido contra os bytes Git imutáveis.
2. `mirror()` recusa por desenho (ADR-038 §3: comparabilidade exige a **mesma fonte**) e
   lançava `Error: source mapping unavailable: src/db/client.server.ts` — um `Error`
   genérico, **sem conjunto medido**.
3. O `catch` de `runMirrorCli` colapsava tudo que não fosse
   `OriginalProvenanceUnavailable` em `reasonCode: "EXECUTION_OR_UNCLASSIFIED"`, com
   `reason` genérico e **nenhum campo `diagnostic`**.
4. `classifyMirrorObservation` reconhecia **um único** código de `NO-VERDICT`
   (`ORIGINAL_PROVENANCE_UNAVAILABLE`); o código observado não pertencia ao contrato, então
   o observador lançou, `observation` ficou `null`, `outcome` virou `FAILURE` e o job saiu
   com exit 1.

O invariante violado é de **contrato**, não de cobertura: uma recusa técnica **conhecida e
esperada** não tinha representação nomeada, então era indistinguível de uma falha de
execução — e o observador, corretamente fail-closed, a tratava como falha.

## 2. Fato medido (não inferido)

| Fato                                    | Valor                                                               | Origem                             |
| --------------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| censo de componentes de main            | 144 arquivos, 144 hashes selados no snapshot                        | `c28-main-unit-snapshot.json`      |
| arquivos divergentes (main × candidato) | 6                                                                   | bytes Git imutáveis                |
| divergentes **com unidades elegíveis**  | 3                                                                   | `census.divergedWithUnits`         |
| unidades elegíveis nesses 3             | 221                                                                 | recusa medida                      |
| denominador autoritativo de main        | `total 3468`, `covered 2507`, `floor 1734`, cobertura 72,29%        | `c24-main-baseline.json`           |
| adapter                                 | `MAPPED`, exit 0, 3468 unidades                                     | `c28-main-unit-adapter.json`       |
| relatório do espelho                    | `NO-VERDICT`, `EXECUTION_OR_UNCLASSIFIED`, exit 2, sem `diagnostic` | `c26-main-mirror.json`             |
| recibo de observação                    | `observation: null`, `outcome: FAILURE`                             | `c29-main-mirror-observation.json` |
| exigidos do ruleset `24333849` (main)   | `verify-release`, `scan + cobertura` — **o espelho não é exigido**  | GET do ruleset                     |

## 3. Correção

- `unit-mirror.ts`: `SourceDivergence` nomeia a recusa e carrega o **conjunto medido
  inteiro** (caminho, hash de main, hash do candidato) mais a contagem de unidades
  elegíveis. A recusa só é nomeada quando o censo elegível inteiro tem identidade selada
  nos dois lados; hash ausente/malformado continua `source mapping unavailable` genérico e
  bloqueante.
- `mirror-runner.ts`: código estável `SOURCE_DIVERGENCE_MAIN_VS_CANDIDATE` e `diagnostic`
  sanitizado — código, contagens e SHA256 de cada caminho, nunca caminho, mensagem bruta,
  corpo de resposta ou credencial. `EXECUTION_OR_UNCLASSIFIED` permanece para todo o resto.
- `mirror-observation.ts`: o observador aceita a recusa **apenas** com código exato,
  contagens inteiras e ≤ denominador, digests únicos e bem-formados; só para `kind:
mirror`. Qualquer outra combinação continua lançando.

Nada disso concede crédito: o relatório de recusa não traz `result`, o recibo mantém
`approvesMain: false` e o CE obrigatório (`new_coverage >= 60%`, ADR-042) segue intocado.

## 4. Verificação

| Etapa                            | Comando                                        | Resultado                                     | Captura                                       |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| artefatos íntegros               | `gh run download` + `sha256sum`                | 8/8 conferem com os digests publicados        | `captures/artifact-digests.txt`               |
| reconstrução com artefatos reais | re-execução de `evaluateMirrorArtifacts`       | `SourceDivergence`, 3 arquivos / 221 unidades | `captures/reconstruction-real-artifacts.json` |
| RED (bytes anteriores)           | `npx vitest run gate-mirror main-unit-adapter` | 4 falhas pela razão correta                   | `captures/red-prefix-tests.txt`               |
| GREEN (bytes corrigidos)         | idem                                           | 60/60 verde                                   | `captures/green-fix-tests.txt`                |
| evidência remota                 | log do job `114081413318`                      | `NO-VERDICT` genérico + exit 1                | `captures/remote-job-evidence.txt`            |
| identidade Git e artefatos       | `git rev-parse` + API de artifacts             | revisões, runs e IDs                          | `captures/git-identity.txt`                   |
| matriz de invariantes            | medição das 5 precondições                     | esperado × observado por invariante           | `captures/divergence-matrix.txt`              |

RED, pela razão correta:

- `expected Error: source mapping unavailable: src/li… to match object { name:
'SourceDivergence', …(2) }` — a recusa era genérica e sem conjunto medido.
- `NO-VERDICT is not a recognized historical observation.` — o observador não reconhecia o
  código.
- `NO-VERDICT: complete per-unit mapping/provenance unavailable or inconsistent` +
  `expected 1 to be +0` — o CLI real do **defeito remoto**, reproduzido ponta a ponta.

## 5. Limites declarados

1. **Reprodução, não o artefato remoto.** A reconstrução re-executa a função selada contra
   os artefatos reais baixados; não é o artefato original e não é apresentada como tal.
2. **`now` injetado.** Sem isso a recusa por snapshot velho mascararia a causa.
3. **Instrumentação.** A identidade de instrumentação veio do próprio snapshot
   (`bfc1a4c4…`), não do Node local; a impressão digital depende de versão de runtime e de
   `vitest`, que é ambiente, não repositório.
4. **`EXECUTION_OR_UNCLASSIFIED` continua sem diagnóstico de fase.** O produtor do espelho
   não persiste fase/código para falhas não nomeadas; nomear todas aumentaria a superfície
   informacional e é proibido pela ADR-042. Limite declarado em `DBT-102`.
5. **Aceite remoto pendente.** A dívida não fecha enquanto a run do SHA corrigido não for
   observada.
6. **Os corpos dos dois LCOV não são versionados** (~750 kB): só os digests entram
   (`captures/artifact-digests.txt`). A identidade deles é o que a investigação usa, e ela
   está selada nos dois `lcov-provenance.json` preservados; os corpos são recuperáveis nas
   runs nomeadas enquanto a retenção durar.

## 6. Evidência preservada

`captures/remote/` guarda os artefatos originais da run **antes** do vencimento da
retenção de 7 dias, sem transformação: os 8 relatórios do `main-mirror-verdict` (incluindo
o snapshot de 144 arquivos / 3468 unidades), as duas proveniências de LCOV (main e
candidato) e o `c25-gate-readout.json` do candidato. Nenhum deles carrega credencial. Os
digests de todos os 20 arquivos do pacote estão em `MANIFEST.sha256`, verificável da raiz
do repositório com `sha256sum -c`.
