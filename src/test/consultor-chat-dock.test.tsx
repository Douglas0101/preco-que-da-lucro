import axe from "axe-core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/inicio",
}));

const server = vi.hoisted(() => ({
  clear: vi.fn(),
  data: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    currentProductId: null as string | null,
  },
}));

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: state.pathname }),
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: server.data, isError: false, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/chat.functions", () => ({
  sendChatMessage: vi.fn(),
  clearChatHistory: server.clear,
}));
vi.mock("@/lib/query-options", () => ({
  chatHistoryQueryOptions: () => ({ queryKey: ["chat", "history"], queryFn: vi.fn() }),
}));
vi.mock("@/lib/server-fn-envelope", () => ({ unwrapServerFn: (value: unknown) => value }));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ConsultorChatDock } from "@/components/consultor-chat-dock";

describe("floating consultor chat", () => {
  beforeEach(() => {
    state.pathname = "/inicio";
    server.data = { messages: [], currentProductId: null };
    server.clear.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
  });

  it("opens the Simon panel, exposes the labelled composer and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(<ConsultorChatDock />);

    const launcher = screen.getByRole("button", {
      name: "Falar com o Simon, consultor de precificação",
    });
    expect(launcher).toHaveAttribute("aria-haspopup", "dialog");
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(launcher);
    expect(launcher).toHaveAttribute("aria-expanded", "true");
    const dialog = await screen.findByRole("dialog", { name: /Simon/ });
    expect(
      await screen.findByText(/Olá! Sou o Simon, seu consultor de precificação/),
    ).toBeInTheDocument();
    const composer = within(dialog).getByLabelText("Mensagem para o consultor");
    expect(composer).toHaveAttribute("id", "simon-mensagem");
    expect(document.querySelectorAll("#novo-produto-mensagem")).toHaveLength(0);

    const axeResult = await axe.run(dialog, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(axeResult.violations).toEqual([]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(launcher).toHaveFocus();
  });

  it("exposes a visible scroll bar when the suggestion row overflows", async () => {
    const user = userEvent.setup();
    const scrollWidth = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(620);
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);

    try {
      render(<ConsultorChatDock />);
      await user.click(
        screen.getByRole("button", { name: "Falar com o Simon, consultor de precificação" }),
      );
      const dialog = await screen.findByRole("dialog", { name: /Simon/ });
      const bar = await within(dialog).findByRole("slider", {
        name: "Rolagem das sugestões",
      });
      const scroller = dialog.querySelector('[data-slot="suggestion-scroller"]') as HTMLElement;

      fireEvent.change(bar, { target: { value: "150" } });
      expect(scroller.scrollLeft).toBe(150);

      scroller.dispatchEvent(new Event("scroll"));
      await waitFor(() => expect(bar).toHaveAttribute("aria-valuetext", "50%"));
    } finally {
      scrollWidth.mockRestore();
      clientWidth.mockRestore();
    }
  });

  it("keeps the panel open while the nested reset confirmation is used", async () => {
    server.data = {
      messages: [
        { id: "m1", role: "user", content: "Quero precificar minha camiseta." },
        { id: "m2", role: "assistant", content: "Resposta restaurada do consultor." },
      ],
      currentProductId: "produto-1",
    };
    const user = userEvent.setup();
    render(<ConsultorChatDock />);

    await user.click(
      screen.getByRole("button", { name: "Falar com o Simon, consultor de precificação" }),
    );
    const dialog = await screen.findByRole("dialog", { name: /Simon/ });
    expect(
      await within(dialog).findByText("Resposta restaurada do consultor."),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Ver produto" }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/diagnostico",
      search: { produto: "produto-1" },
    });

    await user.click(within(dialog).getByRole("button", { name: "Nova conversa" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Apagar esta conversa?" });
    await user.click(within(confirm).getByRole("button", { name: "Apagar conversa" }));

    await waitFor(() => expect(server.clear).toHaveBeenCalledOnce());
    expect(await within(dialog).findByText(/Novo começo!/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Simon/ })).toBeInTheDocument();
  });

  it("stays out of the full chat route, which already renders the workspace", () => {
    state.pathname = "/novo-produto";
    render(<ConsultorChatDock />);

    expect(
      screen.queryByRole("button", { name: "Falar com o Simon, consultor de precificação" }),
    ).toBeNull();
  });
});
