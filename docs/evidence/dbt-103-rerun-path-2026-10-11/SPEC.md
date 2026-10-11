# SPEC — correção do caminho de re-execução do workflow Sonar em `main` (DBT-103)

- **Data:** 2026-10-11.
- **Origem:** re-execução pedida pelo humano (`gh run rerun 38112535521`); attempt 2, passo
  `Seal scanner LCOV provenance`.
- **Escopo:** `scripts/sonar/{main-baseline-select.ts,main-baseline.mjs,lcov-provenance.ts}` e o
  teste que pina o contrato. **Fora de escopo:** o preset do provedor (80% embutido contra os 60%
  da ADR-042), o ruleset `24333849`, o `sonar.yml` (o contrato de cobertura de CI o pina por
  asserção), a publicação, o Neon e qualquer produção.

## 1. Pergunta

A re-execução de um workflow do Sonar em `main` reprovou o check **exigido** `scan + cobertura`.
A pergunta não é "como devolver o verde": é **qual invariante falhou** — recusa legítima do
provedor (a), ambiguidade de identidade da análise medida (b), defeito do seletor histórico (c),
diagnóstico cego que esconde a causa (d), transitória de rede/API (e) ou defeito do próprio
selo (f).

## 2. Precondições declaradas (verificadas em runtime, fail-closed)

| #   | Precondição                                                                  | Como é verificada                                                     |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A1  | os artefatos reais do attempt 2 estão disponíveis e íntegros                 | `gh run download --name sonar-gate-readout` + leitura direta          |
| A2  | a bancada local é um repositório Git real (o selo lê `git rev-parse`)        | `git init` + commit na fixture; senão a recusa viria de outra fase    |
| A3  | a causa é medida nos artefatos, não inferida da mensagem                     | o stub de 508 B e o readout com `analysisId` são lidos e citados      |
| A4  | o RED é contra a regra **anterior** portada fielmente, não contra teste novo | `main-baseline-select.ts` em estado RED, capturado em `red-tests.txt` |
| A5  | o par RED/GREEN usa a **mesma** asserção                                     | o mesmo arquivo de teste nas duas execuções; nada removido ou pulado  |
| A6  | o selo continua fail-closed                                                  | exit 2 observado nos dois lados (antes e depois da correção)          |

`A2` é declarada porque um diretório solto (sem repositório Git) faria a recusa sair na fase
`REVISION_UNAVAILABLE` e o teste mediria outra coisa — foi o que aconteceu na primeira versão do
teste e está corrigido na fixture.

## 3. Método

1. Baixar os artefatos do attempt 2 antes da retenção de 7 dias e compará-los com os do attempt 1.
2. Portar fielmente a regra em vigor (`main-baseline.mjs:42`, unicidade de análise por revisão)
   para um módulo puro e escrever o teste do cenário de re-execução.
3. Medir o RED; corrigir a identidade da análise (a do CE **deste** run, lida do gate readout) e
   medir o GREEN com a mesma asserção.
4. Nomear a causa nas recusas do selo, sem mudar o artefato de sucesso nem o exit code.
5. Reproduzir o passo com os artefatos **reais** do attempt 2 e comparar a mensagem antes/depois.
6. Rodar o gate local integral e observar o CI do próprio push.

## 4. O que falsificaria o diagnóstico

- Se o readout do attempt 2 trouxesse `analysisId` diferente do das duas análises listadas → a causa
  seria identidade do provedor (a), não o seletor.
- Se as duas análises tivessem revisões diferentes → `matches.length` não seria 2 e a unicidade não
  teria sido violada.
- Se o mesmo defeito aparecesse com **uma** análise → o defeito seria do selo (f), não do seletor.
- Se o selo passasse a sair 0 com o stub → teria havido afrouxamento de gate e o resultado seria
  inválido, não uma correção.
- Se a re-execução tivesse mudado o veredito do provedor → a política da ADR-042 estaria em jogo
  (não está: `new_coverage` 73,4 >= 60, `releasePolicy.status=OK` no attempt 2).

## 5. Critério de aceite

RED demonstrável pela razão correta contra a regra anterior; GREEN com a mesma asserção; recusa
nomeada preservando o exit 2; nenhuma alteração de `sonar.yml`, do ruleset ou do preset do
provedor; gate local verde. **O check exigido volta ao verde por revisão nova de `main`** — o SHA do
attempt 2 não recupera por re-execução, por desenho, e isso está declarado no README.
