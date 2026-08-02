# Plano Mestre de Otimizacao, Engenharia e Ciberseguranca

## Preco que Da Lucro

| Campo | Valor |
|---|---|
| Versao do plano | 1.3 |
| Data de referencia | 2026-08-01 |
| Escopo | Aplicacao web, dominio financeiro, IA, banco, seguranca, UX, operacao e governanca |
| Estado analisado | Prototipo funcional conectado ao Supabase e Lovable AI |
| Objetivo | Evoluir para um produto financeiramente confiavel, seguro, auditavel, acessivel e operavel em producao |
| Publico | Produto, engenharia, seguranca, dados, UX, QA, operacoes e responsavel LGPD |
| Especificacao tecnica | [`SDD.md`](./SDD.md) versao 1.2 |

> Este documento e um mapa de planejamento tecnico. Cada item deve virar um epico ou tarefa rastreavel, com responsavel, prazo, evidencias e aprovacao. Nenhum resultado financeiro deve ser disponibilizado como recomendacao confiavel antes da conclusao dos bloqueadores P0 e dos gates de lancamento.

### Historico de revisoes

| Versao | Data | Alteracao |
|---|---|---|
| 1.2 | 2026-08-01 | Baseline de planejamento anterior. |
| 1.3 | 2026-08-01 | Formaliza a migracao shadcn/ui para Base UI, o backlog e o gate do stack de componentes. |

Cada revisao normativa atualiza versao, dependencias, gates e rastreabilidade afetados. Correcao editorial sem impacto de planejamento pode preservar a versao.

---

## Sumario

