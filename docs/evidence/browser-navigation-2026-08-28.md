# Relatório de QA local e tentativa de navegação supervisionada — 2026-08-28

Status do relatório: `PARTIAL/BLOCKED`.

Os checks locais e a suíte automatizada foram executados e observados nesta
rodada. A navegação manual supervisionada não foi executada porque o Browser
in-app (`iab`) não estava disponível no host; o bloqueio foi preservado como
limitação de ambiente e não convertido em falha funcional. Nenhum gate foi
consumido.

## Escopo autorizado

Executar a validação local proposta para a rodada P0–P5, usando somente:

- o checkout `program/v5-fechamento-sdd`;
- PostgreSQL 17 descartável no container local;
- fixture E2E efêmera de owner/member;
- preview local em `http://127.0.0.1:4173`;
- suíte Playwright existente;
- Browser in-app, caso estivesse disponível.

Ficaram fora do escopo: GitHub, GitLab, Neon persistente, Hostinger, produção,
fetch, push, merge, comentário em PR, credenciais reais, migração/cutover e
qualquer endpoint externo. O fluxo de IA não foi submetido pela jornada manual
planejada.

## Identidade do checkout

Verificação fresca no checkout principal:

```text
branch: program/v5-fechamento-sdd
HEAD: a311fac509cf9581f089263f933b8097792b09a9
tracking: origin/program/v5-fechamento-sdd (ref local; sem fetch; ahead 16)
worktree: somente .pi/ não rastreado e deliberado
```

O diretório `.pi/` não foi lido, adicionado ou alterado. Nenhum arquivo de
código, configuração, schema ou migration foi modificado nesta rodada.

## Orquestração de subagents

### R1 — mapa read-only da jornada

Thread local `01a04822-e069-7520-91de-d115884e1320`, em checkout separado,
com write-set vazio e proibição explícita de rede, Git e banco mutável.

O subagent entregou comentários intermediários, classificados como `REPORTED`:

- confirmou a estrutura de rotas e controles principais no código;
- observou que `/produtos`, `/precos` e `/ponto-equilibrio` não possuem
  assertões diretas na suíte `e2e/ui-stack.spec.ts` atual;
- apontou que IA, reset do chat, arquivamento de produto e atualização de
  preço têm efeitos persistentes e não deveriam entrar numa jornada sem
  autorização específica.

Após três janelas bounded e um pedido de finalização, não houve handoff final
estruturado. A thread foi arquivada. Essa ausência não foi tratada como
aprovação, revisão independente ou evidência de execução.

### R2 — revisão read-only da selagem

Thread local `01a04829-1125-7810-9eee-040f9d090f07`, também com write-set vazio,
sem rede e sem mutação. O subagent reafirmou em comentário que SHA/ref,
worktree atual, M-02 pendente e a separação E2E local versus CI/produção eram
os pontos de reconciliação. Após duas janelas bounded e um pedido de
finalização, não houve handoff final. A thread foi arquivada; timeout/ausência
não foi convertido em aprovação.

Os dois subagents foram usados como frentes read-only bounded. As conclusões
abaixo são baseadas nos comandos executados pelo agente principal, não em
silêncio ou em handoff inexistente.

## Preparação local

| Etapa                             | Resultado observado                                        | Classe           |
| --------------------------------- | ---------------------------------------------------------- | ---------------- |
| `npm run db:up`                   | Container `preco-que-da-lucro-postgres` saudável           | `LOCAL-VERIFIED` |
| `npm run e2e:prepare`             | Fixture Better Auth/PostgreSQL de owner e member preparada | `LOCAL-VERIFIED` |
| Preview Nitro em `127.0.0.1:4173` | `Listening on: http://127.0.0.1:4173/`                     | `LOCAL-VERIFIED` |
| Acesso remoto                     | Não executado                                              | `OUT-OF-SCOPE`   |

As variáveis de autenticação usadas no preparo eram efêmeras e específicas do
teste local. Nenhum segredo é reproduzido neste relatório.

## Verificações executadas

### Banco e orçamento

