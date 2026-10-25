# SPEC — Release 1 das correções visuais (V-02, V-03, V-04, V-05, O-01)

## Origem

Achados medidos em produção em `docs/evidence/production-visual-2026-10-24/` contra `dpl_BtH` (`b8bc52e`),
mais o débito de dependência de `@vitest/*` (3 moderates dev-only).

## Perguntas que o pacote responde

1. As cinco correções de interface e a guarda de sessão do acesso anônimo chegaram ao artefato publicado?
2. Cada correção tem medição de antes e depois no artefato real, e não só em teste local?
3. Quais itens do plano original ficaram de fora, e por qual motivo verificável?
4. Qual é o estado honesto dos gates desta release — incluindo o que ficou vermelho?

## Escopo

| Dentro                                                                | Fora                                           |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| `src/routes/__root.tsx` (404 em pt-BR + título)                       | CSP `style-src`/`script-src` (C1/C2)           |
| `src/routes/auth.tsx` (autocomplete, título, 24 px)                   | Health identity (PR E)                         |
| `src/routes/_authenticated/inicio.tsx` (guarda de sessão no prefetch) | Chat autenticado em branch Neon efêmera (G4)   |
| `e2e/visual-corrections.spec.ts`                                      | Hostinger/VPS/DNS                              |
| Testes unitários de regressão                                         | Bump `vitest` 4.1.12 (revertido nesta release) |

## Método

- Medição **no artefato publicado**: Playwright contra `https://preco-que-da-lucro-sage.vercel.app`, quatro
  engines (chromium, firefox, webkit, Pixel 7), com `file://`-free fetch e axe WCAG A/AA.
- Gate local completo (`npm run check`) e matriz de CI do PR (`verify-release`) antes do merge.
- CE obrigatório: leitura real do Quality Gate por SHA imutável, PR e main separados.
- Nenhum dado de produção foi alvo de teste: a verificação é somente leitura (health, páginas públicas e
  redirecionamento anônimo).

## Critérios de aceite

1. 404 responde HTTP 404, com `h2` em pt-BR, CTA "Ir para o início" e título `Página não encontrada · Preço que Dá Lucro`.
2. Formulário de auth expõe `autocomplete` `email`/`name`, preserva `current-password`/`new-password` e o
   título acompanha o modo (`Entrar`/`Criar conta`).
3. Links secundários de auth com alvo de toque >= 24 px.
4. `/inicio` e `/novo-produto` anônimos **não** chamam nenhum `_serverFn` e redirecionam para `/auth` sem
   `pageerror` e sem `console.error` da aplicação.
5. Nenhuma violação axe WCAG A/AA nas superfícies tocadas.
6. `verify-release` e `scan + cobertura` verdes no PR; CE da main `OK` com `new_coverage >= 60`.
7. O estado de todo gate vermelho fica registrado no `README.md`, nunca omitido.
