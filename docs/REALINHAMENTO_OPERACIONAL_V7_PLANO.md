# Preço que Dá Lucro — Realinhamento Operacional: Diretriz V7 × Plano Mestre Validado

| Campo       | Valor                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data        | 2026-08-09                                                                                                                                                              |
| Fontes      | `docs/DIRETRIZ_PRECIFICA_PRECO_QUE_DA_LUCRO_V7_SHADCN_BASEUI_SINCRONIZADO_OFICIAL.md` (V7) e `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` (Plano) |
| Precedência | Em divergência, **a V7 prevalece** (declarado no README em 2026-08-09)                                                                                                  |
| Escopo      | Dados operacionais: roadmap, prioridades, invariantes, ADRs, itens adiados, DoD/gates, SLOs/KPIs. Nenhum detalhe de fase do Plano foi reescrito                         |

## 1. Matriz de realinhamento

| Eixo          | Plano Mestre                   | V7                                | Classe                | Resolução                                                                                            |
| ------------- | ------------------------------ | --------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Macro-roadmap | F0–F15 (16 fases, §4)          | F0–F14 (15 fases, §22.1)          | V7 renumera           | Numeração canônica da V7; fases do Plano viram especificação expandida — ver §2                      |
| P0            | 15 itens (§36)                 | 17 itens (§22.2)                  | V7 expande            | Lista canônica de 17 itens — ver §3                                                                  |
| P1            | 15 itens (§37)                 | 15 itens (§22.3)                  | equivalente           | Redações distintas, mesmo conteúdo e ordem                                                           |
| P2            | 10 itens (§38)                 | 10 itens (§22.4)                  | equivalente           | Redações distintas, mesmo conteúdo e ordem                                                           |
| Invariantes   | INV-001..015 (§3)              | INV-001..022 (§25)                | V7 expande + redação  | V7 adiciona INV-016..022 (fronteira shadcn/Base UI); notas semânticas em §4                          |
| ADRs          | Repo: ADR-016, ADR-017 aceitos | V7 §24: ADR-001..018 obrigatórios | conflito de numeração | Esquema de correspondência em §5                                                                     |
| Itens adiados | §39: 10 itens de infra         | §28: produto + infra              | conjuntos disjuntos   | União canônica em §6                                                                                 |
| DoD/gates     | §41–45 (gates + DoD geral)     | §23 (DoD geral + por área + gate) | equivalente           | Sobrepostos sem contradição; gates específicos do Plano (P0, Neon, memória, HNSW) permanecem válidos |
| SLOs/KPIs     | §29 SLOs + §46 KPIs            | §21 SLOs e indicadores            | equivalente           | Valores idênticos (p95 500/800 ms; LCP ≤ 2,5 s; INP ≤ 200 ms; CLS ≤ 0,1; métricas de IA)             |

## 2. Renumeração canônica de fases (V7 §22.1)

|  V7 | Objetivo                        | Especificação expandida no Plano                                                         |
| --: | ------------------------------- | ---------------------------------------------------------------------------------------- |
|  F0 | Baseline e golden tests         | F0 (§5)                                                                                  |
|  F1 | Segurança e correção financeira | F1 (§6)                                                                                  |
|  F2 | Autenticação server-driven      | F2 (§7)                                                                                  |
|  F3 | BFF único                       | F3 (§8)                                                                                  |
|  F4 | Services + Repositories         | F4 (§9)                                                                                  |
|  F5 | Financial Engine 2.0            | F5 (§10)                                                                                 |
|  F6 | PostgreSQL hardening            | F6 (§11)                                                                                 |
|  F7 | Neon e branching                | F7 (§12)                                                                                 |
|  F8 | Migração                        | F8 (§13)                                                                                 |
|  F9 | Conversation FSM                | F9 (§14, orquestração da IA)                                                             |
| F10 | Memory Service                  | F10 (§15, memória persistente)                                                           |
| F11 | Performance                     | F11 + F12 do Plano (§16 backend + §17 frontend)                                          |
| F12 | UX                              | F13 do Plano (§18)                                                                       |
| F13 | Observabilidade                 | F14 do Plano (§19)                                                                       |
| F14 | Hardening                       | F15 do Plano (§20); resiliência/SLOs do Plano §29–31 permanecem como conteúdo de F13/F14 |

