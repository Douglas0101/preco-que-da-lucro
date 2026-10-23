import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/components/ui/sonner";

export type AuthMode = "signin" | "signup" | "forgot" | "reset";

export function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

export async function submitAuthForm({
  mode,
  token,
  email,
  password,
  name,
  redirect,
  navigate,
  setMode,
  setPassword,
}: Readonly<{
  mode: AuthMode;
  token?: string;
  email: string;
  password: string;
  name: string;
  redirect?: string;
  navigate: ReturnType<typeof useNavigate>;
  setMode: (mode: AuthMode) => void;
  setPassword: (password: string) => void;
}>): Promise<void> {
  if (mode === "forgot") {
    await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/auth`,
    });
    toast.success("Se a conta existir, enviaremos as instruções de recuperação.");
    setMode("signin");
    return;
  }
  if (mode === "reset") {
    if (!token) throw new Error("Link de recuperação inválido.");
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) throw new Error(result.error.message ?? "Não foi possível redefinir.");
    toast.success("Senha redefinida. Entre novamente.");
    setMode("signin");
    setPassword("");
    return;
  }
  if (mode === "signup") {
    const result = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: `${window.location.origin}${redirect ?? "/inicio"}`,
    });
    if (result.error) throw new Error(result.error.message ?? "Não foi possível criar a conta.");
    toast.success("Conta criada! Confirme seu e-mail para entrar.");
    setMode("signin");
    return;
  }
  const result = await authClient.signIn.email({ email, password });
  if (result.error) throw new Error(result.error.message ?? "Credenciais inválidas.");
  await navigate({ to: redirect ?? "/inicio", replace: true });
}
