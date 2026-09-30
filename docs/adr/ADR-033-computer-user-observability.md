# ADR-033 — Computer User Observability em tempo de teste (Playwright)

- **ID:** ADR-033 · **Rastro:** Ciclo 17.1 / F17.1-1..6 · **Data:** 2026-09-30
- **Estado:** **PROPOSTA** — aguarda ratificação do MAESTRO. As quatro decisões de forma
  foram fixadas pelo operador em 2026-09-30 (implementar tudo; captura em tempo de teste;
  `test:visual` no tier e2e; ciclo leve + ADR) e a implementação segue junto desta proposta.
- **Tipo:** observabilidade / contrato de evidência
- **Precedente de forma:** `ADR-030-boundary-guard-dbt19.md`, `ADR-032-decimal-string-wire-canonico.md`

---

## 1. Fato

O brief do Ciclo 17.1 pede quatro agentes de observabilidade visual — V1 percepção, V5
verificação, V6 redaction e V7 correlação — como módulos de runtime em
`src/lib/observability/`, com `captureScreenshot()` / `captureA11yTree()` / `captureDOM()`
operando sobre um browser, e as métricas `visual.*` exportadas para Prometheus/Grafana.

Quatro medições redefinem o desenho:

1. **Não há browser no runtime de produção.** `@playwright/test` vive em `devDependencies`
   (`^1.62.1`) e o binário de browser só existe onde `npx playwright install` roda — no passo
   de e2e do pipeline, nunca no deploy. O preset Nitro (`node-server` fora da Vercel; Build
   Output API na Vercel) serve HTTP e não lança browser. Captura em runtime, como o brief
   pede, não é implementável nesta arquitetura.
2. **A árvore a11y é texto e carrega segredo.** `page.accessibility` não existe mais na
   1.62.1 (varredura dos tipos não encontra o membro); o substituto é `locator.ariaSnapshot()`,
   que devolve **YAML**. O incidente L239/L240 mediu que esse texto carrega valor de input: a
   tela `node/deployments/settings` do hPanel renderizou `DATABASE_URL` e `BETTER_AUTH_SECRET`
   em texto plano no snapshot de acessibilidade. Redaction que cobre só pixel **não** cobre a
   árvore.
3. **O caminho de métrica da aplicação está quebrado por ordem de import.** O meter e os
   instrumentos nascem no escopo do módulo em `src/instrumentation/telemetry.ts:12` e `:87+`;
   o provider global só existiria depois, então `@opentelemetry/api` devolve
   `NOOP_METER_PROVIDER` e nenhuma métrica de aplicação sai do processo — defeito já
   registrado como `F-otel-provider-order`. Qualquer módulo novo que repetir o padrão nasce
   noop.
4. **`test:visual` na cadeia `check` custaria um browser por commit.** O pipeline já tem um
   passo de e2e com browsers instalados, cache por `package-lock.json`, servidor web com
   banco e seed. Uma segunda invocação de `playwright test` subiria um segundo build **e** um
   segundo servidor — contra o orçamento declarado de 12 min do job.

## 2. Decisão

Adotar **Computer User Observability em tempo de teste**, com captura no pipeline de e2e
(Playwright) e redaction **antes** da persistência:

- **Módulos puros** em `src/lib/observability/` — sem `createServerFn`, sem banco, sem
  Playwright: `visual-redaction.ts`, `visual-verification.ts`, `visual-correlation.ts` e
  `visual-perception.ts` (helpers de artefato: hash sha256, nome canônico, gate de redaction).
- **Adaptador Playwright** em `e2e/visual/` (a percepção real): screenshot com `mask`,
  `locator.ariaSnapshot()`, snapshot de DOM, leitura do header `x-correlation-id` e escrita da
  evidência.
- **Redaction em três superfícies, antes de qualquer escrita:** (a) pixels — `mask` na captura
  - remoção de chunks de texto do PNG; (b) árvore a11y — scrub por padrão e por linha, com o
    valor de input tratado como superfície de segredo; (c) DOM e atributos — scrub por padrão.
    Um artefato que ainda contenha o segredo não é persistido (**fail-closed**).
- **Métricas `visual.*`** emitidas via `@opentelemetry/api` com **resolução tardia do meter**
  (no call site), nunca em escopo de módulo, e validadas em teste com provider em memória.
