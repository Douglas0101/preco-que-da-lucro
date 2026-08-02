import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public UI uses valid composed controls and has no serious a11y violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /descubra o preço certo/i })).toBeVisible();
  await expect(page.locator("a button, button a")).toHaveCount(0);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
});

test("authentication controls keep accessible names", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.locator("button button, a button, button a")).toHaveCount(0);
});
