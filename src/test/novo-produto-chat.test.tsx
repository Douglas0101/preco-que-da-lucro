import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  send: vi.fn(),
  clear: vi.fn(),
  invalidate: vi.fn(),
  data: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    currentProductId: null as string | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: server.data, isError: false, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: server.invalidate }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/chat.functions", () => ({
  sendChatMessage: server.send,
  clearChatHistory: server.clear,
}));
vi.mock("@/lib/query-options", () => ({
  chatHistoryQueryOptions: () => ({ queryKey: ["chat", "history"], queryFn: vi.fn() }),
}));
vi.mock("@/lib/server-fn-envelope", () => ({ unwrapServerFn: (value: unknown) => value }));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Route } from "@/routes/_authenticated/novo-produto";

const NovoProduto = Route.options.component as () => React.ReactElement;

describe("conversational product chat", () => {
  beforeEach(() => {
    server.data = { messages: [], currentProductId: null };
    server.send.mockReset().mockResolvedValue({
      content: "Resposta do consultor",
      currentProductId: "produto-1",
    });
    server.clear.mockReset().mockResolvedValue(undefined);
    server.invalidate.mockReset().mockResolvedValue(undefined);
  });

  it("starts with the greeting and sends a suggestion as a real turn", async () => {
    const user = userEvent.setup();
    render(<NovoProduto />);

    expect(await screen.findByText(/Olá! Sou seu consultor financeiro/)).toBeInTheDocument();
    expect(screen.getByText("Comece por aqui")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cadastrar meu primeiro produto" }));

    await waitFor(() =>
      expect(server.send).toHaveBeenCalledWith({
        data: {
          message: "Quero cadastrar meu primeiro produto. Pode me guiar?",
          currentProductId: null,
        },
      }),
    );
    expect(
      screen.getByText("Quero cadastrar meu primeiro produto. Pode me guiar?"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Resposta do consultor")).toBeInTheDocument();
    expect(server.invalidate).toHaveBeenCalled();
  });

  it("resets the conversation through the confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<NovoProduto />);

    await screen.findByText(/Olá! Sou seu consultor financeiro/);
    const input = screen.getByLabelText("Mensagem para o consultor");
    await user.type(input, "Quero começar");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Resposta do consultor");

    await user.click(screen.getByRole("button", { name: "Nova conversa" }));
    await user.click(await screen.findByRole("button", { name: "Apagar conversa" }));

    await waitFor(() => expect(server.clear).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Novo começo!/)).toBeInTheDocument();
  });
});