- **`npm run test:visual` roda no tier e2e.** A spec vive em `e2e/visual/` e é executada pelo
  mesmo passo `npx playwright test` do `ui-stack.yml` — sem segunda invocação, porque uma
  segunda subiria um segundo build+servidor e estouraria o orçamento do job. Localmente,
  `npm run test:visual` é o gate focado.

## 3. Contratos e invariantes

- **INV-007 — NaN/Infinity nunca formatados como zero.** A verificação reprova `R$ 0,00` em
  linha cujo valor é incompleto e reprova o literal visível `NaN` / `Infinity`.
- **INV-006 — desconhecido ≠ zero.** Linha incompleta exibe `—` ou "Erro de cálculo"
  (fallbacks de `src/lib/format.ts`), nunca um valor factual.
- **INV-008 — isolamento de tenant.** Marcador plantado em outro tenant não aparece na
  árvore/DOM do tenant autenticado.
- **Nenhum segredo atravessa a fronteira de persistência.** A11y, DOM e PNG passam por
  redaction antes de `writeFile`; o teste tem controle negativo (fixture com segredo fictício
  **tem** de ser redigida) e a asserção "zero segredos" reprova se o valor reaparecer em
  qualquer artefato.
- **Artefatos** sob `docs/evidence/visual/<timestamp>-<sha256>.<ext>`; o nome carrega o hash
  do **conteúdo já redigido**.
- **Correlação** é o par `{screenshotHash, traceId}`, com `traceId` lido do header
  `x-correlation-id` (uuid validado em `src/start.ts`). Sem header, a correlação é declarada
  **ausente**, nunca inventada.
- **Limite declarado — pixels.** Não há verificação por OCR: a garantia de pixel é a `mask`
  na captura. O teste prova redaction de texto e de metadados; não "lê" a imagem.
- **Limite declarado — export.** Prometheus/Grafana e os alertas (`anomaly.detected > 0`,
  `pass_rate < 99%`) **não** são entregues por este ADR: dependem de resolver
  `F-otel-provider-order` (métricas de aplicação noop) e de infraestrutura fora do repo. O
  que fica pronto é a emissão com resolução tardia e a asserção em memória.

## 4. Alternativas

| Alternativa                                             | Por que não                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Captura em runtime em `src/lib` (como o brief pede)** | Impossível: sem browser no runtime (fato 1) e a árvore a11y nem existe na API instalada (fato 2). Implementar a assinatura e devolver vazio seria pior que declarar o desvio.            |
| **Captura por MCP Playwright para a evidência**         | Exige sessão de browser interativa e agente no loop; não roda no CI determinístico e a evidência não é reproduzível por clone. Serve para QA humano (como no Ciclo 15), não como gate.   |
| **Diff visual por biblioteca de imagem nova**           | Dependência nova + baseline binária que envelhece; o núcleo do brief é semântico (badge, `—`, NaN-as-zero), não pixel-diff. O diff de pixel pode entrar depois, sobre a mesma evidência. |
| **Redaction por opacidade total da página**             | Destrói a evidência, que é o ativo; o scrub por padrão preserva o resto da tela e mantém o artefato auditável.                                                                           |
| **`test:visual` na cadeia `check`**                     | Custo de browser + build + servidor em todo commit; o tier e2e já tem os quatro.                                                                                                         |

## 5. Consequências

**Positivas.** O gate é determinístico, reproduzível por clone e roda no pipeline que já
existe, sem dependência nova em runtime e sem segunda invocação de build. A redaction passa a
ter uma superfície explícita — a árvore a11y — que o incidente do hPanel provou ser necessária.
As invariantes INV-006/007/008 ganham uma verificação de UI, não só de unidade.

**Negativas e limites.** A captura depende do seed de e2e (um produto completo); os cenários de
dado incompleto, XSS e tenant exigem fixture própria dentro da spec. `test:visual` não roda em
todo commit local a menos que o desenvolvedor o invoque — a cobertura executável em CI é o
passo de e2e do `ui-stack.yml`, declarado. E o export de métricas continua bloqueado por
`F-otel-provider-order`: a emissão correta está no código, o que falta é o provider global no
boot, que é mudança de outro WP.

**Dívida declarada.** Enquanto este ADR estiver em `PROPOSTA`, a implementação e o brief
divergem por desenho: o brief descreve runtime, a entrega é tempo de teste. Ratificar mantém a
divergência documentada; reverter implica recompor captura de browser em produção, que a
arquitetura atual não comporta.
