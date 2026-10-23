import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { sendChatMessage, clearChatHistory } from "@/lib/chat.functions";
import { unwrapServerFn } from "@/lib/server-fn-envelope";
import { chatHistoryQueryOptions } from "@/lib/query-options";
import { renderChatMarkdown } from "@/lib/chat-markdown";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Bot,
  Calculator,
  Copy,
  MessageSquarePlus,
  PackagePlus,
  Send,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { chatStatusLabel, isChatBusy, transitionChatState, type ChatState } from "@/lib/chat-fsm";

export const Route = createFileRoute("/_authenticated/novo-produto")({
  head: () => ({
    meta: [
      { title: "Novo Produto · Preço que Dá Lucro" },
      { name: "description", content: "Cadastre um produto conversando com a IA." },
    ],
  }),
  component: NovoProduto,
});

interface Msg {
  id?: string;
  localId: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  {
    label: "Cadastrar meu primeiro produto",
    prompt: "Quero cadastrar meu primeiro produto. Pode me guiar?",
    icon: PackagePlus,
  },
  {
    label: "Entender custos e margem",
    prompt: "Quero entender meus custos e a margem do meu produto.",
    icon: Calculator,
  },
  {
    label: "Calcular meu ponto de equilíbrio",
    prompt: "Quero calcular meu ponto de equilíbrio.",
    icon: TrendingUp,
  },
] as const;

let localMessageSequence = 0;

function localId(): string {
  localMessageSequence += 1;
  return `local-${localMessageSequence}`;
}

