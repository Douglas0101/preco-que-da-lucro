import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/inicio" }));

const server = vi.hoisted(() => ({
  data: {
    messages: [] as Array<{ id: string; role: string; content: string }>,
    currentProductId: null as string | null,
  },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useLocation: () => ({ pathname: state.pathname }),
    useNavigate: () => vi.fn(),
  };
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: server.data, isError: false, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/chat.functions", () => ({
  sendChatMessage: vi.fn(),
  clearChatHistory: vi.fn(),
}));
vi.mock("@/lib/query-options", () => ({
  chatHistoryQueryOptions: () => ({ queryKey: ["chat", "history"], queryFn: vi.fn() }),
}));
vi.mock("@/lib/server-fn-envelope", () => ({ unwrapServerFn: (value: unknown) => value }));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
// Simula falha de carregamento/hidratação do chunk do chat.
vi.mock("@/components/consultor-chat", () => ({
  ConsultorChat: () => {
    throw new Error("chunk indisponível");
  },
}));

import { ConsultorChatDock } from "@/components/consultor-chat-dock";

describe("floating consultor chat — falha do chunk", () => {
  beforeEach(() => {
    state.pathname = "/inicio";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("shows a recoverable message instead of crashing the shell", async () => {
    const user = userEvent.setup();
    render(<ConsultorChatDock />);

    await user.click(
      screen.getByRole("button", { name: "Falar com o Simon, consultor de precificação" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível abrir o consultor agora.",
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Simon/ })).toBeInTheDocument();
  });
});
