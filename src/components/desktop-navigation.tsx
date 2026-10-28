import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import {
  NAV,
  NAV_GROUPS,
  currentSection,
  isGroupActive,
  itemsForGroup,
} from "@/components/app-navigation";

const topLevelClass = cn(
  navigationMenuTriggerStyle(),
  "h-9 rounded-lg px-3 text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
);

/* Desktop: três entradas no topo — Início direto, Cadastro e Financeiro com
   dropdown. O estado ativo do grupo vem da seção mais específica da rota, então
   `/produtos/composicao` continua marcando "Meus Produtos" e "Cadastro". */
export function DesktopNavigation({ pathname }: { pathname: string }) {
  const [value, setValue] = useState<string | null>(null);
  const active = currentSection(pathname)?.to;

  useEffect(() => {
    setValue(null);
  }, [pathname]);

  return (
    <NavigationMenu
      aria-label="Menu principal"
      value={value}
      onValueChange={(next) => setValue(next)}
      className="w-full max-w-none justify-start"
    >
      <NavigationMenuList className="justify-start gap-1">
        {NAV.filter((item) => !item.group).map((item) => (
          <NavigationMenuItem key={item.to}>
            <NavigationMenuLink
              active={active === item.to}
              render={<Link to={item.to} preload="intent" />}
              className={topLevelClass}
            >
              {item.label}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
        {NAV_GROUPS.map((group) => {
          const groupActive = isGroupActive(group.id, pathname);
          return (
            <NavigationMenuItem key={group.id} value={group.id}>
              <NavigationMenuTrigger
                data-active={groupActive ? "true" : undefined}
                className={topLevelClass}
              >
                {group.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-60 gap-1">
                  {itemsForGroup(group.id).map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavigationMenuLink
                          active={active === item.to}
                          closeOnClick
                          render={<Link to={item.to} preload="intent" />}
                          className="flex-row items-center gap-2"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                          <span>{item.label}</span>
                        </NavigationMenuLink>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
