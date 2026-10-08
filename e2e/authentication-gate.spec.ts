import { expect, test } from "@playwright/test";
import { loginWithUI } from "./helpers/authentication";

test("authentication gate rejects a suppressed post-login redirect", async ({ page }, testInfo) => {
  // This extra sign-in has its own documented fixture IP, retaining the real
  // five-per-minute rule and the existing projects' five-sign-in budgets.
  const fixtureIps: Record<string, string> = {
    chromium: "198.51.100.21",
    firefox: "198.51.100.22",
    webkit: "198.51.100.23",
    mobile: "198.51.100.24",
  };
  const fixtureIp = fixtureIps[testInfo.project.name];
  expect(
    fixtureIp,
    "Each configured project requires a distinct negative fixture IP",
  ).toBeDefined();
  await page.setExtraHTTPHeaders({ "x-forwarded-for": fixtureIp });
  await page.context().clearCookies();
  // Mutation control for DBT-63: preserve real sign-in/session/rendering and
  // suppress only the address update performed by the router after login.
  await page.addInitScript(() => {
    for (const method of ["pushState", "replaceState"] as const) {
      const original = History.prototype[method];
      History.prototype[method] = function (data, unused, url) {
        if (url && new URL(String(url), location.href).pathname === "/inicio") return;
        return original.call(this, data, unused, url);
      };
    }
  });

  await expect(
    loginWithUI(page, {
      email: process.env.E2E_AUTH_EMAIL ?? "",
      password: process.env.E2E_AUTH_PASSWORD ?? "",
    }),
  ).rejects.toThrow("Authenticated navigation must end at /inicio");
  expect(new URL(page.url()).pathname).toBe("/auth");
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();
});
