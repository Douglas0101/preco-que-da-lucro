import { createFileRoute } from "@tanstack/react-router";
import { ConsultorChat } from "@/components/consultor-chat";

export const Route = createFileRoute("/_authenticated/novo-produto")({
  head: () => ({
    meta: [
      { title: "Precificação · Preço que Dá Lucro" },
      { name: "description", content: "Precifique seu produto conversando com o Simon." },
    ],
  }),
  component: NovoProduto,
});

/**
 * Workspace completo: mesma conversa do launcher flutuante, em página inteira.
 * O estado de histórico é compartilhado pelo cache de query, então abrir pelo
 * widget ou por esta rota cai na mesma conversa.
 */
function NovoProduto() {
  return <ConsultorChat />;
}