## 3. P0 canônico (V7 §22.2, 17 itens)

| V7 # | Entrega                         | Plano (15 itens, §36)           |
| ---: | ------------------------------- | ------------------------------- |
|    1 | Eliminar XSS                    | #1 XSS                          |
|    2 | Criar Result Type financeiro    | #2 Result Type                  |
|    3 | Implementar Unknown ≠ Zero      | #3 unknown ≠ zero               |
|    4 | Corrigir `NaN`/`Infinity`       | #4 NaN/Infinity                 |
|    5 | Remover volume fictício         | #5 volume fictício              |
|    6 | Remover preço `custo × 1,5`     | #6 markup arbitrário            |
|    7 | Corrigir rendimento default     | #7 yield/tax defaults (parte)   |
|    8 | Corrigir imposto default        | #7 yield/tax defaults (parte)   |
|    9 | Validar unidades                | #8 conversão incompatível       |
|   10 | Zod em tools                    | #9 tool Zod                     |
|   11 | Taxonomia de erros              | #10 error taxonomy              |
|   12 | Autorização em endpoint         | #11 auth por endpoint           |
|   13 | Sessão server-driven            | #12 remover tokens localStorage |
|   14 | Persistir estado conversacional | #13 conversation state          |
|   15 | Auditar tool executions         | #14 tool execution audit        |
|   16 | Timeout da IA                   | #15 AI timeout/budget (parte)   |
|   17 | Quota/budget                    | #15 AI timeout/budget (parte)   |

## 4. Notas semânticas dos invariantes

- **INV-009** — Plano: "transacional ou explicitamente compensável"; V7: "atômica ou idempotente". Prevalece a redação da V7; compensação permanece como mecanismo aceitável quando atomicidade/idempotência não for possível (registrado, sem afrouxar o requisito).
- **INV-008** — Plano: "jamais referencia entidade de Tenant B"; V7: "não acessa Tenant B". A redação do Plano é mais estrita (referência ≠ acesso); adotar a leitura mais estrita na implementação.
- **INV-016..022 (novos na V7)** — fronteira do design system: feature não importa Base UI/Radix diretamente; `components/ui` é a fronteira oficial; composição preserva refs/props/ARIA/handlers; atualização shadcn exige diff review + regressão; tokens semânticos prevalecem; primitive provider não contém regra financeira. Incorporados ao Plano §3.

## 5. Colisão de numeração de ADRs

O repo possui ADRs aceitos com números que colidem com o catálogo obrigatório da V7 §24:

| V7 §24  | Decisão V7                                        | Repo (`docs/adr/`)                |
| ------- | ------------------------------------------------- | --------------------------------- |
| ADR-016 | Sessão server-driven                              | ADR-016 = shadcn/ui sobre Base UI |
| ADR-017 | Neon pooled/direct                                | ADR-017 = branching strategy      |
| ADR-018 | shadcn/ui + Base UI como stack nativo obrigatório | —                                 |

Resolução: os ADRs do repo são histórico aceito e **não são renumerados**. Ao escrever os ADRs do catálogo V7, usar os próximos números livres do repo (a partir de **ADR-018**), registrando em cada um a correspondência "V7 §24 ADR-0XX". ADR-018 da V7 (stack shadcn/Base UI) já está materializado, em substância, pelo ADR-016 do repo.

## 6. União canônica de itens adiados

Produto (V7 §28): estoque completo; fluxo de caixa completo; DRE completa; WhatsApp; marketplace.
Infra (união V7 §28 + Plano §39): microservices; Kafka; Kubernetes; read replicas; HNSW imediato (busca exata primeiro); multi-region write; Redis obrigatório (Plano); partitioning (Plano); CQRS completo (Plano); event sourcing (Plano).

Critério idêntico nos dois documentos: não adotar sem evidência/métricas.

## 7. Verificação

Todos os valores citados foram conferidos por leitura direta: V7 §21–25, §28 e correções #1–17; Plano §3–4, §29, §36–39, §41–46. SLOs e KPIs não divergem em valor; divergências são de estrutura (roadmap, P0, invariantes, ADRs, adiados) e foram resolvidas conforme a precedência da V7.
