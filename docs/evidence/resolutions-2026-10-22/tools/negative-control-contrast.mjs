import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const outDir = "docs/evidence/resolutions-2026-10-22/captures";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: ".artifacts/e2e-auth.json",
  baseURL: "http://127.0.0.1:4173",
  extraHTTPHeaders: { "x-forwarded-for": "198.51.100.31" },
});
const page = await context.newPage();
await page.goto("/produtos");
await page.getByRole("heading", { name: "Meus Produtos" }).waitFor();

// Reverte SÓ as duas cores medidas (os bytes anteriores), mantendo o resto do
// layout/fixture idêntico. Inline+important porque o utilitário do Tailwind v4
// já emite `oklab(...)` e venceria uma regra de folha de mesma especificidade.
await page.evaluate(() => {
  const margin = document.querySelector(".text-success");
  const badge = [...document.querySelectorAll("span, div")].find(
    (element) => element.textContent?.trim() === "DADOS INCOMPLETOS",
  );
  margin?.style.setProperty("color", "#2ec97a", "important");
  badge?.style.setProperty("color", "#e17100", "important");
});
// O badge tem `transition-all`: sem assentar, getComputedStyle devolve a cor
// inicial da transição e a medição lê o token novo (falso verde do controle).
await page.waitForTimeout(600);

const ratios = await page.evaluate(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const parse = (value) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a];
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((channel) => {
      const v = channel / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg, bg) => {
    const a = lum(fg);
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const bgOf = (element) => {
    let node = element;
    while (node) {
      const [r, g, b, alpha] = parse(getComputedStyle(node).backgroundColor);
      if (alpha > 250) return [r, g, b];
      node = node.parentElement;
    }
    return [255, 255, 255];
  };
  const of = (element) => {
    const [r, g, b] = parse(getComputedStyle(element).color);
    return ratio([r, g, b], bgOf(element));
  };
  const margin = document.querySelector(".text-success");
  const badge = [...document.querySelectorAll("span, div")].find(
    (element) => element.textContent?.trim() === "DADOS INCOMPLETOS",
  );
  return { margin: of(margin), badge: of(badge) };
});

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();
const blocking = results.violations.filter(
  (violation) => violation.impact === "critical" || violation.impact === "serious",
);

const report = {
  generatedAt: new Date().toISOString(),
  control: "old tokens #2ec97a / #e17100 injected over the same /produtos fixture",
  ratios,
  blockingViolations: blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length,
  })),
  expected: { marginBelow45: ratios.margin < 4.5, badgeBelow45: ratios.badge < 4.5 },
};
writeFileSync(`${outDir}/negative-control-contrast.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

await browser.close();
