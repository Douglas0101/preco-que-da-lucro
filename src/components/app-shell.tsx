import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Package,
  Wallet,
  Scale,
  LineChart,
  Stethoscope,
  Tag,
  Menu,
  LogOut,
  Sparkles,
  Receipt,
} from "lucide-react";
import { globalSignOut } from "@/lib/auth-client";
import { useSessionUser } from "@/lib/session-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home };
/* A precificação saiu do menu: com o launcher do Simon disponível em todas as
   páginas, a rota `/novo-produto` fica como workspace/deep link (e o launcher
   some nela), sem duplicar a entrada de navegação. */
const NAV: NavItem[] = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/produtos", label: "Meus Produtos", icon: Package },
  { to: "/precos", label: "Preços de Compra", icon: Tag },
  { to: "/despesas", label: "Minhas Despesas", icon: Wallet },
  { to: "/vendas", label: "Vendas", icon: Receipt },
  { to: "/ponto-equilibrio", label: "Ponto de Equilíbrio", icon: Scale },
  { to: "/simulacoes", label: "Simulações", icon: LineChart },
  { to: "/diagnostico", label: "Diagnóstico", icon: Stethoscope },
];

/* Seção por rota: refinamento do prefixo (`/produtos/123` continua
   "Meus Produtos") para o estado ativo do menu nunca ficar sem contexto. */
function currentSection(pathname: string): NavItem | undefined {
  return NAV.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];
}

/* Fonte única do desenho de item: a barra superior usa a variante compacta
   (sem ícone, texto curto) e o drawer mobile a variante completa. */
function NavLink({
  item,
  active,
  layout,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  layout: "bar" | "drawer";
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      preload="intent"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center font-medium outline-none transition-[background-color,color] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none",
        layout === "bar"
          ? "min-h-[36px] shrink-0 whitespace-nowrap rounded-lg px-3 text-sm"
          : "min-h-[44px] gap-3 rounded-xl px-3 py-2.5 text-sm",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      {layout === "drawer" && (
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/50",
          )}
        />
      )}
      <span className="truncate">{item.label}</span>
      {active && layout === "drawer" && (
        <span
          aria-hidden="true"
          className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary"
        />
      )}
    </Link>
  );
}

function DrawerContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const active = currentSection(pathname)?.to;
  return (
    <div className="flex h-full flex-col p-5">
      <Link
        to="/inicio"
        preload="intent"
        className="mb-8 flex items-center gap-3 rounded-xl transition-colors duration-200 outline-none hover:bg-sidebar-accent/40 focus-visible:ring-2 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
        onClick={onNavigate}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold leading-tight tracking-tight text-sidebar-foreground">
            Preço que Dá Lucro
          </div>
          <div className="text-sidebar-foreground/60 text-xs font-medium tracking-wide">
            seu consultor financeiro
          </div>
        </div>
      </Link>

      <nav aria-label="Menu principal" className="flex-1 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            item={item}
            active={active === item.to}
            layout="drawer"
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

const BRAND_MARK = (
  <div className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
    <Sparkles className="h-4 w-4" />
  </div>
);

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Sessão vem do provider compartilhado (get-session único): sem refetch de
  // getSession a cada mount do shell.
  const user = useSessionUser();
  const email = user?.email ?? "";
  const active = currentSection(location.pathname)?.to;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function logout() {
    await globalSignOut();
    queryClient.clear();
    await router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header único (mobile e desktop): identidade à direita e, no desktop,
          o menu principal na própria barra superior. O drawer mobile carrega
          a MESMA lista — nunca há dois menus visíveis ao mesmo tempo. */}
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[56px] w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir menu de navegação"
                    className="text-sidebar-foreground hover:bg-sidebar-accent/60 lg:hidden"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl sm:max-w-72"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu principal</SheetTitle>
                  <SheetDescription>Navegação principal do aplicativo.</SheetDescription>
                </SheetHeader>
                <DrawerContent pathname={location.pathname} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>

            <Link
              to="/inicio"
              preload="intent"
              className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {BRAND_MARK}
              <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                Preço que Dá Lucro
              </span>
            </Link>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-[16rem] truncate text-xs font-medium tracking-wide text-sidebar-foreground/60 md:inline">
              {email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              aria-label="Sair"
              className="gap-1.5 text-sidebar-foreground/75 transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground motion-reduce:transition-none"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Menu principal no topo. É o único ponto de navegação no desktop;
            abaixo de `lg` ele desaparece e o drawer assume (mesma lista). */}
        <div className="hidden border-t border-sidebar-border/60 lg:block">
          <nav
            aria-label="Menu principal"
            className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => (
              <NavLink key={item.to} item={item} active={active === item.to} layout="bar" />
            ))}
          </nav>
        </div>
      </header>

      <main className="min-w-0">
        <div
          key={location.pathname}
          className={cn(
            "mx-auto max-w-6xl animate-in px-4 pt-6 fade-in-0 duration-300 ease-out slide-in-from-bottom-2 md:px-8 md:pt-10 motion-reduce:animate-none",
            // O launcher flutua sobre o conteúdo: reserva a faixa inferior para
            // o último CTA não ficar embaixo dele. O workspace do chat ocupa a
            // altura da viewport, então lá o espaço continua o de antes.
            location.pathname === "/novo-produto" ? "pb-6 md:pb-10" : "pb-24 md:pb-20",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
