# §20.1 — CSP: paridade report-only × enforcement, critério de promoção e bloqueio declarado (WP-B3)

| campo                | conteúdo                                                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **item**             | `20.1` (CSP: report-only → promoção) · **WP-B3** · squad `SQUAD-SEC`                                                                                                                                                                                             |
| **branch / base**    | `mission/b3-csp` · base `1f94b56`                                                                                                                                                                                                                                |
| **spec-card**        | `docs/evidence/agent-state/SPEC-CARDS/20.1-csp.md`                                                                                                                                                                                                               |
| **spec_ref**         | Plano Mestre §20.1 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1636-1646`) · `AGENTS.md:45` (CSP estrita; nunca `'unsafe-inline'` nem host novo) · `docs/evidence/plan-partials-2026-09-13/part-4-seguranca-ux.md:18-31` (gates do §20.1) |
| **status pleiteado** | **PARTIAL** — bloqueio **H-6** (ambiente placeholder) + H-2 (sem preview/token)                                                                                                                                                                                  |
| **ambiente**         | worktree local isolado; **nenhum** enforcement ligado; preview/produção intocados                                                                                                                                                                                |

## 1. O que este WP entrega

1. **Correção da promoção** (`src/lib/security-headers.ts`): com `CSP_ENFORCE=true` a resposta agora
   carrega **exatamente** as diretivas de fonte, byte a byte iguais às do modo report-only — o canal de
   coleta (as duas diretivas de report **e** o header `reporting-endpoints`) pertence à janela de soak e
   **não** entra na resposta enforçada. Na base, o modo enforçado servia uma **cópia** da política
   report-only (com `report-uri`/`report-to` dentro), o que reprovava a paridade exigida pelo card.
2. **T1–T3** em `src/test/security-headers.test.ts` (ver §3) — paridade byte a byte, travas do AGENTS.md e
   canal de coleta best-effort com cap.
3. **Critério objetivo de "relatório limpo"** + **procedimento de promoção** executável (§5 e §6), para a
   fila humana.
4. **Bloqueio declarado** (§7): `20.1` **permanece PARTIAL**; enforcement **não** foi ligado nem por default
   nem em nenhum ambiente (`CSP_ENFORCE` continua o único caminho e está ausente/`false`).

## 2. TEST-FIRST — prova de falha inicial (T1 contra a base)

```
$ npx vitest run src/test/security-headers.test.ts     # (após escrever T1–T3, antes de tocar na política)
 ❯ src/test/security-headers.test.ts (3 tests | 1 failed) 20ms
     × T1: a política enforçada é byte-idêntica à de report-only sem as diretivas de report 7ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/test/security-headers.test.ts > política de CSP (§20.1) > T1: a política enforçada é byte-idêntica à de report-only sem as diretivas de report
AssertionError: expected 'default-src \'self\'; base-uri \'self…' to be 'default-src \'self\'; base-uri \'self…' // Object.is equality

Expected: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:"
Received: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:; report-uri /api/csp-report; report-to csp-endpoint"

 ❯ src/test/security-headers.test.ts:65:22

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

Saída integral: `T1-failure-on-head.txt` (mesmo diretório). A política enforçada da base **continha** o canal
de coleta — a promoção não era "congelar as diretivas de fonte", era "republicar a política de coleta".

**Leitura do card que originou T1** (`src/test/security-headers.test.ts:56-75`): `T1` monta
`report-only − {report-uri, report-to}` e exige igualdade **byte a byte** com `content-security-policy`
(`expect(enforced).toBe(withoutReporting)`, linhas 65-66) — logo a resposta enforçada **não** pode carregar o
canal de report (card, aceitação 2, "o canal de relatório não entra na política enforçada"). Também exige que
as duas políticas nunca coexistam (linha 70) e que `reporting-endpoints` não seja anunciado no modo enforçado
(linha 74).

## 3. IMPLEMENTAÇÃO — `arquivo:linha`

