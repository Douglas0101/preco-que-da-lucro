import { lazy, Suspense, useState } from "react";
import { CatchBoundary, useLocation } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { CONSULTOR } from "@/lib/consultor-persona";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * O chat chega em chunk próprio: quem nunca abre o painel não paga o custo
 * dele no grafo inicial (orçamento em `check:bundle`).
 */
const ConsultorChat = lazy(async () => {
  const module = await import("@/components/consultor-chat");
  return { default: module.ConsultorChat };
});

/** Fallback do chunk do chat: mantém o diálogo nomeado durante o carregamento. */
function ChatPanelSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4" aria-busy="true">
      <SheetTitle className="sr-only">{CONSULTOR.name}</SheetTitle>
      <SheetDescription className="sr-only">{CONSULTOR.roleLabel}</SheetDescription>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-36" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-16 w-3/5 rounded-2xl" />
        <Skeleton className="ms-auto h-12 w-2/5 rounded-3xl" />
        <Skeleton className="h-24 w-4/5 rounded-2xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}

/** Chunk do chat indisponível (rede/mobile instável): falha visível e retry. */
function ChatPanelFailure({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <p className="text-sm font-medium">Não foi possível abrir o consultor agora.</p>
      <p className="text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
      <Button type="button" variant="outline" size="sm" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}

/**
 * Launcher persistente do consultor. Vive no layout autenticado, então a
 * conversa acompanha a navegação; a rota completa `/novo-produto` continua
 * existindo como workspace/deep link — por isso o launcher some nela.
 */
function ConsultorChatDock() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (location.pathname === "/novo-produto") return null;

  return (
    <>
      <Button
        type="button"
        size="icon"
        aria-label={CONSULTOR.launcherLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Falar com o ${CONSULTOR.name}`}
        onClick={() => setOpen(true)}
        className={cn(
          // `bottom` reserva a safe-area do iOS (home indicator); no desktop o
          // `sm:bottom-6` volta ao espaçamento normal.
          "fixed end-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full shadow-xl shadow-primary/20",
          "transition-transform duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          "sm:end-6 sm:bottom-6",
        )}
      >
        <span aria-hidden="true" className="relative">
          <span className="font-heading text-lg font-semibold">{CONSULTOR.name.charAt(0)}</span>
          <span className="absolute -end-1.5 -top-1 size-3 rounded-full border-2 border-primary bg-success" />
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
          aria-label={`${CONSULTOR.name}, ${CONSULTOR.role}`}
        >
          <CatchBoundary getResetKey={() => open} errorComponent={ChatPanelFailure}>
            <Suspense fallback={<ChatPanelSkeleton />}>
              <ConsultorChat variant="panel" />
            </Suspense>
          </CatchBoundary>
        </SheetContent>
      </Sheet>
    </>
  );
}

export { ConsultorChatDock };
