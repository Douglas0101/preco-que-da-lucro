import { Home, LineChart, Package, Receipt, Scale, Stethoscope, Tag, Wallet } from "lucide-react";

export type NavGroupId = "cadastro" | "financeiro";
export type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  group?: NavGroupId;
};

/* A precificação saiu do menu: com o launcher do Simon disponível em todas as
   páginas, a rota `/novo-produto` fica como workspace/deep link (e o launcher
   some nela), sem duplicar a entrada de navegação. */
export const NAV: NavItem[] = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/produtos", label: "Meus Produtos", icon: Package, group: "cadastro" },
  { to: "/precos", label: "Preços de Compra", icon: Tag, group: "cadastro" },
  { to: "/despesas", label: "Minhas Despesas", icon: Wallet, group: "cadastro" },
  { to: "/vendas", label: "Vendas", icon: Receipt, group: "financeiro" },
  { to: "/ponto-equilibrio", label: "Ponto de Equilíbrio", icon: Scale, group: "financeiro" },
  { to: "/simulacoes", label: "Simulações", icon: LineChart, group: "financeiro" },
  { to: "/diagnostico", label: "Diagnóstico", icon: Stethoscope, group: "financeiro" },
];

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "cadastro", label: "Cadastro" },
  { id: "financeiro", label: "Financeiro" },
];

export function itemsForGroup(group: NavGroupId): NavItem[] {
  return NAV.filter((item) => item.group === group);
}

/* Seção por rota: refinamento do prefixo (`/produtos/123` continua
   "Meus Produtos") para o estado ativo do menu nunca ficar sem contexto. */
export function currentSection(pathname: string): NavItem | undefined {
  return NAV.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];
}

export function isGroupActive(group: NavGroupId, pathname: string): boolean {
  const section = currentSection(pathname);
  return section !== undefined && itemsForGroup(group).some((item) => item.to === section.to);
}
