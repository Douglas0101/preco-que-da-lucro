# Análise avançada — Bloco 3 × Plano Mestre (2026-09-20)

> **Proveniência:** texto transcrito da mensagem do operador na sessão de 2026-09-20 (o documento
> não existia em disco — busca em repo, `$HOME` e `/tmp` com `fd` não encontrou; a análise apontava
> um viewer externo). Transcrição **sem edição de conteúdo**; apenas a formatação foi normalizada
> para markdown do repositório. Ponteiros de seção/arquivo citados são da análise original.

---

Li o plano mestre na íntegra (2.559 linhas) e cruzei com o status do Bloco 3. Antes da análise,
validei dois pontos técnicos contra documentação atual — o estado do pooling do Neon (limitações de
`SET`/`PREPARE`/`LISTEN`) e o status dos componentes do OTel JS — porque ambos impactam decisões do
plano. Segue a análise completa.

## 1. Forense do próprio status (o relato se auto-consiste?)

- **A fórmula do placar é reconstruível exatamente:** `86,36%` não é `150/187` (80,21%) nem
  `(150+23)/187` (92,51%) — é **`(D + P/2)/187 = 161,5/187 = 86,3636…%`**. Ou seja, P conta meio
  crédito, NS/UNV zero. A conta fecha ao dígito; recomendo explicitar a fórmula no journal, porque
  "parcial" sem definição vira ambiguidade de auditoria.
- **Inconsistência de registro (taxonomia CORR):** a tabela diz WP4 `0 CORR` e WP5 `1 CORR`, mas a
  narrativa descreve **2 correções forçadas em cada** (WP4: N2 GREEN só por exit + N3 sem
  precondição; WP5: N1 sleep + N2 `window.va`). Só o WP3 bate (2 CORR = N1+N3). Ou a coluna CORR
  mede _claims de evidência_ e as notas N são outra categoria (e o journal precisa definir isso),
  ou houve erro de contagem a retificar.
- **`0 R · 0 U` em três WPs seguidos** merece virar meta-métrica: pode ser virtude do fatiamento
  (escopos pequenos) ou calibração frouxa do adversário. Se permanecer zerado enquanto existem
  14 NS/UNV no ledger geral, as camadas de auditoria estão desacopladas.
- **"Fechado e publicado" × `main` intocado:** coerente com o fluxo develop-first, mas significa
  publicado _em develop_. A divergência develop↔main cresce a cada bloco — vale definir gatilho
  explícito de release-readiness (precedente: `2026-08-27`).

## 2. Padrão sistêmico: o S6 está caçando **harness vacuoso**, não bugs

Das 7 correções forçadas nos três WPs, **6 são defeitos de identidade do teste** (falsificação que
aceitava qualquer falha; restauro que passava com `-1`; GREEN decidido só por exit code; sem
precondição de estado; sleep fixo; asserção inerte) e **0 são de código de produto**. Leitura: o
produto está sólido, mas o estilo default de escrita de testes produz verde falso — o S6 é carga
estrutural, não redundância. Risco de escala: ~2 correções de harness por WP torna o S6 gargalo.
Mitigação: **checklist anti-vacuoso no template do WP** (controle negativo obrigatório; fronteira
testada nas duas direções; proibido exit-code-only, sleep fixo e valores degenerados na identidade
da falsificação; sentinela semeada por cenário — o `23503` do WP4 é o modelo).

## 3. Risco das dívidas — uma delas não é técnica, é de conformidade

**WP4 N1 (purga residual fora dos 5 sítios)** é qualitativamente diferente das demais: o §15.2 do
plano lista **9 tabelas `ai_*`** (memories, sources, versions, conflicts, embeddings, access_log,
policies, conversations, messages). Se a purga cobre 5 sítios, os candidatos naturais a resíduo são
justamente `access_log` e `versions` — logs/históricos que "não parecem dado" mas contêm deriváveis.
Isso toca o gate §43 (delete/export antes de memória semântica) e LGPD art. 18 (eliminação). Detalhe
avançado: mesmo com purga total, a **janela de PITR/history retention do Neon** mantém o estado
anterior recuperável — a política de eliminação precisa cobrir isso explicitamente. **Teste de
fechamento por descoberta, não por lista:** canário com constante mágica única em _cada_ store,
varredura do catálogo inteiro pós-purga, e fail-by-default se tabela nova nascer fora do raio da
purga. As demais dívidas (piso do runner, invariante unidirecional, container/scratch) são
fechamentos baratos — mas o controle negativo do WP5 deve ser **pinado em CI permanente**, senão
apodrece. Sugestão estrutural: dívidas precisam de ID (`DBT-xx`), severidade e closure test no
backlog; dívida só no journal é dívida que some.

## 4. Lacunas do plano validadas contra documentação atual do stack

