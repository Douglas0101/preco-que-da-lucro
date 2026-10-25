import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) => (
      <a href={typeof to === "string" ? to : undefined} {...props}>
        {children}
      </a>
    ),
  };
});

import { Route } from "@/routes/__root";

const NotFound = Route.options.notFoundComponent as () => ReactElement;

describe("página 404", () => {
  it("usa copy em pt-BR, título próprio e leva ao início", async () => {
    const { container } = render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Página não encontrada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A página que você procura não existe ou foi movida."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o início" })).toHaveAttribute("href", "/");
    expect(document.title).toBe("Página não encontrada · Preço que Dá Lucro");

    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
