import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão da classe "a URL muda mas a tela é a do pai".
 *
 * A rota `produtos/composicao.tsx` era FILHA de `produtos.tsx` no routeTree. O pai
 * é uma página, não um layout (não tem `<Outlet/>`), então o filho nunca montava:
 * `/produtos/composicao?produto=…` trocava a barra de endereço e continuava
 * renderizando a lista ("Meus Produtos"). O defeito passou despercebido porque
 * nenhuma asserção olhava o conteúdo depois da navegação — só a URL.
 *
 * Por isso as duas asserções abaixo são conjuntas: (a) a URL É a de composição e
 * (b) o conteúdo É o da composição. Uma sem a outra deixa a classe passar.
 */
const COMPOSITION_HEADING = "Composição do produto";
const PARENT_HEADING = "Meus Produtos";

async function openFirstProductComposition(page: Page): Promise<string> {
  await page.goto("/produtos");
  await expect(page.getByRole("heading", { name: PARENT_HEADING })).toBeVisible();

  // O seed E2E cria produtos (scripts/e2e/seed-auth.ts). Se ele deixar de criar,
  // este teste falha em vez de virar vácuo — descoberta vazia reprova.
  const compose = page.getByRole("button", { name: /^Editar composição de / });
  await expect(compose.first(), "o seed E2E precisa de ao menos um produto").toBeVisible();

  await compose.first().click();
  await expect(page).toHaveURL(/\/produtos\/composicao\?produto=/);
  // Firefox aborta uma navegação de documento enquanto o pushState do clique
  // ainda está em voo (NS_BINDING_ABORTED). Esperar o conteúdo da rota assentar
  // mantém a asserção de documento novo no teste seguinte sem mascarar o defeito.
  await expect(page.getByRole("heading", { name: COMPOSITION_HEADING })).toBeVisible();
  return page.url();
}

test("the Composição button opens the composition page, not the parent list", async ({ page }) => {
  await openFirstProductComposition(page);

  await expect(page.getByRole("heading", { name: COMPOSITION_HEADING })).toBeVisible();
  // A lista do pai não pode estar montada: é exatamente o defeito medido.
  await expect(page.getByRole("heading", { name: PARENT_HEADING })).toHaveCount(0);
});

test("a direct navigation to /produtos/composicao renders the composition page", async ({
  page,
}) => {
  // O id vem do próprio app (o seed não é fixo no spec), e a navegação testada é
  // um documento novo — SSR + hidratação do caminho publicado, não um pushState.
  const deepLink = await openFirstProductComposition(page);

  await page.goto(deepLink);
  await expect(page.getByRole("heading", { name: COMPOSITION_HEADING })).toBeVisible();
  await expect(page.getByRole("heading", { name: PARENT_HEADING })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("produto"), "o deep link carrega o produto").not.toBe(
    null,
  );
});
