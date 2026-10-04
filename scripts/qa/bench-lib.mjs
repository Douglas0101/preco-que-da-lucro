// Shared helpers for ciclo-29 QA gates (DBT-86/89 verification).
// Runs against a local loopback bench. Fixture credentials are read from the
// bench server process environment and are never printed, logged or persisted.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
  const env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  const read = (name) => {
    const hit = env.find((entry) => entry.startsWith(`${name}=`));
    return hit ? hit.slice(name.length + 1) : undefined;
  };
  return { pid, email: read("E2E_AUTH_EMAIL"), password: read("E2E_AUTH_PASSWORD") };
}

export async function loginIfNeeded(page, baseUrl, creds) {
  await page.waitForTimeout(800);
  if (!new URL(page.url()).pathname.startsWith("/auth")) return false;
  if (!creds.email || !creds.password)
    throw new Error("fixture credentials unavailable from bench env");
  // Sign-in is rate limited to 5 attempts per minute per IP (rate-limit-rules
  // .server.ts); a gate run must tolerate a 429 by waiting out the window. The
  // whole fill+submit is retried: a pending SPA redirect can land between fill
  // and click and wipe the fields on slower runs.
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.locator("#email").waitFor({ state: "visible", timeout: 10000 });
    await page.fill("#email", creds.email);
    await page.fill("#password", creds.password);
    await page.click("button[type=submit]");
    try {
      await page.waitForURL("**/inicio**", { timeout: 10000 });
      return true;
    } catch {
      const body = await page.evaluate(() => document.body.innerText);
      const rateLimited = /Muitas solicita/i.test(body);
      if (
        attempt === attempts ||
        (!rateLimited && !new URL(page.url()).pathname.startsWith("/auth"))
      ) {
        throw new Error("sign-in did not complete");
      }
      if (rateLimited) await page.waitForTimeout(25000);
    }
  }
  throw new Error("sign-in did not complete");
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
