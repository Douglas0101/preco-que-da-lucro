# SPEC — bateria de caça a bugs profunda (2026-10-21)

> **Natureza:** este `SPEC.md` foi publicado **na própria janela da bateria** (2026-10-21), e
> descreve o pacote **como ele foi planejado e como foi executado**. O `README.md` é o registro do
> resultado.
>
> **Selo:** `MANIFEST.sha256` + este `SPEC.md` publicados nesta janela.
> **S6 adversarial de contexto limpo NÃO foi executado** — o `README.md` declara isso explicitamente
> na §Riscos. Nada de selo foi simulado.

## 1. Fato-fonte

- Pedido do dono, em sessão: "Caça a Bugs Profunda e Regressão Pré-Commit", com 5 frentes
  (bundle/performance, visual/acessibilidade, integração/resiliência, exploratório SFDPOT,
  segurança OWASP) e foco declarado em **achar bugs reais**, não em confirmar que a suíte passa.
- Journal `docs/evidence/agent-state/PROGRESS.md` — a entrada desta bateria é a linha de
  intenção e a linha de fecho (ver §6).
- Bateria precedente `docs/evidence/otimizacoes-planejamento/deep-2026-10-20/` (journal `L976`
  /`L977`) — o que **já** era fato medido, usado para distinguir _regressão_ de _nunca funcionou_.
- Onda 1 (journal `L975`) — os números de bundle que a Fase 1 deveria confirmar.
- `docs/evidence/agent-state/DEBTS.md` — o registry de dívidas, onde os achados entraram como
  `DBT-148..DBT-172`.

## 2. Problema (medido, não presumido)

O repositório passou por otimizações (Onda 1: lazy do `<Toaster>`, OTel lazy, correções de WebKit,
fechamento de dívidas UI/DT/OB) e por uma bateria de regressão profunda em 2026-10-20. O que
**não** existia era:

1. **Nenhuma verificação independente** de que os ganhos da Onda 1 ainda valiam, nem de que as
   correções não introduziram defeito.
2. **Nenhuma baseline de pixel** no projeto — `e2e/visual/` continha apenas asserções de
   invariante, então nenhuma mudança de layout podia ser detectada por diff.
3. **Nenhum gate de acessibilidade** sobre `/produtos`, rota onde a DBT-123 já tinha medido
   contraste abaixo de AA.
4. **Nenhum dado** sobre exclusão de despesa, exclusão de produto, ou o caminho de preço de
   mercado sem chat — fluxos que ninguém tinha exercitado no browser.
5. **Nenhuma** prova empírica de clickjacking nem de isolamento entre tenants do ponto de vista
   do papel de runtime.

## 3. Contrato (invariante falsificável)

> Antes de qualquer commit ou push, a bateria responde com **número medido**, não com opinião:
> para cada uma das 5 frentes existe uma medição reproduzível; cada defeito encontrado tem
> severidade, passos de reprodução e evidência; nenhum achado é aceito sem par de controle; e o
> que **não** foi possível medir é **declarado**, não omitido.

Sub-contratos por frente:

| frente                     | invariante falsificável                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — bundle/perf            | o grafo inicial, o entry e o gzip medidos batem com a Onda 1 **ou** a divergência tem causa provada; o app carrega normalmente com o exportador de telemetria inalcançável                                                                                                                        |
| 2 — visual/a11y            | baselines de pixel determinísticas em 3 engines; **zero** violações WCAG 2.2 AA nas 6 rotas em light **e** dark; foco visível, preso em modal e devolvido ao gatilho                                                                                                                              |
| 3 — integração/resiliência | `toast()` não é chamado fora das rotas que montam `<Toaster>`; o guard de e-mail recusa **sem** criar usuário; o motor financeiro não produz `NaN`/`Infinity` e é invariante frente a fuso; o chat cria o produto e não inventa número; falha de API mostra erro e permite retry, sem tela branca |
| 4 — exploratório           | as 6 dimensões de SFDPOT cobertas em todas as rotas, com "não achado" explícito; os 3 tours executados                                                                                                                                                                                            |
| 5 — segurança              | rota protegida sem sessão não entrega conteúdo; tenant A não alcança dado de B **na API e no banco**; payload de script e SQL não executam; header de framing efetivo; erro não vaza dado interno                                                                                                 |

