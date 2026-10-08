# C26 — especificação do circuito remanescente

Esta especificação consolida o plano humano autorizado e pre-registra os comandos
das etapas futuras. Foi escrita após os controles locais C01–C05; não transforma
esses controles retrospectivamente em pré-registro nem declara S6 de todo o ciclo.

## Fato-fonte

PROGRESS L401–L432; DEBTS DBT-36/57/64/68/69/70/72/73/74/75/76; job de PR60
110591560363 cancelado instalando Linux/APT; main d4b9395 red63,2; controles do
falsoverde agregado da ADR-038 e erros reais de clipboard do C26. Plano autorizado:
publicação manual ambos, seis rotações, PITR7d humano, VercelGit suspenso.

## Problema

`new_coverage` da PR pode não existir, enquanto main permanece abaixo80. Tempo APT
escapa do cache binário; um push parcial verify não equivale à matriz PR. Segundo
receptor Vercel e geração Neon persistente não reconciliados, Hostinger DB auth
falha, retenção7d/restore e seis rotações não provados. HTTP200 não prova identidade.

## Contrato

Somente develop engenharia e main releasefinal; main só recebe revisão atual com
circuito aplicável verde e unidades main reconciliadas. Dados desconhecidos/nulos,
checks ausentes/cancelados, mapping/identidade/janela vazia não viram verde. Tokens
somente ViaA; produção nunca alvo de fixture. Suspensão de todos os receptores,
restore7d e consumidores autenticados antecedem promoção. Treze commits totais.

## Mudanças

Write-sets já registrados C01–C06: governança/ledger, manifests+esbuildregression,
workflowUI+kit/test, Sonarbaseline+mirror/test, sidecarCLI/probes/test/runbook,
registry/ADR/Dependabot/README. C07 documenta circuito e corrige identificação não
validada sem alterar versões. Qualquer correção subsequente usa commit próprio e
marco de evidência. WIP original permanece em custódia.

## DoD e comandos futuros

- `npm run check` PASS no tip; `git diff --check`; package/lock sincronizados.
- `git push origin HEAD:develop` fast-forward após gate; conferir PR60head e runs por SHA.
- `gh api repos/Douglas0101/preco-que-da-lucro/actions/runs/<run>/jobs`: prep e verify-release fullmatrix SUCCESS, tempos<=12min cada; payload identity/hashes presentes.
- Sonar CE readout do mesmo SHA e mainbaseline atual via runner; mirror operacional sóverde comadapter individual medido. NO-VERDICT bloqueia.
- `sidecar selftest --backend=memoria|cofre`: cinco cenários reais verdes após compositor restabelecido; `test-provider` e consumidores/provedor porcada uma dasseis chaves, sem valores no output.
- NeoNPITR observado>=7d e restore em recurso isolado TTL24h, nunca mudar default/production; descartar GET404+inventário identidade independente.
- GETs `health/live`, `health/ready`, `api/auth/get-session`; humano configura/reconcilia runtimeDB/origens. Sessão anônima null não equivale a login autenticado/tenant.
- Identidade de todos os receptores e Gitconnection/automaticdeployment suspensos; GH deployment success sozinho não prova runtime.
- Ruleset24333849 requerido comfullPR/scan/espelho e strictbase/bypassempty. Somente na janela humana30min retirar update; re-freeze logoapósmergecommit, verificarCEmain>=80/piso/unidades/erroespelho antesmanualdeploy ebackmerge.

## Testes

Negativo antigoCORS0.18 e Host; positivo0.28/localtransform. Kit corrompido, omitido,
imagem/lock/SHA diferente, pacote ausente e browserincompleto reprovam. Espelho:
linhasantigas não pagam, perdas são subtraídas, branchunmapped/denominadordrift
recusados. Provedor: HTTP200 público/403/wrongidentity/shape/rede não autenticam.
Controles remotos requerem observação e não serão substituídos por fixtures locais.

## Riscos

Adapter porunidade ainda inexistente em operação; publicação global inacessível
segundo receptor; clipboardreal e PITRhumano bloqueados. Sem dado não há closure.
KPI/preS6 eCORR/N do ciclo ainda não computáveis; a revisãoC02 não valida outras
etapas. O registry permanece aberto onde o critério operacional não foi observado.

## Rollback

Revert individual dos commits autorizados em develop preserva histórico; main
permanececongelada. Reversão de configuração dos receptores somente sobdecisão de
publicação vigente. Chave revogada precisa emissão válida, não reusar revogada.
Banco de teste descartável removido; nenhuma migrationprodução foi executada.
