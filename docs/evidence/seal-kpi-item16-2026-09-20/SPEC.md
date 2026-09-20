# SPEC — WP-R4 (selo mecânico, KPI do checklist, item 16 e identidade de bundle)

**Fato-fonte:** `L134`/`L138` (plano aprovado por `ask_user_question`) e as análises avançadas de 2026-09-20 (achados a–d).
**Base:** `2f407f7` · **Branch:** `mission/r4-seal-kpi` · **Worktree:** nenhum (branch no checkout principal).
**Natureza:** docs + tooling de contrato; nenhum runtime tocado.

## 1. Problema

Oito lacunas medidas no arco R3→R1: (1) o selo era um `selo.sh` ad-hoc por WP, e `D -eq L` passa **0 = 0**; (2) o checklist não media captura do autor (KPI ausente); (3) a enumeração multi-sítio não era item formal; (4) `UNVERIFIABLE` não tinha semântica escrita; (5) a complementaridade dos dois filtros de CI era prosa sem teste; (6) os 4 casos de falsificação do guard só rodavam à mão; (7) "bundle idêntico" era identidade de **tamanho**; (8) a citação `run@sha` podia citar run no-op como evidência.

## 2. Contrato

- `scripts/m02-seal.mjs` (`--dir`, `--write`, `--ancestry`, `--run`): descoberta por filesystem, `SPEC.md`/`README.md` obrigatórios, **descoberta vazia reprova**, `checked === discovered`, hash por arquivo e entrada de manifesto sem arquivo reprovam; ancestralidade offline (`git merge-base --is-ancestor`) com 0 claims reprovando; `run@sha` exige `conclusion=success`, `headSha` igual/descendente e **≥ 1 check aplicável** (passos de infraestrutura e do scope guard não contam; no-op só como delegação).
- Template: item 10 ganha "descoberta vazia reprova"; item 15 ganha "≥ 1 check aplicável" + rótulo de no-op; **item 16** (descoberta multi-sítio); campo **auto-verificação pré-S6** + KPI; guard `15→16` e âncora do KPI.
- `scripts/lib/m02-ci-coverage.ts`: `light.push.paths == heavy.push.paths-ignore`, `pull_request` da heavy irrestrito, guards presentes nos dois lados — testado por vitest no `check`.
- Falsificação do guard na CI: vitest com fixtures temporárias (16 itens, origem degenerada, coluna extra, KPI ausente, template inexistente).
- Bundle: sha256 por artefato + hash agregado do grafo inicial (schema `2`), impressos e no report.
- AGENTS: U reservado a inverificabilidade de princípio; calibração do S6 em série separada; ponteiro do `m02-seal` e do KPI.

## 3. Mudanças

| #   | arquivo                                                                                    | mudança                                                          |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | `scripts/m02-seal.mjs` + `.d.mts`                                                          | selo compartilhado (manifesto, não-vacuidade, ancestry, run@sha) |
| 2   | `scripts/lib/m02-ci-coverage.ts`                                                           | invariante de cobertura dos dois pipelines                       |
| 3   | `scripts/lib/bundle-identity.mjs` + `.d.mts`                                               | sha256 de conteúdo e hash agregado                               |
| 4   | `scripts/check-bundle.mjs`                                                                 | usa a identidade; report schema 2; imprime `sha256=`             |
| 5   | `scripts/m02-work-package-guard.mjs`                                                       | 16 itens + âncora do KPI                                         |
| 6   | `docs/evidence/_templates/work-package.md`                                                 | itens 10/15/16, KPI/auto-verificação, apêndices                  |
| 7   | `AGENTS.md`                                                                                | 16 itens, KPI, U, calibração, `m02-seal`                         |
| 8   | `src/test/{m02-seal,m02-ci-coverage,m02-work-package-guard,check-bundle-identity}.test.ts` | 33 casos novos                                                   |
| 9   | `docs/evidence/seal-kpi-item16-2026-09-20/`                                                | este selo                                                        |

**Não muda:** runtime, schema de banco, migrations, placar (`QUEUE.md` do MAESTRO intocado).

## 4. DoD

