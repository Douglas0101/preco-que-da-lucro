# RELATÓRIO DO CICLO 5 — NAS-2 (2026-09-17)

**WP:** `9.2`-**T** — desacoplar o **tipo** de `RequestContext.transaction` do driver (o resíduo **R3** que impedia o item `§9.2` de fechar).
**Base:** `5d9169b` (= `origin/develop` **com CI verde**) · **entrega:** `8ff51b7` → merge **`538bcb1`** · **publicado:** sim (push autorizado pelo supervisor).

## 1. Loop S0–S9 — checklist

| fase               | o que foi feito                                                                                                                                                                                                                       | evidência                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **S0 SELECT**      | WP declarado pelo supervisor; **pré-requisito cumprido** (H-10: CI verde no tip `5d9169b3`)                                                                                                                                           | `QUEUE.md` §Ciclo 5                                 |
| **S1 SPEC**        | `SPEC-CARDS/CICLO-5.md` com DoD de 6 itens, riscos, escopo exclusivo e o **teste A/B de tipos** como coração da prova                                                                                                                 | spec-card versionado                                |
| **S2 ISOLATE**     | worktree + branch `mission/n5a-9-2t` + container efêmero próprio; `cwd` explícito e `env -u` em todo comando                                                                                                                          | claim §ambiente                                     |
| **S3 BUILD**       | contrato **type-only** `TransactionExecutor` (`transaction.contracts.ts`); `request-context.ts` deixa de importar `@/db/client.server`; **77 conversões checadas** no adapter (`as DatabaseTransaction`, todas sobre o handle neutro) | `8ff51b7`                                           |
| **S4 VERIFY (E1)** | teste A/B **RED→GREEN** (o teste entregue rodado contra o pai reproduz o `TS2307`), `tsc` 0, `build` 0, `boundaries` 0, greps limpos, 204 testes dirigidos + banco real em `:55490`                                                   | claim `WP-9.2T.md`                                  |
| **S5 BROWSER**     | bateria **Firefox** no preview local: `/produtos`, `/precos`, `/ponto-equilibrio` **3/3 OK**, zero erro novo                                                                                                                          | `docs/evidence/cycle-5-92t-2026-09-17/`             |
| **S6 ADVERSARIAL** | verifier em contexto novo: **7 CONFIRMED · 3 CORRECTED · 1 REJECTED · 0 UNVERIFIABLE** — o coração provado; a moldura corrigida                                                                                                       | `CLAIMS-INBOX/WP-9.2T-VERDICT.md`                   |
| **S7 GUARD**       | env-guard **13/13** · secrets-audit exit 0 · lockfile OK · `:5432` **intocado** (26 tabelas) · preview **sem** `DATABASE_URL_UNPOOLED`                                                                                                | este relatório §4                                   |
| **S8 SEAL**        | matriz **regenerada pelo MAESTRO** (`transactionSites` **119 → 88**; `directDatabaseFiles` 46 = 46); capturas com manifesto `sha256sum -c` = ALL MATCH; claim corrigido **append-only**                                               | `docs/specs/M-02/matrix.yaml`; `screenshots.sha256` |
| **S9 LAND**        | merge em `develop` com **E2 verde**; push autorizado; follow-ups registrados; nada tocado em produção                                                                                                                                 | `git log`; `SUPERVISION-LOG`                        |

## 2. O que o veredicto provou (e o que ele derrubou)

**Provado (o que importa para o item `9.2`):**

