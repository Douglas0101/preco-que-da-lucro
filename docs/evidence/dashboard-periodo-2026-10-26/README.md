# WP `dashboard-periodo-2026-10-26` — janela de período financeira

- Pacote: `docs/evidence/dashboard-periodo-2026-10-26/` (`SPEC.md`, este `README.md`, `captures/`, `MANIFEST.sha256`).
- ADR: `docs/adr/ADR-049-janela-de-periodo-financeira.md` (**ACEITA**, 2026-10-26).
- Estado: **F1 RED ✔ · F2 GREEN ✔ · F3 UI+E2E ✔ · F4 governança ✔ (documentação) · F5 (commit/push) não executada**.
- Nenhum commit foi feito. Nenhum arquivo de `src/`, `e2e/` ou `scripts/` foi alterado nesta fase.

## Resumo executivo

**Problema.** O seletor Mês/Trimestre/Ano de `/inicio` somava vendas de **qualquer data posterior** ao início do
período (venda futura entrava em todos os períodos), calculava a fronteira no **fuso do processo** (em UTC, o
mês começava 21:00 BRT do dia anterior), não exibia a janela que havia consultado e colocava **despesa mensal**
ao lado de faturamento **trimestral** sem rótulo de unidade. A troca de período desmontava a página inteira
(inclusive o seletor) e o estado vazio aparecia como "DADOS INCOMPLETOS".

**Solução.** Janela `[from, to)` em `America/Sao_Paulo` calculada por `Intl` (`src/lib/period-window.ts`), `to`
obrigatório nas duas agregações (`lt`), `window` atestado no payload, dois grupos na tela (invariante ×
realizado), badge `SEM VENDAS` para vazio, `keepPreviousData` + `aria-busy` para não desmontar o seletor.

**Prova.** 12 testes unitários da janela (3 fusos), 8 de banco (4 tenants de fronteira), 5 e2e (E1–E5) verdes
em chromium/firefox/webkit/mobile, **dois controles negativos por mutação** e 2470 testes unitários verdes.

## O que foi entregue

| Fase                 | Entrega                                                                             | Prova                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| F1 RED               | módulo com o comportamento legado movido _verbatim_, T1–T7 e 4 tenants de fronteira | `captures/f1-red-unit-tz-utc.txt` (7 falhas), `f1-red-unit-tz-brt.txt` (2), `f1-red-db.txt` (2)      |
| F2 GREEN             | `periodWindow`/`periodEnd`, `lt(to)` nas duas consultas, `window` no payload        | `captures/f2-green-unit-scope.txt` (81/81), `f2-green-db.txt` (8/8), `f2-green-unit-full.txt` (2470) |
| F2 correção          | defeito `to = startMonth + 1` (trimestre/ano com 1 mês) detectado e corrigido       | `captures/f2-mutation-to-rejects.txt`                                                                |
| F3 UI+E2E            | dois grupos, rótulo da janela, `SEM VENDAS`, `aria-busy`, E1–E5                     | `captures/f3-e2e-chromium.txt` (7/7), `f3-e2e-matrix.txt` (133/3/0)                                  |
| F3 controle negativo | sem `keepPreviousData`, E3 e E5 reprovam; restaurado, passam                        | `captures/f3-negative-control-mutation.txt`, `f3-negative-control-restored.txt`                      |
| F4                   | ADR-049, este README, DEBTS 173–176, selo                                           | `MANIFEST.sha256` + `sha256sum -c`                                                                   |

## Passada de computer user (F5, antes do commit)

Executada no servidor de desenvolvimento (`http://localhost:8080`, o código que será commitado) por um script que lê o
kit de fixture (`.artifacts/e2e-local.env`) e dirige o Chromium — o segredo nunca entra no contexto do agente:

**25/25 checks `PASS`, exit 0** (`captures/f5-cu-walk.txt`), com capturas `playwright-mcp/inicio-desktop.png` e
`playwright-mcp/inicio-mobile-360.png`.

