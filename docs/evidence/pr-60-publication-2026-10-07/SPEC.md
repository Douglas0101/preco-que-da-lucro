# SPEC — publicação e merge verificado da PR #60

## Origem e escopo

Pedido humano: fazer push e merge da PR com CI/CD verdadeiramente aprovado. Intenção L756 em `docs/evidence/agent-state/PROGRESS.md`. Base reconciliada: develop `1ff8a7749c05854bafe0c62cb6dd2e07b0be724c`; main `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`; PR #60 develop → main aberta. Integração dos candidatos locais descritos em `release-remediation-2026-10-07/` e `ci-check-remediation-2026-10-07/`, sem incorporar custódia ciclo-29/local-ci/.zcodeignore.

## Contrato de execução

1. Gate local atual sobre os bytes integrados, revisão independente R3 da fonte e commit ordinário em develop, sem alterar histórico publicado ou ignorar hooks.
2. Push de um marco completo, sem rajada de commits. Checks atuais têm de pertencer ao SHA publicado. Runs antigos não aprovam estes bytes; cancelled/pending/skipped aplicável não aprovam.
3. Release exige verify-release com matriz Chromium/Firefox/WebKit/mobile, banco nas 18 suítes, RLS, fixture Neon schema-only por run/attempt, cleanup com GET404 e inventário independente, além do CE real da PR com política ADR-042 >=60% e controles não relacionados a cobertura preservados.
4. Reconciliação Vercel verifica suspensão da publicação automática antes de mover main. MCP sem autenticação não prova estado; navegador autenticado pode obter os campos públicos necessários, sem obter credenciais.
5. Ruleset atual mantém update e mirror obrigatório, divergindo da ADR-042 já aceita. Correção autorizada pela ADR remove somente essas duas exigências obsoletas, conservando PR, base atualizada, verify-release/scan + cobertura, proibição de deletion/force push e bypass vazio. Não usar bypass ou auto-merge para antecipar evidência.
6. Merge ordinário deve conferir o head esperado da PR. Logo após main avançar, merge ordinário main → develop. CE real do novo SHA de main é separado da aprovação de PR; nenhuma publicação em produção antes de sua aprovação.
7. Recusa externa, ambiente inconclusivo ou check vermelho bloqueia merge. Registrar causa observada, corrigir somente o necessário e requalificar; nunca pular testes ou trocar banco isolado por permanente.

## Claims da revisão independente de fonte

C1–C4: instalação/provisionamento, mascaramento, isolamento/cutover de todos os consumidores e cleanup fiel ao protocolo. C5–C8: CE obrigatório, shell/auditoria, observação histórica rigorosamente informativa e import graph native Node/contratos. As lanes independentes recebem somente o contrato e fonte atual, não os veredictos anteriores. Revisão de fonte não é selo formal do pacote nem prova remota.

## Comandos pré-registrados e evidência

- `npm run check`: gate local atual; captura e fingerprints das fontes.
- `gh run watch <run> --exit-status`: acompanhar cada run real do SHA publicado, preservando estados e logs.
- GitHub API checks/jobs/artifacts e relatório gate-readout: identidade exata de revisão/superfície e conteúdo dos gates, não somente exit codes.
- Inventário Neon oficial após cleanup: identidade/ausência da cópia, permanentes preservadas.
- GitHub merge com SHA esperado; refs observados e CE de main separados.

## Limites

Os checks antigos de 9 sucessos/3 falhas são diagnóstico, não aprovação desta publicação. HTTP412 antigo não prova quota ou permissão. A ausência histórica de provenance do espelho permanece NO-VERDICT informativo, nunca aprovação de main. DBT-96 não fecha automaticamente por push/merge; seu closure completo permanece obrigatório. A publicação solicitada é Git/PR; deploy de produção não é implícito.
