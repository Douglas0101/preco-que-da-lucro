import axe from "axe-core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({ redirect: undefined, token: undefined }),
  };
});

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: null }),
    signIn: { social: vi.fn() },
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
  toast: { error: vi.fn() },
}));

import { Route } from "@/routes/auth";

const Auth = Route.options.component as () => ReactElement;

describe("formulário de autenticação", () => {
  it("expõe autocomplete correto e atualiza o título ao alternar para cadastro", async () => {
    const { container } = render(<Auth />);

    const email = screen.getByLabelText("E-mail");
    const password = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    await waitFor(() => expect(document.title).toBe("Entrar · Preço que Dá Lucro"));

    fireEvent.click(screen.getByRole("button", { name: "Cadastre-se" }));

    await waitFor(() => expect(document.title).toBe("Criar conta · Preço que Dá Lucro"));
    expect(
      screen.getByRole("heading", { level: 2, name: "Vamos começar juntos" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Como podemos te chamar?")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "new-password");

    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