| Grupo                 | Verificado                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — `/inicio` desktop | duas seções (`Seu negócio agora` \| `Realizado no período`), `aria-busy="false"`, janela `01/10/2026 – 31/10/2026`, `SEM VENDAS` presente e `DADOS INCOMPLETOS` ausente, 3 rótulos "Não varia por período", 0 px de overflow |
| B — teclado           | `aria-pressed` no Trimestre, **`activeElement` continua o botão** (DBT-165), **grupo não desmontou** (`isConnected=true`), janela do trimestre `01/10 – 31/12`, selo de coincidência, `aria-busy` observado em frame         |
| C — mouse             | foco no "Ano" após o clique, janela do ano `01/01 – 31/12`                                                                                                                                                                   |
| D — mobile 360×640    | 0 px de overflow em `/inicio` e `/produtos`                                                                                                                                                                                  |
| E — rotas vizinhas    | `/vendas`, `/diagnostico`, `/ponto-equilibrio` com heading próprio                                                                                                                                                           |
| F — higiene           | **0 erros de console** e **0 respostas ≥ 400**                                                                                                                                                                               |

Dois achados do próprio harness, corrigidos no caminho (e que valem para quem repetir a bancada):
`npm run e2e:prepare` **re-semeia a senha do usuário demo** a partir do kit, então a credencial documentada em sessões
anteriores fica obsoleta; e o sign-in por API exige `origin` igual ao `BETTER_AUTH_URL` do `.env`
(`http://localhost:8080`) — com `127.0.0.1` o guard responde **403**, sem sessão, e toda rota cai em `/auth`.

## Checklist anti-vacioso (17 itens, demonstrados)

| #   | Item                                   | Como foi satisfeito                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo                      | T7a prova que o regex de mutadores locais **reprova** um `setHours(` plantado; mutação de F2 (`endIndex = startMonth - 1 + 1`) reprova T9/T10; mutação de F3 (remover `keepPreviousData`) reprova E3/E5.                                                                                                                           |
| 2   | Fronteira nas duas direções            | D-start (início inclusivo) e D-end (`to` exclusivo) no banco; no guard, T7b proíbe o mutador local **e** T7c exige o símbolo do fuso — os dois lados.                                                                                                                                                                              |
| 3   | Identidade, não cardinalidade          | Cada caso assere instante ISO literal (T1–T10) ou valor exato (`20.0000 → 0`, `40.0000 → 0`); o runner de banco exige os **títulos** dos 8 casos.                                                                                                                                                                                  |
| 4   | Proibido exit-code-only                | Toda falha carrega esperado × recebido; as capturas RED mostram os valores observados (`{revenue:'40.0000',count:1}`).                                                                                                                                                                                                             |
| 5   | Proibido sleep fixo como sincronização | E5 usa `page.route` com atraso **determinístico** de 600 ms apenas para alargar a janela observável do placeholder; a asserção é `toHaveAttribute`/`toContainText` com auto-retry e **não depende da duração**. Limite declarado: o atraso é fixo por desenho; os `sleep` de boot existem só nos scripts de bancada, não em teste. |
| 6   | Sem valor degenerado na identidade     | Nenhum caso usa `""`, `0` ou `—` como identidade: as identidades são instantes ISO e valores monetários concretos.                                                                                                                                                                                                                 |
| 7   | Precondição de estado compartilhado    | O runner de banco exige `DATABASE_ADMIN_URL`/`DATABASE_URL`, **0 pendentes** e os 8 títulos; os tenants do WP (`…-e5..e8`) são exclusivos e o tenant demo nunca recebe venda.                                                                                                                                                      |
| 8   | Sentinela real por cenário             | Cada tenant de fronteira tem **um** instante e **um** valor (10/20/40/80), então vazamento entre tenants aparece como soma errada, não como "passou".                                                                                                                                                                              |
| 9   | Fingerprint de revisão                 | As capturas carregam `HEAD=ec0ed77ee963…` e `sha256` dos arquivos tocados; o RED de F1 rodou os bytes do pai (módulo com o comportamento legado).                                                                                                                                                                                  |
| 10  | `checked === discovered`               | O selo é gerado por `scripts/m02-seal.mjs`, que **descobre por filesystem** (não por lista), exige `SPEC.md`/`README.md`, reprova descoberta vazia e compara manifesto × arquivos.                                                                                                                                                 |
| 11  | S6 adversarial de contexto limpo       | **NÃO EXECUTADO** nesta sessão — não havia lane adversarial independente disponível. Declarado: nenhum item deste WP foi verificado por S6, e nenhum `0 REJECTED` é reivindicado.                                                                                                                                                  |
| 12  | Falha alta (fail-closed)               | `periodWindow` lança `PERIOD_WINDOW_INVALID_INSTANT`/`PERIOD_WINDOW_INVALID_PART` em vez de devolver janela vazia; o guard de shape recusa payload incompleto; `dbPrecondition` falha em vez de pular.                                                                                                                             |
| 13  | Isolamento de bancada assertado        | Container PG17 local (`127.0.0.1:5432`, host conferido sem imprimir credencial); e2e contra preview local com `.env` loopback; nenhuma query em produção.                                                                                                                                                                          |
| 14  | Todo check impresso tem gate e captura | Cada número citado neste README aponta para um arquivo em `captures/`; os guards citados têm a saída no relato da sessão.                                                                                                                                                                                                          |
| 15  | Run de CI atado ao commit selado       | **N/A-trigger**: nada foi commitado nem enviado; não existe run para citar, e nenhum selo `run@sha` é usado.                                                                                                                                                                                                                       |
| 16  | Descoberta multi-sítio                 | Consumidores de `periodStart` enumerados por grep (serviço + teste) e de `dashboardSummaryQueryOptions` (rota + loader test); a matriz M-02 foi regenerada na F2 e conferida na F3.                                                                                                                                                |
| 17  | Precondição de estado ambiente         | O RED é **condicional ao fuso** (passa em BRT, falha em UTC) e isso está declarado; a bancada exige seed + build + preview; o gate completo está bloqueado por WIP herdado (abaixo).                                                                                                                                               |