- [1. Objetivos de Engenharia](#1-objetivos-de-engenharia)
- [2. Diagnostico Executivo](#2-diagnostico-executivo)
- [3. Principios Obrigatorios](#3-principios-obrigatorios)
- [4. Arquitetura-Alvo](#4-arquitetura-alvo)
- [5. Modelo de Priorizacao](#5-modelo-de-priorizacao)
- [6 a 10. Governanca, Arquitetura, Seguranca, Identidade e IA](#6-governanca-de-produto-e-dominio)
- [11 a 13. Dados, Motor Financeiro e Backend](#11-banco-de-dados-rls-e-integridade)
- [14 a 17. Frontend, Acessibilidade, Performance e Qualidade](#14-frontend-e-experiencia-do-usuario)
- [18 a 23. Observabilidade, LGPD, DevSecOps, Operacao e Documentacao](#18-observabilidade-e-auditoria)
- [24. Sequenciamento de Entrega](#24-sequenciamento-de-entrega)
- [25 a 27. Dependencias, RACI e Indicadores](#25-trilhas-paralelas-e-dependencias)
- [28. Checklist de Liberacao](#28-checklist-de-liberacao-para-producao)
- [29 e 30. Epicos e Resultado Esperado](#29-primeiros-epicos-recomendados)

---

## 1. Objetivos de Engenharia

1. Garantir que todos os calculos sejam deterministas, reproduziveis, testados e acompanhados de premissas explicitas.
2. Impedir que dados incompletos, invalidos ou indisponiveis sejam tratados silenciosamente como zero.
3. Tornar o fluxo conversacional retomavel, idempotente, auditavel e independente da memoria temporaria do modelo de IA.
4. Aplicar seguranca em profundidade no navegador, servidor, banco, integracoes, pipeline e operacao.
5. Centralizar regras de negocio e validacoes sem depender exclusivamente da interface ou do modelo de IA.
6. Preservar isolamento entre usuarios por autenticacao, autorizacao, RLS e integridade relacional.
7. Implementar privacidade por design e controles compativeis com a LGPD.
8. Oferecer estados de carregamento, erro, vazio e recuperacao consistentes em todas as jornadas.
9. Criar uma cadeia de entrega reproduzivel, verificavel e com rollback seguro.
10. Medir disponibilidade, desempenho, custo, erros, abuso e qualidade dos resultados financeiros.

---

## 2. Diagnostico Executivo

### 2.1 Fundacoes existentes que devem ser preservadas

- Motor financeiro separado da IA em `src/lib/finance.ts`.
- RLS habilitada nas tabelas de negocio.
- Server functions executadas com o JWT do usuario em vez de service role.
- Protecao CSRF explicitamente configurada para server functions.
- Interface visual coerente e navegacao cobrindo as principais areas do produto.
- Formato monetario brasileiro centralizado.
- Estrutura inicial para produtos, ingredientes, embalagens, taxas, mercado, despesas, chat e simulacoes.
- Cliente service role isolado em modulo server-only e atualmente sem uso funcional.

### 2.2 Bloqueadores atuais

| ID | Severidade | Bloqueador | Impacto |
|---|---|---|---|
| P0-SEC-01 | Critica | HTML da IA renderizado sem sanitizacao | XSS persistente e possivel comprometimento da sessao |
| P0-AI-01 | Critica | IDs e resultados das ferramentas nao persistem entre mensagens | Fluxo principal de custo dos ingredientes pode falhar |
| P0-FIN-01 | Critica | Dados ausentes ou unidades incompativeis viram custo zero | Margens e precos potencialmente superestimados |
| P0-FIN-02 | Critica | `Infinity` e valores invalidos podem ser exibidos como zero | Recomendacao financeira objetivamente incorreta |
| P0-FIN-03 | Critica | Cenario atual usa volume ficticio e preco sugerido usa markup arbitrario | Informacoes hipoteticas apresentadas como reais |
| P0-DATA-01 | Alta | Produto nao possui estado de rascunho ou conclusao | Cadastros parciais contaminam indicadores |
| P0-API-01 | Alta | Erros de banco frequentemente viram listas vazias | Falhas operacionais apresentadas como ausencia de dados |
| P0-SEC-02 | Alta | Endpoint de IA sem rate limit, quota, timeout e idempotencia | Abuso, indisponibilidade e custo nao controlado |
| P0-DATA-02 | Alta | Banco sem constraints financeiras e de tenant compostas | Dados invalidos e relacionamentos inconsistentes |
| P0-QA-01 | Alta | Ausencia de testes automatizados | Sem evidencia de correcao ou protecao contra regressao |

### 2.3 Rastreabilidade dos bloqueadores

Os IDs desta tabela sao IDs de risco. Os IDs dos backlogs sao IDs de remediacao. O encerramento de um risco exige todas as remediacoes e evidencias indicadas, nao apenas uma alteracao de codigo.

| Risco | Remediacoes canonicas | Fase limite | Evidencia minima de fechamento |
|---|---|---|---|
| P0-SEC-01 | SEC-001 a SEC-005, QA-005 | Fase 0 | Teste em navegador real, CSP report e revisao de sinks |
| P0-AI-01 | AI-001 a AI-006, DATA-018, QA-004 | Fase 0 | Fluxo completo retomado apos reload, sem ID inventado |
| P0-FIN-01 | FIN-006, FIN-007, FIN-010, FIN-011, QA-002 | Fase 0 | Unidade ambigua bloqueada e pendencia exibida |
| P0-FIN-02 | FIN-004, FIN-005, QA-002 | Fase 0 | Casos `NaN`, infinito e margem nao positiva aprovados |
| P0-FIN-03 | FIN-019, FIN-025, FE-017, QA-002 | Fase 0 | Hipoteses rotuladas e heuristica retirada |
| P0-DATA-01 | GOV-003, DATA-017, FE-003 | Fase 0 | Rascunhos excluidos dos indicadores |
| P0-API-01 | API-002, API-003, FE-007 | Fase 0 | Falha simulada nunca aparece como lista vazia |
| P0-SEC-02 | SEC-013 a SEC-016, AI-021 a AI-024, QA-012 | Fase 0 | Limites atomicos e custo maximo validados sob concorrencia |
| P0-DATA-02 | DATA-001 a DATA-011, QA-003 | Fase 1 | Matriz RLS e integridade cross-tenant aprovada |
| P0-QA-01 | QA-001 a QA-005, DSO-003 | Fase 0 | Pipeline bloqueia regressao critica |

### 2.4 Classificacao de maturidade atual

| Setor | Estado atual | Estado desejado |
|---|---|---|
| Produto | Prototipo navegavel | MVP validado com regras e premissas explicitas |
| IA | Orquestracao orientada por prompt | Maquina de estados deterministica com IA limitada a interpretar e explicar |
| Financeiro | Formulas basicas com defaults perigosos | Motor decimal, validado, versionado e extensivamente testado |
| Dados | Schema inicial com RLS | Integridade forte, historico, auditoria, indices e migrations seguras |
| Seguranca | Bons controles iniciais, com XSS critico | Defesa em profundidade e verificacao continua |
| Frontend | Visual coerente, estados inconsistentes | UX acessivel, resiliente e transparente |
| Qualidade | Sem testes ou CI | Piramide de testes, gates e releases reproduziveis |
| Operacao | Observabilidade minima | SLOs, logs, tracing, alertas, runbooks e resposta a incidentes |

---

## 3. Principios Obrigatorios

### 3.1 Principios de produto financeiro

- Nunca transformar dado desconhecido em zero sem informar o usuario.
- Nunca apresentar hipotese como dado atual.
- Nunca recomendar preco sem declarar formula, premissas e dados ausentes.
- Nunca arredondar para baixo uma quantidade minima necessaria para equilibrio ou lucro.
- Diferenciar custo direto, custo variavel, despesa fixa, margem de contribuicao, markup e lucro.
- Exibir data de referencia e completude dos dados usados no calculo.
- Permitir reproducao do resultado a partir de uma versao do motor e um snapshot de entradas.

### 3.2 Principios de seguranca

- Zero trust entre navegador, IA, server functions, banco e integracoes.
- Todo dado externo e nao confiavel, inclusive respostas da IA e resultados retornados pelo banco.
- Autorizacao deve existir no servidor e no banco, independentemente da interface.
- RLS e defesa adicional, nao substituta para validacao e regras de negocio.
- Nenhum segredo deve ser incorporado ao bundle do navegador.
- Logs nao podem conter tokens, senhas, prompts completos ou dados pessoais desnecessarios.
- Operacoes mutaveis devem ser idempotentes, auditaveis e, quando compostas, transacionais.
- Falhas devem ser seguras: negar operacao, preservar dados anteriores e comunicar erro sem vazar detalhes.

### 3.3 Principios de arquitetura

- Uma unica camada de aplicacao para operacoes de dominio.
- Contratos tipados e validados em runtime nas fronteiras.
- Motor financeiro puro, sem dependencia de UI, banco ou IA.
- Modulos organizados por dominio, com dependencias direcionadas.
- Primitivos reutilizaveis exclusivamente por shadcn/ui sobre Base UI e fronteira local `@/components/ui`.
- Migrations versionadas e reversiveis por estrategia operacional.
- Telemetria desde a primeira entrega, com redacao de dados sensiveis.

---

## 4. Arquitetura-Alvo

```text
Navegador
  |
  | HTTPS + CSP + sessao segura
  v
TanStack Start / BFF
  |-- Auth e sessao
  |-- Validacao Zod
  |-- Rate limit e idempotencia
  |-- Autorizacao e auditoria
  |
  +--> Servico de Produtos
  +--> Servico de Despesas
  +--> Servico de Vendas
  +--> Motor Financeiro versionado
  +--> Orquestrador Conversacional
  |      |-- Maquina de estados
  |      |-- Ferramentas permitidas
  |      |-- Validacao de saida
  |      +-- Gateway de IA com quota e timeout
  |
  v
Supabase com JWT do usuario
  |-- RLS
  |-- Constraints
  |-- FKs compostas por tenant
  |-- Transacoes/RPCs restritas
  |-- Auditoria
  +-- Indices e backups
```

### 4.1 Fronteiras propostas

| Modulo | Responsabilidade | Nao deve fazer |
|---|---|---|
| UI | Coletar, apresentar, validar experiencia e orientar | Definir regra financeira ou confiar em dados nao validados |
| BFF/server functions | Autenticar, validar, autorizar, limitar e orquestrar | Usar service role para operacao normal de usuario |
| Servico de dominio | Aplicar invariantes e coordenar repositorios | Renderizar UI ou chamar IA diretamente |
| Motor financeiro | Calcular com entradas tipadas e retornar resultado/avisos | Consultar banco, inferir dados ou preencher valores ausentes |
| Orquestrador de IA | Interpretar linguagem e explicar resultados autorizados | Calcular, decidir permissao ou inventar IDs/valores |
| Banco | Garantir integridade, isolamento e persistencia | Depender da interface para proteger dados |
| Observabilidade | Registrar sinais operacionais e trilhas de auditoria | Armazenar segredo ou conteudo pessoal integral sem necessidade |

### 4.2 Organizacao de codigo sugerida

```text
src/
  features/
    auth/
    products/
    expenses/
    sales/
    pricing/
    simulations/
    diagnostics/
    conversations/
  domain/
    finance/
    units/
    money/
  server/
    middleware/
    repositories/
    services/
    observability/
    security/
  integrations/
    supabase/
    lovable/
  components/
    ui/
    finance/
    async-state/
```

Nao e necessario executar uma reorganizacao total de uma vez. Novas funcionalidades devem seguir essa direcao e os modulos existentes devem migrar por fluxo vertical.

---

## 5. Modelo de Priorizacao

| Prioridade | Significado | Regra de liberacao |
|---|---|---|
| P0 | Risco critico, resultado incorreto ou fluxo central quebrado | Bloqueia beta e producao |
| P1 | Requisito necessario para confiabilidade e seguranca | Bloqueia usuarios pagantes |
| P2 | Escalabilidade, produtividade e qualidade sustentavel | Deve entrar no ciclo de consolidacao |
| P3 | Evolucao e sofisticacao futura | Executar depois dos indicadores basicos estarem estaveis |

Estimativa deve ser registrada em pontos ou pessoa-dia somente apos refinamento tecnico. Seguranca e testes fazem parte da tarefa e nao devem ser estimados como atividade opcional separada.

### 5.1 Dimensoes separadas de planejamento

Prioridade, severidade e bloqueio de release nao sao sinonimos. O registro de execucao deve manter os tres campos:

| Campo | Uso |
|---|---|
| Severidade do risco | Impacto e probabilidade caso o problema ocorra |
| Prioridade de execucao | Ordem relativa dentro da capacidade e das dependencias |
| Release bloqueada | Marco que nao pode avancar sem a evidencia |

P0 indica impedimento do proximo marco relevante, nao necessariamente execucao serial. Itens P1 podem bloquear usuarios externos ou pagantes mesmo quando nao bloqueiam o desenvolvimento interno.

A ordem operacional e definida pelas fases e dependencias, nao pela contagem bruta de P0/P1. Dentro de cada fase, o caminho critico e os owners devem ser definidos no registro §5.2.

### 5.2 Registro obrigatorio por item

Cada ID deve possuir, na ferramenta de gestao:

- Owner e accountable.
- Severidade e release bloqueada.
- Dependencias por ID.
- Estimativa e prazo-alvo.
- Criterios de aceite mensuraveis.
- Ambiente, versao/build e massa usados na verificacao.
- Link para testes, logs, relatorios ou ADRs.
- Aprovador e data de validade da evidencia.
- Plano de rollback ou controle compensatorio.

Vulnerabilidade critica exploravel, quebra de isolamento entre tenants, segredo privilegiado no cliente ou resultado financeiro sabidamente falso nao admite excecao para release externa. Outras excecoes exigem autoridade definida, justificativa, controle compensatorio, responsavel, prazo e expiracao automatica.

---

## 6. Governanca de Produto e Dominio

### Objetivo

Transformar o README atual em uma especificacao executavel, sem ambiguidades financeiras ou estados implicitos.

### Backlog

- [ ] **GOV-001 - P0 - Criar glossario financeiro oficial.** Definir custo direto, custo variavel, despesa fixa, margem de contribuicao, markup, lucro operacional, lucro liquido, ponto de equilibrio e mix de vendas. Criterio de aceite: os mesmos termos e formulas aparecem no codigo, interface, testes e documentacao.
- [ ] **GOV-002 - P0 - Definir dados obrigatorios por etapa.** Criar matriz de completude para produto, custos, preco, mercado, despesas e vendas. Criterio de aceite: nenhum indicador e classificado como valido sem seu conjunto minimo de entradas.
- [ ] **GOV-003 - P0 - Definir estados do produto.** Adotar ao menos `draft`, `costing`, `ready`, `archived` e motivo de bloqueio. Criterio de aceite: somente produtos `ready` entram em indicadores consolidados.
- [ ] **GOV-004 - P1 - Documentar premissas.** Cada calculo deve declarar periodo, unidade, base tributaria, mix e origem dos dados. Criterio de aceite: premissas aparecem junto do resultado ou em detalhe acessivel.
- [ ] **GOV-005 - P1 - Criar catalogo de regras.** Cada regra recebe ID, descricao, formula, versao, responsavel e testes associados.
- [ ] **GOV-006 - P1 - Separar dado real, estimado e demonstracao.** A origem deve ser representada no modelo e visivel na UI.
- [ ] **GOV-007 - P2 - Criar ADRs.** Registrar decisoes sobre sessao, camada de dados, precisao decimal, IA, historico e estrategia de deploy.
- [ ] **GOV-008 - P2 - Manter registro de riscos.** Risco, probabilidade, impacto, responsavel, mitigacao, prazo e evidencia de encerramento.
- [ ] **GOV-009 - P0 - Fechar o escopo economico do MVP.** Decidir inclusao ou exclusao de mao de obra direta, perdas, desperdicio, frete, descontos, devolucoes, receita bruta/liquida, capacidade produtiva, custo por canal, moeda e tratamento tributario por regime e vigencia. Criterio de aceite: componentes fora do escopo sao declarados na UI e impedem o uso de termos como “lucro liquido” ou “saude financeira”.

### Evidencias exigidas

- Glossario aprovado por responsavel financeiro.
- Matriz de completude versionada.
- Catalogo de formulas ligado aos testes.
- ADRs no repositorio.
- Registro de riscos revisado a cada release.

---

## 7. Arquitetura da Aplicacao

### Objetivo

Eliminar a arquitetura hibrida e criar uma camada de aplicacao consistente, tipada e observavel.

### Backlog

- [ ] **ARCH-001 - P0 - Centralizar operacoes de dominio.** Migrar leituras e escritas financeiras do cliente para server functions/BFF. Manter Supabase direto no navegador apenas para autenticacao quando necessario. Criterio de aceite: nenhuma pagina altera tabelas de dominio diretamente.
- [ ] **ARCH-002 - P0 - Criar contratos de entrada e saida.** Usar Zod em toda fronteira, inclusive ferramentas da IA, query strings, formularios e respostas externas.
- [ ] **ARCH-003 - P1 - Separar repositorio, servico e motor.** Repositorio acessa dados; servico aplica regras; motor calcula; rota apenas orquestra.
- [ ] **ARCH-004 - P1 - Padronizar TanStack Query.** Definir chaves, `staleTime`, retry, cancelamento, invalidacao, prefetch e estados. Remover o provider caso a decisao seja nao utilizar a biblioteca.
- [ ] **ARCH-005 - P1 - Criar envelope de erro tipado.** Campos minimos: `code`, `message`, `fieldErrors`, `retryable`, `correlationId`. Detalhes internos ficam apenas nos logs.
- [ ] **ARCH-006 - P1 - Adotar cancelamento e protecao contra resposta fora de ordem.** Trocas rapidas de produto nao podem exibir dados do produto anterior.
- [ ] **ARCH-007 - P2 - Criar modulos por feature.** Migracao incremental, iniciando pelo fluxo de novo produto.
- [ ] **ARCH-008 - P2 - Remover codigo dormente.** Server functions nao utilizadas devem ser adotadas, testadas ou removidas.
- [ ] **ARCH-009 - P0 - Definir estrategia SSR e sessao.** Produzir ADR conjunto com IAM-003, implementar guard server-side quando a sessao BFF permitir e eliminar tela vazia/flicker de autenticacao.
- [ ] **ARCH-010 - P1 - Definir fronteira de tenant.** Decidir se o tenant permanece usuario individual ou evolui para workspace/equipe; nenhuma tabela nova deve assumir uma opcao diferente sem ADR.
- [ ] **ARCH-011 - P1 - Confirmar monolito modular.** Os “servicos” da arquitetura-alvo sao inicialmente modulos no mesmo deploy, salvo evidencia operacional para separacao; evitar microservicos prematuros.
- [x] **ARCH-012 - P0 - Fixar shadcn/ui sobre Base UI como camada exclusiva de primitivos.** Owner: lider tecnico de frontend. Dependencias: SDD 1.2, ADR-016 e DSO-001. Criterio de aceite: features, rotas e aplicacao consomem somente `@/components/ui`, apenas `src/components/ui` importa `@base-ui/react`, especialistas ficam em wrappers allowlisted e o inventario Radix temporario e fechado, sem uso novo.

### Criterios de aceite do setor

- Uma unica rota arquitetural para operacoes de dominio.
- Nenhum `any` em contratos publicos.
- Erros possuem codigos estaveis.
- Consultas sao cancelaveis e nao exibem resposta obsoleta.
- Dependencias entre camadas sao verificadas por lint ou convencao testada.
- Fronteiras do stack de componentes e inventario Radix sao verificadas automaticamente.

---

## 8. Ciberseguranca da Aplicacao

### Objetivo

Aplicar controles rastreaveis ao OWASP ASVS 5.0 nivel 2, OWASP Top 10 e OWASP Top 10 for LLM Applications. Manter uma matriz com requisito aplicavel, implementacao, evidencia, responsavel, excecao e validade; declarar alinhamento sem essa matriz nao e criterio de conformidade.

### 8.1 XSS e seguranca de conteudo

- [ ] **SEC-001 - P0 - Remover HTML nao confiavel.** Substituir `dangerouslySetInnerHTML` do chat por texto puro ou parser Markdown com HTML desabilitado.
- [ ] **SEC-002 - P0 - Sanitizar quando HTML for inevitavel.** Usar biblioteca consolidada, allowlist minima e testes com SVG, MathML, URLs `javascript:`, atributos de evento e payloads de mutacao DOM.
- [ ] **SEC-003 - P0 - Implementar CSP.** Inicialmente em modo report-only e depois bloqueante. Definir `default-src`, `script-src` com nonce unico por resposta, `connect-src` para Supabase e Lovable, `style-src`, `img-src`, `font-src`, `worker-src`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` e `form-action 'self'`. Remover scripts, handlers e estilos inline antes de bloquear; nao liberar `'unsafe-eval'` ou `'unsafe-inline'` como correcao permanente.
- [ ] **SEC-004 - P1 - Eliminar sinks inseguros.** Mapear `innerHTML`, `dangerouslySetInnerHTML`, URLs dinamicas, estilos dinamicos e renderizacao de dados externos.
- [ ] **SEC-005 - P1 - Adicionar Trusted Types quando suportado.** Bloquear criacao arbitraria de HTML e scripts no navegador.

### 8.2 Headers e transporte

- [ ] **SEC-006 - P0 - Forcar HTTPS.** HSTS com rollout controlado e `includeSubDomains` apos validar todos os subdominios.
- [ ] **SEC-007 - P0 - Configurar headers.** `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP e politica de framing.
- [ ] **SEC-008 - P1 - Definir politica de cache.** Respostas autenticadas e com dados financeiros devem usar `Cache-Control: private, no-store` quando aplicavel.
- [ ] **SEC-009 - P1 - Restringir CORS.** Allowlist por ambiente, sem origem curinga em endpoints autenticados.
- [ ] **SEC-010 - P1 - Validar CSRF.** Manter protecao para server functions e criar testes de origem permitida, ausente e maliciosa.

### 8.3 Validacao, autorizacao e abuso

- [ ] **SEC-011 - P0 - Validar toda entrada no servidor.** Limites de tamanho, formato, faixa, enum, UUID, percentual e texto.
- [ ] **SEC-012 - P0 - Verificar ownership do recurso.** O servidor nao deve confiar em `product_id`, `ingredient_id` ou outro ID fornecido pelo cliente ou pela IA.
- [ ] **SEC-013 - P0 - Implementar rate limiting distribuido.** Chaves por usuario, IP e operacao; armazenamento compartilhado; resposta 429 com `Retry-After`.
- [ ] **SEC-014 - P0 - Criar quotas para IA.** Limite diario/mensal, chamadas por mensagem, tokens, ferramentas e custo por usuario/plano.
- [ ] **SEC-015 - P1 - Limitar payloads.** Tamanho maximo de mensagem, nome, notas, metadata e historico enviado ao modelo.
- [ ] **SEC-016 - P1 - Criar protecao contra automacao abusiva.** Rate limits de cadastro/login, CAPTCHA adaptativo e alertas de anomalia.
- [ ] **SEC-017 - P1 - Aplicar menor privilegio.** Revisar grants por operacao e evitar `FOR ALL` quando usuarios nao precisam editar campos controlados pelo sistema.

### 8.4 Segredos

- [ ] **SEC-018 - P0 - Ignorar `.env`.** Adicionar `.env` ao `.gitignore`, manter apenas `.env.example` sem valores e verificar historico remoto antes de considerar o risco encerrado.
- [ ] **SEC-019 - P0 - Rejeitar segredos no cliente.** O build deve falhar ao detectar service role, chave de IA, token privado, JWT privilegiado ou segredo literal em variavel publica, bundle, source map ou asset. Nao depender apenas do prefixo. A chave publishable do Supabase e publica por desenho e deve ser distinguida de credencial secreta.
- [ ] **SEC-020 - P0 - Rotacionar credenciais realmente expostas.** Verificar historico, branches, artifacts, logs e ambientes; rotacionar apenas credenciais secretas ou privilegiadas com evidencia de exposicao ou risco, documentando responsavel, impacto e confirmacao.
- [ ] **SEC-021 - P0 - Usar secret manager por ambiente.** Proibir segredo em repositorio, logs, CI artifacts e configuracoes de preview.
- [ ] **SEC-022 - P1 - Criar rotina de rotacao.** Chaves de IA, Supabase, webhooks e integracoes devem ter inventario e prazo de rotacao.

### 8.5 Tratamento de erro seguro

- [ ] **SEC-023 - P0 - Retornar 401/403 corretamente.** Falhas de sessao nao podem virar HTML 500 ou revelar detalhes internos.
- [ ] **SEC-024 - P0 - Redigir logs.** Remover bearer tokens, refresh tokens, senhas, chaves, cookies e dados pessoais desnecessarios.
- [ ] **SEC-025 - P1 - Usar correlation ID.** Toda resposta de erro deve permitir localizar o evento sem expor stack ao usuario.
- [ ] **SEC-026 - P1 - Implementar paginas de erro seguras.** Mensagens em pt-BR, sem detalhes tecnicos, com retry ou suporte quando apropriado.

### 8.6 Verificacao continua

- [ ] **SEC-027 - P0 - SAST e analise de dependencias.** CodeQL ou Semgrep, auditoria do package manager e politica de severidade antes de qualquer ambiente com dados reais.
- [ ] **SEC-028 - P1 - Secret scanning.** Gitleaks ou equivalente em commits e CI.
- [ ] **SEC-029 - P1 - DAST em staging.** OWASP ZAP com autenticacao controlada e allowlist.
- [ ] **SEC-030 - P0 - Testes de autorizacao/RLS.** Matriz para `anon`, usuario A e usuario B em toda tabela, view, RPC, Storage e operacao exposta; incluir IDs conhecidos, relacoes cross-tenant, colunas controladas e exclusao atomica. Para service role, comprovar o bypass esperado, o isolamento server-only e a ausencia da credencial no cliente.
- [ ] **SEC-031 - P1 - Pentest antes da producao.** Escopo: auth, RLS, XSS, IA, abuso, sessao, APIs e configuracao de cloud.
- [ ] **SEC-032 - P0 - Criar threat model inicial.** STRIDE para aplicacao, plano de controle e cadeia de entrega; abuse cases especificos para IA. Revisar em mudancas arquiteturais e releases de risco.
- [ ] **SEC-033 - P0 - Auditar superficie Supabase.** Inventariar schemas expostos, default privileges, grants de tabela/coluna, views, RPCs, funcoes `SECURITY DEFINER`, `search_path`, `EXECUTE` publico, Storage e Realtime; aplicar default-deny.
- [ ] **SEC-034 - P0 - Proteger o plano de controle.** MFA resistente a phishing quando suportado, contas individuais, menor privilegio e auditoria para Supabase, Lovable, Cloudflare, DNS, CI e secret manager.

### Gate de seguranca

- Zero vulnerabilidade critica exploravel, quebra de tenant ou segredo privilegiado exposto. Esses controles nao sao dispensaveis por aceite generico de risco.
- Vulnerabilidade alta somente pode ser excepcionada por autoridade nomeada, analise de explorabilidade, controle compensatorio, prazo e expiracao.
- XSS automatizado e manual sem execucao, navegacao ou exfiltracao em navegador real; nenhum dado nao confiavel alcanca sink HTML/CSS sem politica segura.
- CSP bloqueante sem `'unsafe-eval'` e sem `'unsafe-inline'`, com relatorio de violacoes revisado.
- RLS validada em toda tabela, view, RPC e Storage expostos.
- Segredos ausentes do historico ativo, bundle, source maps, logs, imagens e artifacts.
- Rate limits atomicos validados sob concorrencia, IPv6, NAT e headers de proxy confiavel.
- Pentest com reteste dos achados e matriz ASVS atualizada.

---

## 9. Identidade, Sessao e Controle de Acesso

### Backlog

- [ ] **IAM-001 - P0 - Corrigir redirecionamentos.** Aceitar somente caminhos internos conhecidos e preservar destino apos login.
- [ ] **IAM-002 - P0 - Reagir a expiracao e logout.** Escutar mudancas de sessao, limpar caches e redirecionar em todas as abas.
- [ ] **IAM-003 - P0 - Decidir e implementar a arquitetura de sessao.** Preferencia: BFF com access/refresh tokens inacessiveis ao JavaScript, cookies `HttpOnly`, `Secure`, `SameSite` adequado e toda operacao de dominio passando pelo BFF. Se a compatibilidade obrigar token no navegador, registrar ADR, risco residual e controles compensatorios. Cookies exigem CSRF em toda mutacao.
- [ ] **IAM-004 - P1 - Implementar recuperacao de senha.** Fluxo completo, mensagens neutras e protecao contra enumeracao de contas.
- [ ] **IAM-005 - P1 - Confirmar e-mail e estado da conta.** A interface deve diferenciar cadastro pendente, bloqueio, expiracao e autenticacao concluida.
- [ ] **IAM-006 - P1 - Configurar OAuth com allowlist.** Validar state/PKCE pelo SDK, redirects por ambiente e retorno interno seguro.
- [ ] **IAM-007 - P1 - Endurecer politicas de senha.** Integrar requisitos do Supabase, protecao contra senha vazada e rate limit.
- [ ] **IAM-008 - P2 - Oferecer MFA para contas de maior risco.** Priorizar administradores e operacoes sensiveis.
- [ ] **IAM-009 - P2 - Criar gestao de sessoes.** Listar dispositivos, revogar sessoes e registrar eventos de seguranca.
- [ ] **IAM-010 - P1 - Implementar exclusao e exportacao de conta.** Com reautenticacao, periodo de seguranca e trilha de auditoria.
- [ ] **IAM-011 - P0 - Definir ciclo de vida da sessao.** TTL absoluto e por inatividade, rotacao e deteccao de reutilizacao de refresh token, janela maxima apos revogacao e procedimento emergencial. Logout, troca de senha e incidente devem limpar caches e abas e revogar o que o provedor permitir.
- [ ] **IAM-012 - P0 - Exigir MFA no plano de controle.** Contas administrativas de Supabase, Lovable, Cloudflare, DNS, CI e secret manager nao podem depender apenas de senha.

### Testes obrigatorios

- Token ausente, malformado, expirado e revogado.
- Usuario A tentando acessar e alterar dados do usuario B.
- OAuth com redirect externo ou manipulado.
- Logout em outra aba.
- TTL absoluto e por inatividade, rotacao/reutilizacao de refresh token e janela residual do access token.
- Troca de senha e resposta a incidente com revogacao, limpeza de caches e propagacao entre abas.
- Recuperacao de senha sem enumeracao de e-mail.
- Reautenticacao em operacoes destrutivas.

---

## 10. IA Conversacional e Seguranca de LLM

### Objetivo

Transformar a IA em uma camada de interpretacao e explicacao, nunca em autoridade de estado, calculo ou permissao.

### 10.1 Estado conversacional

- [ ] **AI-001 - P0 - Criar `conversations`.** Registrar usuario, produto atual, etapa, status, versao do fluxo, timestamps e ultima atividade.
- [ ] **AI-002 - P0 - Persistir eventos de ferramentas.** Nome da ferramenta, argumentos validados, resultado minimizado, idempotency key, status e erro seguro.
- [ ] **AI-003 - P0 - Restaurar conversa apos reload.** A UI deve recuperar etapa, produto, pendencias e ultima pergunta.
- [ ] **AI-004 - P0 - Corrigir janela de historico.** Carregar as mensagens mais recentes com ordenacao deterministica e limite de tokens, nao apenas quantidade de linhas.
- [ ] **AI-005 - P0 - Criar maquina de estados.** O servidor determina etapas validas e proximas transicoes; o modelo nao decide livremente a ordem.
- [ ] **AI-006 - P0 - Adicionar ferramenta de leitura segura.** `get_product_draft_state` retorna apenas campos necessarios e IDs autorizados.
- [ ] **AI-007 - P1 - Suportar varias conversas.** Nao manter todo o historico do usuario como uma unica conversa global.

### 10.2 Ferramentas e integridade

- [ ] **AI-008 - P0 - Validar argumentos com Zod.** JSON Schema orienta o modelo, mas Zod deve bloquear payload invalido em runtime.
- [ ] **AI-009 - P0 - Resolver IDs no servidor.** Sempre que possivel, a IA envia uma referencia semantica e o servidor localiza o ID dentro do produto autorizado.
- [ ] **AI-010 - P0 - Verificar etapa permitida.** Uma ferramenta so executa quando for valida para a etapa e estado atuais.
- [ ] **AI-011 - P0 - Adotar idempotency key.** Retry da mesma mensagem nao pode duplicar produto, ingrediente, taxa ou embalagem.
- [ ] **AI-012 - P0 - Tornar operacoes compostas transacionais.** Persistencia da mensagem, mudancas de estado e eventos criticos devem ter consistencia definida.
- [ ] **AI-013 - P1 - Implementar correcoes.** Ferramentas para atualizar/remover ingrediente, embalagem, taxa e mercado, com confirmacao.
- [ ] **AI-014 - P1 - Validar completude antes de finalizar.** `finish_product` deve recusar conclusao com pendencias e gravar status apenas quando valido.

### 10.3 Prompt injection e saida nao confiavel

- [ ] **AI-015 - P0 - Conter prompt injection por arquitetura.** Assumir que delimitadores e instrucoes podem ser ignorados pelo modelo. Autorizacao, maquina de estados, allowlist, validacao, ownership e limites de capacidade devem permanecer fora do LLM; marcar conteudo como dado e apenas uma mitigacao adicional.
- [ ] **AI-016 - P0 - Aplicar allowlist de ferramentas.** O modelo nao pode escolher tabela, coluna, endpoint ou operacao arbitraria.
- [ ] **AI-017 - P0 - Nunca executar codigo ou URL da resposta.** Links devem ser validados e renderizados de forma segura.
- [ ] **AI-018 - P0 - Limitar e redigir resultados de ferramenta.** Remover `user_id`, IDs nao necessarios, timestamps, erros brutos e dados pessoais antes de devolver ao modelo. Aplicar schema de saida estrito e limite de bytes.
- [ ] **AI-019 - P1 - Criar testes de jailbreak.** Tentativas de ignorar regras, obter segredos, acessar outro usuario, inventar imposto, executar ferramenta indevida e produzir HTML malicioso.
- [ ] **AI-020 - P1 - Registrar decisao, nao chain-of-thought.** Guardar eventos e justificativas curtas, sem solicitar ou persistir raciocinio interno do modelo.

### 10.4 Custo, resiliencia e qualidade

- [ ] **AI-021 - P0 - Timeout e cancelamento.** AbortController e limite por chamada e por ciclo completo.
- [ ] **AI-022 - P0 - Limitar iteracoes e ferramentas.** Limites configuraveis e observados por usuario/plano.
- [ ] **AI-023 - P0 - Tratar falhas por categoria.** HTTP 402 e demais 4xx permanentes nao recebem retry automatico; 429 respeita `Retry-After`; timeout e 5xx transitivos usam backoff com jitter e limite. Toda tentativa reutiliza idempotency key e nao duplica mutacoes.
- [ ] **AI-024 - P1 - Implementar budget de tokens.** Resumo estruturado do historico e exclusao de conteudo irrelevante.
- [ ] **AI-025 - P1 - Criar suite de avaliacoes.** Receitas reais, ambiguidades, unidades, correcoes, retomada e ataques.
- [ ] **AI-026 - P1 - Versionar prompts e modelos.** Toda execucao deve registrar versao, modelo, latencia e resultado sem expor conteudo desnecessario.
- [ ] **AI-027 - P1 - Criar fallback controlado.** Permitir continuar manualmente quando a IA estiver indisponivel, sem perder o rascunho.
- [ ] **AI-028 - P0 - Detectar e minimizar PII em texto livre.** Antes de enviar ao provedor, identificar e redigir credenciais, tokens, CPF, telefone, e-mail e outros dados pessoais sem finalidade; oferecer confirmacao quando a redacao puder alterar o sentido.
- [ ] **AI-029 - P0 - Validar resposta do provedor.** Aplicar schema `.strict()`, limite de bytes/tokens, numero maximo de tool calls, enums e rejeicao de campos extras antes de qualquer uso.
- [ ] **AI-030 - P1 - Exigir confirmacao humana para mutacoes sensiveis.** Exclusao, substituicao em massa, conclusao e mudanca financeira relevante devem apresentar resumo e consequencia antes da confirmacao.
- [ ] **AI-031 - P1 - Fixar revisao do modelo por release.** Mudanca de modelo ou comportamento passa por avaliacao, canary e rollback; registrar identificador imutavel quando fornecido pelo provedor.

### Criterios de aceite

- Fluxo completo funciona apos reload e em uma nova aba.
- Retry nao cria duplicatas.
- A IA nao consegue operar recurso de outro usuario.
- Unidade ambigua gera pergunta, nao custo zero.
- Produto incompleto nao pode ser finalizado.
- Toda mutacao possui evento auditavel.
- Falha do provedor nao corrompe o cadastro.
- Nenhum erro bruto ou dado pessoal sem finalidade e enviado ao provedor.
- Idempotencia permanece correta com chamadas concorrentes.

---

## 11. Banco de Dados, RLS e Integridade

### 11.1 Constraints e tipos

- [ ] **DATA-001 - P0 - Adicionar constraints numericas.** Precos e despesas nao negativos; rendimento, quantidade e unidades por pacote positivos; percentuais em faixa representavel.
- [ ] **DATA-002 - P0 - Validar ordem de mercado.** `min_price <= avg_price <= max_price` quando os valores existirem.
- [ ] **DATA-003 - P0 - Restringir enums.** Status de produto, tipo e periodicidade de despesa, role de chat, unidade, regime tributario e status de conversa.
- [ ] **DATA-004 - P0 - Corrigir precisao e semantica de percentuais.** O tipo deve representar 100% quando permitido. Nao somar taxas com bases de incidencia diferentes; cada componente deve guardar base, vigencia e regra de composicao.
- [ ] **DATA-005 - P1 - Limitar textos.** Nome, notas, mensagens e metadata com tamanho maximo e validacao de schema JSON.
- [ ] **DATA-006 - P1 - Proteger timestamps.** Campos de criacao, atualizacao e revisao devem ser controlados pelo servidor/banco.

### 11.2 Isolamento por tenant

- [ ] **DATA-007 - P0 - Criar chave unica composta em produtos.** `UNIQUE (id, user_id)`.
- [ ] **DATA-008 - P0 - Criar FKs compostas nas filhas.** `(product_id, user_id)` deve referenciar `products(id, user_id)`.
- [ ] **DATA-009 - P0 - Fortalecer policies.** Policies de tabelas filhas devem validar ownership do produto-pai quando aplicavel.
- [ ] **DATA-010 - P0 - Criar testes automatizados de RLS.** SELECT, INSERT, UPDATE, DELETE, relacionamentos cruzados e service role.
- [ ] **DATA-011 - P1 - Separar grants por operacao.** Campos controlados pelo sistema nao devem ser alteraveis pelo cliente autenticado.

### 11.3 Indices e consultas

- [ ] **DATA-012 - P1 - Indexar `products(user_id, created_at)`.** Ajustar direcao conforme consultas.
- [ ] **DATA-013 - P1 - Indexar filhas por `(user_id, product_id)`.** Ingredientes, embalagens, taxas, mercado e simulacoes.
- [ ] **DATA-014 - P1 - Indexar despesas por `(user_id, type, created_at)`.**
- [ ] **DATA-015 - P1 - Indexar mensagens por `(user_id, conversation_id, created_at, id)`.**
- [ ] **DATA-016 - P1 - Validar indices com `EXPLAIN ANALYZE`.** Usar volume representativo e medir impacto das policies.

### 11.4 Evolucao do modelo

- [ ] **DATA-017 - P0 - Adicionar status e completude ao produto.** Estado, etapa, pendencias e data de conclusao.
- [ ] **DATA-018 - P0 - Criar conversas e eventos.** Conversacao, mensagens, tool events e idempotencia.
- [ ] **DATA-019 - P1 - Criar vendas/volumes por periodo.** Produto, quantidade, receita, canal, periodo e origem.
- [ ] **DATA-020 - P1 - Modelar despesas variaveis.** Percentual, valor por unidade, valor por transacao ou valor periodico normalizado.
- [ ] **DATA-021 - P1 - Preservar historico de mercado.** Nao apagar registros anteriores; registrar fonte, regiao e data de referencia.
- [ ] **DATA-022 - P1 - Persistir simulacoes.** Nome, versao do motor, snapshot de entradas e resultados.
- [ ] **DATA-023 - P1 - Persistir diagnosticos quando necessario.** Snapshot, versao das regras, alertas e data.
- [ ] **DATA-024 - P1 - Separar demonstracao.** Origem do dado ou workspace de demonstracao, sem mistura nos totais reais.
- [ ] **DATA-025 - P3 - Avaliar catalogo reutilizavel de insumos.** Compartilhar preco de compra entre produtos sem perder historico e personalizacao.

### 11.5 Migrations

- [ ] **DATA-026 - P0 - Criar estrategia expand-migrate-contract.** Adicionar campos, preencher, validar e somente depois tornar obrigatorios.
- [ ] **DATA-027 - P0 - Fazer backup antes de migration destrutiva.** Registrar ponto de restauracao.
- [ ] **DATA-028 - P1 - Testar migration do zero e sobre copia anonimizada.**
- [ ] **DATA-029 - P1 - Criar verificacao de drift.** Schema remoto deve corresponder as migrations e tipos gerados.
- [ ] **DATA-030 - P1 - Regenerar tipos automaticamente.** CI deve falhar quando tipos e schema divergirem.
- [ ] **DATA-031 - P0 - Endurecer views, RPCs e funcoes.** Preferir views `security_invoker`; toda funcao `SECURITY DEFINER` deve possuir owner controlado, `search_path` fixo, grants explicitos e teste de abuso. Revogar `EXECUTE` publico por padrao.
- [ ] **DATA-032 - P1 - Implementar concorrencia otimista.** Versao ou `updated_at` como precondicao, resposta 409 em conflito e resolucao explicita na UI para impedir lost updates entre abas.
- [ ] **DATA-033 - P1 - Definir politica de exclusao.** Revisar `CASCADE`, `SET NULL`, arquivamento e soft delete por entidade, preservando simulacoes e auditoria quando exigido.
- [ ] **DATA-034 - P1 - Preservar vigencia temporal.** Historico ou snapshot imutavel de precos de ingredientes, embalagens, taxas, impostos e regras usados em cada simulacao/diagnostico.
- [ ] **DATA-035 - P0 - Auditar e sanear dados existentes.** Medir valores fora das futuras constraints, relacionamentos inconsistentes, duplicatas e campos ausentes; corrigir ou quarentenar antes de validar constraints.

---

## 12. Motor Financeiro e Confiabilidade dos Calculos

### 12.1 Precisao e tipos

- [ ] **FIN-001 - P0 - Criar tipos de dominio.** `Money`, `Quantity`, `Percentage`, `Unit`, `Period` e resultados discriminados.
- [ ] **FIN-002 - P0 - Adotar decimal exato.** Manter `NUMERIC` no banco e usar biblioteca decimal ou estrategia equivalente no motor. Evitar aritmetica monetaria direta com `number`; transportar decimais por JSON como string canonica ou representacao exata documentada.
- [ ] **FIN-003 - P0 - Definir politica de escala.** Exemplo: valores internos com seis casas, percentuais com quatro, exibicao monetaria com duas e regra de arredondamento documentada.
- [ ] **FIN-004 - P0 - Proibir `NaN` e `Infinity` na apresentacao.** Resultado deve ser `valid`, `incomplete`, `notApplicable` ou `invalid`, nunca um numero especial mascarado.
- [ ] **FIN-005 - P0 - Aplicar teto em unidades indivisiveis.** Ponto de equilibrio e meta de lucro usam `ceil` quando a unidade de venda nao for fracionavel.

### 12.2 Completude e validacao

- [ ] **FIN-006 - P0 - Remover defaults silenciosos.** Rendimento ausente nao vira 1; imposto desconhecido nao vira zero; custo ausente nao vira zero.
- [ ] **FIN-007 - P0 - Retornar pendencias estruturadas.** Exemplo: `MISSING_PACKAGE_PRICE`, `INCOMPATIBLE_UNIT`, `UNKNOWN_TAX_RATE`.
- [ ] **FIN-008 - P0 - Bloquear diagnostico positivo incompleto.** Exibir “dados insuficientes” e orientar a correcao.
- [ ] **FIN-009 - P1 - Exibir qualidade do dado.** Completo, estimado, desatualizado, informado pelo usuario ou demonstracao.

### 12.3 Unidades e conversoes

- [ ] **FIN-010 - P0 - Modelar dimensoes.** Massa, volume, contagem e unidades customizadas.
- [ ] **FIN-011 - P0 - Confirmar conversao nao segura.** Colher, xicara, pacote e caixa exigem fator informado pelo usuario ou densidade contextual.
- [ ] **FIN-012 - P1 - Normalizar aliases.** `g`, `grama`, `gramas`, `kg`, `quilo`, `ml`, `litro`, `un`, `unidade`, com testes.
- [ ] **FIN-013 - P1 - Representar quantidade de embalagem usada.** Permitir duas etiquetas, tres guardanapos ou fracao de material por unidade vendida.
- [ ] **FIN-014 - P1 - Usar a unidade de rendimento.** Resultados devem informar unidade, fatia, porcao, kg, g, L ou ml corretamente.

### 12.4 Custos e margem

- [ ] **FIN-015 - P0 - Integrar despesas variaveis.** Definir como cada tipo afeta custo unitario, transacao, receita ou periodo.
- [ ] **FIN-016 - P1 - Suportar taxa fixa e percentual.** Cartao, marketplace, delivery, comissao e tarifa fixa.
- [ ] **FIN-017 - P1 - Explicitar base tributaria.** Taxas podem incidir sobre preco bruto, liquido ou base especifica.
- [ ] **FIN-018 - P1 - Separar margem de contribuicao e lucro.** Nunca chamar resultado simplificado de lucro liquido.

### 12.5 Formacao de preco

- [ ] **FIN-019 - P0 - Remover `custo x 1,5` como preco sugerido.** Enquanto nao houver modelo validado, apresentar apenas simulacao rotulada.
- [ ] **FIN-020 - P1 - Implementar preco por margem-alvo.** Separar modelos sem rateio fixo, com volume-alvo e com capacidade/mix. Custos fixos por unidade so podem ser usados quando volume e criterio de rateio forem entradas explicitas; bloquear circularidade e denominador menor ou igual a zero.
- [ ] **FIN-021 - P1 - Comparar cenarios.** Preco calculado, preco atual e mercado, sem declarar automaticamente que um valor esta correto ou incorreto.
- [ ] **FIN-022 - P1 - Exibir decomposicao.** Quanto do preco cobre ingrediente, embalagem, taxas, impostos, contribuicao e resultado estimado.

### 12.6 Ponto de equilibrio e vendas

- [ ] **FIN-023 - P0 - Rotular analise de produto unico.** Se todas as despesas fixas forem atribuidas a um produto, a premissa deve ser explicita.
- [ ] **FIN-024 - P1 - Implementar mix multiproduto.** Margem ponderada por participacao real ou simulada de vendas.
- [ ] **FIN-025 - P1 - Registrar volume real.** Substituir o valor ficticio de 100 vendas por dado informado ou hipotese claramente editavel.
- [ ] **FIN-026 - P1 - Normalizar periodos.** Mensal, semanal, anual e eventual devem ser convertidos para o periodo da analise.
- [ ] **FIN-027 - P1 - Persistir snapshot da simulacao.** Entradas, resultados, versao do motor e premissas.

### 12.7 Diagnostico

- [ ] **FIN-028 - P0 - Criar estado “dados insuficientes”.** Nenhuma mensagem de saude financeira sem entradas completas.
- [ ] **FIN-029 - P1 - Versionar regras de alerta.** Thresholds de margem, mercado e despesas devem ser configuraveis e justificaveis.
- [ ] **FIN-030 - P1 - Incluir nivel de severidade e acao.** Informativo, atencao, risco e bloqueio, com proximo passo claro.
- [ ] **FIN-031 - P1 - Integrar IA somente apos calculo.** A IA recebe resultados estruturados e explica sem recalcular ou alterar valores.
- [ ] **FIN-032 - P1 - Definir politicas de rateio.** Volume, receita, tempo, capacidade ou direcionador especifico, com formula, precondicao e aviso de limitacao.
- [ ] **FIN-033 - P1 - Garantir reproducao temporal.** Todo resultado persistido referencia snapshot das entradas, origem, vigencia, versao do motor, regras e politica de arredondamento.
- [ ] **FIN-034 - P1 - Definir moeda e timezone.** MVP pode limitar a BRL e timezone configurado, mas deve validar e persistir essa premissa sem conversoes implicitas.

### Matriz minima de testes financeiros

| Grupo | Casos obrigatorios |
|---|---|
| Conversao | g/kg/mg, ml/L, unidade/duzia, aliases, unidade incompativel |
| Custo | pacote zero, preco ausente, rendimento zero, valor negativo, fracao de centavo |
| Margem | taxa zero, taxa alta, margem negativa, preco zero, denominador invalido |
| Equilibrio | margem positiva, zero e negativa; despesa zero; unidade fracionavel e indivisivel |
| Meta | lucro zero, positivo, negativo invalido e margem nao positiva |
| Mix | um produto, varios produtos, participacao zero, soma diferente de 100% |
| Arredondamento | limites de meio centavo, grandes volumes e repeticao deterministica |
| Propriedades | custo total monotono, margem reduz ao aumentar custo, equilibrio aumenta ao elevar despesa |

---

## 13. Backend, APIs e Server Functions

### Backlog

- [ ] **API-001 - P0 - Validar runtime em todas as operacoes.** Schemas compartilhados entre formulario, server function e testes.
- [ ] **API-002 - P0 - Criar codigos de erro de dominio.** Nao depender de texto livre do Supabase ou do provedor.
- [ ] **API-003 - P0 - Verificar todo erro de consulta.** Nunca usar `data ?? []` sem avaliar `error`.
- [ ] **API-004 - P0 - Implementar idempotencia para mutacoes.** Unicidade por usuario, operacao e chave; hash do payload; estados `processing`, `completed` e `failed`; TTL; resposta armazenada; conflito quando a chave for reutilizada com outro payload.
- [ ] **API-005 - P0 - Usar transacoes em operacoes compostas.** Mercado, conclusao de produto e passos de chat nao podem apagar dados antes de garantir a nova gravacao. Nunca manter transacao de banco aberta durante chamada ao LLM; usar transacao local, outbox/saga e reconciliacao quando houver dependencia externa.
- [ ] **API-006 - P1 - Padronizar paginacao.** Cursor estavel com ordenacao secundaria por ID.
- [ ] **API-007 - P1 - Definir timeouts.** Banco, IA e demais integracoes com limites especificos.
- [ ] **API-008 - P1 - Retry apenas em operacoes seguras.** Backoff com jitter e respeito a `Retry-After`.
- [ ] **API-009 - P0 - Criar camada de autorizacao.** Helpers centralizados para ownership e permissoes, matriz por endpoint e recurso, mantendo RLS como defesa adicional.
- [ ] **API-010 - P1 - Criar auditoria de mutacoes.** Quem, quando, recurso, operacao, resultado e correlation ID.
- [ ] **API-011 - P1 - Minimizar respostas.** Retornar somente campos necessarios para a tela ou IA.
- [ ] **API-012 - P2 - Versionar contratos externos.** Preparar compatibilidade para clientes futuros sem manter codigo legado prematuramente.
- [ ] **API-013 - P1 - Padronizar controle de concorrencia.** Aceitar versao/ETag nas mutacoes e retornar 409 com estado atual quando houver conflito.

### Contrato de erro sugerido

```ts
type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  fieldErrors?: Record<string, string[]>;
  correlationId: string;
};
```

O usuario recebe mensagem segura em pt-BR. Stack, erro do banco e detalhes do provedor ficam apenas na observabilidade, com redacao.

---

## 14. Frontend e Experiencia do Usuario

### 14.1 Jornada de produto

- [ ] **FE-001 - P0 - Criar ficha tecnica do produto.** Ingredientes, custos, rendimento, embalagem, taxas, mercado, completude e historico.
- [ ] **FE-002 - P0 - Permitir revisar e corrigir.** Editar/remover ingredientes, embalagens, taxas, rendimento e preco.
- [ ] **FE-003 - P0 - Exibir status de rascunho.** Produtos incompletos devem ter CTA para continuar e nao participar de consolidacoes.
- [ ] **FE-004 - P1 - Criar resumo antes da conclusao.** Confirmacao estruturada dos dados coletados pela IA.
- [ ] **FE-005 - P1 - Direcionar o fim do chat.** Acoes claras para ficha, despesas, equilibrio, simulacao e diagnostico.

### 14.2 Estados assincronos

- [ ] **FE-006 - P0 - Padronizar loading, vazio, erro e sucesso.** Componentes compartilhados com `role="status"`, retry e mensagens contextuais.
- [ ] **FE-007 - P0 - Distinguir erro de vazio.** Falha de rede ou permissao nunca deve parecer ausencia de produto ou despesa.
- [ ] **FE-008 - P1 - Usar skeleton sem layout shift.** Priorizar dashboard, produtos e diagnostico.
- [ ] **FE-009 - P1 - Preservar entrada em falhas.** Mensagem do chat e formularios nao devem apagar dados quando a requisicao falhar.
- [ ] **FE-010 - P1 - Evitar dados obsoletos.** Limpar ou marcar resultado anterior enquanto uma nova selecao carrega.

### 14.3 Formularios

- [ ] **FE-011 - P0 - Criar input monetario pt-BR.** Aceitar `1.234,56`, normalizar para decimal e exibir erros inline.
- [ ] **FE-012 - P0 - Validar faixas e obrigatoriedade.** `min`, `max`, `step` e mensagens de dominio, sem depender apenas de atributos HTML.
- [ ] **FE-013 - P1 - Implementar edicao de despesas.** Periodicidade, observacao, tipo e categoria.
- [ ] **FE-014 - P1 - Substituir `window.confirm`.** Usar dialog acessivel, com nome do recurso e consequencia.
- [ ] **FE-015 - P1 - Configurar autocomplete.** Nome, e-mail e senha com valores semanticamente corretos.
- [ ] **FE-016 - P1 - Sincronizar filtros com a URL.** Produto selecionado deve sobreviver a reload e historico do navegador.

### 14.4 Transparencia financeira

- [ ] **FE-017 - P0 - Exibir premissas junto dos resultados.** Volume hipotetico, periodo, produto unico e fonte de mercado.
- [ ] **FE-018 - P0 - Marcar resultados incompletos.** Bloquear cor de sucesso e linguagem positiva quando houver pendencias.
- [ ] **FE-019 - P1 - Mostrar detalhamento do calculo.** Formula legivel, entradas e data de atualizacao.
- [ ] **FE-020 - P1 - Identificar dados demo, estimados e reais.** Badge e exclusao dos totais quando necessario.
- [ ] **FE-021 - P1 - Alertar precos desatualizados.** Considerar preco ausente e mudanca no tamanho da embalagem, nao apenas data.
- [ ] **FE-022 - P1 - Proteger trabalho nao salvo.** Autosave de rascunho quando seguro, indicador de estado sujo, confirmacao de navegacao e recuperacao apos falha.
- [ ] **FE-023 - P1 - Resolver conflitos entre abas.** Exibir versao atual, diferencas relevantes e opcoes de recarregar ou reaplicar, sem sobrescrever silenciosamente.
- [x] **FE-024 - P0 - Inventariar e congelar o legado Radix.** Owner: lider tecnico de frontend. Dependencias: ARCH-012. Criterio de aceite: inventario fechado registra wrappers, imports e dependencias legadas, confirma 38 wrappers dormentes e um check bloqueia qualquer nova entrada ate a expiracao no gate da Fase 2.
- [x] **FE-025 - P0 - Implantar a fronteira local de UI.** Owner: frontend. Dependencias: ARCH-012 e FE-024. Criterio de aceite: aplicacao, features e rotas importam UI somente de `@/components/ui`; apenas `src/components/ui` importa `@base-ui/react`; Sonner permanece encapsulado e nenhum especialista nao aprovado e usado.
- [x] **FE-026 - P1 - Migrar os wrappers retidos para Base UI.** Owner: frontend. Dependencias: FE-024, FE-025 e FE-030. Criterio de aceite: os dez wrappers retidos sao transformados in-place por ondas, sem import Radix, com API local, comportamento, estilos e tokens preservados.
- [x] **FE-027 - P1 - Promover `sheet` e `alert-dialog` a uso ativo.** Owner: frontend/UX. Dependencias: FE-014, FE-026 e A11Y-003. Criterio de aceite: menu/drawer e confirmacoes destrutivas usam os wrappers Base locais com foco, Escape, retorno de foco e mobile validados.
- [x] **FE-028 - P1 - Remover 36 wrappers dormentes.** Owner: frontend. Dependencias: FE-024 e FE-027. Criterio de aceite: nao restam imports ou arquivos dos 36 wrappers descartados e o catalogo contem exatamente `alert-dialog`, `badge`, `button`, `card`, `input`, `label`, `select`, `sheet`, `sonner` e `textarea`.
- [x] **FE-029 - P1 - Remover `cmdk`, `vaul` e integracoes Radix.** Owner: frontend. Dependencias: FE-026 e FE-028. `cmdk` e `vaul` nao sao elegiveis como especialistas porque mantem Radix. Criterio de aceite: source mantido nao importa `cmdk`, `vaul`, `@radix-ui/*` ou `radix-ui`; nenhuma stack concorrente substitui esses pacotes e Sonner continua como unico especialista allowlisted.
- [ ] **FE-030 - P1 - Preservar o estilo legado durante a transformacao.** Owner: frontend/UX. Dependencias: ARCH-012 e FE-024. Criterio de aceite: `new-york` e transformado in-place sem regressao visual ou troca de tokens; `components.json` so muda para `base-nova` depois da migracao, como metadata para adicoes futuras.
- [ ] **FE-031 - P1 - Fechar a conformidade do catalogo Base UI.** Owner: lider tecnico de frontend. Dependencias: FE-026 a FE-030. Criterio de aceite: catalogo, fronteiras, comportamento, a11y, CSP, SSR/hydration e evidencias por wrapper atendem SDD 1.2 e ADR-016.

### 14.5 Trilha de migracao do stack de componentes

| Onda | IDs principais | Saida obrigatoria |
|---|---|---|
| Fundacao | ARCH-012, FE-024, FE-025, QA-016, DOC-010 | Decisao documentada, inventario fechado e nenhum novo Radix |
| Transformacao | FE-026, FE-030 | Wrappers retidos sobre Base UI sem perder estilo/tokens |
| Adocao e descarte | FE-027, FE-028 | `sheet`/`alert-dialog` ativos, outros 36 dormentes removidos |
| Limpeza do grafo | FE-029, DSO-021, PERF-009 | npm-only, lockfile limpo e sem stack duplicada |
| Paridade e gate | FE-031, A11Y-017, QA-016, QA-017 | Evidencias funcionais, arquiteturais, a11y, CSP e SSR aprovadas |

### Gate do stack de componentes

- Aplicacao, features e rotas usam UI somente por `@/components/ui`; somente `src/components/ui` importa `@base-ui/react`.
- O catalogo possui exatamente dez wrappers; `sheet` e `alert-dialog` estao ativos e os outros 36 wrappers dormentes foram removidos.
- Sonner e o unico especialista allowlisted, sempre atras do wrapper local; `cmdk`, `vaul` e qualquer stack concorrente estao ausentes.
- npm e `package-lock.json` sao autoritativos e exclusivos; arquivos Bun foram removidos.
- Source mantido e grafo direto/transitivo de producao possuem zero `@radix-ui/*` e `radix-ui`.
- Paridade comportamental, visual, WCAG, CSP e SSR/hydration foi aprovada por wrapper e em jornadas integradas.
- A excecao temporaria Radix expira neste gate da Fase 2 e nao pode ser prorrogada.

---

## 15. Acessibilidade e Responsividade

### Meta

Atender WCAG 2.2 nivel AA nas jornadas principais.

### Backlog

- [ ] **A11Y-001 - P0 - Alterar idioma para `pt-BR`.** Aplicacao e paginas de erro.
- [ ] **A11Y-002 - P0 - Associar labels e controles.** Chat, despesas, simulacoes, equilibrio e diagnostico.
- [ ] **A11Y-003 - P0 - Tornar menu movel um drawer acessivel.** `aria-expanded`, foco inicial, focus trap, Escape, retorno de foco, backdrop e bloqueio de scroll.
- [ ] **A11Y-004 - P0 - Remover controles aninhados.** Nunca renderizar `<a><button>`.
- [ ] **A11Y-005 - P1 - Criar skip link.** Pular navegacao repetitiva e focar o conteudo principal.
- [ ] **A11Y-006 - P1 - Anunciar o chat.** `role="log"`, `aria-live`, estado “consultor respondendo” e foco controlado.
- [ ] **A11Y-007 - P1 - Garantir foco visivel.** Nenhum campo ou botao pode remover outline sem substituto equivalente.
- [ ] **A11Y-008 - P1 - Corrigir contraste.** Texto de sucesso, warning, bordas e estados disabled conforme AA.
- [ ] **A11Y-009 - P1 - Corrigir hierarquia de headings.** Titulos de cards semanticos e apenas um `h1` por pagina.
- [ ] **A11Y-010 - P1 - Respeitar movimento reduzido.** Animacoes e scroll suave condicionados a `prefers-reduced-motion`.
- [ ] **A11Y-011 - P1 - Usar alvos moveis adequados.** Preferencialmente 44 x 44 px para acoes primarias e destrutivas.
- [ ] **A11Y-012 - P1 - Testar teclado e leitor de tela.** Chrome/Firefox, NVDA e VoiceOver nas jornadas criticas.
- [ ] **A11Y-013 - P1 - Validar reflow e zoom.** Conteudo funcional a 200% e 400%, text spacing ajustado e sem scroll bidimensional desnecessario.
- [ ] **A11Y-014 - P1 - Padronizar erros acessiveis.** Resumo de erros, foco no resumo, `aria-describedby`, mensagem por campo e identificacao sem depender de cor.
- [ ] **A11Y-015 - P1 - Tornar graficos e tabelas compreensiveis.** Alternativa textual, cabecalhos corretos, legenda e valores disponiveis para tecnologia assistiva.
- [ ] **A11Y-016 - P1 - Gerenciar foco na navegacao SPA.** Focar titulo/conteudo, preservar expectativa ao voltar e evitar foco perdido.
- [ ] **A11Y-017 - P1 - Validar paridade acessivel dos wrappers Base UI.** Owner: UX/acessibilidade. Dependencias: FE-026 e FE-027. Criterio de aceite: `select`, `sheet` e `alert-dialog`, alem dos demais wrappers interativos retidos, passam teclado, foco inicial/retorno, Escape, nomes/descricoes, estados e NVDA/VoiceOver sem regressao.
- [ ] **RESP-001 - P0 - Corrigir chat em mobile.** `100dvh`, safe areas, teclado virtual e orientacao horizontal.
- [ ] **RESP-002 - P1 - Eliminar overflow em 320 px.** Cabecalhos, grupos de botoes, edicao de precos, textos longos e valores grandes.
- [ ] **RESP-003 - P1 - Permitir scroll no menu movel.** Navegacao e logout acessiveis em viewport baixa.

### Gate de acessibilidade

- Zero violacao critica no axe e relatorio manual aprovado; automacao isolada nao encerra o gate.
- Jornada completa por teclado.
- Leitor de tela anuncia erros, carregamento e novas mensagens.
- Contraste AA validado.
- Reflow, zoom, text spacing e foco SPA validados.
- Layout utilizavel em 320 px, 375 px, tablet e desktop.
- Wrappers Base UI interativos mantem teclado, foco, Escape, retorno de foco e semantica aprovados.

---

## 16. Performance e Escalabilidade

### Backlog

- [ ] **PERF-001 - P1 - Eliminar N+1.** Dashboard e lista de produtos devem obter metricas por consulta agregada, view segura ou endpoint de aplicacao.
- [ ] **PERF-002 - P1 - Usar cache de consultas.** Deduplicacao, invalidacao apos mutacao e prefetch seletivo.
- [ ] **PERF-003 - P1 - Paginar dados.** Produtos, despesas, historico, mercado, simulacoes e auditoria.
- [ ] **PERF-004 - P1 - Medir queries.** Planos de execucao, hit ratio, latencia P95/P99 e slow query log.
- [ ] **PERF-005 - P1 - Medir bundle.** Remover componentes/imports nao usados e dividir rotas pesadas.
- [ ] **PERF-006 - P2 - Otimizar renderizacao.** Virtualizar historicos extensos e evitar recalculos durante digitacao sem necessidade.
- [ ] **PERF-007 - P2 - Definir estrategia de cache HTTP.** Assets imutaveis com hash; dados autenticados privados.
- [ ] **PERF-008 - P1 - Executar teste de carga.** Definir massa, concorrencia, ramp-up, duracao, distribuicao de operacoes e criterios para login, dashboard, chat, consultas financeiras e atualizacao de preco.
- [ ] **PERF-009 - P1 - Medir o impacto da consolidacao de primitivos.** Owner: frontend/performance. Dependencias: FE-028, FE-029 e DSO-021. Criterio de aceite: bundle e Core Web Vitals sao comparados ao baseline, nao existe stack de primitivos duplicada no grafo de producao e qualquer regressao excedente ao budget aprovado bloqueia o gate.

### Metas iniciais sugeridas

| Sinal | Meta inicial |
|---|---|
| LCP mobile P75 | menor que 2,5 s |
| INP P75 | menor que 200 ms |
| CLS P75 | menor que 0,1 |
| API P95 sem IA | menor que 500 ms |
| Chat P95 ate primeiro token util | menor que 2 s |
| Erros 5xx | menor que 0,5% |

As metas devem ser revisadas com dados reais e separadas por ambiente e operacao.

---

## 17. Testes e Garantia de Qualidade

### 17.1 Piramide de testes

- [ ] **QA-001 - P0 - Configurar runner unitario.** Cobrir motor financeiro, unidades, formatacao e validadores.
- [ ] **QA-002 - P0 - Criar testes de regressao financeira.** Vetores aprovados por especialista e resultados versionados.
- [ ] **QA-003 - P0 - Criar testes de RLS.** Dois usuarios, relacoes cruzadas e service role.
- [ ] **QA-004 - P0 - Testar fluxo conversacional.** Multiplas mensagens, reload, correcao, retry, idempotencia e falha do provedor.
- [ ] **QA-005 - P0 - Testar XSS.** Payloads HTML, SVG, URL e historico persistido.
- [ ] **QA-006 - P1 - Testes de componentes.** Formularios, estados assincronos e acessibilidade automatizada.
- [ ] **QA-007 - P1 - E2E com Playwright.** Cadastro, produto, despesas, equilibrio, simulacao, diagnostico, logout e mobile.
- [ ] **QA-008 - P1 - Testes de contrato.** Schemas de server functions, Supabase e gateway de IA mockado.
- [ ] **QA-009 - P1 - Testes de migration.** Banco vazio, upgrade com dados, rollback operacional e integridade.
- [ ] **QA-010 - P1 - Property-based tests.** Invariantes do motor financeiro e conversoes.
- [ ] **QA-011 - P1 - Testes de concorrencia.** Duas abas, atualizacoes simultaneas, retries e mercado.
- [ ] **QA-012 - P1 - Testes de carga e abuso.** Rate limit, quotas, filas, timeout e degradacao.
- [ ] **QA-013 - P1 - Padronizar ambientes de teste.** Relogio, timezone, locale, seeds deterministicas, isolamento, limpeza e mascaramento de dados.
- [ ] **QA-014 - P1 - Governar testes instaveis.** Quarentena com owner e prazo; teste flaky nao pode ser simplesmente repetido ate passar.
- [ ] **QA-015 - P1 - Definir limiares das avaliacoes de IA.** Conjunto versionado, taxa minima por intencao, zero violacao de seguranca e revisao humana de amostra.
- [x] **QA-016 - P0 - Automatizar conformidade do stack de componentes.** Owner: QA/plataforma. Dependencias: ARCH-012, FE-024 e FE-025. Criterio de aceite: CI verifica fronteiras de import, allowlist, inventario sem crescimento, catalogo exato, ausencia de Bun e grafo npm de producao; no gate da Fase 2 bloqueia qualquer Radix, `cmdk` ou `vaul`.
- [ ] **QA-017 - P1 - Testar paridade dos wrappers migrados.** Owner: QA. Dependencias: FE-026, FE-027, FE-031 e A11Y-017. Criterio de aceite: testes de componente/E2E cobrem comportamento, formularios, teclado, foco, portal, CSP e SSR/hydration por onda e no catalogo integrado.

### 17.2 Gates de qualidade

- Formatacao verificada sem alterar arquivos na CI.
- ESLint sem erro.
- TypeScript sem erro.
- Testes unitarios e de integracao aprovados.
- Build de producao aprovado.
- Migrations validadas.
- SAST, secret scan e dependencia sem bloqueador.
- E2E critico aprovado em staging.
- Fronteiras de UI, catalogo allowlisted e grafo npm de producao atendem o gate da fase, sem crescimento do inventario Radix.
- Cobertura de linhas nao deve ser usada isoladamente; exigir cobertura das regras e branches criticos.

### 17.3 Definicao de pronto

Uma tarefa so esta pronta quando:

- Implementacao e tratamento de erro estao concluidos.
- Testes relevantes foram adicionados.
- Telemetria e auditoria foram consideradas.
- Acessibilidade foi validada.
- Ameacas e dados pessoais foram avaliados.
- Alteracao de frontend/dependencia atende fronteiras, allowlist, catalogo e checks do stack de componentes.
- Documentacao e migration foram atualizadas.
- Rollback ou mitigacao foi definido.
- Criterios de aceite possuem evidencia.

---

## 18. Observabilidade e Auditoria

### Backlog

- [ ] **OBS-001 - P0 - Logs estruturados.** JSON com timestamp, nivel, ambiente, servico, operacao, correlation ID e status.
- [ ] **OBS-002 - P0 - Redacao automatica.** Tokens, cookies, chaves, senhas, e-mails e prompts sensiveis.
- [ ] **OBS-003 - P1 - Error tracking.** Source maps protegidos, agrupamento, release e contexto minimo necessario.
- [ ] **OBS-004 - P1 - OpenTelemetry.** Traces de server function, banco e IA, sem payload sensivel.
- [ ] **OBS-005 - P1 - Metricas de aplicacao.** Latencia, erro, throughput, retry, timeout e saturacao.
- [ ] **OBS-006 - P1 - Metricas de IA.** Tokens, custo, iteracoes, ferramentas, falhas, 402, 429 e taxa de conclusao.
- [ ] **OBS-007 - P1 - Metricas financeiras de qualidade.** Produtos incompletos, custos ausentes, unidades ambiguas e diagnosticos bloqueados.
- [ ] **OBS-008 - P1 - Trilha de auditoria.** Alteracoes financeiras e de seguranca, append-only e com retencao definida.
- [ ] **OBS-009 - P1 - Dashboards e alertas.** Disponibilidade, auth, Supabase, IA, erros, abuso e custo.
- [ ] **OBS-010 - P1 - SLOs e error budget.** Definir disponibilidade e latencia por jornada.
- [ ] **OBS-011 - P2 - Health e readiness.** Separar processo vivo de dependencias prontas.
- [ ] **OBS-012 - P0 - Eliminar estado global de erro entre requisicoes.** Captura e correlation ID devem ser request-scoped; testes concorrentes comprovam que erro e contexto de um usuario nunca aparecem em outro.
- [ ] **OBS-013 - P1 - Tornar auditoria resistente a alteracao.** Armazenamento append-only fora da permissao normal da aplicacao, integridade verificavel e acesso auditado.
- [ ] **OBS-014 - P1 - Especificar SLIs.** Formula, fonte, janela, volume minimo, ambiente e error budget para cada jornada.
- [ ] **OBS-015 - P1 - Adotar RUM e synthetic checks.** Core Web Vitals reais e verificacoes periodicas de login, dashboard e dependencias.

### Eventos de auditoria minimos

| Evento | Campos essenciais |
|---|---|
| Login/logout | usuario pseudonimizado, metodo, resultado, IP truncado, user agent resumido |
| Produto alterado | recurso, campos alterados, ator, origem, timestamp, correlation ID |
| Preco alterado | valor anterior/novo com acesso restrito, item, ator e motivo |
| Diagnostico gerado | versao do motor, versao das regras, snapshot ID |
| Ferramenta de IA | conversa, ferramenta, status, versao do prompt, idempotency key |
| Falha de autorizacao | ator, recurso, operacao, origem e resultado |
| Exportacao/exclusao | solicitante, aprovacao, escopo, data e conclusao |

---

## 19. Privacidade e LGPD

### Objetivo

Garantir finalidade, necessidade, transparencia, seguranca, retencao controlada e exercicio dos direitos do titular.

### Backlog

- [ ] **PRIV-001 - P0 - Inventariar dados pessoais.** Origem, finalidade, base legal, armazenamento, compartilhamento, retencao e responsavel.
- [ ] **PRIV-002 - P0 - Mapear fluxo para a IA.** Quais mensagens e dados financeiros saem da aplicacao, para qual subprocessador e por quanto tempo.
- [ ] **PRIV-003 - P0 - Minimizar dados enviados.** Remover `user_id`, IDs internos, e-mail, timestamps e campos nao necessarios.
- [ ] **PRIV-004 - P1 - Publicar aviso de privacidade.** Linguagem clara sobre Supabase, Lovable/IA, finalidade e direitos.
- [ ] **PRIV-005 - P1 - Definir base legal e consentimentos.** Consentimento nao deve ser usado quando outra base for mais adequada; registrar decisao juridica.
- [ ] **PRIV-006 - P1 - Criar politica de retencao.** Chat, auditoria, diagnosticos, conta inativa, backups e logs.
- [ ] **PRIV-007 - P1 - Implementar exportacao.** Dados em formato estruturado, autenticacao forte e prazo controlado.
- [ ] **PRIV-008 - P1 - Implementar exclusao.** Considerar cascades, auditoria obrigatoria, backups e periodos legais.
- [ ] **PRIV-009 - P1 - Criar processo de correcao.** Titular pode corrigir perfil e dados financeiros.
- [ ] **PRIV-010 - P1 - Avaliar fornecedores.** DPA, localizacao, suboperadores, retencao, treinamento com dados e notificacao de incidente.
- [ ] **PRIV-011 - P1 - Produzir RIPD quando aplicavel.** Especialmente pelo uso de IA e dados economico-financeiros.
- [ ] **PRIV-012 - P0 - Criar processo de incidente de privacidade.** Avaliacao, preservacao de evidencia, comunicacao e registro dentro do prazo regulatorio vigente; validar juridicamente a regra atualmente aplicavel antes do lancamento.
- [ ] **PRIV-013 - P0 - Documentar transferencia internacional.** Base, salvaguardas, paises, fornecedores, suboperadores e mecanismo contratual para Supabase, Lovable e observabilidade.
- [ ] **PRIV-014 - P1 - Tratar menores e representantes.** Definir se o servico e restrito a adultos, como verificar capacidade e como atender representante legal quando aplicavel.
- [ ] **PRIV-015 - P1 - Tratar decisoes automatizadas.** Explicar que diagnosticos sao apoio, oferecer revisao humana e canal para contestacao/correcao.
- [ ] **PRIV-016 - P1 - Versionar consentimentos quando aplicaveis.** Finalidade, versao do texto, data, retirada e prova; nao usar consentimento quando outra base legal for a correta.
- [ ] **PRIV-017 - P1 - Reconciliar exclusao, auditoria e backups.** Matriz de retencao, pseudonimizacao, excecoes legais e ledger para reaplicar exclusoes depois de restauracao.
- [ ] **PRIV-018 - P1 - Operacionalizar todos os direitos aplicaveis.** Canal autenticado, confirmacao/acesso, correcao, portabilidade quando regulamentada, anonimizacao/bloqueio, eliminacao, informacao, oposicao e revogacao, com SLA, identidade do solicitante e trilha de atendimento.

### Classificacao sugerida

| Classe | Exemplos | Controle |
|---|---|---|
| Publico | Landing e documentacao publica | Integridade e disponibilidade |
| Interno | Metricas agregadas sem identificador | Acesso interno controlado |
| Confidencial | Produtos, custos, despesas, faturamento e chat | Criptografia, RLS, auditoria e minimizacao |
| Restrito | Tokens, segredos, credenciais e dados de incidente | Secret manager, acesso minimo e rotacao |

---

## 20. DevSecOps, Dependencias e Supply Chain

### Backlog

- [x] **DSO-001 - P0 - Padronizar o projeto em npm.** npm e `package-lock.json` sao autoritativos; declarar `packageManager` e remover lockfile/configuracao Bun durante a execucao.
- [ ] **DSO-002 - P0 - Fixar runtime.** `.nvmrc`, `.tool-versions` ou equivalente, com `engines` no `package.json`.
- [ ] **DSO-003 - P0 - Criar CI obrigatoria.** Format check, lint, typecheck, testes, build, migration check e scans.
- [ ] **DSO-004 - P1 - Configurar Renovate/Dependabot.** Atualizacoes agrupadas, changelog e testes automaticos.
- [ ] **DSO-005 - P1 - Gerar SBOM.** CycloneDX ou SPDX por release.
- [ ] **DSO-006 - P1 - Verificar licencas.** Allowlist/denylist e revisao de dependencias transitivas.
- [ ] **DSO-007 - P1 - Assinar artifacts e releases.** Proveniencia e checksums quando suportado.
- [ ] **DSO-008 - P1 - Proteger branches.** Reviews, checks obrigatorios, proibicao de force push e segregacao de funcoes.
- [ ] **DSO-009 - P1 - Isolar ambientes.** Projetos, bancos, chaves e dominios separados para dev, staging e producao.
- [ ] **DSO-010 - P1 - Controlar previews.** Sem dados reais, segredos de producao ou permissao de callback ampla.
- [ ] **DSO-011 - P1 - Criar deploy progressivo.** Smoke tests, canary quando possivel e rollback documentado.
- [ ] **DSO-012 - P1 - Tratar migrations como etapa controlada.** Backup, compatibilidade, lock timeout, observacao e rollback operacional.
- [ ] **DSO-013 - P1 - Automatizar verificacao de bundle.** Garantir que service role, chaves e modulos server-only nao estejam no cliente.
- [ ] **DSO-014 - P3 - Adotar SLSA compativel com o contexto.** Melhorar integridade da cadeia de build progressivamente.
- [ ] **DSO-015 - P0 - Endurecer a CI.** Actions fixadas por SHA, `permissions` minimas, OIDC em vez de segredo de longa duracao e nenhuma credencial disponibilizada a PR nao confiavel.
- [ ] **DSO-016 - P0 - Controlar scripts de instalacao.** Revisar dependencias com lifecycle scripts, bloquear execucao desnecessaria e documentar excecoes ao `minimumReleaseAge`.
- [ ] **DSO-017 - P1 - Promover o mesmo artifact.** Build imutavel testado em staging deve ser promovido, nao recompilado com dependencias diferentes em producao.
- [ ] **DSO-018 - P1 - Gerenciar configuracao como codigo.** Detectar drift de hosting, DNS, headers, secrets references e Supabase.
- [ ] **DSO-019 - P1 - Definir SLA de vulnerabilidades.** Severidade, explorabilidade, owner, prazo, excecao e expiracao.
- [ ] **DSO-020 - P1 - Governar feature flags e kill switches.** Owner, escopo, auditoria, valor seguro por padrao, desligamento emergencial e data de remocao.
- [x] **DSO-021 - P0 - Tornar npm e o grafo de producao autoritativos.** Owner: plataforma/DevOps. Dependencias: DSO-001, ARCH-012 e FE-029. Criterio de aceite: `npm ci` usa `package-lock.json`, `bun.lock`/`bunfig.toml` foram removidos e o lockfile/grafo direto e transitivo de producao contem zero `@radix-ui/*`, `radix-ui`, `cmdk` e `vaul`; Sonner e a unica excecao especialista aprovada.

### Pipeline minimo

```text
Checkout limpo
  -> instalar por lockfile
  -> verificar fronteiras, catalogo e grafo de producao do stack de UI
  -> format check
  -> lint
  -> typecheck
  -> unit tests
  -> integration/RLS tests
  -> build
  -> secret scan
  -> SAST
  -> dependency/license scan
  -> SBOM
  -> aplicar expand migration em staging
  -> deploy do artifact em staging
  -> backfill e verificacao em staging
  -> E2E + DAST + smoke
  -> aprovacao
  -> criar/verificar ponto de restauracao de producao
  -> aplicar expand migration em producao
  -> promover o mesmo artifact com deploy progressivo
  -> backfill e verificacao em producao
  -> verificacao pos-deploy
  -> contract migration em release posterior
```

---

## 21. Infraestrutura, Backup e Continuidade

### Backlog

- [ ] **OPS-001 - P0 - Documentar ambientes e dependencias.** Cloudflare/Nitro, Supabase, Lovable, DNS, e-mail e observabilidade.
- [ ] **OPS-002 - P0 - Habilitar backups adequados.** Confirmar politica Supabase e manter copia criptografada, imutavel e protegida de comprometimento do mesmo dominio administrativo. Cobrir banco, Auth, configuracoes, DNS, artifacts e metadados necessarios para recompor o servico.
- [ ] **OPS-003 - P0 - Definir RPO e RTO.** Aprovados pelo negocio para dados financeiros e autenticacao.
- [ ] **OPS-004 - P1 - Habilitar PITR quando compativel.** Validar custo e janela de recuperacao.
- [ ] **OPS-005 - P1 - Testar restauracao.** Restaurar em projeto isolado, comprovar RPO/RTO, integridade, Auth, RLS, migrations, segredos referenciados e reconciliacao de exclusoes; registrar evidencia e tempo medido.
- [ ] **OPS-006 - P1 - Criar plano de continuidade.** Indisponibilidade de IA nao deve impedir acesso e edicao manual dos dados existentes.
- [ ] **OPS-007 - P1 - Criar runbook de rollback.** Aplicacao, migration, segredo e configuracao.
- [ ] **OPS-008 - P1 - Configurar alertas de custo.** IA, Supabase, hosting, logs e trafego.
- [ ] **OPS-009 - P1 - Definir capacidade e limites.** Conexoes, requests, tamanho de banco, mensagens e filas.
- [ ] **OPS-010 - P1 - Executar tabletop pre-producao.** Simular falha do banco, IA, auth, DNS, comprometimento de conta e deploy defeituoso. Game days tecnicos de maior impacto permanecem P2 apos a prontidao inicial.

---

## 22. Resposta a Incidentes

### Processo minimo

1. Detectar e registrar correlation ID, ambiente, horario sincronizado e indicador.
2. Classificar severidade e nomear Incident Commander, lider tecnico, comunicacao e responsavel por privacidade.
3. Conter sem destruir evidencias.
4. Revogar sessoes ou rotacionar segredos quando necessario.
5. Preservar logs com acesso restrito, cadeia de custodia e canal fora de banda.
6. Corrigir e validar em ambiente controlado.
7. Comunicar partes necessarias, incluindo avaliacao LGPD.
8. Executar post-mortem sem culpabilizacao.
9. Converter causas e falhas de deteccao em tarefas rastreaveis.

Cada runbook deve conter gatilho, owner, contatos, precondicoes, contencao, preservacao de evidencia, recuperacao, validacao, comunicacao, decisao de rollback, encerramento e data do ultimo exercicio.

### Runbooks obrigatorios

- [ ] **IR-001 - P0 - Conta comprometida.**
- [ ] **IR-002 - P0 - Chave de IA ou Supabase secreta exposta.**
- [ ] **IR-003 - P0 - XSS explorado.**
- [ ] **IR-004 - P0 - Vazamento ou acesso cross-tenant.**
- [ ] **IR-005 - P0 - Resultado financeiro incorreto em producao.**
- [ ] **IR-006 - P1 - Abuso de custo da IA.**
- [ ] **IR-007 - P1 - Migration com corrupcao ou indisponibilidade.**
- [ ] **IR-008 - P1 - Provedor externo indisponivel.**
- [ ] **IR-009 - P0 - Comprometimento da CI ou supply chain.**
- [ ] **IR-010 - P0 - Comprometimento de conta administrativa ou plano de controle.**
- [ ] **IR-011 - P0 - Revogacao emergencial de sessoes.**

### Severidade sugerida

| Nivel | Exemplo | Resposta inicial |
|---|---|---|
| SEV-1 | Vazamento, takeover, RLS quebrada, calculo massivamente incorreto | Reconhecimento em ate 15 min; atualizacao executiva periodica; contencao imediata |
| SEV-2 | Funcao central indisponivel ou corrupcao limitada | Reconhecimento em ate 30 min; owner e comunicacao interna |
| SEV-3 | Degradacao com contorno | Reconhecimento no horario operacional e plano de correcao |
| SEV-4 | Defeito sem impacto relevante | Backlog normal com owner |

---

## 23. Documentacao e Operacao da Equipe

### Backlog

- [ ] **DOC-001 - P0 - Criar guia de desenvolvimento.** Setup, runtime, package manager, variaveis, Supabase local e comandos.
- [ ] **DOC-002 - P0 - Criar `.env.example`.** Nomes, finalidade, ambiente e indicacao de secreto/publico.
- [ ] **DOC-003 - P1 - Documentar arquitetura.** Diagramas, fronteiras, fluxo de auth, dados e IA.
- [ ] **DOC-004 - P1 - Documentar motor financeiro.** Formulas, unidades, arredondamento, versao e exemplos.
- [ ] **DOC-005 - P1 - Documentar banco.** ERD, RLS, constraints, indices e estrategia de migration.
- [ ] **DOC-006 - P1 - Documentar seguranca.** Threat model, gestao de vulnerabilidade, secrets e resposta a incidente.
- [ ] **DOC-007 - P1 - Criar runbook operacional.** Deploy, rollback, restauracao, alertas e fornecedores.
- [ ] **DOC-008 - P1 - Criar changelog de regras financeiras.** Alteracao de formula deve ser visivel e versionada.
- [ ] **DOC-009 - P2 - Criar catalogo de APIs e eventos.** Contratos, codigos de erro e exemplos seguros.
- [x] **DOC-010 - P0 - Manter ADR e guia normativo do stack de componentes.** Owner: lider tecnico de frontend/documentacao. Dependencias: ARCH-012. Criterio de aceite: ADR-016, SDD 1.2 e Plano 1.3 registram decisao fixa, fronteiras, allowlist, ondas, rollback, gate e governanca de mudancas futuras sem reabrir Base UI.

---

## 24. Sequenciamento de Entrega

### Fase 0 - Contencao imediata

Objetivo: impedir exploracao e resultados manifestamente incorretos.

- [ ] SEC-001, SEC-003, SEC-004 e QA-005: remover HTML inseguro e ativar protecoes de conteudo. SEC-002 e SEC-005 exigem evidencia “nao aplicavel” ou implementacao quando o sink/browser justificar.
- [ ] SEC-006, SEC-007, SEC-011, SEC-012, SEC-027, SEC-033 e SEC-034: transporte, validacao, autorizacao, scans, Supabase e plano de controle endurecidos.
- [ ] IAM-001, IAM-002 e IAM-012: redirects, propagacao de logout e MFA administrativo corrigidos.
- [ ] GOV-001, GOV-002 e GOV-009: glossario, completude e escopo economico aprovados.
- [ ] GOV-003, DATA-017 e FE-003: status `draft`, completude minima e exclusao de rascunhos dos indicadores.
- [ ] FIN-004 a FIN-011, FIN-019 e FIN-025: corrigir valores especiais, arredondamento, dados ausentes, unidades, volume ficticio e preco arbitrario.
- [ ] FIN-028 e FE-017/FE-018: bloquear diagnostico positivo e explicitar hipoteses.
- [ ] AI-001 a AI-006 e DATA-018: persistencia minima da conversa, produto, etapa e resultados necessarios para o fluxo continuar apos reload.
- [ ] SEC-013 a SEC-016 e AI-021 a AI-024: rate limit, quota, timeout, payload e custo controlado.
- [ ] SEC-018 a SEC-021: revisar `.env`, bundles, artifacts e credenciais realmente secretas.
- [ ] SEC-023, SEC-024 e DOC-002: erros 401/403 corretos, redacao de logs e `.env.example` seguro.
- [ ] API-002/API-003 e FE-007: erro de banco nao pode aparecer como vazio.
- [ ] API-001, API-004 e API-005: validacao, idempotencia e atomicidade minimas nas mutacoes criticas.
- [ ] DATA-026, DATA-027 e DATA-035: estrategia de migration, backup e saneamento definidos antes das constraints.
- [ ] SEC-032, QA-001 a QA-005 e QA-012 em escopo P0: threat model, regressao e concorrencia dos limites bloqueantes.
- [ ] DSO-003 em baseline P0: pipeline minimo executa testes criticos e scans; a expansao completa continua na Fase 1.

**Gate de saida:** todos os riscos da matriz §2.3 com fase limite “Fase 0” possuem evidencia aprovada. Nenhum P0 critico conhecido permanece exploravel, interrompe o fluxo central ou apresenta recomendacao falsa como valida.

### Fase 1 - Fundacao segura

Objetivo: estabilizar estado, contratos, dados e pipeline.

- [ ] AI-007 a AI-020 e AI-028 a AI-031: conversas multiplas, tools seguras, minimizacao, confirmacoes e versao do modelo.
- [ ] ARCH-001 a ARCH-006, ARCH-009, IAM-003 e IAM-011: BFF, contratos, SSR, sessao, CSRF e identidade definidos por ADR.
- [ ] ARCH-012, FE-024, FE-025, QA-016 e DOC-010: stack Base UI normativo, inventario Radix fechado, fronteiras locais e checks contra novos usos ativos.
- [ ] DATA-001 a DATA-016 e DATA-031: constraints, FKs compostas, RLS tests, hardening Supabase e indices.
- [ ] API-006 a API-011, incluindo API-009: paginacao, timeout, autorizacao e auditoria padronizados.
- [ ] FIN-001 a FIN-003: tipos financeiros e politica decimal ponta a ponta.
- [ ] DSO-001 a DSO-003, DSO-015 e DSO-016: CI segura, npm/`package-lock.json` autoritativos e runtime fixado.
- [ ] OBS-001 a OBS-004 e OBS-012: logs request-scoped, correlation ID, redacao e error tracking.
- [ ] OPS-001 e DOC-001: ambientes, dependencias e setup de desenvolvimento documentados.
- [ ] PRIV-001 a PRIV-005, PRIV-010 e PRIV-013: finalidade, base legal, aviso, fornecedores e transferencia internacional antes de qualquer usuario externo.
- [ ] AI-027 e OPS-006: fluxo manual preserva o rascunho quando a IA estiver indisponivel.

**Gate de saida:** todos os itens listados na Fase 1 estao concluidos ou possuem excecao permitida conforme §5.2; fluxo conversacional completo, retomavel, sem duplicacao e com isolamento comprovado; CI, sessao, privacidade, motor decimal e observabilidade possuem evidencias aprovadas. O inventario Radix nao cresceu, nenhum uso novo foi aceito e a excecao fechada permanece com expiracao obrigatoria no gate da Fase 2.

### Fase 2 - Confiabilidade financeira e experiencia

Objetivo: concluir o MVP funcional especificado.

- [ ] FE-001 a FE-005: ficha tecnica, revisao, rascunho, resumo e proximos passos.
- [ ] FIN-015 a FIN-018 e DATA-020: despesas variaveis, taxas e margem corretamente modeladas.
- [ ] FIN-019 a FIN-027, FIN-032 a FIN-034 e DATA-019: formacao de preco, vendas, volume, mix, rateio e reproducao temporal.
- [ ] DATA-021 a DATA-024 e FIN-027 a FIN-031: historico, simulacoes e diagnosticos persistidos/versionados.
- [ ] FE-006 a FE-023: estados assincronos, formularios, transparencia, autosave e conflitos.
- [ ] FE-026 a FE-031: transformar os dez wrappers retidos, promover `sheet`/`alert-dialog`, remover os outros 36 dormentes, eliminar `cmdk`/`vaul` e preservar estilo/tokens.
- [ ] A11Y-001 a A11Y-017 e RESP-001 a RESP-003: WCAG AA, paridade Base UI e responsividade nas jornadas principais.
- [ ] PERF-009, QA-006 a QA-011 e QA-013 a QA-017: componentes, contratos, E2E, concorrencia, avaliacoes da IA, bundle e conformidade do stack.
- [ ] DSO-021: npm/`package-lock.json` exclusivos, arquivos Bun removidos e grafo de producao limpo.

**Gate de saida:** todos os itens listados na Fase 2 estao concluidos; resultados sao reproduziveis, premissas visiveis, estados assincronos aprovados e gates financeiro, de acessibilidade e do stack de componentes encerrados. A aceitacao exige npm-only com `package-lock.json` autoritativo, nenhum arquivo Bun, exatamente dez wrappers retidos, remocao dos 36 dormentes, Sonner como unico especialista aprovado e zero `@radix-ui/*`/`radix-ui` direto ou transitivo no grafo de producao e no source mantido. A excecao temporaria Radix expira aqui, sem prorrogacao.

### Fase 3A - Prontidao para beta

Objetivo: comprovar que o ambiente esta seguro e operavel antes do primeiro usuario externo.

- [ ] SEC-029 a SEC-031: DAST, pentest e reteste.
- [ ] PRIV-006 a PRIV-018: retencao, direitos, incidentes, decisoes automatizadas e reconciliacao de backups.
- [ ] OBS-005 a OBS-015: SLOs, dashboards, alertas, RUM, tracing e auditoria resistente.
- [ ] PERF-008 e QA-012: testes de carga, abuso e custos com criterios aprovados.
- [ ] OPS-002 a OPS-005 e OPS-010: backup independente, restauracao isolada e tabletop.
- [ ] IR-001 a IR-011: runbooks exercitados e contatos validados.
- [ ] DSO-020: feature flags e kill switches governados.

**Gate de saida:** checklist §28 aprovado com build, ambiente, evidencias, owners e validade registrados. Nenhum usuario externo entra antes deste gate.

### Fase 3B - Operacao do beta controlado

Objetivo: validar uso real com exposicao limitada, reversivel e monitorada.

- [ ] Liberar por coorte pequena e feature flag.
- [ ] Monitorar seguranca, qualidade financeira, custo, abandono e error budget diariamente.
- [ ] Coletar feedback sem misturar dados demonstrativos e reais.
- [ ] Acionar kill switch quando um limiar de seguranca, custo ou confiabilidade for ultrapassado.
- [ ] Revisar semanalmente riscos, incidentes, excecoes e prontidao de expansao.

**Gate de saida:** seguranca continua aprovada, SLOs cumpridos, restauracao comprovada e indicadores de qualidade dentro dos limites definidos.

### Fase 4 - Producao e melhoria continua

Objetivo: operar com previsibilidade e evoluir sem regressao.

- [ ] Monitorar error budget e qualidade financeira.
- [ ] Revisar ameacas e dependencias continuamente.
- [ ] Executar restore drills e game days.
- [ ] Medir conclusao do onboarding, abandono e correcao de dados.
- [ ] Versionar alteracoes de formula e prompt.
- [ ] Realizar auditorias periodicas de RLS, acesso e fornecedores.

---

## 25. Trilhas Paralelas e Dependencias

| Trilha | Momento de inicio | Depende de |
|---|---|---|
| Seguranca P0 | Imediato | Nenhuma para contencao; SEC-032 orienta a arquitetura |
| Testes do motor atual | Apos baseline do GOV-001 | Glossario e vetores aprovados |
| Estado conversacional | Apos GOV-003 | Modelo de produto/conversa e threat model |
| Constraints e indices | Apos DATA-035 | Auditoria e saneamento dos dados existentes |
| Motor decimal | Apos FIN-003 | Politica de precisao e serializacao aprovada |
| Ficha tecnica | Apos ARCH-002 e GOV-003 | Contratos e estado do produto |
| Stack de componentes Base UI | Fase 1 para fundacao; Fase 2 para fechamento | ARCH-012, ADR-016, inventario fechado e npm autoritativo |
| Vendas e mix | Apos GOV-009 | Definicao de periodo, escopo economico e tenant |
| Diagnostico por IA | Apos FIN-031 | Motor confiavel e resultados estruturados |
| LGPD | Imediato | Participacao juridica, produto e seguranca |
| Observabilidade | Baseline imediato | ADR da plataforma para expansao |
| Pentest | Fase 3A | P0/P1 de seguranca implementados em staging |

### 25.1 DAG minimo do caminho critico

| Predecessor | Sucessor bloqueado | Motivo |
|---|---|---|
| GOV-001, GOV-002, GOV-009 | FIN-001 a FIN-034 | Formula e escopo precisam estar aprovados |
| GOV-003, SEC-032 | AI-001 a AI-020 | Estado e capacidades dependem do dominio e threat model |
| IAM-003, IAM-011, ARCH-009 | ARCH-001 e SEC-010 | BFF, identidade e CSRF dependem da sessao escolhida |
| DATA-035 | DATA-001 a DATA-011 | Constraints nao podem ser validadas sobre dados invalidos |
| ARCH-002, API-001, API-009 | FE-001 a FE-023 | UI depende de contratos e autorizacao estaveis |
| ARCH-012, ADR-016, FE-024, FE-025, FE-030 | FE-026 a FE-029 | Transformacao depende de decisao, inventario, fronteira e regra de estilo fixos |
| FE-026 a FE-031, A11Y-017, PERF-009, QA-016, QA-017, DSO-021 | Gate do stack na Fase 2 | Catalogo, paridade, toolchain e grafo precisam de evidencia conjunta |
| FIN-001 a FIN-018 | FIN-019 a FIN-031 | Preco e diagnostico dependem de custo/margem confiaveis |
| DSO-003, QA-001 a QA-005 | Gate da Fase 0 | Sem pipeline nao existe evidencia repetivel |
| Gates das Fases 1 e 2 | Fase 3A | Pentest e prontidao avaliam o produto candidato ao beta |
| Gate da Fase 3A | Primeiro usuario externo | Go/no-go obrigatorio |

O DAG completo deve ser mantido na ferramenta de gestao conforme §5.2. Alteracao de dependencia exige atualizacao deste plano ou ADR relacionado.

---

## 26. RACI Sugerido

| Area | Responsavel direto | Aprovador | Consultados |
|---|---|---|---|
| Regras financeiras | Engenharia de dominio | Responsavel financeiro/produto | QA e UX |
| Seguranca | Security champion/engenharia | Lider tecnico | Operacoes e juridico |
| Banco e RLS | Backend/dados | Lider tecnico | Seguranca |
| IA | Backend/ML integration | Produto e seguranca | Financeiro e QA |
| Frontend/a11y | Frontend/UX | Produto | QA e usuarios |
| Design system/primitivos | Lider tecnico de frontend | Lider tecnico e Produto/UX | QA, acessibilidade, seguranca e plataforma |
| LGPD | Encarregado/juridico | Controlador | Engenharia e produto |
| CI/CD e operacao | Plataforma/DevOps | Lider tecnico | Seguranca e QA |
| Release | Lider de release | Produto/tecnologia | Todas as trilhas |

Uma mesma pessoa pode acumular papeis em equipe pequena, mas aprovacao de regras financeiras e aceite de risco de seguranca nao devem ocorrer sem revisao independente.

### 26.1 Governanca dos gates

Cada gate deve ser registrado como artefato de release:

| Campo | Exemplo |
|---|---|
| Build e commit | Artifact imutavel e SHA |
| Ambiente | Staging equivalente a producao |
| Controle | `SEC-030`, `QA-003`, `FIN-004` |
| Metrica/limiar | Zero bypass cross-tenant; 100% dos vetores criticos aprovados |
| Evidencia | Relatorio, execucao CI, dashboard ou ata |
| Executor | Pessoa que realizou a verificacao |
| Aprovador | Papel independente autorizado |
| Validade | Release, data ou condicao que invalida a evidencia |
| Excecao | Owner, justificativa, compensacao, expiracao e risco residual |

### 26.2 Coordenacao e rastreabilidade de entregas transversais

IDs sobrepostos representam implementacao, verificacao e aprovacao diferentes, nao tres implementacoes concorrentes:

| Entrega | Implementacao canonica | Verificacao | Aprovacao/gate |
|---|---|---|---|
| RLS e tenant | DATA-007 a DATA-011 | QA-003 | SEC-030 |
| Redacao de logs | OBS-002 | Testes de OBS-002 | SEC-024 |
| Estado de conversa | AI-001/AI-002 e DATA-018 | QA-004 | Gate da Fase 1 |
| Direitos do titular | PRIV-007/PRIV-008 | Teste ponta a ponta | IAM-010 e aprovacao LGPD |
| Carga e abuso | PERF-008 | QA-012 | Gate da Fase 3A |
| Stack de componentes | ARCH-012, FE-024 a FE-030 e DSO-021 | A11Y-017, PERF-009, QA-016 e QA-017 | FE-031, DOC-010 e gate da Fase 2 |

Toda decisao marcada como “avaliar” ou “quando aplicavel” deve produzir ADR com alternativas, criterios, decisor e data limite.

---

## 27. Indicadores de Sucesso

### Produto e financeiro

- Percentual de produtos concluidos sem pendencias.
- Percentual de ingredientes com preco e unidade validos.
- Taxa de correcao manual apos interpretacao da IA.
- Diferenca entre resultados esperados e calculados nos vetores de referencia.
- Percentual de diagnosticos bloqueados corretamente por dados insuficientes.
- Tempo mediano para concluir o primeiro produto.

### Seguranca

- Vulnerabilidades abertas por severidade e idade.
- Tentativas bloqueadas por rate limit e RLS.
- Tempo para rotacao de segredo.
- Cobertura de endpoints por validacao e autorizacao.
- Percentual de releases com scans e evidencias completas.
- Tempo medio de deteccao e recuperacao de incidente.

### Operacao

- Disponibilidade por jornada.
- Latencia P50/P95/P99.
- Taxa de erro por dependencia.
- Custo de IA por produto concluido.
- Taxa de retry, timeout e abandono.
- Sucesso dos testes de restauracao.

### Qualidade

- Regressao financeira detectada antes da producao.
- Flakiness dos testes.
- Tempo de pipeline.
- Mudancas com rollback.
- Violacoes de acessibilidade por release.
- Violacoes de fronteira de import e especialistas fora da allowlist.
- Quantidade de wrappers mantidos versus catalogo aprovado e remocoes pendentes dos 36 dormentes.
- Ocorrencias de Radix no source e no grafo direto/transitivo de producao; meta zero no gate da Fase 2.
- Variacao de bundle e Core Web Vitals por onda da migracao Base UI.

---

## 28. Checklist de Liberacao para Producao

### Seguranca

- [ ] XSS do chat eliminado e testado.
- [ ] CSP bloqueante ativa sem violacoes desconhecidas.
- [ ] Headers de seguranca validados.
- [ ] RLS e FKs compostas testadas.
- [ ] Schemas, views, RPCs, grants e Storage do Supabase auditados.
- [ ] Rate limits, quotas e timeouts ativos.
- [ ] Segredos em secret manager e ausentes do bundle.
- [ ] Sessao, TTL, revogacao, CSRF e limpeza de cache testados.
- [ ] MFA e auditoria ativas nas contas do plano de controle.
- [ ] PII e erros brutos nao chegam ao provedor de IA sem finalidade.
- [ ] SAST, DAST, secret scan e dependencia aprovados.
- [ ] Pentest e reteste concluidos.

### Financeiro

- [ ] Motor decimal e politica de arredondamento aprovados.
- [ ] Dados ausentes nunca viram zero silencioso.
- [ ] Unidade incompativel bloqueia ou pede confirmacao.
- [ ] Ponto de equilibrio e meta usam tratamento correto de impossibilidade.
- [ ] Preco sugerido possui formula validada e premissas visiveis.
- [ ] Mix e volume sao reais ou explicitamente hipoteticos.
- [ ] Vetores de referencia aprovados.

### Dados

- [ ] Constraints e indices aplicados.
- [ ] Migrations testadas sobre dados representativos.
- [ ] Backup independente/imutavel e restauracao isolada verificados.
- [ ] Dados demo segregados.
- [ ] Retencao e exclusao definidas.
- [ ] Snapshots reproduzem precos, regras e versao do motor no tempo.

### Produto e UX

- [ ] Fluxo conversacional retomavel e idempotente.
- [ ] Fluxo manual preserva o rascunho quando a IA falha.
- [ ] Produto possui rascunho, completude e conclusao.
- [ ] Ficha tecnica permite revisao e correcao.
- [ ] Loading, erro, vazio e retry consistentes.
- [ ] WCAG AA validada nas jornadas criticas.
- [ ] Mobile validado com teclado virtual e viewport estreita.

### Stack de componentes

- [ ] Aplicacao, features e rotas importam UI somente por `@/components/ui`; apenas `src/components/ui` importa `@base-ui/react`.
- [ ] Catalogo possui exatamente dez wrappers, com `sheet`/`alert-dialog` ativos e os outros 36 dormentes removidos.
- [ ] Sonner e o unico especialista allowlisted e permanece atras de wrapper local; `cmdk` e `vaul` foram removidos.
- [ ] npm/`package-lock.json` sao exclusivos e arquivos Bun foram removidos.
- [ ] Source mantido e grafo direto/transitivo de producao possuem zero `@radix-ui/*` e `radix-ui`.
- [ ] Paridade comportamental, visual, acessivel, CSP e SSR/hydration foi aprovada e a excecao Radix encerrou na Fase 2.

### Operacao

- [ ] CI/CD e branch protection ativas.
- [ ] Logs, metricas, tracing e alertas ativos.
- [ ] SLOs e error budget definidos.
- [ ] Runbooks e contatos atualizados.
- [ ] Rollback testado.
- [ ] Incidente e privacidade possuem processo aprovado.
- [ ] Tabletop, revogacao emergencial e contatos fora de banda testados.
- [ ] Build, ambiente, executor, aprovador e evidencias registrados conforme §26.1.

### Privacidade

- [ ] Inventario, finalidade e bases legais aprovados.
- [ ] Aviso de privacidade publicado antes de coleta externa.
- [ ] DPA, suboperadores e transferencia internacional documentados.
- [ ] Exportacao, correcao e exclusao testadas ponta a ponta.
- [ ] Canal, SLA e demais direitos aplicaveis do titular estao operacionais.
- [ ] Retencao de chat, logs, auditoria e backups implementada.
- [ ] Processo de incidente atende ao prazo regulatorio vigente.

---

## 29. Primeiros Epicos Recomendados

| Ordem | Epico | Entrega principal |
|---|---|---|
| 1 | Contencao de seguranca | Chat sem XSS, headers, secrets e erros seguros |
| 2 | Correcao financeira imediata | Sem zeros silenciosos, `Infinity`, volume ficticio ou preco arbitrario |
| 3 | Estado conversacional | Conversa persistente, maquina de estados, tools validadas e idempotencia |
| 4 | Integridade do banco | Constraints, tenant composto, indices e testes RLS |
| 5 | Plataforma de qualidade | CI, testes, runtime fixo, scans e migrations verificadas |
| 6 | Ficha tecnica | Revisao, edicao, completude e historico do produto |
| 7 | Motor financeiro 2.0 | Decimal, unidades, despesas variaveis, preco e mix |
| 8 | Experiencia e acessibilidade | Async states, formularios, drawer, WCAG e mobile |
| 9 | Consolidacao do stack de UI | shadcn/Base UI exclusivo, dez wrappers, npm-only e zero Radix |
| 10 | Operacao e LGPD | Telemetria, SLOs, retencao, direitos e incidentes |
| 11 | Beta seguro | Carga, pentest, restore, rollout e monitoramento |

---

## 30. Resultado Esperado

Ao concluir este plano, o sistema devera:

- Cadastrar produtos por conversa sem perder contexto ou duplicar dados.
- Permitir revisao humana antes da conclusao.
- Calcular com precisao decimal e regras versionadas.
- Recusar resultados quando os dados forem insuficientes.
- Explicar premissas e diferenciar dado real de simulacao.
- Isolar usuarios no servidor, banco e relacionamentos.
- Resistir a XSS, abuso de IA, prompt injection, vazamento de segredo e IDOR.
- Proteger dados conforme principios da LGPD.
- Ser acessivel em desktop, mobile, teclado e leitor de tela.
- Usar shadcn/ui sobre Base UI como unica camada reutilizavel, por wrappers locais governados, com catalogo de dez componentes, npm-only e zero Radix em producao.
- Possuir testes, auditoria, observabilidade, backup, rollback e resposta a incidentes.
- Entregar recomendacoes financeiras rastreaveis e reproduziveis, sem depender do raciocinio matematico da IA.

Este resultado deve ser comprovado por evidencias de teste, metricas, auditorias e aprovacao dos gates, nao apenas pela existencia de codigo ou telas.
