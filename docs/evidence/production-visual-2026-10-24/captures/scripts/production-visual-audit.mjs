import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(process.cwd() + "/package.json");
const { chromium, firefox, webkit, devices } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default ?? require("@axe-core/playwright");

const BASE = "https://preco-que-da-lucro-sage.vercel.app";
const OUT = process.cwd() + "/docs/evidence/visual/production-2026-10-24";
mkdirSync(OUT, { recursive: true });

const engines = [
  { name: "chromium", browser: chromium, device: devices["Desktop Chrome"] },
  { name: "firefox", browser: firefox, device: devices["Desktop Firefox"] },
  { name: "webkit", browser: webkit, device: devices["Desktop Safari"] },
  { name: "mobile", browser: chromium, device: devices["Pixel 7"] },
];

const pages = [
  { key: "home", path: "/" },
  { key: "auth-login", path: "/auth" },
  {
    key: "auth-signup",
    path: "/auth",
    after: async (page) => {
      await page.getByRole("button", { name: "Cadastre-se" }).click();
      await page.getByRole("heading", { name: "Vamos começar juntos" }).waitFor();
    },
  },
  { key: "404", path: "/rota-inexistente" },
];

const results = [];
for (const { name, browser, device } of engines) {
  const b = await browser.launch({ headless: true });
  const context = await b.newContext({ ...device, reducedMotion: "reduce" });
  const page = await context.newPage();
  let events = {
    console: [],
    pageErrors: [],
    failed: [],
    httpErrors: [],
    cspConsole: [],
    cspRequests: [],
  };
  const reset = () => {
    events = {
      console: [],
      pageErrors: [],
      failed: [],
      httpErrors: [],
      cspConsole: [],
      cspRequests: [],
    };
  };
  page.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy/i.test(t)) events.cspConsole.push(t.slice(0, 600));
    else if (m.type() === "error" || m.type() === "warning")
      events.console.push({ type: m.type(), text: t.slice(0, 600) });
  });
  page.on("pageerror", (e) => events.pageErrors.push(String(e).slice(0, 600)));
  page.on("requestfailed", (r) =>
    events.failed.push({ url: r.url().slice(0, 220), error: r.failure()?.errorText }),
  );
  page.on("response", (r) => {
    if (r.status() >= 400)
      events.httpErrors.push({ status: r.status(), url: r.url().slice(0, 220) });
  });
  page.on("request", (r) => {
    if (r.url().includes("/api/csp-report")) events.cspRequests.push(r.url());
  });

  for (const p of pages) {
    reset();
    const t0 = Date.now();
    const resp = await page
      .goto(BASE + p.path, { waitUntil: "load", timeout: 30000 })
      .catch(() => null);
    const loadMs = Date.now() - t0;
    if (p.after) await p.after(page);
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(250);
    const dom = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      lang: document.documentElement.lang,
      h1: Array.from(document.querySelectorAll("h1")).map((h) => h.textContent?.trim()),
      h2: Array.from(document.querySelectorAll("h2")).map((h) => h.textContent?.trim()),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      brokenImages: Array.from(document.images)
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.currentSrc || i.src),
      inputs: Array.from(document.querySelectorAll("input")).map((i) => ({
        id: i.id,
        type: i.type,
        autocomplete: i.getAttribute("autocomplete"),
        required: i.required,
      })),
    }));
    let axe = { violations: [], passes: [] };
    try {
      axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
    } catch (e) {
      axe = {
        violations: [{ id: "axe-error", impact: "unknown", help: String(e), nodes: [] }],
        passes: [],
      };
    }
    const shot = `${OUT}/${name}-${p.key}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    writeFileSync(`${OUT}/${name}-${p.key}.axe.json`, JSON.stringify(axe, null, 2));
    writeFileSync(`${OUT}/${name}-${p.key}.aria.yml`, await page.locator("body").ariaSnapshot());
    results.push({
      engine: name,
      page: p.key,
      status: resp?.status() ?? null,
      loadMs,
      url: dom.url,
      title: dom.title,
      lang: dom.lang,
      h1: dom.h1,
      h2: dom.h2,
      overflow: dom.overflow,
      scrollWidth: dom.scrollWidth,
      innerWidth: dom.innerWidth,
      bodyBg: dom.bodyBg,
      brokenImages: dom.brokenImages,
      inputs: dom.inputs,
      axe: {
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          targets: v.nodes.slice(0, 3).map((n) => n.target),
        })),
        passes: axe.passes.length,
      },
      console: events.console,
      pageErrors: events.pageErrors,
      failed: events.failed.slice(0, 10),
      httpErrors: events.httpErrors.slice(0, 10),
      cspConsole: events.cspConsole.length,
      cspRequests: events.cspRequests.length,
      screenshot: shot,
    });
  }

  for (const path of ["/inicio", "/novo-produto"]) {
    reset();
    const t0 = Date.now();
    await page
      .goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 30000 })
      .catch(() => null);
    let redirected = false;
    try {
      await page.waitForURL(/\/auth(\?|$)/, { timeout: 15000 });
      redirected = true;
    } catch {}
    results.push({
      engine: name,
      page: `redirect${path}`,
      redirectMs: Date.now() - t0,
      redirected,
      url: page.url(),
      title: await page.title(),
      console: events.console.slice(0, 6),
      pageErrors: events.pageErrors.slice(0, 6),
      failed: events.failed.slice(0, 10),
      httpErrors: events.httpErrors.slice(0, 10),
    });
  }
  await b.close();
}

writeFileSync(OUT + "/production-visual-summary.json", JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    results.map((r) => ({
      engine: r.engine,
      page: r.page,
      status: r.status,
      loadMs: r.loadMs,
      redirectMs: r.redirectMs,
      redirected: r.redirected,
      overflow: r.overflow,
      violations: r.axe?.violations?.length ?? null,
      console: r.console?.length ?? null,
      httpErrors: r.httpErrors?.length ?? null,
      cspConsole: r.cspConsole,
      cspRequests: r.cspRequests,
      screenshot: r.screenshot?.split("/").pop(),
    })),
    null,
    2,
  ),
);