## Rastreabilidade (requisito → teste → arquivo)

| Requisito                                          | Teste                                                                                                                  | Arquivo                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| FR-PER-001 janela `[from, to)` nas duas agregações | D1–D5; T9/T10                                                                                                          | `src/server/repositories/sales.repository.ts`, `src/test/dashboard-consolidated-margin.db.test.ts` |
| FR-PER-002 fuso do negócio independente do `TZ`    | T1–T6 (3 fusos)                                                                                                        | `src/lib/period-window.ts`, `src/test/period-window.test.ts`                                       |
| FR-PER-003 janela exibida, atestada no payload     | E2; D (window)                                                                                                         | `src/routes/_authenticated/inicio.tsx`, `src/server/services/dashboard.service.ts`                 |
| FR-PER-004 separação invariante × realizado        | E4/E2; medição no browser                                                                                              | `src/routes/_authenticated/inicio.tsx`                                                             |
| FR-PER-005 `empty` ≠ `incomplete`                  | E4; visual (badge)                                                                                                     | `inicio.tsx`, `e2e/visual/visual-observability.spec.ts`                                            |
| FR-PER-006 guard de coerência `period`×payload     | **forma** implementada na F6 (`window` obrigatório); coerência de período é exibição, não guarda (**DBT-176 fechada**) | `src/lib/dashboard-summary-guard.ts`                                                               |
| RNF-PER-001 sem dependência nova                   | `guard:upgrade`, `check:bundle`                                                                                        | `package.json` (inalterado)                                                                        |
| RNF-PER-002 foco preservado (DBT-165)              | E3 (4 projetos)                                                                                                        | `e2e/sales-dashboard.spec.ts`                                                                      |
| RNF-PER-003 mesmas duas consultas                  | revisão + D1–D5                                                                                                        | `sales.repository.ts`                                                                              |
| RNF-PER-004 bundle dentro do limite                | `check:bundle` (487.577 B ≤ 500.000)                                                                                   | `scripts/check-bundle.mjs`                                                                         |
| RNF-PER-005 determinismo sob `TZ`                  | T1–T10 em UTC/Asia/Tokyo/BRT                                                                                           | `src/test/period-window.test.ts`                                                                   |
| INV-006/007 número antigo nunca como atual         | E5 (`aria-busy` + rótulo antigo)                                                                                       | `inicio.tsx`, `src/lib/query-options.ts`                                                           |

## Decisões abertas resolvidas

1. **Despesas fixas** → card **"Despesas fixas por mês"**, invariante, sem multiplicação por 3/12. Motivo: o
   trimestre/ano em curso não tem meses futuros realizados; multiplicar presumiria compromisso não registrado.
   Alinha `/despesas` e `/ponto-equilibrio`, que já rotulavam "/ mês".
