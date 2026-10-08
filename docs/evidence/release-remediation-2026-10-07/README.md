# release-remediation-2026-10-07 — correções S6-R2 (N01–N04) do candidato de release

## Veredito

LOCAL-VERIFIED para a bancada (negativos RED → focados GREEN 186/186 →
`npm run check` completo com capture) e PENDING para CI/S6: o circuito remoto da
PR, a lane S6 R3 de contexto limpo (exigência 0 REJECTED) e o run@sha do commit
selado são pré-condições separadas e ainda não emitidas. `main`, rulesets e
promoção Vercel permanecem sem mutação.

## Auto-verificação pré-S6 (checklist anti-vacuísmo, item a item)

1. **Controle negativo** — `assertConnectionPair` recusa porta ausente/:9999 e
   `host`/`hostaddr`/`port`/`options`/`application_name` na query; `pinConnection`
   recusa as sete formas negativas; a auditoria recusa os quatro mutantes do
   passo do CE (expressão, shell, BASH_ENV, erro engolido); o provisionador
   recusa 412/500, endpoint ambíguo e contexto de run falso (negativos rodados
   antes dos positivos).
2. **Fronteira nas duas direções** — a política de cobertura já provada em
   `policy-red-green` permanece: ≥60 passa, <60 bloqueia, controles do provedor
   bloqueiam; o audit do CE aceita o passo correto e reprova cada desvio nomeado.
3. **Identidade, não cardinalidade** — endpoint exigido por `branch_id` +
   `project_id` + `type` + `disabled`, com regex de host e contagem exata 1;
   duplicado reprova.
4. **Proibido exit-code-only** — todo veredito imprime/persiste relatório
   estruturado (`neon-pr-provision.json`, `c25-gate-readout.json`) com
   schema/fase/razão; falha sem caminho válido existe só no log, rotulada.
5. **Proibido sleep fixo** — sondas de prontidão usam relógio e pausa
   injetáveis com prazo (`readyDeadlineMs`/300s), sem `sleep` constante.
6. **Sem valor degenerado na identidade** — `br-` com regex, PR/run/attempt
   numéricos, porta 5432 exata, `""` nunca é aceito como id.
7. **Precondição de estado compartilhado** — nenhum banco compartilhado: os
   testes do provisionador são herméticos (fetch, relógio e IO injetados).
8. **Sentinela real por cenário** — `raw-refusal-not-for-output` e
   `synthetic leaky layer` provam que o corpo bruto/valor conhecido não chega ao
   log ou artefato.
9. **Fingerprint de revisão** — `captures/source-fingerprints.txt` com as 14
   fontes; `ADR-042` e `prepare-neon-fixture.ts` batem byte a byte com o pacote
   selado `release-unblock-2026-10-06` (prova de ausência de edição drive-by).
10. **checked === discovered** — `auditSonarPipeline` roda sobre o sonar.yml
    real (verde) e sobre cada mutante (vermelho); a descoberta de workflows
    (DBT-62) segue fail-closed.
11. **S6 de contexto limpo** — R3 será executada sobre este pacote antes do
    commit; exigência 0 REJECTED, CORR/N nomeados no journal.
12. **Falha alta/fail-closed** — provisionador sai `2` em recusa; findings da
    auditoria reprovam o `check`; catch sem caminho válido não grava arquivo.
13. **Isolamento de bancada assertado** — nenhum teste toca rede/Neon real;
    prova de criação real fica para o run de CI (limite declarado no SPEC §6).
14. **Check impresso com gate+captura** — `captures/focused-tests.txt` e
    `captures/check-r7.txt`; o r6 (format:check reprovando 2 arquivos) é
    mantido no journal como falha real capturada pelo próprio gate e corrigida
    sem afrouxar regra.
15. **Run de CI atado ao commit selado** — pendente por desenho: só existirá
    `run@sha` após o push do candidato 2; nada é citado antes.
16. **Descoberta multi-sítio** — sítios enumerados: 2 workflows, 5 scripts,
    5 suítes de teste, AGENTS.md e ADR (SPEC §2); sítio novo cairia no gate de
    descoberta.
17. **Precondição de estado ambiente** — credenciais ausentes ⇒ exit 2 com
    rótulo; `GITHUB_OUTPUT`/`RUNNER_TEMP` obrigatórios no entrypoint; a lane S6
    exige worktree limpo fora do selo.

KPI de prevenção: **6 defeitos capturados pelo autor** antes da S6 (regex com
backtracking no audit, regex de endpoint multi-rótulo, 2 negativos com flag
coerente que não testavam a recusa, asserção de formato do GITHUB_OUTPUT e
asserção de segredo que incluíva o próprio `::add-mask::`), além de 1 reprovação
do `format:check` pego pelo gate — nenhum exigiu afrouxar teste ou orçamento.

## Conteúdo

- `SPEC.md` — write-set de 14 fontes, correções N01–N04, verificação de API
  externa, protocolo e limites.
- `captures/source-fingerprints.txt` — SHA256 das 14 fontes declaradas.
- `captures/focused-tests.txt` — rodada focada (186/186) pós-formatação.
- `captures/check-r7.txt` — `npm run check` completo da rodada.
- `MANIFEST.sha256` — somas de tudo que o pacote contém.
