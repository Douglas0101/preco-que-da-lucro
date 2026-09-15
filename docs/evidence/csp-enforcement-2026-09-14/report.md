# §20.1 — CSP enforcement: canal de coleta (O23)

- **Operador:** O23 · **Item:** plano mestre §20.1 (`docs/evidence/plan-partials-2026-09-13/part-4-seguranca-ux.md`)
- **Branch:** `ops/onda3-csp` · **Base:** `6132325`
- **Commit da implementação:** `52311a6` (`feat(security): collect CSP violation reports via report-uri/Reporting-Endpoints`)
- **Data:** 2026-09-14 · **Ambiente:** worktree local, sem preview Vercel e sem token (H-2)

## 1. O que foi entregue

| Arquivo                                    | Mudança                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `src/routes/api/csp-report.ts` (novo)      | `POST /api/csp-report`: cap de payload, `logJson("warn","csp.violation")`, `204`; best-effort (nunca 500)           |
| `src/lib/csp-report-payload.ts` (novo)     | Contrato do payload: media types aceitos, teto de bytes, normalização dos dois formatos, limite por requisição      |
| `src/lib/security-headers.ts`              | Acrescenta `report-uri`/`report-to` à política e o header `reporting-endpoints`; **nenhuma diretiva de fonte muda** |
| `src/test/csp-report.test.ts` (novo)       | 13 testes do contrato do endpoint                                                                                   |
| `src/test/security-headers.test.ts` (novo) | 3 testes: política congelada, canal declarado, `CSP_ENFORCE` como único enforcement                                 |
| `e2e/ui-stack.spec.ts`                     | Assert do header reescrito **sem relaxar** + verificação de que o canal responde `204`                              |
| `src/routeTree.gen.ts`                     | Regenerado (`/api/csp-report` registrado) — 21 linhas adicionadas, 0 removidas                                      |
| `docs/specs/M-02/matrix.{generated.,}yaml` | Regenerado: `apiRoutes: 4 → 5` + entrada do novo route                                                              |

Não há _nonce_ (o plano o descarta: CSP estática; nonce exigiria threading por SSR sem driver concreto) e a política
**não foi afrouxada** — nenhum `'unsafe-inline'`, nenhum host novo.

## 2. Header: antes / depois e a prova de que as fontes não mudaram

Captura verbatim em `headers.txt` (mesmo diretório). Resumo da política:

```
BEFORE (6132325, report-only):
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self';
img-src 'self' data: https:; font-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https:

AFTER (52311a6, report-only):
<as diretivas acima, byte-idênticas>; report-uri /api/csp-report; report-to csp-endpoint
+ header novo: reporting-endpoints: csp-endpoint="/api/csp-report"
```

**Prova (reproduzida em `headers.txt`, seção `PROVA: diretivas de fonte`):** removendo as duas diretivas de
relatório (`report-uri`, `report-to`) das políticas antes/depois, o `diff` das duas strings é **vazio** e ambas têm
**10 diretivas de fonte**. Logs/leitura: a política em modo enforce (`CSP_ENFORCE=true`) tem exatamente o mesmo
conteúdo da política em report-only — a única diferença continua sendo _qual_ header a carrega.

Notas de honestidade sobre a captura:

- as capturas rodaram com `NODE_ENV` **diferente** de `production`, então `strict-transport-security` está ausente
  nos **dois** lados (delta zero); não foi verificado nem alterado por este item;
- `CSP_ENFORCE` segue como **único** caminho de enforcement; o e2e agora pina que, sem a variável, o header
  `content-security-policy` **não existe** (rollback por env preservado).

## 3. Endpoint: contrato verificado localmente

`POST /api/csp-report` (`src/routes/api/csp-report.ts`):

| Entrada                                                        | Resultado                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `application/csp-report` + `{"csp-report":{…}}` (canal legado) | `204` + 1 registro `csp.violation`                           |
| `application/reports+json` + `[{type:"csp-violation",…}]`      | `204` + 1 registro por violação; outros `type` são ignorados |
| media type com `; charset=…`                                   | `204`                                                        |
| media type desconhecido/ausente                                | `415` + `csp.report_rejected`                                |
| `content-length` acima do cap (8 KiB)                          | `413` (corpo **não** é lido)                                 |
| corpo acima do cap sem `content-length`                        | `413`                                                        |
| JSON malformado                                                | `400`                                                        |
| JSON válido com forma inesperada / array sem violação de CSP   | `400`                                                        |
| > 10 violações na mesma requisição                             | `204` + 10 registros + `csp.violation_truncated`             |
| falha inesperada ao ler o corpo                                | `400` (`unexpected_error`) — **nunca 500**                   |

Respostas sempre com `cache-control: no-store`; nenhum caminho de erro lança exceção (o handler inteiro está sob
`try/catch` que degrada para `400`).

`csp-violations.jsonl` contém os **registros reais** emitidos por um driver `tsx` que chama `handleCspReportPost`
com os mesmos cinco payloads cobertos por `src/test/csp-report.test.ts` (2 casos aceitos + 3 recusas); cada linha
foi validada com `JSON.parse`. Os payloads e o driver usados:

```ts
// driver executado com: npx tsx /tmp/csp-evidence/emit.mts 2> /tmp/csp-evidence/emit.raw.jsonl
import { handleCspReportPost } from "<worktree>/src/routes/api/csp-report.ts";
const legacy = JSON.stringify({
  "csp-report": {
    "document-uri": "https://app.example/inicio",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    disposition: "report",
    "blocked-uri": "https://cdn.example/x.js",
    "line-number": 12,
    "column-number": 3456,
    "source-file": "https://app.example/assets/app.js",
    "script-sample": "alert(1)",
  },
});
const reporting = JSON.stringify([
  {
    type: "csp-violation",
    body: {
      documentURL: "https://app.example/inicio",
      blockedURL: "inline",
      effectiveDirective: "style-src",
      disposition: "report",
      lineNumber: 3,
      columnNumber: 9,
      sourceFile: "https://app.example/assets/app.js",
      sample: "color:red",
    },
  },
  {
    type: "csp-violation",
    body: {
      documentURL: "https://app.example/produtos",
      blockedURL: "https://cdn.example/y.js",
      effectiveDirective: "img-src",
      disposition: "report",
      lineNumber: 1,
      columnNumber: 42,
      sourceFile: "https://app.example/assets/app.js",
    },
  },
]);
// casos: legacy (204) · reporting (204) · corpo de 9.001 bytes (413) · JSON truncado (400) · application/json (415)
```

## 4. Verificação executada (tudo local a este worktree)

| Comando                                                                        | Resultado                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npx vitest run src/test/csp-report.test.ts src/test/security-headers.test.ts` | 2 arquivos, **16 testes** passaram (13 do endpoint + 3 da política) |
| `npx vitest run`                                                               | **66 arquivos / 594 testes** passaram (92,2 s)                      |
| `npx tsc -p tsconfig.json --noEmit`                                            | exit 0                                                              |
| `npx eslint <6 arquivos alterados>`                                            | sem achados                                                         |
| `npx prettier --check .`                                                       | "All matched files use Prettier code style!"                        |
| `npx tsx scripts/m02-matrix.ts --check`                                        | "M-02 matrix is deterministic and up to date."                      |
| `node scripts/check-ui-stack.mjs`                                              | "UI stack check passed"                                             |
| `node scripts/check-no-supabase-runtime.mjs`                                   | gate OK                                                             |

E2E (`e2e/ui-stack.spec.ts`), alteração **sem relaxar** o assert existente:

```ts
const reportOnlyCsp = response?.headers()["content-security-policy-report-only"] ?? "";
expect(reportOnlyCsp).toContain("script-src 'self'"); // mantido
expect(reportOnlyCsp).toContain("report-uri /api/csp-report"); // novo
expect(reportOnlyCsp).toContain("report-to csp-endpoint"); // novo
expect(response?.headers()["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"'); // novo
expect(response?.headers()["content-security-policy"]).toBeUndefined(); // novo: rollback por env
expect(response?.headers()["x-content-type-options"]).toBe("nosniff"); // mantido
```

mais um teste novo (`the CSP report channel answers 204 for a violation report`) que posta um relatório no endpoint
publicado e exige `204` + `cache-control: no-store` — um `report-uri` apontando para rota inexistente tornaria o
gate de "zero violações" silenciosamente vazio.

## 5. NÃO VERIFICADO (residual declarado — nada aqui foi medido no preview)

1. **Soak report-only (3 execuções, zero violações)** — não executado. Não há preview Vercel nem tráfego real neste
   ambiente; contadores de violação **não** foram medidos nem estimados.
2. **Enforce no preview (`CSP_ENFORCE=true`)** — não executado. A troca de header foi provada apenas em unidade
   (`security-headers.test.ts`) e pela leitura do código; nenhuma página real foi servida com CSP enforcing.
3. **Produção / H-2** — não tocada. A virada em produção e o registro no painel continuam pendentes do dono.
4. **`e2e/ui-stack.spec.ts` e `e2e/sales-dashboard.spec.ts` não foram executados** neste ambiente (exigem
   `npm run build` + `npm run preview` + browsers Playwright). O assert novo é uma proposta verificável, não um
   resultado.
5. **`npm run build` / `check:bundle` não executados** localmente (orçamento de tempo do slice); a rota nova entra
   pelo `routeTree.gen.ts` regenerado, mas o bundle não foi medido.
6. **Comportamento real de `Reporting-Endpoints` com URL relativa** (`csp-endpoint="/api/csp-report"`) não foi
   verificado em nenhum browser. Se algum motor exigir URL absoluta, o canal moderno (`application/reports+json`)
   não é registrado — o canal legado `report-uri` (suportado por Chromium/Firefox/WebKit) continua valendo, e o
   endpoint aceita os dois formatos.
7. **Duplicação esperada de relatórios:** com `report-uri` **e** `report-to` presentes, o Chromium pode entregar a
   mesma violação duas vezes (uma por canal). É custo de log, não de correção; dedupe por
   `(documentUri, effectiveDirective, blockedUri)`. Se o soak mostrar ruído, remover `report-to` é uma linha.

## 6. Rollback

`CSP_ENFORCE` não existe em nenhum ambiente novo deste item; o comportamento default continua **report-only**.
Para desligar a coleta basta remover as duas diretivas de `security-headers.ts` (o endpoint pode permanecer
publicado e inerte) — nenhuma migration, nenhum dado persistido, nenhuma dependência nova.