2. **Trimestre ≡ mês** (primeiro mês do trimestre) → selo condicional **"Coincidente com o mês atual"**, sem
   desabilitar a opção. Motivo: a coincidência é verdade de calendário, não erro; esconder a opção impediria o
   usuário de ver que a janela é a mesma.
3. **Badge do vazio** → **"SEM VENDAS"** (neutral); `DADOS INCOMPLETOS` fica reservado a `incomplete`
   (ADR-041 §3).

## Desvios declarados

| #   | Desvio                                                                       | Justificativa                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Seletor continua `role="group"` de botões com `aria-pressed`, não `<Select>` | trocar quebraria os e2e existentes e o contrato de foco que a DBT-165 mede; o grupo já é acessível por teclado                                                                                                                   |
| 2   | E2 não usa data fixa (`01/10/2026 – 31/10/2026`)                             | data fixa mentiria a partir de 01/11; a janela é derivada por oráculo BRT independente                                                                                                                                           |
| 3   | E1 condiciona a expectativa de "Ano" em janeiro                              | em janeiro o mês anterior pertence ao ano anterior; a expectativa vem do calendário                                                                                                                                              |
| 4   | Card de maior margem permanece como destaque abaixo dos grupos               | é card largo com explicação, não tile; recebeu rótulo "Não varia por período"                                                                                                                                                    |
| 5   | E4 não simula `incomplete` no dashboard                                      | exigiria produto sem custo + venda (fixture frágil); `incomplete` está provado no banco e no visual de produto, e o e2e assere o negativo                                                                                        |
| 6   | README do WP vive no próprio pacote de evidência                             | o template e o `m02-seal.mjs` exigem `SPEC.md` + `README.md` no mesmo diretório; separar em `docs/specs/` quebraria o selo                                                                                                       |
| 7   | `periodStart` **não** foi removido                                           | a premissa do prompt não se confirmou: ele continua como atalho de `periodWindow`; o que saiu foi o re-export local no serviço                                                                                                   |
| 8   | `window` **não** era exigido pelo guard                                      | **Resolvido na F6** após o achado P2 do review do PR #72: guard exige `window`; a comparação de `period` foi removida porque E3/E5 reprovam com `keepPreviousData` (run 40275083772), com controle negativo; **DBT-176 FECHADA** |

## Bloqueio herdado

`npm run check` **para em `m02:lockfile-guard`**: `package.json` e `package-lock.json` carregam o WIP do `motion`
de outra sessão, não commitado. O hint do guard pede `git checkout -- package.json package-lock.json`, proibido
(custódia de WIP alheio). Evidência: `captures/f3-check-lockfile-inherited.txt`. O caminho previsto no `AGENTS.md`
foi seguido — `check:own` (exit 0), `npm run test` (2470/2470), `npm run build` (0), `npm run check:bundle` (0) —
e a reexecução do gate completo está registrada como **DBT-175**.

## F6 — achado P2 do review do PR #72 (fecha DBT-176)

O review automático do PR #72 (`chatgpt-codex-connector`) deixou **um thread aberto** em
`src/routes/_authenticated/inicio.tsx:178`, classificado **P2**: o guard `isDashboardSummaryValid`
aceitava payload sem `window`, e o `formatWindowLabel(metrics.window)` estourava antes do card de erro
poder renderizar. O ruleset `24333849` tem `required_review_thread_resolution: true`, então o thread não
era cosmético: **bloqueava o merge**.

