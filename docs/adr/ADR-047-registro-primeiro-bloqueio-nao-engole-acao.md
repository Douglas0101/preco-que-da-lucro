# ADR-047 — Registro primeiro: o bloqueio financeiro não engole a ação, e nenhuma entidade tem o chat como porta única

- **Status:** PROPOSTA — origem é decisão do dono em 2026-10-19, derivada do percurso de primeiro cliente medido na bancada (DBT-127; journal L970). Ratificação pendente. **Não edita a ADR-046** (ACEITA e imutável após a aceitação): segue o caminho que ela própria prevê — substituição/complemento por ADR nova.
- **Data:** 2026-10-19.
- **Escopo:** orquestração entre execução de tools e o grounding financeiro de saída; paridade de porta de entrada (manual × conversacional) para criação e edição.
- **Origem:** `docs/evidence/cu-primeiro-cliente-2026-10-19/` — mensagem densa do cliente novo → `ai.financial_output_blocked (unsupportedCount: 2)` → `UNGROUNDED_FINANCIAL_REPLY` → `products=0`, `product_ingredients=0`, `product_packaging=0`, nenhuma execução de tool, nenhuma próxima pergunta, e a copy afirmava "Os dados informados continuam registrados".
- **Complementa:** ADR-046 §2 (paridade manual), ADR-026 (grafo FSM executado), `AGENTS.md` §Security baseline → "Chat financial figures".

## Contexto

**Arquitetura real (medida, não presumida).** O consumidor de chat **não** é o Vercel AI SDK: é um laço próprio em `src/lib/chat-execution.server.ts` (`for round < AI_MAX_TOOL_ROUNDS` → `executeReservedRound` → `handleModelResponse`), com protocolo de tools nativo contra `api.deepseek.com/chat/completions` e tool protocol não-thinking explícito. Não existem `stopWhen`, `toolChoice` ou `maxSteps` no repositório. Consequência: se o modelo não devolver `tool_calls`, o turno termina em texto — e é nesse ponto que o grounding atua (`handleModelResponse`, `groundFinancialOutput(sanitized, messages)`).

**Os dois defeitos acoplados, medidos:**

1. **Nada foi registrado e a copy dizia o contrário.** O grounding era uma constante (`UNGROUNDED_FINANCIAL_REPLY`) que afirmava registro mesmo com `products=0`. O cliente lia confirmação onde não havia. É a mesma classe de defeito que a ADR-046 §1 já nomeia ("o verbo da UI é o verbo do servidor"): rótulo que promete o que o comportamento não entrega.
2. **O turno inteiro era engolido.** A resposta substituta descartava a resposta do modelo **e** não trazia continuidade: sem registro, sem próxima pergunta, sem caminho. Para um cliente de primeira viagem — que é justamente quem chega com os dados — o fluxo travava no primeiro turno com dados.

**Fato de fronteira que a medição fixou:** mensagem **sem** figuras → resposta conversacional normal, sem bloqueio; mensagem **com** as figuras do próprio usuário → bloqueio. O guarda-corpo atingia o perfil mais valioso.

## Decisão

### 1. O bloqueio de output financeiro não engole a ação

- O grounding atua **somente na resposta final**. Execução de tool nunca é bloqueada por ele: tool válida com dado bruto informado **executa**, e o resultado é **evidência do turno**.
- A resposta substituta é **derivada do que o turno registrou de fato** (tools com `ok:true`, identificadas pelo `tool_call_id`), nunca uma constante:
  - **com registro** → confirma o que foi registrado, por rótulo de entidade, **sem números**, e mantém o caminho vivo;
  - **sem registro** → declara explicitamente que **nada foi registrado** neste turno e oferece as saídas reais (dado bruto, cadastro manual, Diagnóstico/Simulações).
- Propriedades obrigatórias da substituição: **determinística** (sem chamada extra ao modelo), **sem figuras** (nem dígitos) e **par negativo preservado** — figura sem lastro continua bloqueada e logada com `unsupportedCount > 0`.
- Ordem canônica do intake: **dado bruto entra primeiro; cálculo vem depois, e só pelo motor financeiro.** Isso é regra explícita no system prompt (`REGRAS INEGOCIÁVEIS`, item 9), não expectativa implícita.

### 2. Paridade de porta de entrada (criação e edição)

- **Nenhuma entidade pode ter o chat como única porta de criação.** Todo fluxo de intake via IA precisa de **formulário manual equivalente**, alimentando o mesmo modelo de dados com as **mesmas regras de validação**.
- O **empty state** da entidade oferece as duas rotas, com affordance visível (padrão do repo: shadcn/ui sobre Base UI; consultar `llms.txt` antes do trabalho de front).
- **Critério de aceitação para toda tool nova:** (a) existe caminho manual equivalente; (b) o empty state oferece as duas rotas; (c) validação equivalente nos dois caminhos. Tool nova sem (a)–(c) não entra no `TOOL_REGISTRY`.

## Consequências

- **Positivas:** o cliente que chega com dados deixa de ser engolido; a copy passa a ser contrato também no caminho bloqueado; a liberdade manual deixa de depender do chat.
- **Negativas:** o registro passa a depender de o modelo chamar as tools (mitigado pela regra 9 do prompt e pelo tratamento não destrutivo do turno bloqueado); o formulário manual é UI nova.
- **Neutras:** o bloqueio **continua bloqueando** — o que muda é que ele deixa de destruir o turno.

## Riscos e questões abertas

1. **A "próxima pergunta" da substituição é determinística** (não gerada pelo modelo, para não pagar chamada extra). Se a UX exigir a pergunta específica do campo faltante, é decisão nova (custo de uma chamada adicional × tabela de campos faltantes).
2. **Escopo do formulário manual:** só a criação ou também os filhos? A ADR-046 §2 já ordena a prioridade por pureza da violação.
3. **Verificação de e-mail** (achado de UX do mesmo percurso: toast efêmero, sem estado persistente nem reenviar; atalho de desenvolvimento restrito) fica como item próprio, fora desta ADR.

## Implementação nesta janela (parcial e declarada)

- **Feito:** §1 — resposta substituta derivada do turno + regra 9 do system prompt, com testes em `src/test/chat-financial-grounding-reply.test.ts` (6 casos: sem registro, com registro, tool falha, ausência de figuras na copy, par negativo preservado, contrato do prompt).
- **Pendente (nomeado, não presumido):** §2 (formulário manual com paridade) e o item 3 dos riscos.
