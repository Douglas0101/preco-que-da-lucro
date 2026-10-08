// Shared helpers for ciclo-29 QA gates (DBT-86/89 verification).
// Runs against a local loopback bench. Fixture credentials are read from the
// bench server process environment and are never printed, logged or persisted.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { redactPng } from "../../src/lib/observability/visual-redaction.ts";

const ALLOWED_HOST = /^127\.0\.0\.1$/;

export function assertLoopbackBench(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || !ALLOWED_HOST.test(url.hostname)) {
    throw new Error(`bench must be loopback http, got ${baseUrl}`);
  }
  return url;
}

function pidListeningOn(port) {
  const out = execFileSync("ss", ["-ltnp", `sport = :${port}`], { encoding: "utf8" });
  const match = out.match(/pid=(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Fixture credentials live in the environment of the bench server process
 * (never in the repository). Resolves them by discovering the PID that owns
 * the bench port; returns undefined values when the bench is not running.
 */
export function readBenchFixtureCredentials(benchUrl) {
  const url = assertLoopbackBench(benchUrl);
  const port = url.port || "80";
  const pid = pidListeningOn(port);
  if (!pid) return { pid: null, email: undefined, password: undefined };
  return { pid, ...readBenchEnv(pid) };
}

/** Reads named variables from the bench server process environment. */
export function readBenchEnv(pid, names) {
  const env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  const read = (name) => {
    const hit = env.find((entry) => entry.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  };
  if (Array.isArray(names)) return Object.fromEntries(names.map((name) => [name, read(name)]));
  return {
    email: read("E2E_AUTH_EMAIL"),
    password: read("E2E_AUTH_PASSWORD"),
    databaseUrl: read("DATABASE_URL"),
  };
}

export async function loginIfNeeded(page, baseUrl, creds) {
  await page.waitForFunction(
    () =>
      document.querySelector("#email") !== null ||
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent?.trim() === "Sair",
      ),
    null,
    { timeout: 15000 },
  );
  if ((await page.locator("#email").count()) === 0) return false;
  await page.waitForURL((url) => url.pathname === "/auth", { timeout: 10000 });
  if (!creds.email || !creds.password)
    throw new Error("fixture credentials unavailable from bench env");
  const redirectTarget = new URL(page.url()).searchParams.get("redirect") ?? "/inicio";
  // A fresh document's session lookup establishes React hydration. Old
  // responses or SSR-visible fields cannot authorize a native form submit.
  let committed = false;
  let hydrationRequest;
  const onNavigation = (frame) => {
    if (frame === page.mainFrame()) committed = true;
  };
  const onRequest = (request) => {
    if (
      committed &&
      request.frame() === page.mainFrame() &&
      new URL(request.url()).pathname === "/api/auth/get-session" &&
      request.method() === "GET"
    ) {
      hydrationRequest ??= request;
    }
  };
  page.on("framenavigated", onNavigation);
  page.on("request", onRequest);
  const ready = page.waitForResponse((response) => response.request() === hydrationRequest, {
    timeout: 10000,
  });
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    if ((await ready).status() !== 200) throw new Error("fixture client session lookup rejected");
  } finally {
    page.off("framenavigated", onNavigation);
    page.off("request", onRequest);
  }
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  const submitted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
      response.request().method() === "POST",
    { timeout: 10000 },
  );
  await page.click("button[type=submit]");
  const status = (await submitted).status();
  if (status !== 200) throw new Error(`fixture sign-in rejected (HTTP ${status})`);
  await page.waitForURL(`**${redirectTarget}**`, { timeout: 10000 });
  return true;
}

export async function waitForRouteReady(page) {
  await page.waitForFunction(
    () =>
      document.querySelector("main") !== null &&
      (location.pathname !== "/inicio" ||
        /margem consolidada|Não foi possível carregar/i.test(document.body.innerText)) &&
      ![...document.querySelectorAll('[role="status"]')].some((node) =>
        /Carregando/.test(node.textContent ?? ""),
      ),
    null,
    { timeout: 15000 },
  );
}

export async function persistBenchScreenshot(page, path, element = page) {
  const buffer = await element.screenshot({
    mask: [page.locator('input[type="password"], input[type="email"]')],
  });
  writeFileSync(path, redactPng(buffer).value);
}

export async function logoutViaUi(page) {
  await page.getByRole("button", { name: "Sair" }).first().click();
  await page.waitForURL("**/auth**", { timeout: 20000 });
}

const MIN_ASSERTED_CLIENT_WIDTH = 8;

/**
 * Geometry probe: document plus key containers must satisfy
 * scrollWidth <= clientWidth (no hidden/clip-dependent layout).
 * Elements below the minimum client width are ignored (invisible helpers).
 */
export function geometryProbe() {
  // Inline on purpose: this function is serialized into the page context,
  // where module-scope bindings do not exist.
  const MIN_CLIENT_WIDTH = 8;
  const de = document.documentElement;
  const selectors = ["main", "form", "div.grid.gap-4", '[class*="bg-card"]'];
  const seen = new Set();
  const containers = [];
  const roots = [de, ...document.querySelectorAll(selectors.join(","))];
  for (const el of roots) {
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cw = el.clientWidth;
    if (cw < MIN_CLIENT_WIDTH) continue;
    containers.push({
      tag: el.tagName,
      cls: String(el.className).slice(0, 90),
      clientWidth: cw,
      scrollWidth: el.scrollWidth,
      overflow: el.scrollWidth - cw,
    });
  }
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentClientWidth: de.clientWidth,
    documentScrollWidth: de.scrollWidth,
    containers,
  };
}

export function geometryVerdict(probe) {
  const offenders = probe.containers.filter((c) => c.overflow > 0);
  return { ok: offenders.length === 0, offenders };
}