O achado é exatamente o **DBT-176** que esta sessão já havia registrado (Desvio #8). Em vez de resolver o
thread por retórica, a lacuna foi fechada:

- `src/lib/dashboard-summary-guard.ts` exige `window: { from, to }` — strings ISO parseáveis com
  `from < to`. É a forma que faltava: sem ela o `formatWindowLabel` estourava antes do card de erro.
- `src/test/dashboard-summary-guard.test.ts` ganhou dois casos: payload sem `window` / janela invertida /
  data inválida (recusa) e payload de **outro período** durante a troca (aceita — ver a correção abaixo).
- **Controle negativo** (`captures/f6-review-p2-guard.txt`): removida a linha
  `if (!isWindowValid(candidate.window)) return false;`, o teste novo **falha** (`1 failed | 9 passed`);
  restaurado, `sha256sum` idêntico (`5f1ad0cf…`) e **10/10** verdes. A guarda é _load-bearing_, não decoração.

### Correção de escopo: o guard valida forma, não coerência de período

A primeira versão da correção foi **além** do achado: além de exigir `window`, comparava `payload.period`
com o período pedido e recusava divergência. O `verify-release` da run **40275083772** reprovou **E3**
(esperava `Trimestre` e recebeu o card de erro) e **E5** em chromium e firefox: com `keepPreviousData` o
payload anterior — de outro período — fica montado **de propósito** durante a troca, e recusá-lo desmonta o
grid e mata o foco, que é exatamente o contrato que a F3 provou.

A comparação foi removida; sobrou o que o achado pedia (forma). A coerência de período é decisão de
**exibição**, resolvida pelo fato de o rótulo sair de `summary.window` (atestado pelo servidor) e nunca ser
recalculado no cliente. O `src/test/dashboard-summary-guard.test.ts` agora **afirma esse contrato**
(payload de outro período é aceito), em vez de afirmar o comportamento que o E2E reprovou. Evidência da
regressão e do rerun: `captures/f6b-e2e-period-guard.txt`.

**Custo do ciclo, declarado:** este defeito foi **capturado pelo CI** (tier e2e), não pelo autor — o
`npm run check` local não roda Playwright por desenho (AGENTS, tabela de guardas), e a mudança foi medida
só por unidade antes do push. Conta como o **7º** defeito do WP, na coluna do ciclo e não na do autor.

**DBT-176 → FECHADA** (registry com 160 dívidas, `m02:debts-guard` OK). O `AGENTS.md` e o ADR-049 foram
atualizados na mesma passada para não descreverem a lacuna como aberta.

### Kilo Code Review (nota de leitura)

O check **`Kilo Code Review`** aparece vermelho com `action_required`/“Insufficient credits to run review”:
é **app externo**, cuja instalação não é versionada no repositório e cujo token de App não é acessível ao
`gh` — logo o agente não pode desinstalá-lo (só o dono, em _Settings → Applications_). O ruleset
`24333849` exige **apenas** `verify-release` e `scan + cobertura`, ambos verdes; o vermelho do Kilo **não**
é veredito sobre o código e **não** bloqueia nada.

## Limites, S6 e selo

- Caminho de erro do painel ainda desmonta o seletor (o contrato de foco vale no caminho normal).
- Selo de coincidência é predicado de calendário no cliente sobre a janela atestada.
- **S6 adversarial não foi executado**; nenhum veredicto de revisor independente é reivindicado.
- KPI do autor: **6 defeitos capturados pelo autor antes de qualquer S6** — (1) `to` em 1 mês; (2) card de
  Faturamento com texto antigo; (3) fixture de componente sem `window`; (4) 429 por 7 sign-ins; (5) newline
  apagado na DBT-165; (6) errata do orçamento de bundle.
- **Selo**: `node scripts/m02-seal.mjs --dir docs/evidence/dashboard-periodo-2026-10-26 --write` **recusou por
  precondição** (`seal_exit=2`): o sealer exige worktree limpo **fora** do pacote, e esta árvore carrega WIP
  herdado mais o trabalho das Fases 1–4 (commit proibido nesta fase). A recusa está em
  `captures/f4-seal-precondition.txt`. O `MANIFEST.sha256` foi gerado manualmente sobre o conjunto **descoberto
  por filesystem** (18 arquivos, `checked === discovered`), com `sha256sum -c` devolvendo **18/18 `OK`**; o
  `captures/adr-049.sha256` ancora o ADR, que vive fora do pacote. O selo oficial deve ser **reexecutado depois
  do commit da F5**, quando a precondição de worktree puder ser satisfeita — junto com a reexecução do gate
  completo (DBT-175).
- `PROGRESS.md`/`DEBTS.md` **não** entram no manifesto: são journals append-only, e congelar o hash tornaria o
  selo falso no próximo append; são citados por ID/entrada (`DBT-165`, `DBT-173`–`DBT-175`, **`DBT-176` fechada
  na F6**, `DBT-177`, `L1010`–`L1022`).