| arquivo                             | linhas    | o que muda                                                                                                                                                                    |
| ----------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/security-headers.ts`       | `13-24`   | `SOURCE_DIRECTIVES`: as 10 diretivas de fonte, **congeladas** (antes eram literais inline dentro de `securityHeaders()`)                                                      |
| `src/lib/security-headers.ts`       | `32`      | `REPORTING_DIRECTIVES`: `report-uri /api/csp-report` + `report-to csp-endpoint` (canal, não fonte)                                                                            |
| `src/lib/security-headers.ts`       | `39-58`   | `securityHeaders()`: modo enforçado (`:45-47`) devolve `SOURCE_DIRECTIVES.join("; ")`; modo report-only (`:48-53`) devolve fontes + canal **e** anuncia `reporting-endpoints` |
| `src/test/security-headers.test.ts` | `13-28`   | listas congeladas de diretivas de fonte e de report                                                                                                                           |
| `src/test/security-headers.test.ts` | `32-47`   | `directivesOf()` (parser de política → `Record`) + restauração de `CSP_ENFORCE`                                                                                               |
| `src/test/security-headers.test.ts` | `56-75`   | **T1** paridade byte a byte / canal fora do enforçado                                                                                                                         |
| `src/test/security-headers.test.ts` | `79-111`  | **T2** travas do AGENTS.md                                                                                                                                                    |
| `src/test/security-headers.test.ts` | `113-166` | **T3** canal best-effort com cap                                                                                                                                              |

Nenhuma diretiva de fonte foi afrouxada; nenhum host novo; nenhum `'unsafe-inline'`; nenhum nonce (decisão
explícita do plano §20.1 — ver §10). O endpoint `POST /api/csp-report` e seu contrato (`src/lib/csp-report-payload.ts`,
`src/routes/api/csp-report.ts`) **não** foram tocados: `src/test/csp-report.test.ts` segue 13/13.

## 4. EVIDENCE — comandos e saídas reais

```
$ npx vitest run src/test/security-headers.test.ts
 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-mB3


 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  01:50:17
   Duration  1.08s (transform 80ms, setup 166ms, import 127ms, tests 12ms, environment 649ms)
```

```
$ npx vitest run src/test/csp-report.test.ts          # canal de coleta: sem regressão
 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-mB3


 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  01:49:59
   Duration  875ms (transform 66ms, setup 102ms, import 101ms, tests 20ms, environment 550ms)
