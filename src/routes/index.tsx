import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, Calculator, Scale, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Preço que Dá Lucro — descubra o preço certo do seu produto" },
      {
        name: "description",
        content:
          "Ferramenta financeira conversacional para pequenos empreendedores. Cadastre produtos por chat, calcule custo, margem e ponto de equilíbrio.",
      },
      { property: "og:title", content: "Preço que Dá Lucro" },
      {
        property: "og:description",
        content: "Descubra por quanto vender seu produto conversando com uma IA.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/inicio" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-bold">Preço que Dá Lucro</span>
        </div>
        <Button render={<Link to="/auth" />} variant="ghost">
          Entrar
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-20 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3 w-3" /> IA que conversa como um consultor
          </span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Descubra o <span className="text-primary">preço certo</span> do seu produto conversando.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Vamos descobrir juntos quanto custa o seu produto, qual preço faz sentido para o seu
            negócio e quanto você precisa vender para começar a ter lucro.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button render={<Link to="/auth" />} size="lg" className="gap-2">
              Começar agora <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-3">
          {[
            {
              icon: MessageCircle,
              title: "Cadastro por conversa",
              desc: "Escreva a receita do seu jeito. A IA organiza tudo para você.",
            },
            {
              icon: Calculator,
              title: "Cálculos precisos",
              desc: "Custo, margem de contribuição e preço sugerido calculados pelo sistema.",
            },
            {
              icon: Scale,
              title: "Ponto de equilíbrio",
              desc: "Saiba exatamente quanto vender para parar de ter prejuízo.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-soft)]"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