## 4. Mudanças (o que esta janela mudou)

| o que                                     | onde                                        | por quê                                                                                                   |
| ----------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **25 dívidas novas** (`DBT-148..DBT-172`) | `docs/evidence/agent-state/DEBTS.md`        | todo defeito real encontrado, com closure test                                                            |
| **Pacote de evidência**                   | `docs/evidence/bug-hunt/`                   | `SPEC.md` + `README.md` + `MANIFEST.sha256` + `captures/` + `screenshots/` curadas + `bundle-report.html` |
| **Relatório HTML do bundle**              | `docs/evidence/bug-hunt/bundle-report.html` | o prompt pedia `rollup-plugin-visualizer`; a dependência **não** foi adicionada (ver §6, Riscos)          |

### O que **não** mudou

- **Nenhum arquivo de produção** (`src/**`, `scripts/**`, `e2e/**`, `vite.config.ts`).
- **Nenhum** `package.json`/`package-lock.json` — nenhuma dependência nova.
- **Nenhum** ADR novo; nenhuma alteração de ADR existente.
- **Nenhum** commit, push, tag, branch, merge, deploy, alias, migration remota.
- **Nenhuma** alteração de dívida **existente** — as dívidas anteriores foram lidas, reconfirmadas
  ou referenciadas, nunca enfraquecidas. A `DBT-123` foi **reconfirmada** (mesmos números), e a
  lacuna de cobertura do gate virou dívida **nova** (`DBT-159`), sem mexer na `DBT-123`.
- **Nenhuma** linha do tenant semeado (`00000000-0000-4000-8000-000000000002`) tocada.
- **Nenhuma** variável de ambiente com valor de segredo lido, impresso ou gravado.

## 5. DoD (critérios binários, com o artefato que prova)

| etapa    | como foi provada                                                                                                                                                                  | artefato                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| ambiente | branch `develop`, HEAD `363eb43`, container PG17 healthy, `npm ci --ignore-scripts` verde, build verde, seed verde, preview `:4173` respondendo 200 e `/api/health/ready` = ready | `captures/a-bundle-check.txt` e o journal |
| Fase 1   | `check:bundle` reproduzido; HTML gerado sem dependência nova; Lighthouse medido nos 2 form factors; OTel offline sem degradação                                                   | `captures/a-*`                            |
| Fase 2   | 24 baselines byte-idênticas entre 2 gerações; spec verde 3× contra a própria baseline; 36 varreduras axe; 36 amostras de teclado                                                  | `captures/b-*`                            |
| Fase 3   | 33 call sites de `toast()` enumerados por rota; 503 com contagem de usuários inalterada; dízima e 4 fusos; 1 turno real; 3 modos de falha                                         | `captures/c-*`                            |
| Fase 4   | 6 dimensões × 12 rotas; 3 tours; 14 achados; 4 tenants purgados                                                                                                                   | `captures/d-*`                            |
| Fase 5   | 9 rotas de auth; 2 tenants nos 2 níveis; 30 injeções; headers com prova empírica; 23 respostas varridas                                                                           | `captures/e-*`                            |
| registry | `m02-debts-guard` verde com 155 dívidas (117 ABERTA) e a prosa da contagem atualizada                                                                                             | `docs/evidence/agent-state/DEBTS.md`      |
| selo     | `MANIFEST.sha256` com `checked === discovered`; `m02:work-package-guard` verde                                                                                                    | `MANIFEST.sha256`                         |

## 6. Testes (e o que o pacote prova)

O pacote **não** é uma suíte: é a evidência de uma bateria. O que ele prova, e o que ele **não**
prova, está na §7 do `README.md` e na seção de limites declarados.