```

```
$ npx tsc -p tsconfig.json --noEmit                   # worktree isolado (sem mudanças de irmãos)
tsc exit: 0                                            # 10,8 s
```

```
$ npx tsx /tmp/csp-parity/parity.mts                  # capturado em policy-parity.txt
REPORT-ONLY content-security-policy-report-only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:; report-uri /api/csp-report; report-to csp-endpoint
REPORT-ONLY reporting-endpoints: csp-endpoint="/api/csp-report"
ENFORCED   content-security-policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:
ENFORCED   content-security-policy-report-only: undefined
ENFORCED   reporting-endpoints: undefined
REPORT-ONLY menos diretivas de report: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:
diff(enforced, report-only sem report): (vazio)
bytes: 214 enforcado / 214 esperado
sha256(enforced): 51ad78eb5afacb6affd6d8fdf1552b451f77b2e88da3fc941cbba4a512e9bac7
sha256(report-only sem report): 51ad78eb5afacb6affd6d8fdf1552b451f77b2e88da3fc941cbba4a512e9bac7
```

**T1 prova** paridade byte a byte: `diff` vazio, 214 bytes de cada lado, **mesmo `sha256`**.
**T2 prova** as travas: lista de diretivas fechada (qualquer host novo quebra a comparação), ausência de
`unsafe-inline`/`unsafe-eval`/`strict-dynamic`/`nonce-`/`*`, `script-src 'self'` exato e `data:` só em
`img-src`/`font-src`.
**T3 prova** o canal: `report-uri /api/csp-report` tem handler POST publicado (não é canal órfão), acima do cap
→ `413` **sem ler o corpo**, lote de 15 violações → `204` com **10** registros `csp.violation` +
`csp.violation_truncated{suppressed:5}`, sempre `cache-control: no-store` e nunca 5xx.

## 5. Critério objetivo de "relatório limpo" (gate humano da promoção)

Promoção autorizada **somente** quando todos os itens abaixo forem verdadeiros, medidos em **ambiente real**
(preview Vercel; produção depois), com o fechamento do **H-6**:

1. **Canal vivo antes de contar:** uma violação **sintética** observada durante a janela aparece no log
   estruturado (`event=csp.violation`). Sem isso, "zero violações" é indistinguível de canal morto e a janela
   é inválida (o e2e só prova o `204`, não a entrega pelo browser).
2. **Janela:** ≥ 3 execuções de soak (gate do plano §20.1) cobrindo as rotas autenticadas (`/inicio`,
   `/produtos`, `/ponto-equilibrio`, `/diagnostico`, `/simulacoes`, `/chat`) com ≥ 500 page-views e ≥ 72 h de
   coleta contínua — o **maior** dos dois; a última coleta ≤ 24 h antes da virada.
3. **Zero violações nas diretivas que a promoção congela** (`script-src`, `object-src`, `base-uri`,
   `form-action`, `frame-ancestors`, `default-src`): contagem literal de
   `event=csp.violation` agrupada por `effectiveDirective` = **0**. Qualquer valor > 0 reprova a janela.
4. **Resíduo fora dessas diretivas não reprova, mas precisa estar triado:** `img-src`/`font-src`/`style-src`/
   `connect-src` são permissivas por desenho (`https:`/`data:`); violações nelas entram no relatório da
   janela com `documentURL`/`blockedURL` e decisão registrada — nunca silenciadas.
5. **Contagem re-derivável:** os números vêm do log estruturado (`csp.violation`, JSONL), não de estimativa
   nem de painel agregado; a janela é anexada ao artefato de promoção.

## 6. Procedimento de promoção (executável, passo a passo)

Hoje: `CSP_ENFORCE` **ausente** ⇒ report-only com canal de coleta (default preservado).

1. **Soak (report-only, nenhum env novo):** deixar o preview no default e coletar conforme §5.
2. **Contar:** agrupar `event=csp.violation` por `effectiveDirective` na janela; aplicar §5.3/§5.4.
3. **Promover no preview:** definir `CSP_ENFORCE=true` **apenas** no ambiente de preview (dono = H-6) e
   redeployar. Verificar na resposta: `content-security-policy` presente, `content-security-policy-report-only`
   **ausente**, política **byte-idêntica** à do passo 1 sem as diretivas de report (é exatamente o que T1
   prova: `src/test/security-headers.test.ts:56-75`), `reporting-endpoints` ausente.
4. **E2E no preview (`PLAYWRIGHT_BASE_URL`):** `e2e/ui-stack.spec.ts` + `e2e/sales-dashboard.spec.ts` sem
   violação de CSP e com zero `securitypolicyviolation` no console do browser. **Proposta de asserção para o
   modo enforçado** (a aplicar quando a janela rodar; requer `CSP_ENFORCE=true` no alvo):
   ```ts
   expect(response?.headers()["content-security-policy"]).toContain("script-src 'self'");
   expect(response?.headers()["content-security-policy"]).not.toContain("report-uri");
   expect(response?.headers()["content-security-policy-report-only"]).toBeUndefined();
   expect(response?.headers()["reporting-endpoints"]).toBeUndefined();
   ```
5. **Produção:** repetir 3–4 em produção (mesma variável, mesmo rollback) depois de ≥ 72 h de preview
   enforçado sem `securitypolicyviolation` no circuito de smoke.
6. **Registrar:** painel/ledger e dono da virada; anexar a contagem da janela ao artefato.

**Custo/falha de um passo:** qualquer violação sustenta-se em (a) corrigir o sink ou (b) voltar a
report-only — nunca relaxar a política.

## 7. BLOQUEIO DECLARADO — `20.1` permanece **PARTIAL**

- **`H-6` (ambiente placeholder)** — não há preview Vercel nem app real neste ambiente; a janela de soak
  (§5) e o enforcement no preview (§6.3-6.5) **não** podem ser exercitados. Sem eles, `20.1` **não** pode ser
  promovido a `DONE` (aceitação 1 do card) e o enforcement **não** foi ligado aqui.
- **`H-2`** (sem token/painel) — a virada de `CSP_ENFORCE` por ambiente é passo do dono, não deste squad.
- Consequência: este WP entrega **procedimento testado + critério objetivo**, não a promoção. O default segue
  **report-only** (`CSP_ENFORCE` ausente em todo ambiente novo; `.env.example:65` mantém `"false"`).

## 8. NÃO VERIFICADO (residual honesto)

1. Soak report-only em ambiente real e a contagem de violações — **não medidos** (sem preview/tráfego).
2. Enforcement servindo página real — **não executado**; a paridade foi provada em unidade (§4) e por leitura
   de `src/lib/security-headers.ts:45-47`.
3. `Reporting-Endpoints` com URL relativa em browsers reais (`csp-endpoint="/api/csp-report"`) — **não
   verificado**; o canal legado `report-uri` é aceito por Chromium/Firefox/WebKit e o endpoint aceita os dois
   formatos.
4. Duplicação de relatórios quando `report-uri` **e** `report-to` coexistem (custo de log, dedupe por
   `(documentUri, effectiveDirective, blockedUri)`) — **não medida**.
5. `e2e/**` e `npm run build`/`check:bundle` — **não executados** aqui (exigem build + preview + browsers).
6. `strict-transport-security` (só em `NODE_ENV=production`) — intocado por este item.
7. **Visibilidade pós-promoção:** no modo enforçado **não** há canal de coleta (decisão do card). Bloqueios
   passam a ser silenciosos no log; a observabilidade do enforcement depende das janelas de report-only.
   Se o dono quiser coletar **durante** o enforcement, é uma decisão de spec nova (relaxaria a paridade
   exigida) — hoje o card diz o contrário, então **não** foi feito.

## 9. Rollback

- Sem código: remover/`false` em `CSP_ENFORCE` e redeployar (volta a report-only — o canal de coleta volta
  junto, porque ambos vivem no ramo report-only de `securityHeaders()`).
- Com código: `git revert <sha>` — a mudança é restrita a política/teste/doc; nenhuma migration, nenhum dado
  persistido, nenhuma dependência nova.

## 10. Notas de interpretação (para o SPEC-STEWARD)

1. **"Paridade byte a byte"**: adotada a leitura mais estrita — `enforçado == report-only − {report-uri,
report-to}` (card, aceitação 2 e linha de testes "removendo as diretivas de report, `diff` vazio"). Isso
   mudou o comportamento do modo enforçado (antes: cópia da política com o canal dentro).
2. **`reporting-endpoints` fora do modo enforçado**: consequência coerente de "o canal de relatório não entra
   na política enforçada" — sem `report-to` o header seria um anúncio órfão. Se o SPEC-STEWARD quiser o
   anúncio preservado no enforcement, é 1 linha em `security-headers.ts:52` + 1 asserção em T1 (linha 74).
3. **"nonce ausente"** no card (linha de testes T2): o plano §20.1 decidiu **não** usar nonce (CSP estática;
   nonce exigiria threading no SSR sem driver concreto — `part-4-seguranca-ux.md:28`). A trava assertada é a
   ausência de `nonce-`, `strict-dynamic` e `'unsafe-inline'` com `script-src 'self'` exato
   (`src/test/security-headers.test.ts:91-96`); introduzir nonce quebraria T1/T2 e exigiria decisão de spec.
4. **Registro histórico corrigido:** `docs/evidence/csp-enforcement-2026-09-14/report.md` §2 afirmava que a
   política enforçada tinha "exatamente o mesmo conteúdo" da report-only; essa leitura está **superada** por
   este artefato (nota de supersessão no topo do antigo).
