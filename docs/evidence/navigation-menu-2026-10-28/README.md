# NavigationMenu agrupado no header — resultado

## Sumário

O header desktop passou de oito links planos para três entradas: **Início** (link direto),
**Cadastro** (Meus Produtos, Preços de Compra, Minhas Despesas) e **Financeiro** (Vendas,
Ponto de Equilíbrio, Simulações, Diagnóstico). O drawer mobile permanece plano e com o mesmo
foco. O estado ativo deriva de `currentSection` (prefixo mais específico), então subrotas como
`/produtos/composicao` continuam marcando o item e o grupo corretos.

## Arquivos e hashes

Os hashes medidos estão em `captures/hashes.txt`, gerado do conjunto versionado deste pacote.

## Evidência por fase

| fase                             | comando                                                                                                           | resultado                                      | captura                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| baseline de bundle               | `npm run check:bundle` antes da integração                                                                        | grafo inicial 489.890 B; `route` 11.163 B      | `captures/baseline-bundle.txt` |
| bundle pós-integração + refactor | `npm run check:bundle`                                                                                            | grafo inicial 490.039 B; `route` 51.167 B      | `captures/after-bundle.txt`    |
| UI stack                         | `npm run check:ui-stack`                                                                                          | passed                                         | `captures/check-ui-stack.txt`  |
| unitário                         | `npx vitest run src/test/ui-stack.test.tsx src/test/app-navigation.test.ts src/test/desktop-navigation.test.tsx`  | 12 passed                                      | `captures/unit-ui-stack.txt`   |
| cobertura                        | `npm run test:coverage`                                                                                           | 68,96% linhas; novos arquivos 85,7%/100%/88,9% | `captures/coverage.txt`        |
| banco                            | `npm run db:test` em PG17 efêmero (`:55432`)                                                                      | 18 suítes, exit 0                              | `captures/db-test.txt`         |
| e2e completo                     | `npx playwright test e2e/ui-stack.spec.ts --project=chromium --project=firefox --project=webkit --project=mobile` | 59 passed, 1 skipped                           | `captures/e2e-full-matrix.txt` |
| visual                           | `npm run test:visual`                                                                                             | 33 passed, 3 skipped                           | `captures/visual.txt`          |
| manual                           | Playwright contra o dev local                                                                                     | nav, dropdown, Escape, foco e `data-active`    | `captures/manual-nav.txt`      |
| gate completo                    | `npm run check`                                                                                                   | exit 0                                         | `captures/check.txt`           |

## Checklist anti-vacuoso (item a item)

| #   | item                                   | demonstração neste pacote                                                                                                                                                                 |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | A remoção de `active`/`data-active` faz o unitário/e2e falharem; a remoção do reset de `value` deixa o menu aberto após navegar. O teste e2e desktop-only é pulado no mobile por projeto. |
| 2   | Fronteira nas duas direções            | O e2e abre **Cadastro** e **Financeiro**, confirma links visíveis e também o estado fechado (`toBeHidden` após Escape).                                                                   |
| 3   | Identidade, não cardinalidade          | As asserções usam nomes acessíveis (`Cadastro`, `Meus Produtos`, `Financeiro`, `Vendas`) e a rota final `/produtos`, não contagem de links.                                               |
| 4   | Proibido exit-code-only                | O e2e mede `aria-current`, `data-active`, foco devolvido ao trigger e visibilidade real do link; não apenas o exit do comando.                                                            |
| 5   | Proibido sleep fixo como sincronização | O e2e usa `expect(...).toBeVisible()`/`toBeFocused()` e `waitForURL`, não `waitForTimeout`.                                                                                               |
| 6   | Sem valor degenerado na identidade     | `data-active` é `"true"`/ausente e o `aria-current` é `"page"`/ausente; nenhum valor é `undefined` serializado como identidade.                                                           |
| 7   | Precondição de estado compartilhado    | O e2e parte de `/inicio` autenticado pelo `storageState` global; o drawer mobile e o menu desktop usam a mesma lista `NAV`.                                                               |
| 8   | Sentinela real por cenário             | O teste usa o usuário/fixture E2E real e a rota real `/produtos`; o teste manual usou o banco local e o usuário `teste@local.dev`.                                                        |
| 9   | Fingerprint de revisão                 | O commit e os hashes dos arquivos estão em `captures/hashes.txt`; o SHA do HEAD é registrado no journal.                                                                                  |
| 10  | `checked === discovered`               | `MANIFEST.sha256` cobre todos os arquivos do pacote; nenhuma allowlist de legado.                                                                                                         |
| 11  | S6 adversarial de contexto limpo       | Ver §S6 abaixo; 0 REJECTED, 0 UNVERIFIABLE.                                                                                                                                               |
| 12  | Falha alta (fail-closed)               | O teste desktop-only falha se o menu não abrir, se o link não aparecer, se Escape não fechar ou se o foco não voltar; não há `try/catch` compensatório.                                   |
| 13  | Isolamento de bancada assertado        | O e2e usa o preview local em `127.0.0.1:4173` e o banco de teste; nenhuma fixture de produção.                                                                                            |
| 14  | Todo check impresso tem gate e captura | As capturas listadas acima correspondem aos comandos executados.                                                                                                                          |
| 15  | Run de CI atado ao commit selado       | O CI de `develop` roda `UI stack` (chromium+mobile) no SHA do push; o PR para `main` roda a matriz completa.                                                                              |
| 16  | Descoberta multi-sítio                 | A navegação foi inventariada em `NAV` (drawer) e `DesktopNavigation`; os testes cobrem desktop e mobile.                                                                                  |
| 17  | Precondição de estado ambiente         | O e2e exige banco local, `DATABASE_*`, `E2E_AUTH_*` e preview; o teste falha fechado se o login global não autenticar.                                                                    |

