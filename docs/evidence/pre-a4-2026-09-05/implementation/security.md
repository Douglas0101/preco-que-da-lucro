# Segurança pré-A4 — correção e execução de 2026-09-05

Esta entrada substitui as conclusões operacionais de `../secrets-hygiene.md`, preservado como histórico.

- A1 executada: `neon.delete_branch(project_id=damp-forest-57346541, branch_id=br-summer-dream-ayewlgx2)` retornou sucesso; listas `branches-before.json` e `branches-after-sandbox-delete.json` comprovam remoção apenas do sandbox. Janela: 2026-09-05T22:36–22:38Z.
- A2 parcial anterior confirmada: `neon-storage.env` ausente. Revogação no emissor NÃO comprovada. **DB-02/SEC-01 permanecem VIOLAÇÃO aberta**; aguardam IDs não secretos das chaves autorizadas. Nada foi revogado por inferência.
- Inventário atual: `gh secret list --json name > .artifacts/m02-secrets-audit-ci.json && npm run m02:secrets-audit`; 39 definições, 28 com referências executáveis/CI, 11 para revisão, nenhuma falha de leitura ou candidato literal no escopo. Saída: `secrets-inventory.json`, com timestamps e exclusões. Não prova liveness. **Emenda 2026-09-05 (run 3):** os argumentos de CLI (`--root`, `--ci-metadata`) foram removidos — raiz fixa no repositório e metadados de CI por caminho convencional fixo — para eliminar fluxo de path-injection apontado pelo Sonar (S2083) em `process.argv`. Números reproduzidos idênticos após a mudança.
- Referências Supabase residuais NÃO são automaticamente FALSO-ALARME: conteúdo/liveness permanecem DESCONHECIDOS. URLs públicas e nomes de projeto não são credenciais secretas. A conta emissora deve decidir revogação de candidatos além de A2.
- `DATABASE_URL_UNPOOLED` tem uso manual documentado (admin/backup); uma referência lexical ausente não invalida esse consumidor.
- `gh secret list --json name,updatedAt`: NEON_API_KEY. Ausência da credencial legada observada no repositório, não generalizada para ambientes/organização. Environment `neon-readiness` existe sem protection_rules; não é um environment com revisão obrigatória comprovada.
- Arquivos privados/vendor, evidências, testes, symlinks e arquivos >1MiB aparecem no relatório como exclusões ou cobertura incompleta. Valores de env nunca são emitidos; output é somente nomes/metadados.

## Matriz requisito → verificação → classificação

| Requisito                                | Fonte                | Verificação                              | Classificação / estado              |
| ---------------------------------------- | -------------------- | ---------------------------------------- | ----------------------------------- |
| Sandbox descartado após evidência        | A1; ledger do drill  | listas antes/depois                      | CONFORME                            |
| Revogar credenciais órfãs autorizadas    | ADR-021 Gates; DB-02 | emissor ainda não identificado por chave | VIOLAÇÃO / SEC-01 aberta            |
| Remover arquivo local                    | A2                   | arquivo inexistente                      | CONFORME                            |
| Inventário repetível e redigido          | regra SDD 2/5        | script + 4 testes de fronteira           | CONFORME dentro dos limites         |
| Consumidores externos/manuais e liveness | regra SDD 2          | requer inventário dos emissores          | DESCONHECIDO                        |
| Correção de conclusões anteriores        | regra SDD 4          | esta emenda datada                       | GAP-DOC / corrigido documentalmente |

## ESTADO DO SUBSTRATO

| Dimensão | Estado                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| Tráfego  | Não existe deploy segundo ledger; hPanel não homologado                      |
| Neon     | production preservada nesta etapa; sandbox br-summer-dream-ayewlgx2 removido |
| Paridade | DESCONHECIDO; G1 pendente                                                    |
| Blockers | DB-02/SEC-01; DB-01; backup integral; G1/G2; hPanel; Sonar                   |