```text
npm run db:test
PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
Better Auth, tenant pessoal, cookie, bcrypt/scrypt e rotação de sessão: OK
Tool registry: validação, AuthZ, idempotência, auditoria e isolamento: OK
Chat GET é somente leitura; criação fica restrita a POST: OK
T1–T10: suíte local de orçamento concluída
```

Resultado: `exit=0`, `LOCAL-VERIFIED`, usando somente PostgreSQL local em
`127.0.0.1:5432`.

### Check amplo

```text
npm run check
exit=0
check:ui-stack: PASS
check:no-supabase-runtime: PASS
format:check: PASS
lint: PASS
typecheck: PASS
Vitest: 26 arquivos, 273 testes PASS
build client/SSR: PASS
check:bundle: PASS
```

`git diff --check` também foi executado previamente na selagem e permaneceu
sem erro nesta árvore sem alterações rastreadas. O resultado é `LOCAL-VERIFIED`
para este checkout; não é prova de CI ou produção.

### Suíte Playwright existente

Com o wrapper `scripts/e2e-hygiene.sh`, a fixture local e preview Nitro padrão:

```text
npm run test:e2e:hygiene
Running 32 tests using 2 workers
32 passed (1.1m)
exit=0
```

Os 32 casos cobriram os oito cenários existentes em quatro projetos: Chromium,
Firefox, WebKit e mobile. A suíte observada verificou:

- landing pública e ausência de violações a11y críticas/sérias;
- nomes acessíveis dos controles de autenticação;
- credencial inválida e proteção de rotas;
- bloqueio 403 para mutação feita por member;
- shell autenticado, navegação acessível e sessão sem token em Web Storage;
- simulação manual sem volume atual fictício;
- diagnóstico calculado somente a partir de premissas explícitas;
- tratamento de falha financeira sem renderizar vazio ou zero.

Avisos observados no servidor foram compatíveis com os casos negativos ou com
dependência: senha inválida, `AUTHORIZATION_ERROR` esperado no teste de 403 e
warning deprecado do `pg` sobre `client.query()` concorrente. Nenhum virou
falha de teste.

A primeira tentativa histórica com `NODE_ENV=test` falhou no bundle SSR antes
dos testes (`jsxDEV is not a function`); a repetição no modo padrão do preview
passou 32/32. Isso permanece uma limitação de configuração do runner, não uma
falha funcional promovida.

### Checks M-02

Foram reexecutados no checkout principal depois da QA:

```text
npm run m02:matrix:check
exit=1
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.

npm run m02:boundaries
exit=1
M-02 boundary violations:
- missing catalog path: src/server/services/pricing.service.ts
- missing catalog path: src/server/services/diagnostic.service.ts
- missing catalog path: src/server/services/conversation.service.ts
- missing catalog path: src/server/services/audit.service.ts
- missing catalog path: src/server/repositories/product-catalog.repository.ts
```

Classificação: `LOCAL-VERIFIED` como saída dos comandos e
`NOT-APPLICABLE/EXPECTED-FAILURE` para o candidato pré-extração, conforme o
adendo S1/S4/S2 já registrado no ledger. A matriz não foi regenerada para
silenciar o drift; os componentes ausentes pertencem ao trabalho de P10 e o
estado M-02 continua pendente. Os resultados não são um passe de M-02.

## Navegação supervisionada no Browser in-app

### Protocolo previsto

O protocolo foi preparado para usar exclusivamente a allowlist local:

```text
http://127.0.0.1:4173/
http://127.0.0.1:4173/auth
http://127.0.0.1:4173/inicio
http://127.0.0.1:4173/produtos
http://127.0.0.1:4173/novo-produto
http://127.0.0.1:4173/precos
http://127.0.0.1:4173/despesas
http://127.0.0.1:4173/ponto-equilibrio
http://127.0.0.1:4173/simulacoes
http://127.0.0.1:4173/diagnostico
```

A sequência seria: landing pública; auth e redirecionamento de credencial
inválida; login owner pela UI; shell desktop; menu mobile; leitura das rotas
financeiras; preenchimento da simulação e diagnóstico; criação e remoção de
uma despesa sentinela; abertura e cancelamento do diálogo de reset do chat.
O envio ao provedor de IA e ações persistentes de produto/preço seriam
explicitamente evitados.