### Journal

A intenção e o fecho foram registrados em `docs/evidence/agent-state/PROGRESS.md` (entradas
`▶` e `✔`), com o estado do bench, as portas usadas por cada agente e a lista das dívidas
criadas.

## 7. Riscos e limites declarados

1. **S6 adversarial de contexto limpo NÃO foi executado.** Nenhum verificador independente
   reexecutou este pacote em contexto limpo. O checklist anti-vacuoso está **auto-declarado** na
   §3 do `README.md`, com o KPI `capturados pelo autor / total` — mas isso mede **prevenção**,
   **não** verificação adversarial.
2. **A precondição de worktree limpo do selo NÃO foi satisfeita.** `scripts/m02-seal.mjs` exige
   `git status` sem drift fora do diretório selado; nesta sessão isso é insatisfazível (WIP
   alheio preservado por custódia + commit proibido pelo pedido). O `MANIFEST.sha256` foi gerado
   pelo **script real** num repositório git isolado e limpo, com os **mesmos bytes** do pacote
   ⇒ conteúdo e hashes genuínos (81/81 conferidos contra o repo real), mas a afirmação "o
   pacote foi construído a partir de uma árvore limpa" **é falsa** e fica declarada, não
   presumida.
3. **O `rollup-plugin-visualizer` não foi adicionado.** Ele não é dependência do projeto;
   adicioná-la mutaria `package.json` + `package-lock.json` e colidiria com o guard
   `m02:lockfile-guard` (já vermelho por WIP alheio). O relatório HTML foi gerado a partir do
   manifest do Vite, sem dependência nova. **O HTML não é um treemap interativo** — é uma
   tabela/treemap estático.
4. **A árvore de trabalho estava suja** (~46 arquivos modificados + 8 não rastreados) por WIP de
   outra sessão, **preservado intacto**. Isso significa que as medições são do **estado do
   worktree**, não do commit `363eb43`. A diferença de bundle de **+15 B** foi **atribuída** ao
   WIP não commitado (bisect por SHA), não ao patch do `vite` — a hipótese do enunciado foi
   **refutada** por medição.
5. **`m02:lockfile-guard` permaneceu vermelho**, por WIP alheio e por contrato do próprio guard.
   Não foi tocado.
6. **Nenhuma medição em produção.** Vercel, Neon remoto, Hostinger e GitHub não foram
   acionados. As conclusões de código (ex.: `x-frame-options` ausente) valem para produção; a
   observação em produção **não** foi medida.
7. **Um turno de IA real** foi gasto (13.138 tokens, US$ 0,0049) na Fase 3, sob a decisão do
   dono registrada em `L969`. O resto da bateria rodou no ramo **controlado** (custo zero).
8. **A bateria anterior (`deep-2026-10-20`) não foi reexecutada** — o que é fato medido foi
   **reconfirmado** quando a medição era barata e barata de reexecutar (finanças, grounding,
   `age_days`), e declarado como reconfirmação quando não era.

## 8. Rollback

Nada a desfazer em Git — **nenhum commit** foi feito. O que a janela adicionou ao disco:

| artefato                                          | como desfazer                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/evidence/bug-hunt/`                         | remover o diretório (é evidência, não fonte)                                                |
| `docs/evidence/visual/bug-hunt-2026-10-21/`       | remover (é gitignored, saída bruta de run)                                                  |
| 25 linhas em `docs/evidence/agent-state/DEBTS.md` | remover as linhas `DBT-148..DBT-172` e restaurar a prosa da contagem para 130 = 92 + 35 + 3 |
| entradas de journal em `PROGRESS.md`              | o journal é **append-only**: corrigir por **errata declarada**, nunca por reescrita         |

O banco local de teste recebeu linhas de 4 tenants de teste, **todas purgadas** com contagem
antes/depois capturada; o tenant semeado está intacto (2 produtos, 2 despesas).
