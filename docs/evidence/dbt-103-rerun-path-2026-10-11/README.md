# README — o caminho de re-execução do workflow Sonar em `main`: causa, correção e verificação

- **Data:** 2026-10-11. **Base:** `develop` `006bc83306fde67a6efc236a6309a24ad9c3c69c` (registro do
  `DBT-103`); `main` `40c1a35577c70c7d33424640648d52bfdedb8bde`.
- **Dívida:** `DBT-103` (aberta; o closure exige run real de re-execução verde em `main`).

## 1. Veredito

Causa comprovada, classes (c)+(d): **defeito do seletor histórico de análise** somado a **diagnóstico
cego**. Não é recusa do provedor, não é transitória de rede, não houve afrouxamento de gate.

A cadeia medida no attempt 2:

1. A re-execução submeteu uma **segunda análise da mesma revisão** de `main`
   (`11893646-49df-4fe9-a029-de9cec53dbf2` no attempt 1, `08d02858-5846-445b-b349-9e1fc4fe6ba3` no
   attempt 2).
2. `scripts/sonar/main-baseline.mjs:42` exigia `matches.length === 1`; com duas análises da mesma
   revisão o passo de baseline gravou um **stub de 508 B** `main-baseline/2` com
   `verdict: NO-VERDICT` — e esse passo é `continue-on-error` **de propósito**, para não criar um
   segundo veto de release.
3. `scripts/sonar/lcov-provenance.ts` converte o stub em exceção e sai **2**, mas o passo
   `Seal scanner LCOV provenance` **não** tem `continue-on-error` → reprova o check **exigido**
   `scan + cobertura` de `main`.
4. A mensagem era genérica (`no raw inputs emitted`): não distinguia baseline inutilizável de gate
   ausente nem de lcov ausente. O diagnóstico era cego exatamente no passo que mais precisava dele.

O invariante violado é de **identidade**: a análise a medir não pode ser identificada por "é a
única", porque "única" é propriedade do histórico, não da medição. Ela é identificada pela tarefa do
CE **deste** run, que o gate readout do próprio job já publicou.

## 2. Fato medido (não inferido)

| Fato                             | Valor                                              | Origem                             |
| -------------------------------- | -------------------------------------------------- | ---------------------------------- |
| run / SHA                        | `38112535521` / `40c1a355…`                        | API de runs                        |
| attempt 1 → attempt 2            | `success` → `failure`                              | jobs do run                        |
| passo que reprova                | `Seal scanner LCOV provenance`, exit 2             | log do attempt 2                   |
| análises da mesma revisão        | 2 (`11893646…`, `08d02858…`)                       | readouts dos dois attempts         |
| baseline do attempt 2            | 508 B, `verdict: NO-VERDICT`, sem `reasonCode`     | `captures/real-artifact-repro.txt` |
| check exigido `scan + cobertura` | `114499549769` failure                             | check-runs do SHA                  |
| veredito do provedor             | `73,3%` → `73,4%`, ambos < 80% (ERROR)             | `114391269506`, `114500272020`     |
| `releasePolicy` (ADR-042)        | `OK` (73,4 >= 60) no attempt 2                     | `c25-gate-readout.json`            |
| demais checks de `main`          | `verify` e `docs-light` success; espelho `skipped` | check-runs do SHA                  |
| ruleset `24333849`               | exige `verify-release` + `scan + cobertura`        | GET do ruleset                     |
| RED / GREEN                      | 11 failed e 1 passed → 12 passed                   | `captures/red-tests.txt`, `green`  |

## 3. Correção

- **`main-baseline-select.ts` (novo):** a seleção passa a exigir a identidade do CE — a análise mais
  recente de `main` tem de ser a **deste** run e estar na revisão medida — e deixa de exigir
  unicidade de registro. Cada recusa tem código próprio: `CE_ANALYSIS_ID_UNAVAILABLE`,
  `ANALYSES_UNAVAILABLE`, `NEWEST_ANALYSIS_NOT_OUR_REVISION`, `NEWEST_ANALYSIS_NOT_CE_ANALYSIS`.