### Bloqueio observado

O Browser skill foi inicializado pelo runtime oficial, com a sequência
`setupBrowserRuntime()` e `agent.browsers.get("iab")`. A resposta literal foi:

```text
Browser is not available: iab
```

Por isso, não houve `goto`, snapshot, login visual, mudança de viewport,
click/fill, requisição observada pelo Browser, criação/remoção de despesa ou
qualquer outra mutação manual. Não foram inspecionados cookies, localStorage,
sessionStorage ou stores do perfil. O bloqueio é classificado como
`CONFIGURATION-MISSING/BLOCKED` do ambiente Browser.

O protocolo do skill determina não substituir IAB por Chrome, Docker Browser ou
outro navegador sem nova autorização. Essa regra foi respeitada. A suíte
Playwright 32/32 é evidência independente e automatizada; não deve ser
apresentada como se fosse a jornada manual que não ocorreu.

### Cobertura manual resultante

| Superfície          | Manual Browser                   | Evidência automatizada nesta rodada           |
| ------------------- | -------------------------------- | --------------------------------------------- |
| `/`                 | `BLOCKED` antes do primeiro goto | Landing/a11y PASS                             |
| `/auth`             | `BLOCKED`                        | Controles e credencial inválida PASS          |
| `/inicio`           | `BLOCKED`                        | Shell autenticado e falha financeira PASS     |
| `/produtos`         | `BLOCKED`                        | Sem assertão direta específica na suíte atual |
| `/novo-produto`     | `BLOCKED`                        | Histórico restaurado e sessão PASS            |
| `/precos`           | `BLOCKED`                        | Sem assertão direta específica na suíte atual |
| `/despesas`         | `BLOCKED`                        | Bloqueio de mutação member 403 PASS           |
| `/ponto-equilibrio` | `BLOCKED`                        | Sem assertão direta específica na suíte atual |
| `/simulacoes`       | `BLOCKED`                        | Simulação manual e erro financeiro PASS       |
| `/diagnostico`      | `BLOCKED`                        | Premissas, resultado e erro financeiro PASS   |

Os três itens sem assertão direta específica e os controles persistentes
identificados pelo R1 ficam como cobertura pendente para uma sessão futura com
IAB disponível e, quando necessário, uma autorização de mutação explícita.

## Delta contra o SDD v5.1-EXEC

| Item                             | Estado desta rodada                                                         |
| -------------------------------- | --------------------------------------------------------------------------- |
| QA local descartável             | Fechada localmente: `db:test` PASS, `npm run check` PASS                    |
| E6/T1–T10                        | Fechados localmente conforme saída de `db:test`                             |
| E2E automatizado                 | Fechado localmente: 32/32 PASS em quatro projetos                           |
| Navegação Browser supervisionada | `BLOCKED`: IAB indisponível no host                                         |
| M-02 matrix/boundaries           | Exit 1 observado; esperado até P10, sem promoção de DoD                     |
| Segurança                        | Nenhum scan novo necessário: não houve diff rastreado após o scan S3 selado |
| R1/R2                            | Sem handoff final; ausências registradas, não aprovadas                     |
| GitHub/Neon/produção/gates       | Não tocados; nenhum gate consumido                                          |

## Gatilho de retomada

Retomar somente quando o Browser in-app estiver disponível no host. Reexecutar
a jornada com a mesma allowlist e fixture local; capturar snapshots de
acessibilidade, URL/origem e erros de console/rede sem inspecionar credenciais
persistidas. Se houver mutação sentinela, confirmar a reversão no mesmo
checkout local antes de encerrar.

## Conclusão

A execução automatizada local está verde para o escopo coberto: PostgreSQL 17,
budget T1–T10, QA ampla e 32 casos Playwright. A execução manual proposta não
tem veredicto de produto porque o Browser in-app não estava disponível. A
limitação permanece explícita e não contamina a evidência automatizada nem
promove M-02, CI remoto, readiness Neon ou qualquer gate.
