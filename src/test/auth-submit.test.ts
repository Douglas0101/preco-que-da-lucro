import { describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ authClient }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null, toast }));
import { safeRedirect, submitAuthForm } from "@/lib/auth-form";

function form(overrides: Partial<Parameters<typeof submitAuthForm>[0]> = {}) {
  return {
    mode: "signin" as const,
    token: undefined,
    email: "teste@example.test",
    password: "password-123",
    name: "Teste",
    redirect: undefined,
    navigate: vi.fn(async () => undefined) as never,
    setMode: vi.fn(),
    setPassword: vi.fn(),
    ...overrides,
  };
}

describe("auth form submission", () => {
  it("forgot: requests reset, confirms generically and returns to signin", async () => {
    const input = form({ mode: "forgot" });
    await submitAuthForm(input);
    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: input.email,
      redirectTo: `${window.location.origin}/auth`,
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Se a conta existir, enviaremos as instruções de recuperação.",
    );
    expect(input.setMode).toHaveBeenCalledWith("signin");
  });

  it("reset: rejects without a token and surfaces provider errors", async () => {
    await expect(submitAuthForm(form({ mode: "reset" }))).rejects.toThrow(
      "Link de recuperação inválido.",
    );
    authClient.resetPassword.mockResolvedValueOnce({ error: { message: "token expirado" } });
    await expect(submitAuthForm(form({ mode: "reset", token: "token-1" }))).rejects.toThrow(
      "token expirado",
    );
  });

  it("reset: confirms success, clears the password and returns to signin", async () => {
    authClient.resetPassword.mockResolvedValueOnce({ error: null });
    const input = form({ mode: "reset", token: "token-2" });
    await submitAuthForm(input);
    expect(authClient.resetPassword).toHaveBeenCalledWith({
      newPassword: input.password,
      token: "token-2",
    });
    expect(toast.success).toHaveBeenCalledWith("Senha redefinida. Entre novamente.");
    expect(input.setMode).toHaveBeenCalledWith("signin");
    expect(input.setPassword).toHaveBeenCalledWith("");
  });

  it("signup: surfaces provider errors and confirms the created account", async () => {
    authClient.signUp.email.mockResolvedValueOnce({ error: { message: "e-mail em uso" } });
    await expect(submitAuthForm(form({ mode: "signup" }))).rejects.toThrow("e-mail em uso");
    authClient.signUp.email.mockResolvedValueOnce({ error: null });
    const input = form({ mode: "signup" });
    await submitAuthForm(input);
    expect(authClient.signUp.email).toHaveBeenCalledWith({
      name: input.name,
      email: input.email,
      password: input.password,
      callbackURL: `${window.location.origin}/inicio`,
    });
    expect(toast.success).toHaveBeenCalledWith("Conta criada! Confirme seu e-mail para entrar.");
    expect(input.setMode).toHaveBeenCalledWith("signin");
  });

  it("signin: surfaces errors and navigates to the redirect target on success", async () => {
    authClient.signIn.email.mockResolvedValueOnce({ error: { message: "credenciais inválidas" } });
    await expect(submitAuthForm(form())).rejects.toThrow("credenciais inválidas");
    authClient.signIn.email.mockResolvedValueOnce({ error: null });
    const input = form({ redirect: "/produtos" });
    await submitAuthForm(input);
    expect(input.navigate).toHaveBeenCalledWith({ to: "/produtos", replace: true });
  });

  it("safeRedirect accepts only local paths", () => {
    expect(safeRedirect("/inicio")).toBe("/inicio");
    expect(safeRedirect("//evil.example")).toBeUndefined();
    expect(safeRedirect("https://evil.example")).toBeUndefined();
    expect(safeRedirect(42)).toBeUndefined();
  });
});