- **R3 fechado com A/B independente:** com `@/db/*` remapeado, o pai acusa `src/lib/request-context.ts:1:42 TS2307` e a entrega tem **0 diagnósticos**; o grafo de tipos do contexto + contratos tem **zero** arestas a `drizzle-orm`/driver (6 arquivos, pacotes só `typescript/@types/react/csstype/zod/vite`).
- **Zero mudança de runtime:** 27 tokens de runtime por arquivo com **0 drift**; stream de tokens normalizado idêntico (4 resíduos explicados); nenhuma supressão de tipo nova (`@ts-expect-error`/`any`/`as unknown` = 0 adicionados).
- **Fronteira intacta:** `build` 0 com o `import-protection` **comprovadamente fail-closed** (controle positivo: injetar import de valor cliente-alcançável quebra o build).
- **Comportamento preservado:** os 5 arquivos do agregado **byte-idênticos**, `expect(` com multiset igual, testes com banco próprio verdes.

**Derrubado / corrigido (registrado, não escondido):**

- **7c REJECTED:** a atribuição de que o drift da matriz era herdado é **falsa** — o pai estava byte-limpo e o drift nasce **neste WP**; o número é **88** (o claim dizia 87). Já regularizado (matriz regenerada).
- **2b/3b/7a CORRECTED:** as "77 asserções apagadas na compilação" são na verdade **75 statements executáveis** (bundles minificados diferem pai × HEAD nos 19 arquivos); a porta aceita **qualquer** `execute` (o `never[]` é largo na entrada) e **nenhum** adapter a chama; o "delta de tipo Executor: zero" é falso (20 → 1 membro).

## 3. Achados de qualidade que viram follow-up

| id         | conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                  | por que importa                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **F-C5-2** | **`transactionSites` perdeu sentido como inventário**: o scanner casa o texto `context.transaction`, então o alias local faz um método com N statements contribuir **1** site (`tool-runner` 11→3, `dashboard.repository` 6→1, `product.repository` 28→19). A queda 119→88 **não** é "32 sites a menos". Somado a isso, `transaction.contracts.ts:21` (comentário em arquivo type-only) entra como `compatibility-facade` | qualquer leitura da matriz como inventário transacional fica **subnotificada** até o scanner contar por _binding_ |
| **F-C5-3** | o **drift da matriz é invisível ao gate local**: `npm run check` não inclui `m02:matrix:check` e `m02:boundaries` lê a matriz sem comparar com a geração                                                                                                                                                                                                                                                                  | drift só aparece se alguém rodar o check da matriz — foi assim que ele passou pelo E1 do squad                    |

## 4. Guard (S7)

`env-guard --selftest` **13/13** · `secrets-audit` exit 0 · `lockfile-guard` OK · `:5432` **intocado** (26 tabelas) · preview do ciclo rodou **sem** `DATABASE_URL_UNPOOLED` (regra do ciclo 3, verificada em `/proc`) · containers efêmeros removidos · **nenhum host remoto**, **nenhuma migração fora de container**.

## 5. Placar e estado do item

- **Placar: inalterado** (86,36% parcial / 80,21% crua) — a promoção do item `9.2` a **DONE** exige a **recomputação do MAESTRO** com o E2 verde e os resíduos declarados; o DoD foi cumprido no que é satisfazível (a divergência nº 1 do veredicto mostra que a leitura literal do card — enraizar também o adapter — é **inviável**: quem executa SQL **tem** de nomear o driver).
- **Estado do `9.2`:** os 4 pontos de acesso direto caíram no ciclo 4 (48→46 arquivos) e o **acoplamento de tipo** caiu neste ciclo; **F-C5-2/F-C5-3** ficam declarados como dívida da _métrica_, não do item.
- **Próximo despacho proposto:** `MEM-D4` (delete/export + access log; **H-12 aprovado** e **SD-C3-12** aplicado) · `F-C4-1` (mapeamento `23503→CONFLICT` morto, pré-existente) · `WP-BAT-1` (lacunas de bateria §32/§33) · `F-C5-2`/`F-C5-3` (scanner da matriz + gate).
- **Gates humanos:** **H-10 fechado** · **H-12 aprovado** · seguem **H-6** (Turnstile; 2 min no Firefox do dono), **H-4** (plano Free ⇒ 6 h), **H-9**, **H-2**, **H-11**, **H-5**, **H-8**.
