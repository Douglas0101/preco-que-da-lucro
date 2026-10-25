# Release 1 — correções visuais de produção (2026-10-25)

**Veredito: PUBLICADO**, com um vermelho real detectado e corrigido no caminho. O artefato em produção é
`dpl_6BPGAEkTwFCexpUHRNrWkGuxSWqg` sobre `8c1b4d2`, servido por `sage`, pelo alias de projeto e por `git-main`;
health 200, 0 runtime errors, 0 violação axe e 0 erro de console nas superfícies tocadas.

A release saiu em dois PRs porque o primeiro deixou um gate vermelho:

| PR  | Conteúdo                                 | Resultado             |
| --- | ---------------------------------------- | --------------------- |
| #69 | correções V-02/V-03/V-04/V-05/O-01 + e2e | mergeado em `e51f090` |
| #70 | espera de hidratação no e2e de auth      | mergeado em `8c1b4d2` |

## 1. O que foi corrigido, medido no artefato publicado

Antes = `dpl_BtH` (`b8bc52e`), capturado em `docs/evidence/production-visual-2026-10-24/`.
Depois = `dpl_6BPG` (`8c1b4d2`), capturado em `captures/02-production-probe.json` nos quatro engines
(chromium, firefox, webkit, Pixel 7).

| Achado                      | Antes (medido)                                                         | Depois (medido)                                                                                                                                                                           | Teste que trava                                                    |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| V-02 — 404 em inglês        | `Page not found` / `Go home`, título `Preço que Dá Lucro`              | HTTP 404, `Página não encontrada`, `A página que você procura não existe ou foi movida.`, CTA "Ir para o início" → `/`, título `Página não encontrada · Preço que Dá Lucro` nos 4 engines | `src/test/not-found.test.tsx`, `e2e/visual-corrections.spec.ts`    |
| V-03 — autocomplete         | e-mail e nome sem `autocomplete`                                       | `email`, `name`; senha preserva `current-password`/`new-password`                                                                                                                         | `src/test/auth-form-ui.test.tsx`                                   |
| V-05 — título estático      | sempre `Entrar · …`                                                    | `Entrar · …` no login e `Criar conta · …` no cadastro, nos 4 engines                                                                                                                      | idem                                                               |
| O-01 — alvo de toque        | 22 px                                                                  | 30 px em "Esqueci minha senha", "Cadastre-se" e "Voltar para entrar"                                                                                                                      | `e2e/visual-corrections.spec.ts` (mobile)                          |
| V-04 — 401/prefetch anônimo | `_serverFn` do dashboard 401 em `/inicio`; pageerror em Firefox/WebKit | 0 chamada `_serverFn`, 0 `401`, 0 `pageerror`, 0 `console.error`; redirect em 512–830 ms                                                                                                  | `src/test/inicio-loader.test.ts`, `e2e/visual-corrections.spec.ts` |

axe WCAG A/AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`): **0 violação** em `/rota-inexistente` e `/auth` no
artefato publicado.

### Limite declarado do V-02

O documento 404 é servido com o título genérico do `__root` e o título específico é aplicado quando o React
hidrata. Medido no SHA final: leitura imediatamente após `load` devolve o genérico em chromium/mobile e o
específico em firefox/webkit; com 600 ms de assentamento, os quatro engines devolvem o específico. É ganho
sobre o estado anterior (que nunca mudava), não uma correção de SSR — a correção de SSR exigiria título por
rota não-encontrada no `head`, fora do escopo desta release.

## 2. Estado dos gates (nada omitido)

| Gate                           | Onde                        | Resultado                                                                                                                                                  |
| ------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify-release`               | PR #69 (`18ff729`)          | **pass** 8m23s — matriz completa, 4 projetos                                                                                                               |
| `scan + cobertura`             | PR #69                      | **pass**; CE `OK`, `new_coverage` **100%** (`captures/05-ce-pr-69.json`)                                                                                   |
| Branch efêmera Neon + cleanup  | PR #69                      | **pass** 10m5s / cleanup **pass**                                                                                                                          |
| `main-coverage-mirror`         | PR #69                      | **pass**                                                                                                                                                   |
| `docs-light`                   | PR #69                      | **pass**                                                                                                                                                   |
| `npm run check` local          | `e51f090`                   | **exit 0** na 2ª tentativa; 1ª caiu por crash de worker do jsdom (classe documentada em `vitest.config.ts`), sem falha de teste: 2375 passed (captures/09) |
| **`verify` do push em `main`** | `e51f090` (run 40150376452) | **FAIL** — e2e de título de auth por clique antes da hidratação (captures/08)                                                                              |
| `verify-release`               | PR #70 (`8033eff`)          | **pass** 8m48s                                                                                                                                             |
| `scan + cobertura`             | PR #70                      | **pass**; ADR-044 `NOT_APPLICABLE` (PR sem delta em `src` fora de `src/test/**`)                                                                           |
| `verify` do push em `main`     | `8c1b4d2` (run 40154435106) | **pass** — o mesmo e2e agora verde (captures/12)                                                                                                           |
| CE da main                     | `e51f090`                   | **OK**, `new_coverage` 82.4%                                                                                                                               |
| CE da main                     | `8c1b4d2`                   | **OK**, `new_coverage` 82.4% (`captures/07`)                                                                                                               |
| Kilo Code Review               | PRs #69/#70                 | fail em 1–2 s: conta sem créditos. Check **não obrigatório** (o ruleset `24333849` exige `verify-release` e `scan + cobertura`)                            |