function NovoProduto() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const send = useServerFn(sendChatMessage);
  const clear = useServerFn(clearChatHistory);
  const historyQuery = useQuery(chatHistoryQueryOptions());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>("idle");
  const loading = isChatBusy(chatState);
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  // Anuncio do reset para leitores de tela: antes o apagamento era silencioso.
  const [resetAnnouncement, setResetAnnouncement] = useState("");
  // Reset so faz sentido se ha fala do usuario; a saudacao inicial nao e historico.
  const conversationEmpty = !messages.some((message) => message.role === "user");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const history = historyQuery.data;
    if (!history) {
      if (historyQuery.isError) {
        setMessages([
          {
            localId: "history-error",
            role: "assistant",
            content: "⚠️ Não foi possível restaurar o histórico da conversa.",
          },
        ]);
      }
      return;
    }
    const restored = history.messages.reduce<Msg[]>((messages, message) => {
      if (message.role === "user" || message.role === "assistant") {
        messages.push({
          id: message.id,
          localId: message.id,
          role: message.role,
          content: message.content,
        });
      }
      return messages;
    }, []);

    if (restored.length === 0) {
      setMessages([
        {
          localId: "welcome",
          role: "assistant",
          content:
            "Olá! Sou seu consultor financeiro. Vamos descobrir juntos quanto realmente custa produzir e vender seu produto. **Qual produto ou receita você gostaria de analisar primeiro?**",
        },
      ]);
    } else {
      setMessages(restored);
    }
    setCurrentProductId(history.currentProductId);
    inputRef.current?.focus();
  }, [historyQuery.data, historyQuery.isError]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { localId: localId(), role: "user", content: text }]);
    setChatState((state) => transitionChatState(state, { type: "SUBMIT" }));
    try {
      const res = await unwrapServerFn(send({ data: { message: text, currentProductId } }));
      setMessages((m) => [...m, { localId: localId(), role: "assistant", content: res.content }]);
      if (res.currentProductId) setCurrentProductId(res.currentProductId);
      await queryClient.invalidateQueries({ queryKey: ["chat", "history"] });
      setChatState((state) => transitionChatState(state, { type: "ASSISTANT_RESPONSE" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar";
      toast.error(msg);
      setMessages((m) => [...m, { localId: localId(), role: "assistant", content: `⚠️ ${msg}` }]);
      setChatState((state) => transitionChatState(state, { type: "FAIL" }));
    } finally {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    void sendMessage(input);
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Resposta copiada.");
    } catch {
      toast.error("Não foi possível copiar a resposta.");
    }
  }

  async function reset() {
    try {
      await unwrapServerFn(clear());
      await queryClient.invalidateQueries({ queryKey: ["chat", "history"] });
      setMessages([
        {
          localId: "welcome",
          role: "assistant",
          content: "Novo começo! Qual produto você gostaria de cadastrar agora?",
        },
      ]);
      setCurrentProductId(null);
      setChatState((state) => transitionChatState(state, { type: "RESET" }));
      setResetAnnouncement("Conversa apagada.");
      window.setTimeout(() => setResetAnnouncement(""), 5000);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      toast.error("Não foi possível apagar a conversa.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-0 flex-col lg:h-[calc(100dvh-11.5rem)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
            <span
              className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-success"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black md:text-3xl">Cadastro conversacional</h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              Consultor financeiro
              <span className="text-border" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                online
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentProductId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                navigate({ to: "/diagnostico", search: { produto: currentProductId } })
              }
            >
              Ver produto
            </Button>
          )}
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            {/* `outline` (nao `ghost`) + rotulo que nomeia a acao: sem caixa visivel o
                gatilho parecia texto, e "Recomecar" prometia reset instantaneo quando
                o primeiro clique apenas abre a confirmacao. Desabilitado com conversa
                vazia (reset seria no-op) e durante resposta em andamento. */}
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={conversationEmpty || loading}
                />
              }
            >
              <MessageSquarePlus className="h-4 w-4" /> Nova conversa
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
                <AlertDialogDescription>
                  O histórico atual será apagado e a conversa volta à saudação inicial. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void reset()}>
                  Apagar conversa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {resetAnnouncement}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border bg-card shadow-sm">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport aria-label="Histórico da conversa">
              <MessageScrollerContent
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                className="gap-5 px-4 py-5 sm:px-6"
              >
                {messages.map((message) => (
                  <MessageScrollerItem
                    key={message.localId}
                    messageId={message.localId}
                    scrollAnchor={message.role === "user"}
                  >
                    <ChatMessage message={message} onCopy={copyMessage} />
                  </MessageScrollerItem>
                ))}

                {conversationEmpty && !loading && (
                  <div className="px-1">
                    <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Comece por aqui
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {SUGGESTIONS.map((suggestion) => {
                        const Icon = suggestion.icon;
                        return (
                          <Button
                            key={suggestion.label}
                            type="button"
                            variant="outline"
                            className="h-auto justify-start gap-2 rounded-2xl px-3 py-2.5 text-left text-xs whitespace-normal"
                            onClick={() => void sendMessage(suggestion.prompt)}
                          >
                            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                            <span>{suggestion.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {loading && (
                  <MessageScrollerItem messageId="assistant-loading">
                    <Message align="start" data-loading="true">
                      <MessageAvatar className="bg-primary/10 text-primary">
                        <Bot className="size-4" aria-hidden="true" />
                      </MessageAvatar>
                      <MessageContent>
                        <MessageHeader>Consultor</MessageHeader>
                        <Bubble variant="muted">
                          <BubbleContent>
                            <span
                              role="status"
                              aria-label={chatStatusLabel(chatState) ?? "Consultor respondendo"}
                              className="flex items-center gap-1.5 py-0.5"
                            >
                              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                            </span>
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <form onSubmit={submit} className="mt-3">
        <Label htmlFor="novo-produto-mensagem" className="sr-only">
          Mensagem para o consultor
        </Label>
        <InputGroup className="border-border bg-card shadow-sm">
          <InputGroupTextarea
            id="novo-produto-mensagem"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Escreva sua resposta..."
            rows={1}
            className="max-h-40 min-h-11"
            disabled={loading}
          />
          <InputGroupAddon align="block-end" className="gap-3">
            <InputGroupText className="hidden text-xs sm:flex">
              Enter envia · Shift+Enter quebra linha
            </InputGroupText>
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label="Enviar"
              className="ms-auto"
              disabled={loading || !input.trim()}
            >
              <Send className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

function ChatMessage({
  message,
  onCopy,
}: Readonly<{
  message: Msg;
  onCopy: (content: string) => Promise<void>;
}>) {
  const isUser = message.role === "user";
  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageAvatar
        className={isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}
      >
        {isUser ? (
          <User className="size-4" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader className={isUser ? "justify-end" : undefined}>
          {isUser ? "Você" : "Consultor"}
        </MessageHeader>
        <Bubble align={isUser ? "end" : "start"} variant={isUser ? "default" : "muted"}>
          <BubbleContent className={isUser ? "whitespace-pre-wrap" : undefined}>
            {isUser ? message.content : renderChatMarkdown(message.content)}
          </BubbleContent>
        </Bubble>
        {!isUser && (
          <MessageFooter className="gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 gap-1 px-1.5 text-xs"
              onClick={() => void onCopy(message.content)}
              aria-label="Copiar resposta"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Copiar
            </Button>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}