- [x] `m02-seal` com não-vacuidade, `D≠L`, hash, `SPEC`/`README`, ancestry offline e `run@sha` com ≥ 1 aplicável (17 casos de teste)
- [x] selos reais do R1/R3 aceitos pela ferramenta; run heavy aceito e run light no-op **reprovado** (captura de aceitação)
- [x] complementaridade dos filtros testada (6 casos) contra os workflows reais
- [x] falsificação do guard na CI (6 casos) — os 4 casos do R3 agora têm regressão
- [x] bundle com sha256 (RED "mesmo tamanho, conteúdo diferente")
- [x] template/AGENTS com item 16 e KPI; guard 16 itens verde
- [x] `npm run check` exit 0 com `CHECK_EXIT=0` no log do selo
- [ ] S6 adversarial de contexto limpo (veredicto em `captures/`)
- [ ] selo com `m02-seal --write` + `checked === discovered` (marcado no fecho)

## 5. Testes

| arquivo                          | casos | RED medido                                                             |
| -------------------------------- | ----- | ---------------------------------------------------------------------- |
| `m02-seal.test.ts`               | 17    | módulo ausente (LSP/execução) + no-op real da light aceito → corrigido |
| `m02-ci-coverage.test.ts`        | 6     | lib ausente; filtro divergente e guard ausente reprovam                |
| `m02-work-package-guard.test.ts` | 6     | template 15 itens (antes do bump) e mutações do R3                     |
| `check-bundle-identity.test.ts`  | 4     | mesmos bytes de tamanho, conteúdos diferentes → hashes diferentes      |

## 6. Riscos

| risco                                                          | tratamento                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `m02-seal` valida estrutura, não a verdade da prosa            | declarado: conteúdo segue com S6/humano; o tool fecha vacuidade e vínculo de hash                  |
| exclusão de passos de infraestrutura no `run@sha` é heurística | declarada e testada com o JSON real da light no-op; nomes de check substantivos não casam o filtro |
| o parser de cobertura cobre `push` da light e PR da heavy      | declarado: `pull_request` da light não é comparado (a heavy irrestrita já cobre PRs)               |
| `--run` exige `gh` com rede                                    | declarado: é flag de selo, não roda em `check`; a lógica pura é testada com fixtures               |

## 7. Rollback

Descartar a branch `mission/r4-seal-kpi`; nada em `develop` antes do Gate C.

## 8. Checklist anti-vacuoso demonstrado (16 itens)

| #   | item                            | demonstração                                                                                                                 |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo               | `m02-seal` sobre fixture vazia e sobre run light real **reprovam** (`captures/acceptance.log.txt`)                           |
| 2   | Fronteira nas duas direções     | run heavy aceito × run light no-op reprovado; claim de ancestry verdadeira × invertida                                       |
| 3   | Identidade, não cardinalidade   | sha256 de conteúdo e hash agregado `arquivo:hash`; cobertura compara **conjuntos** de paths                                  |
| 4   | Proibido exit-code-only         | os testes asseram mensagem nomeada; `m02-seal` distingue exit 1 (falha) de 2 (uso/IO)                                        |
| 5   | Proibido sleep fixo             | N/A — nenhuma espera temporal neste WP                                                                                       |
| 6   | Sem valor degenerado            | descoberta vazia, manifesto vazio, linha de manifesto inválida e hash divergente reprovam                                    |
| 7   | Precondição de estado           | fixtures criadas por caso; aceitação usa selos reais e runs reais                                                            |
| 8   | Sentinela real por cenário      | runs `35532153460`/`35532153466` reais; hashes reais dos selos R1/R3                                                         |
| 9   | Fingerprint de revisão          | `captures/hashes.txt` com sha256 dos arquivos; bundle id por conteúdo                                                        |
| 10  | `checked === discovered`        | `m02-seal --write` + verificação; descoberta vazia reprova                                                                   |
| 11  | S6 de contexto limpo            | lane read-only; veredicto verbatim em `captures/`                                                                            |
| 12  | Falha alta                      | exit 1/2 nomeado; nenhum catch compensatório                                                                                 |
| 13  | Isolamento de bancada assertado | S7: escopo, `:5432` 0 listeners, zero credencial, `origin/main`                                                              |
| 14  | Check impresso tem gate/captura | gate, aceitação, testes e S7 em `captures/`                                                                                  |
| 15  | Run de CI atado ao commit       | `m02-seal --run` implementado e exercitado; o land cita `run@sha` conferido por API                                          |
| 16  | Descoberta multi-sítio          | a própria cobertura de CI é enumerada por leitura dos dois workflows (não lista fixa) e o guard exige sítio novo por default |
