import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(process.cwd() + "/package.json");
const { chromium, devices } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default ?? require("@axe-core/playwright");

const BASE = "https://preco-que-da-lucro-sage.vercel.app";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" });
const page = await context.newPage();

const measure = async () => {
  return page.evaluate(() => {
    const form = document.querySelector("form");
    const card = form?.closest(".rounded-2xl");
    const aside = document.querySelector("aside");
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    const targets = Array.from(document.querySelectorAll("button, a"))
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      })
      .filter((t) => t.w < 24 || t.h < 24);
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      formTop: form ? Math.round(form.getBoundingClientRect().top) : null,
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
      asideHeight: aside ? Math.round(aside.getBoundingClientRect().height) : null,
      formBelowFold: form ? form.getBoundingClientRect().top > window.innerHeight : null,
      smallTargets: targets,
    };
  });
};

const axe22 = async () => {
  const r = await new AxeBuilder({ page }).withTags(["wcag22aa"]).analyze();
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target),
  }));
};

const out = {};
await page.goto(BASE + "/auth", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(350);
out.login = { geometry: await measure(), wcag22: await axe22() };

await page.getByRole("button", { name: "Cadastre-se" }).click();
await page.getByRole("heading", { name: "Vamos começar juntos" }).waitFor();
await page.waitForTimeout(250);
out.signup = { geometry: await measure(), wcag22: await axe22() };

writeFileSync(process.cwd() + "/docs/evidence/visual/production-2026-10-24/mobile-wcag22.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
