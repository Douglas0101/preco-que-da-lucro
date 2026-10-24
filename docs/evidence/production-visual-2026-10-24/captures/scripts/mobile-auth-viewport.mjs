import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const { chromium, devices } = require("playwright");
const BASE = "https://preco-que-da-lucro-sage.vercel.app";
const OUT = process.cwd() + "/docs/evidence/visual/production-2026-10-24";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" });
const page = await context.newPage();
await page.goto(BASE + "/auth", { waitUntil: "load" });
await page.waitForTimeout(350);
const geo = await page.evaluate(() => {
  const form = document.querySelector("form");
  const submit = form?.querySelector('button[type="submit"]');
  const card = form?.closest(".rounded-2xl");
  const aside = document.querySelector("aside");
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  };
  return {
    innerHeight: window.innerHeight,
    visualViewport: window.visualViewport ? { height: Math.round(window.visualViewport.height) } : null,
    aside: rect(aside),
    card: rect(card),
    form: rect(form),
    submit: rect(submit),
    submitBelowFold: submit ? submit.getBoundingClientRect().bottom > window.innerHeight : null,
  };
});
await page.screenshot({ path: `${OUT}/mobile-auth-login-viewport.png`, fullPage: false });
console.log(JSON.stringify(geo, null, 2));
await browser.close();