- **RLS × pooling transacional (ADR ausente, alta prioridade):** a doc vigente do Neon lista
  `SET`/`RESET` de sessão, `LISTEN/NOTIFY` e `PREPARE` SQL-level como **não suportados no endpoint
  pooled** [1](https://neon.com/docs/connect/connection-pooling). O §11.9 exige RLS mas o plano
  nunca diz _como_ o tenant chega ao Postgres — o padrão compatível é `SET LOCAL app.tenant_id`
  dentro de cada transação (o que força transação explícita em todo acesso tenant-scoped). E os
  testes de RLS do §11.9 devem rodar **no pooled**, senão provam um caminho que a produção não usa.
- **Outbox (§23):** polling é compatível; push via `LISTEN/NOTIFY` exige conexão direct — registrar
  a decisão (com `FOR UPDATE SKIP LOCKED`).
- **Prepared statements:** não mencionados no plano. SQL-level não funciona via pooler;
  protocol-level funciona (PgBouncer ≥1.22, `max_prepared_statements=1000` no Neon) — impacta
  configuração do driver (postgres.js `prepare:false` / named queries do node-pg).
- **§19.1 desatualizada:** o plano diz que logs do OTel JS estão "em desenvolvimento"; a doc oficial
  hoje lista **Traces, Metrics e Logs como Stable**. A decisão de manter logger próprio continua
  defensável, mas o motivo mudou — e isso interage com o ADR `F-otel-provider-order` (D7). No
  escopo do D7 entram também o conflito clássico `NodeSDK` × `@vercel/otel` (duplo registro de
  provider) e a ordem registro→import das instrumentações.
- **LGPD: zero menções** num produto brasileiro com chat, perfilização e memória persistente.
  Mínimo: base legal/registro de tratamento, fluxo de eliminação que alcance todas as tabelas
  `ai_*`, política de retenção × PITR, e gancho de retificação na proveniência de memória inferida
  (§15.4 já tem "inferida + confiança" — boa base).
- **Budget de IA × serverless:** o fix `csf_58b444f` (CWE-770, budget race) prova que a corrida é
  real, mas o §14.6 não prescreve mecanismo. Com Redis deferido (§39), o estado vive no Postgres:
  prescrever enforcement atômico (`UPDATE … WHERE used + x <= budget RETURNING`), nunca
  check-then-act, e reconhecer o hotspot de linha por tenant.
- **Decisões em aberto implícitas:** percent canônico (§10.2 pede e não define — contamina todos os
  golden tests), rounding mode/scale/alocação de impostos entre itens (pré-requisito silencioso de
  `sales_items` e dos property-based tests), SameSite/CSRF "conforme fluxo" (§7.2), provedor de
  identidade (§7.1).
- **SLOs sem load test, degradação sem matriz:** §29 define p95 mas o pipeline §24 não tem estágio
  de carga; §31 afirma graceful degradation sem uma matriz de testes análoga às de segurança (§32)
  e financeira (§33). E o RUM (`window.va`) agora tem prova de que _carrega_ (WP5) — falta provar
  que o dado _chega e vira alerta_.

## 5. Sequência recomendada

1. **WP `DBT-01`** — purga exaustiva de memória (fecha N1/N7 do WP4) com teste por descoberta +
   política de retenção/PITR;
2. **Checklist anti-vacuoso** no template de WP (institucionaliza as 6 lições do S6);
3. **ADR D7** (otel provider order) com escopo ampliado a logs e coexistência com RUM;
4. **ADR novo: tenant/RLS sob pooling** — bloqueia qualidade de F6/F8 se adiado;
5. Fechamentos baratos: piso do runner (WP3 N2) e controle negativo do WP5 permanente em CI;
6. **Reconciliação do ledger:** fórmula do placar, taxonomia CORR×N, retificação WP4/WP5, varredura
   dos 14 NS/UNV;
7. **Release develop→main** do Bloco 3;
8. Itens D implícitos (percent, rounding/alocação, SameSite, budget atômico);
9. Matriz de degradação + estágio de load test antes do fecho de F14.

## Veredicto

O fecho do Bloco 3 é **legítimo e bem evidenciado** — falsificação bidirecional (WP3), RED→GREEN
com sentinela (WP4) e controle negativo multi-engine (WP5) são exatamente o rigor que o plano
prega. Nada nas dívidas invalida os selos. Os três itens que merecem ação _antes_ do próximo bloco:
a purga residual (conformidade), o checklist anti-vacuidade (o S6 não pode ser o único antídoto
permanente) e os dois ADRs de infraestrutura que o stack tornou urgentes. Uma ressalva de doutrina:
os três WPs vivem em território P2/observabilidade, e o status não informa o estado do gate P0
(§41, 17 itens) — uma linha sobre isso no journal do bloco manteria o arco posicionado contra a
ordem canônica do §1.
