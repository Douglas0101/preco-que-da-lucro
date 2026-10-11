# SPEC — correção da classificação da recusa por divergência de fonte no espelho informacional

- **Data:** 2026-10-11.
- **Origem:** PR #61 (`develop` → `main`), run `38007913293`, job `114081413318`,
  artefato `main-mirror-verdict` `11652725068`.
- **Escopo:** `scripts/sonar/{unit-mirror,mirror-runner,mirror-observation}.ts` e os
  testes que pinam o contrato. **Fora de escopo:** o CE obrigatório, o ruleset
  `24333849`, a ADR-042, a ADR-038, o Neon, a Vercel e qualquer produção.

## 1. Pergunta

Um `NO-VERDICT` com `rawExitCode 2` no passo _Observe the conservative mirror_ foi
classificado como `EXECUTION/EVIDENCE FAILURE` e derrubou o job `main-coverage-mirror`.
A pergunta não é "como deixar o job verde": é **qual invariante falhou** e se a falha é
(a) uma recusa legítima e esperada, (b) uma divergência válida de fontes, (c) falha de
identidade/proveniência, (d) inconsistência da evidência, (e) defeito do runner,
(f) defeito do classificador, (g) erro operacional ou (h) falha real de qualidade.

## 2. Precondições declaradas (verificadas em runtime, fail-closed)

| #   | Precondição                                                               | Como é verificada                                               |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A1  | os artefatos originais da run estão disponíveis e íntegros                | `gh run download` + `sha256sum` contra o digest publicado       |
| A2  | a revisão do candidato é a do run (ref de merge), não uma suposição       | `git rev-parse` do objeto buscado por `refs/pull/61/merge`      |
| A3  | os bytes de main são imutáveis e legíveis no clone                        | `git show <mainSha>:<path>` por arquivo do censo                |
| A4  | o clone é completo (não raso)                                             | `git rev-parse --is-shallow-repository` = `false`               |
| A5  | a reprodução roda na raiz do repositório (o produtor usa `process.cwd()`) | execução com `cwd` = raiz do repositório                        |
| A6  | o tempo do snapshot é injetado, não lido do relógio                       | `now` fixado no instante medido do job (`2026-10-10T00:14:13Z`) |

`A6` é declarada porque `mirror()` recusa snapshot com mais de 30 minutos: uma
reprodução "ao vivo" seria recusada por idade, e atribuir isso à causa investigada
seria falso.

## 3. Método

1. Baixar e conferir os artefatos da run; preservar antes do vencimento de 7 dias.
2. Re-executar a função **selada** `evaluateMirrorArtifacts` (o produtor real) contra os
   artefatos reais, com `sourceHash` lendo os bytes Git imutáveis do checkout do PR.
3. Medir o censo inteiro (144 arquivos) e separar "divergente" de "divergente **com
   unidades elegíveis**".
4. Reproduzir o defeito ponta a ponta no CLI real (`mirror-observation.ts mirror`) em
   fixture Git própria, contra os bytes anteriores e posteriores à correção.
5. Provar, por mutação, que cada recusa não reconhecida continua bloqueante.

## 4. O que falsificaria o diagnóstico

- Se o `snapshotDigest`/`metadataDigest`/`periodDigest` divergissem → a causa seria
  inconsistência de evidência (d), não divergência de fonte.
- Se as fontes fossem idênticas entre main e o candidato → a recusa não teria causa
  medida e a classificação informacional seria indevida.
- Se o `before.revision`/`analysisId`/`branch` não casassem com a baseline → identidade
  (c), bloqueante.
- Se o defeito aparecesse também com fontes idênticas → defeito do runner (e), não
  classificação.

## 5. Critério de aceite

RED demonstrável contra os bytes anteriores pela razão correta; GREEN com a mesma
asserção; mutação negativa bloqueante em todas as variantes; nenhum crédito de
cobertura, nenhum `result`, `approvesMain: false`; exigidos do ruleset intocados.
