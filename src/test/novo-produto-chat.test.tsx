import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  send: vi.fn(),
  clear: vi.fn(),
  invalidate: vi.fn(),
  data: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    currentProductId: null as string | null,
  },
}));

const navigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
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
vi.mock("@/components/ui/sonner", () => ({ toast }));

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
    navigate.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("starts with the greeting and sends a suggestion as a real turn", async () => {
    const user = userEvent.setup();
    const { container } = render(<NovoProduto />);

    expect(
      await screen.findByRole("heading", { name: "Precificação de produto" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Olá! Sou o Simon, seu consultor de precificação/)).toBeInTheDocument();
    expect(screen.getByText("Comece por aqui")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem para o consultor")).toHaveAttribute(
      "id",
      "novo-produto-mensagem",
    );
    // Estado vazio é o herói do turno zero: o histórico persistido não ganha
    // uma mensagem de saudação que o servidor nunca gravou.
    expect(screen.queryByRole("log")).toBeNull();
    expect(container.querySelector('[data-slot="message"]')).toBeNull();

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

    // A fala da pessoa é bolha `muted` do lado end; a resposta do consultor é
    // texto (markdown) do lado start, com a ação de copiar no rodapé.
    const userBubble = container.querySelector(
      '[data-slot="message"][data-align="end"] [data-slot="bubble"][data-variant="muted"]',
    );
    expect(userBubble).toHaveTextContent("Quero cadastrar meu primeiro produto. Pode me guiar?");
    const assistantTurn = container.querySelector('[data-slot="message"][data-align="start"]');
    expect(assistantTurn).toHaveTextContent("Resposta do consultor");
    expect(assistantTurn?.querySelector('[data-slot="bubble"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Copiar resposta" })).toBeInTheDocument();
  });

  it("resets the conversation through the confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<NovoProduto />);

    await screen.findByText(/Olá! Sou o Simon/);
    const input = screen.getByLabelText("Mensagem para o consultor");
    await user.type(input, "Quero começar");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Resposta do consultor");

    await user.click(screen.getByRole("button", { name: "Nova conversa" }));
    await user.click(await screen.findByRole("button", { name: "Apagar conversa" }));

    await waitFor(() => expect(server.clear).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Novo começo!/)).toBeInTheDocument();
  });

  it("copies the consultant reply to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<NovoProduto />);

    await screen.findByText(/Olá! Sou o Simon/);
    await user.type(screen.getByLabelText("Mensagem para o consultor"), "Quanto custa?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Resposta do consultor");
    await user.click(screen.getByRole("button", { name: "Copiar resposta" }));

    expect(writeText).toHaveBeenCalledWith("Resposta do consultor");
    expect(toast.success).toHaveBeenCalledWith("Resposta copiada.");
  });

  it("surfaces a failed send without leaving the composer stuck", async () => {
    const user = userEvent.setup();
    server.send.mockRejectedValueOnce(new Error("Falha de rede"));
    render(<NovoProduto />);

    await screen.findByText(/Olá! Sou o Simon/);
    await user.type(screen.getByLabelText("Mensagem para o consultor"), "Quanto custa?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("⚠️ Falha de rede")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Falha de rede");
    // O campo foi limpo no envio: o botão volta a desabilitado sem travar a tela.
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByLabelText("Mensagem para o consultor")).toBeEnabled();
  });

  it("announces the pending state while the consultant replies", async () => {
    const user = userEvent.setup();
    let resolveSend!: (value: { content: string; currentProductId: null }) => void;
    server.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const { container } = render(<NovoProduto />);

    await screen.findByText(/Olá! Sou o Simon/);
    await user.type(screen.getByLabelText("Mensagem para o consultor"), "Quanto custa?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(container.querySelector('[data-loading="true"]')).not.toBeNull());
    expect(screen.getByRole("status", { name: "Consultor pensando" })).toBeInTheDocument();

    resolveSend({ content: "Resposta do consultor", currentProductId: null });
    expect(await screen.findByText("Resposta do consultor")).toBeInTheDocument();
  });

  it("exposes the renamed route metadata", () => {
    const head = Route.options.head as
      (() => { meta?: Array<{ title?: string; name?: string; content?: string }> }) | undefined;
    const meta = head?.().meta ?? [];
    expect(meta).toContainEqual({ title: "Precificação · Preço que Dá Lucro" });
    expect(meta).toContainEqual({
      name: "description",
      content: "Precifique seu produto conversando com o Simon.",
    });
  });

  it("links the current product from the header", async () => {
    server.data = {
      messages: [{ id: "m1", role: "assistant", content: "Conversa restaurada." }],
      currentProductId: "produto-1",
    };
    const user = userEvent.setup();
    render(<NovoProduto />);

    await screen.findByText("Conversa restaurada.");
    await user.click(screen.getByRole("button", { name: "Ver produto" }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/diagnostico",
      search: { produto: "produto-1" },
    });
  });
});
