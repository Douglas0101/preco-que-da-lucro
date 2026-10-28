import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    preload: _preload,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    preload?: string;
    children?: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { DesktopNavigation } from "@/components/desktop-navigation";

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

describe("desktop navigation", () => {
  it("renders the three top-level entries and marks Início as current", () => {
    const { container } = render(<DesktopNavigation pathname="/inicio" />);

    expect(screen.getByRole("navigation", { name: "Menu principal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Cadastro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Financeiro" })).toBeInTheDocument();
    expect(container.querySelector("a button, button a")).not.toBeInTheDocument();
  });

  it("opens Cadastro and marks the group active on a nested product route", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<DesktopNavigation pathname="/produtos/composicao" />);

    const cadastro = screen.getByRole("button", { name: "Cadastro" });
    expect(cadastro).toHaveAttribute("data-active", "true");

    await user.click(cadastro);
    const products = screen.getByRole("link", { name: "Meus Produtos" });
    await waitFor(() => expect(products).toBeVisible());
    expect(products).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Preços de Compra" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Minhas Despesas" })).toBeVisible();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Meus Produtos" })).not.toBeInTheDocument(),
    );
    await expectNoAxeViolations(document.body ?? container);

    rerender(<DesktopNavigation pathname="/inicio" />);
    expect(screen.getByRole("button", { name: "Cadastro" })).not.toHaveAttribute("data-active");
  });

  it("opens Financeiro with all four items and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<DesktopNavigation pathname="/vendas" />);

    const financeiro = screen.getByRole("button", { name: "Financeiro" });
    financeiro.focus();
    await user.keyboard("{Enter}");

    for (const name of ["Vendas", "Ponto de Equilíbrio", "Simulações", "Diagnóstico"]) {
      await waitFor(() => expect(screen.getByRole("link", { name })).toBeVisible());
    }

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Diagnóstico" })).not.toBeInTheDocument(),
    );
    expect(financeiro).toHaveFocus();
  });
});
