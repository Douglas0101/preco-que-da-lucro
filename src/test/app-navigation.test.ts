import { describe, expect, it } from "vitest";

import {
  NAV,
  NAV_GROUPS,
  currentSection,
  isGroupActive,
  itemsForGroup,
} from "@/components/app-navigation";

describe("app navigation model", () => {
  it("keeps the eight routes in the drawer order and assigns two groups", () => {
    expect(NAV.map((item) => item.to)).toEqual([
      "/inicio",
      "/produtos",
      "/precos",
      "/despesas",
      "/vendas",
      "/ponto-equilibrio",
      "/simulacoes",
      "/diagnostico",
    ]);
    expect(NAV_GROUPS.map((group) => group.id)).toEqual(["cadastro", "financeiro"]);
    expect(itemsForGroup("cadastro").map((item) => item.to)).toEqual([
      "/produtos",
      "/precos",
      "/despesas",
    ]);
    expect(itemsForGroup("financeiro").map((item) => item.to)).toEqual([
      "/vendas",
      "/ponto-equilibrio",
      "/simulacoes",
      "/diagnostico",
    ]);
  });

  it("resolves the most specific section for exact and nested routes", () => {
    expect(currentSection("/inicio")?.to).toBe("/inicio");
    expect(currentSection("/produtos")?.to).toBe("/produtos");
    expect(currentSection("/produtos/composicao")?.to).toBe("/produtos");
    expect(currentSection("/produtos/123")?.to).toBe("/produtos");
    expect(currentSection("/desconhecido")).toBeUndefined();
  });

  it("does not treat a sibling prefix as a section", () => {
    expect(currentSection("/produtos-outro")).toBeUndefined();
    expect(currentSection("/vendaa")).toBeUndefined();
  });

  it("marks the owning group as active for exact and nested routes", () => {
    expect(isGroupActive("cadastro", "/produtos")).toBe(true);
    expect(isGroupActive("cadastro", "/produtos/composicao")).toBe(true);
    expect(isGroupActive("cadastro", "/despesas")).toBe(true);
    expect(isGroupActive("cadastro", "/vendas")).toBe(false);
    expect(isGroupActive("financeiro", "/vendas")).toBe(true);
    expect(isGroupActive("financeiro", "/diagnostico")).toBe(true);
    expect(isGroupActive("financeiro", "/inicio")).toBe(false);
    expect(isGroupActive("financeiro", "/desconhecido")).toBe(false);
  });
});
