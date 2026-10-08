import { expect, type Frame, type Page, type Request } from "@playwright/test";

type Credentials = Readonly<{ email: string; password: string }>;

export async function loginWithUI(page: Page, credentials: Credentials): Promise<void> {
  expect(credentials.email, "E2E_AUTH_EMAIL deve estar configurada").not.toBe("");
  expect(credentials.password, "E2E_AUTH_PASSWORD deve estar configurada").not.toBe("");

  // Auth's getSession effect runs after React attaches the form handlers. SSR
  // visibility alone permits a native submit before hydration, returning /auth.
  let committed = false;
  let hydrationRequest: Request | undefined;
  const onNavigation = (frame: Frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/auth") committed = true;
  };
  const onRequest = (request: Request) => {
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
  // Match the new document's request identity; a pending response from the
  // preceding /auth document cannot establish readiness after this navigation.
  const ready = page.waitForResponse((response) => response.request() === hydrationRequest, {
    timeout: 5_000,
  });
  try {
    await page.goto("/auth");
    expect((await ready).status(), "Auth's client session lookup must succeed").toBe(200);
  } finally {
    page.off("framenavigated", onNavigation);
    page.off("request", onRequest);
  }

  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  const submitted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-in/email" &&
      response.request().method() === "POST",
    { timeout: 5_000 },
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await submitted).status(), "The UI must submit a successful sign-in").toBe(200);

  const sessionResponse = await page.request.get("/api/auth/get-session");
  expect(sessionResponse.status(), "The authenticated session lookup must succeed").toBe(200);
  const session: unknown = await sessionResponse.json();
  const authenticated =
    typeof session === "object" &&
    session !== null &&
    "session" in session &&
    Boolean(session.session) &&
    "user" in session &&
    typeof session.user === "object" &&
    session.user !== null &&
    "email" in session.user &&
    session.user.email === credentials.email;
  // Persist neither response bodies nor cookie values, including on failure.
  expect(authenticated, "The session must belong to the submitted fixture identity").toBe(true);
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();
  // Once the authenticated shell is visible, a missing redirect is a state
  // assertion failure. It must not be hidden by retrying login or extending time.
  expect(new URL(page.url()).pathname, "Authenticated navigation must end at /inicio").toBe(
    "/inicio",
  );
}