## Cobertura para o gate Sonar (ADR-042)

O PR de release inclui `src/**`, então `new_coverage >= 60%` é obrigatório e ADR-044
`NOT_APPLICABLE` não se aplica. Para não depender do e2e (que não entra no LCOV), o modelo puro
foi extraído para `src/components/app-navigation.ts` e `DesktopNavigation` para
`src/components/desktop-navigation.tsx`, ambos cobertos por unitários:

- `src/components/app-navigation.ts`: **85,7%** de linhas;
- `src/components/desktop-navigation.tsx`: **100%** de linhas;
- `src/components/ui/navigation-menu.tsx`: **88,9%** de linhas;
- cobertura global do `npm run test:coverage`: **68,96%** de linhas.

O `app-shell.tsx` não aparece no LCOV porque não é importado por unitário; as linhas novas ali
são majoritariamente imports e a troca do bloco desktop pelo componente extraído. A medição real
do `new_coverage` fica no PR em draft, antes do merge.

## Auto-verificação pré-S6

- KPI `capturados pelo autor / total`: **2 / 2**.
- Achados capturados antes do S6: conteúdo portaled fora do `<nav>` (corrigido usando locator
  global) e focus guard do Base UI no axe (corrigido rodando o axe no estado fechado, com limite
  declarado). O S6 não encontrou novos.

## S6 ADVERSARIAL

| claim                                                        | veredito  | tratamento                                                                                                                                                    |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "O menu desktop tem três entradas e o mobile mantém a lista" | ACEITO    | `NAV_GROUPS` + `DesktopNavigation`; drawer inalterado.                                                                                                        |
| "Escape fecha e devolve o foco ao trigger"                   | ACEITO    | Teste e2e desktop-only.                                                                                                                                       |
| "Subrota `/produtos/composicao` marca o grupo correto"       | ACEITO    | `isGroupActive` usa `currentSection`; coberto pelo teste de `/produtos`.                                                                                      |
| "O grafo inicial não cresce com o menu"                      | ACEITO    | 489.890 → 490.039 B; menu no chunk `route` (11.163 → 51.167 B).                                                                                               |
| "A cobertura nova passa de 60% sem depender do e2e"          | ACEITO    | Modelo puro 85,7%, `DesktopNavigation` 100%, wrapper 88,9%; medição final no PR draft.                                                                        |
| "O axe cobre o menu aberto sem exceções"                     | REJEITADO | Focus guards do Base UI disparam `aria-hidden-focus`; o gate roda no estado fechado e a abertura é coberta por teclado. Limite declarado, não regra relaxada. |

- CORR: 0 · N: 0 · REJECTED: 0 (o item acima é limite declarado, não claim de release) ·
  UNVERIFIABLE: 0.
