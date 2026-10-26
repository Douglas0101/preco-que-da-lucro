import { useEffect, useRef, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUp,
  Calculator,
  Copy,
  MessageSquarePlus,
  Package,
  PackagePlus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { clearChatHistory, sendChatMessage } from "@/lib/chat.functions";
import { unwrapServerFn } from "@/lib/server-fn-envelope";
import { chatHistoryQueryOptions } from "@/lib/query-options";
import { renderChatMarkdown } from "@/lib/chat-markdown";
import { chatStatusLabel, isChatBusy, transitionChatState, type ChatState } from "@/lib/chat-fsm";
import { CONSULTOR } from "@/lib/consultor-persona";
import { MESSAGE_ANIMATIONS } from "@/lib/message-animations";
import { cn } from "@/lib/utils";
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
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { ConsultorAvatar } from "@/components/consultor-avatar";

/** `page` = rota completa; `panel` = conteúdo do painel flutuante (Sheet). */
type ConsultorChatVariant = "page" | "panel";

interface Msg {
  id?: string;
  localId: string;
  role: "user" | "assistant";
  content: string;
}

/* Saudação = estado vazio da conversa (não é turno do histórico). O texto
   inicial continua legível para leitores de tela no cabeçalho do estado
   vazio, sem inventar uma mensagem que o servidor não persistiu. */
const INITIAL_WELCOME = {
  title: "Qual produto ou receita você gostaria de analisar primeiro?",
  description:
    "Olá! Sou o Simon, seu consultor de precificação. Vamos descobrir juntos quanto realmente custa produzir e vender seu produto.",
} as const;

const RESET_WELCOME = {
  title: "Novo começo!",
  description: "Qual produto você gostaria de precificar agora?",
} as const;

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

/**
 * O fluxo animado do Chat oficial (AI Elements) usa `motion.create` sobre o
 * item do scroller: cada turno entra com `slide-up` e respeita
 * `prefers-reduced-motion`.
 */
const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

/**
 * Barra de rolagem horizontal visível das sugestões. O scroller nativo fica
 * oculto (`no-scrollbar`); este range é o affordance persistente no desktop e
 * no mobile — arrasta, clica e responde às setas/Home/End do teclado. Também
 * reflete a posição quando a pessoa rola a faixa com a roda ou o toque.
 */
function SuggestionScrollBar({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const [metrics, setMetrics] = useState({ left: 0, max: 0 });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const sync = () => {
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      setMetrics((previous) =>
        previous.left === element.scrollLeft && previous.max === max
          ? previous
          : { left: element.scrollLeft, max },
      );
    };

    sync();
    element.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [scroller]);

  if (metrics.max === 0) return null;

  return (
    <Input
      type="range"
      min={0}
      max={Math.round(metrics.max)}
      step={1}
      value={Math.round(metrics.left)}
      onChange={(event) => {
        const element = scroller.current;
        if (element) element.scrollLeft = Number(event.target.value);
      }}
      aria-label="Rolagem das sugestões"
      aria-valuetext={`${Math.round((metrics.left / metrics.max) * 100)}%`}
      title="Arraste ou use as setas para ver todas as sugestões"
      className="suggestion-scrollbar mt-2 w-full border-0 p-0"
    />
  );
}

let localMessageSequence = 0;

function localId(): string {
  localMessageSequence += 1;
  return `local-${localMessageSequence}`;
}

function ConsultorChat({ variant = "page" }: Readonly<{ variant?: ConsultorChatVariant }>) {
  const isPanel = variant === "panel";
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
  const [welcome, setWelcome] = useState<{ title: string; description: string }>(INITIAL_WELCOME);
  // Anuncio do reset para leitores de tela: antes o apagamento era silencioso.
  const [resetAnnouncement, setResetAnnouncement] = useState("");
  // Reset so faz sentido se ha fala do usuario; a saudacao inicial nao e historico.
  const conversationEmpty = !messages.some((message) => message.role === "user");
  const showWelcome = messages.length === 0 && !loading;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  // IDs únicos por instância de tela: a página e o painel nunca compartilham
  // `id` de controle (dois mounts não podem gerar `id` duplicado no DOM).
  const inputId = isPanel ? "simon-mensagem" : "novo-produto-mensagem";
  const helpId = `${inputId}-ajuda`;

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
    const restored = history.messages.reduce<Msg[]>((restoredMessages, message) => {
      if (message.role === "user" || message.role === "assistant") {
        restoredMessages.push({
          id: message.id,
          localId: message.id,
          role: message.role,
          content: message.content,
        });
      }
      return restoredMessages;
    }, []);

    setMessages(restored);
    // O refetch pós-envio não pode sobrescrever a saudação de reset ("Novo
    // começo!"): a cópia inicial já é o estado padrão, e só o reset a troca.
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
      setMessages([]);
      setWelcome(RESET_WELCOME);
      setCurrentProductId(null);
      setChatState((state) => transitionChatState(state, { type: "RESET" }));
      setResetAnnouncement("Conversa apagada.");
      window.setTimeout(() => setResetAnnouncement(""), 5000);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      toast.error("Não foi possível apagar a conversa.");
    }
  }

  const headerActions = (
    <ChatHeaderActions
      compact={isPanel}
      currentProductId={currentProductId}
      onOpenProduct={() => {
        if (!currentProductId) return;
        // O `navigate` do TanStack devolve promessa: sem tratamento ela fica
        // flutuante, o que o Sonar classifica como bug de confiabilidade
        // (S6544) e rebaixa o rating de código novo.
        void navigate({ to: "/diagnostico", search: { produto: currentProductId } });
      }}
      resetDialogOpen={resetDialogOpen}
      onResetDialogOpenChange={setResetDialogOpen}
      onReset={reset}
      resetDisabled={conversationEmpty || loading}
    />
  );

  return (
    <div
      className={cn(
        "flex flex-col",
        isPanel
          ? "h-full min-h-0"
          : "mx-auto h-[calc(100dvh-8.5rem)] min-h-[30rem] w-full max-w-3xl lg:h-[calc(100dvh-11.5rem)]",
      )}
    >
      {isPanel ? (
        <header className="flex items-start justify-between gap-3 border-b px-4 pt-4 pb-3 pe-14">
          <div className="flex min-w-0 items-center gap-3">
            <ConsultorAvatar />
            <div className="flex min-w-0 flex-col gap-0.5">
              <SheetTitle className="truncate text-sm font-semibold">{CONSULTOR.name}</SheetTitle>
              <SheetDescription className="flex min-w-0 items-center gap-1.5 text-xs">
                <span className="truncate">{CONSULTOR.roleLabel}</span>
                {/* O ponto verde do avatar já sinaliza presença; no celular o
                    texto "online" repetiria o sinal e empurraria o cabeçalho
                    para três linhas. O estado continua no sr-only abaixo. */}
                <span className="hidden text-border sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden items-center gap-1.5 sm:inline-flex">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  online
                </span>
                <span className="sr-only">online</span>
              </SheetDescription>
            </div>
          </div>
          {headerActions}
          <p role="status" aria-live="polite" className="sr-only">
            {resetAnnouncement}
          </p>
        </header>
      ) : (
        <header className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-base font-medium">Precificação de produto</h1>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <span>
                {CONSULTOR.name} · {CONSULTOR.role}
              </span>
              <span className="text-border" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                online
              </span>
            </p>
          </div>
          {headerActions}
          <p role="status" aria-live="polite" className="sr-only">
            {resetAnnouncement}
          </p>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {showWelcome ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-4 px-2 pb-6 text-center",
              isPanel && "px-4",
            )}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-balance">{welcome.title}</h2>
              <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">
                {welcome.description}
              </p>
            </div>
          </div>
        ) : (
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller>
              <MessageScrollerViewport aria-label="Histórico da conversa">
                <MessageScrollerContent
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions text"
                  className={cn("gap-6 py-2", isPanel ? "px-4" : "px-1")}
                >
                  {messages.map((message) => (
                    <MotionMessageScrollerItem
                      key={message.localId}
                      messageId={message.localId}
                      scrollAnchor={message.role === "user"}
                      variants={MESSAGE_ANIMATIONS["slide-up"].variants}
                      initial={shouldReduceMotion ? false : "initial"}
                      animate="animate"
                    >
                      <ChatMessage message={message} onCopy={copyMessage} />
                    </MotionMessageScrollerItem>
                  ))}

                  {loading && (
                    <MessageScrollerItem messageId="assistant-loading">
                      <ThinkingMessage chatState={chatState} />
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>

      {conversationEmpty && !loading && (
        <div className={cn("flex flex-col gap-2 pb-3", isPanel && "px-4")}>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Comece por aqui
          </p>
          {/* Suggestion: uma linha de atalhos que rola na horizontal no celular,
              imediatamente acima do campo (padrão AI Elements). */}
          <div
            ref={suggestionsRef}
            data-slot="suggestion-scroller"
            className="scroll-fade-x no-scrollbar -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1"
          >
            {SUGGESTIONS.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <Button
                  key={suggestion.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => void sendMessage(suggestion.prompt)}
                >
                  <Icon className="size-3.5 text-primary" aria-hidden="true" />
                  {suggestion.label}
                </Button>
              );
            })}
          </div>
          <SuggestionScrollBar scroller={suggestionsRef} />
        </div>
      )}

      <form
        onSubmit={submit}
        className={cn("pt-1", isPanel && "px-4 pb-[max(1rem,env(safe-area-inset-bottom))]")}
      >
        <Label htmlFor={inputId} className="sr-only">
          Mensagem para o consultor
        </Label>
        <p id={helpId} className="sr-only">
          Enter envia a mensagem. Shift+Enter quebra a linha.
        </p>
        <InputGroup>
          <InputGroupTextarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Pergunte sobre custos, margem ou ponto de equilíbrio…"
            aria-describedby={helpId}
            rows={1}
            className={cn("max-h-40 py-3", isPanel ? "min-h-12" : "min-h-14")}
            disabled={loading}
          />
          <InputGroupAddon align="block-end">
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              aria-label="Enviar"
              className="ms-auto"
              disabled={loading || !input.trim()}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

interface ChatHeaderActionsProps {
  compact: boolean;
  currentProductId: string | null;
  onOpenProduct: () => void;
  resetDialogOpen: boolean;
  onResetDialogOpenChange: (open: boolean) => void;
  onReset: () => Promise<void>;
  resetDisabled: boolean;
}

function ChatHeaderActions({
  compact,
  currentProductId,
  onOpenProduct,
  resetDialogOpen,
  onResetDialogOpenChange,
  onReset,
  resetDisabled,
}: ChatHeaderActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {currentProductId &&
        (compact ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Ver produto"
            title="Ver produto"
            onClick={onOpenProduct}
          >
            <Package className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onOpenProduct}>
            Ver produto
          </Button>
        ))}
      <AlertDialog open={resetDialogOpen} onOpenChange={onResetDialogOpenChange}>
        {/* `outline` (não `ghost`) mantém o gatilho visível como controle. O
            ícone sozinho não nomeia a ação: o nome acessível vive no
            `aria-label` e o `title` atende ao mouse. Desabilitado com conversa
            vazia (reset seria no-op) e durante resposta em andamento. */}
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              size={compact ? "icon-sm" : "icon"}
              aria-label="Nova conversa"
              title="Nova conversa"
              disabled={resetDisabled}
            />
          }
        >
          <MessageSquarePlus aria-hidden="true" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico atual será apagado e a conversa volta à saudação inicial. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void onReset()}>
              Apagar conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <MessageContent className="gap-2">
        {isUser ? (
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
          </Bubble>
        ) : (
          <div className="max-w-none text-sm leading-relaxed">
            {renderChatMarkdown(message.content)}
          </div>
        )}
        {!isUser && (
          <MessageFooter className="px-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => void onCopy(message.content)}
              aria-label="Copiar resposta"
              title="Copiar resposta"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

function ThinkingMessage({ chatState }: Readonly<{ chatState: ChatState }>) {
  return (
    <Message align="start" data-loading="true">
      <MessageContent>
        <span
          role="status"
          aria-label={chatStatusLabel(chatState) ?? "Consultor respondendo"}
          className="flex items-center gap-1.5 py-0.5"
        >
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </span>
      </MessageContent>
    </Message>
  );
}

export { ConsultorChat };