- **`main-baseline.mjs`:** lê o gate readout do próprio job (`analysisId` e superfície `main`/sem PR)
  e usa o seletor; o stub de falha passa a carregar `reasonCode` de um conjunto fechado validado por
  regex — nenhum corpo do provedor entra no artefato.
- **`lcov-provenance.ts`:** o selo passa a **nomear a fase** que recusou
  (`GATE_READOUT_UNAVAILABLE`, `BASELINE_ARTIFACT_UNUSABLE`, `LCOV_UNAVAILABLE`,
  `SCANNER_LOG_UNAVAILABLE`, `REVISION_UNAVAILABLE`, `SOURCE_FILE_UNAVAILABLE`,
  `SCANNER_IDENTITY_UNAVAILABLE`, `MAIN_PROVENANCE_UNAVAILABLE`, `PROVENANCE_UNCLASSIFIED`).
  **Exit 2 preservado:** nomear não afrouxa o selo, e nenhum teste, regra ou orçamento foi removido.

## 4. Prova

| prova                        | comando                                                       | resultado               | captura                            |
| ---------------------------- | ------------------------------------------------------------- | ----------------------- | ---------------------------------- |
| RED (regra anterior portada) | `npx vitest run src/test/main-baseline-select.test.ts`        | 11 failed e 1 passed    | `captures/red-tests.txt`           |
| GREEN (regra corrigida)      | idem, a **mesma** asserção                                    | 12 passed               | `captures/green-tests.txt`         |
| artefatos reais do attempt 2 | `RUNNER_TEMP=<fixture> node scripts/sonar/lcov-provenance.ts` | código nomeado, exit 2  | `captures/real-artifact-repro.txt` |
| evidência remota             | run, attempts e check-runs                                    | success → failure       | `captures/remote-job-evidence.txt` |
| identidade Git               | `git rev-parse`                                               | revisões e arquivos     | `captures/git-identity.txt`        |
| gate local                   | `npm run check`                                               | exit 0, cadeia completa | `captures/check-local.txt`         |

## 5. Limites declarados

1. **O SHA do attempt 2 não recupera por re-execução.** Uma terceira tentativa criaria uma terceira
   análise da mesma revisão; com a correção ela seria aceita por um workflow que **contivesse** a
   correção — e o `rerun` usa o workflow do SHA do run. Logo o verde do check exigido volta por
   **revisão nova de `main`** (release PR), não por re-execução do SHA atual.
2. **O closure do `DBT-103` não está executado.** Ele exige run real de re-execução verde em `main`
   com o workflow corrigido; até lá a dívida fica `EM_TRATAMENTO`.
3. **O preset do provedor segue em 80%.** A coexistência é declarada pela ADR-042 §3; esta correção
   não toca o preset nem transforma o ERROR do provedor em verde.
4. **Reprodução, não o artefato remoto.** A reprodução usa os artefatos reais baixados, mas não é o
   artefato original e não é apresentada como tal.
5. **`/tmp/scanner.log` continua caminho fixo do selo.** Não foi alterado nesta correção: a bancada
   testa a fase de baseline, que recusa **antes** de ler esse arquivo.
6. **Publicação segue pendente de decisão humana** (ADR-042 §6 e §7, Via A). Merge e publicação são
   ações distintas.

## 6. Evidência preservada

`captures/` guarda as capturas textuais desta correção; os artefatos remotos originais (stub de
baseline, gate readout e os dois vereditos do app) estão citados por id em
`captures/remote-job-evidence.txt` e reproduzidos localmente em `captures/real-artifact-repro.txt`.
Os digests dos arquivos do pacote estão em `MANIFEST.sha256`, verificáveis da raiz do repositório com
`sha256sum -c`.