## 3. O vermelho de `main`: causa e correção

O push de `main` em `e51f090` reprovou em `chromium`:

```
Expected: "Criar conta · Preço que Dá Lucro"
Received: "Entrar · Preço que Dá Lucro"   (5 s, 14 amostras)
```

Causa medida: o SSR entrega o formulário de `/auth` antes de o React anexar handlers; o clique em
"Cadastre-se" caiu nessa janela e não trocou o modo. A mesma classe já estava documentada em
`e2e/helpers/authentication.ts`. A matriz do PR #69 (4 projetos) passou; o push de `main` roda só
chromium+mobile e pegou a corrida.

Correção (#70): `gotoAuthHydrated()` aguarda a resposta de `GET /api/auth/get-session`, que só existe depois do
efeito de montagem — logo, depois da hidratação — antes de clicar. Aplicado nos dois testes que interagem com o
formulário. Sem mudança em `src/**`.

## 4. Decisões tomadas e o que ficou fora

### Vitest 4.1.12 — retirado desta release por medição

O bump entrou em `f44eb17` e foi revertido em `2d7d879`. Causa: `instrumentationFingerprint()`
(`scripts/sonar/lcov-provenance.ts:9`) inclui as versões resolvidas de `vitest` e `@vitest/coverage-v8`, então o
mapa unitário selado de `main` deixa de ser comparável ao candidato. O `main-coverage-mirror` recusou com
`EXECUTION_OR_UNCLASSIFIED` (limite residual declarado em DBT-102), que é **bloqueante**, em vez de uma recusa
nomeada.

Medido: com `4.1.11` o fingerprint reproduz exatamente o selo de `main`
`bfc1a4c4c02d60ea9e5652efa582f7795032773aa8f7a4db3a040dac2ece341f`; com `4.1.12` vira
`82ed289ba5bec110d15798b3b28dc1c4637c8b3e69d51715d1ebea231a49359c`. Consequência: hoje **nenhum** bump de
Vitest passa pelo mirror. O bump volta em mudança própria, com recusa nomeada de divergência de instrumentação e
ADR — não sob pressão de release. Os 3 moderates de dev continuam abaixo do `--audit-level=high` aplicado.

### C1/C2 (CSP) — deferidos

`src/lib/security-headers.ts`, `src/test/security-headers.test.ts` e `e2e/ui-stack.spec.ts` estão em WIP de outra
sessão; a decisão hash-estático vs nonce exige ADR-043. `CSP_ENFORCE` continua `false` e o header continua
`content-security-policy-report-only` (captures/03).

### PR E (health identity), G4 (chat autenticado) e Hostinger

Não executados nesta release; seguem no plano com seus gates próprios.

## 5. Rollback

Reatribuir `sage`, o alias de projeto e `git-main` ao `dpl_AXt1nVXCc29au1uLPKoCy9VbKxq3` (`e51f090`) ou ao
`dpl_BtH5YVqmd2QTKs5V2fNRGuomrAeB` (`b8bc52e`). Sem migration, sem mudança de schema, sem mudança de CSP e sem
alteração de dados.

## 6. Dívidas declaradas (pendentes de registro)

`docs/evidence/agent-state/DEBTS.md` está em WIP de outra sessão (63 linhas reescritas) e não foi tocado nesta
release: commitar o arquivo misturaria trabalho alheio. As entradas abaixo ficam registradas aqui até o merge
daquele WIP:

1. **Divergência de instrumentação bloqueia upgrade de Vitest** — `instrumentationFingerprint()` entra na
   comparação do mirror; ausência de recusa nomeada transforma um upgrade legítimo em falha de execução
   bloqueante. Fechamento: recusa nomeada `INSTRUMENTATION_DIVERGENCE_MAIN_VS_CANDIDATE`, classificada como
   observação informacional sem crédito, com controle negativo (fingerprint ausente/ilegível continua bloqueante).
2. **Título do 404 depende de hidratação** — ver §1. Fechamento: título do caso não-encontrado no `head` da rota,
   com asserção de SSR.
3. **Prosa viva não atualizada nesta release** — `AGENTS.md` e `docs/MAPA-OPERACIONAL.md` estão no mesmo WIP de
   outra sessão e não foram tocados. Fechamento: o commit que trouxer aquele WIP registra a Release 1 (PRs #69/#70,
   `8c1b4d2`, `dpl_6BPG`) na tabela de estado do mapa.

## 7. Como reproduzir

- Probe de produção: `captures/02-production-probe.json` (Playwright, 4 engines, somente leitura).
- Checks do PR: `captures/04-pr-69-checks.txt` e `captures/11-pr-70-checks.txt`.
- CE: `captures/05-ce-pr-69.json`, `captures/07-ce-main-8c1b4d2.json`, `captures/10-ce-pr-70.json`.
- Gate local: `captures/09-local-gate.txt`.
- Vermelho e verde do push de `main`: `captures/08-main-push-e51f090-red.txt`,
  `captures/12-main-push-8c1b4d2-green.txt`.
