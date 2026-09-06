# Pré-A4 — guard, TLS e ensaio pós-purge — 2026-09-06

## Critérios extraídos antes do ensaio

| Requisito                                 | Fonte                         | Verificação                                                                        | Classificação                                       |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| Guard 0010 protege futuras contas         | A3; ADR-021 §8; SDD §16.7     | conta presente, vazia e dois ordenamentos concorrentes                             | CONFORME no drill Neon                              |
| Snapshot antes de qualquer purge          | A3; Plano §42                 | snapshot nativo + manifesto SHA-256 + receipt vigente; produção APPLY desabilitado | CONFORME                                            |
| Estado de fixture conhecido e SQL atômico | DB-01; ADR-021 §6             | 27 tabelas/catalog/roles reconciliados sob lock; 26 recontadas antes de commit     | CONFORME no ensaio                                  |
| Certificado validado no admin/smoke       | SDD NFR-SEC; conexões ADR-019 | remover overrides TLS, teste de configuração e conexão Neon real                   | CONFORME após correção SEC-02                       |
| Restore preserva Auth/RLS                 | NFR-RES-005; §16.6            | conexão efetiva app_runtime; handler Auth; controles positivos e negativos         | ver restore-auth-drill.txt; não inferir de catálogo |
| Production fixture-free                   | A3; DB-01                     | smoke read-only em production; não repetir purge ou seed                           | evidência específica nesta rodada                   |

## Exceções e correções rastreáveis

- **SEC-02:** `rejectUnauthorized:false` nas ferramentas administrativas. Corrigido usando `directPool`; parâmetros `sslmode`, `ssl`, `sslcert`, `sslkey`, `sslrootcert`, `uselibpqcompat` não podem rebaixar TLS por URL. Fase-alvo pré-A4; nenhum segredo alterado.
- **SEC-03:** corrida entre contagem e down 0010 na revisão local. Corrigida com `BEGIN`, `lock_timeout=5s`, `LOCK TABLE public.accounts IN SHARE ROW EXCLUSIVE MODE`, checagem e UPDATE na mesma transação. Não houve exploração em production. Fase-alvo pré-A4.
- **SEC-04:** plano do purge fora da transação e ausência de prova de snapshot no CLI. Corrigido com receipt e digest via stdin, identidade no servidor, manifesto completo, locks, reconciliação pré-commit. Depois de DB-01, APPLY só pode atingir a branch de restore do documento. Fase-alvo pré-A4.
- **GAP-DOC:** retirada a explicação sem prova sobre o cabeçalho do dump. O diagnóstico reproduzível do PR #32 é hash calculado após recodificação do binário. A duração do dump nunca representou RPO.

## Execução e comandos reproduzíveis

Credenciais fornecidas em memória pelo CLI Neon, sem arquivo de segredo ou URL nos artefatos. `M02_DRILL_BRANCH=br-floral-pond-ayltjy2t`; a identidade real é verificada antes das escritas.

```sh
npm run m02:rollback-0010-drill
npm run db:purge-fixtures -- --branch br-floral-pond-ayltjy2t --proof-sha256 "$PROOF_SHA256" --apply < "$PROOF_FILE"
npm run m02:rollback-0010-drill
npm run m02:restore-auth-drill
npm run smoke:substrate
```

O envelope de prova contém `verification` (native-restore-verify.json), `snapshot` (id, source_branch_id, expires_at) e `snapshot_checked_at` UTC, resultado de list_snapshots imediatamente antes. SHA-256 calculado sobre os bytes exatos do envelope. Receipt máximo 10 min; expirado ou divergente falha antes do banco. A ferramenta não autentica a origem do receipt; o operador deve obter o registro do provedor. Não reutilizar a prova antiga para dados novos.

| Artefato                     | Resultado e limite                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| guard-populated.json         | PASS: quatro contas, down recusado, manifesto inalterado                                                                    |
| purge-rehearsal.json         | PASS: 34 linhas de fixture removidas somente na branch restaurada; 26 tabelas vazias                                        |
| guard-empty-attempt-1.json   | FAIL 42501: neondb_owner não pode SET ROLE app_runtime; nenhuma ampliação de grants feita                                   |
| guard-empty-concurrency.json | PASS: down vazio, forward 0/0; NULL preenchido 1/0; writer posterior aguarda e preserva issuer; writer anterior impede down |

O predicado é `count(accounts)>0`, conservador para qualquer conta. Execução automática continua proibida. Rollback normal de aplicação preserva o schema aditivo; incidente com dados exige ponto de recuperação compatível com RPO e ledger de exclusões. Snapshot pré-purge contém fixtures e não é baseline produtivo pós-limpeza.

A falha 42501 foi diagnosticada por `pg_has_role(current_user,'app_runtime','SET')=false`, `has_table_privilege('app_runtime','public.products','SELECT')=true`, users/accounts=0. O ensaio de RLS passou a usar a conexão real app_runtime em um script separado. Não confundir a restrição correta de SET ROLE com falha da política RLS.

## ESTADO DO SUBSTRATO

| Dimensão | Estado                                                                             |
| -------- | ---------------------------------------------------------------------------------- |
| Tráfego  | Não existe segundo briefing/ledger; hPanel não homologado                          |
| Neon     | Production permanece fixture-free; ensaios confinados a br-floral-pond-ayltjy2t    |
| Paridade | DESCONHECIDO; G1 pendente                                                          |
| Blockers | DB-02/SEC-01; BAK-01 integral; G1/G2; hPanel; Sonar main; provisionamento separado |

## Limite Auth — protocolo de erro aplicado

`m02:restore-auth-drill` falhou (assertion); users/accounts/tenants/rate_limits
continuaram em zero por consulta independente. O probe read-only da conexão
runtime também falhou. Após duas falhas consecutivas nessa frente, a execução
Auth foi encerrada; não houve nova tentativa nem mudança de grants/senha.
O script recebeu identificação de estágio para a próxima rodada, sem registrar
valores de credenciais/cookies. **Auth/RLS comportamental permanece DESCONHECIDO**;
BAK-01 não foi encerrada. `restore-auth-drill.txt` guarda o resultado, sem dados
sensíveis. A guard concorrente passou em uma frente independente.
