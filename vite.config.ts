import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Uma única fonte para "estamos buildando para a Vercel": ela escolhe o preset do Nitro e o
// gate do `@vercel/analytics` (src/lib/vercel-analytics.ts).  Localmente (e na CI) `VERCEL`
// não existe ⇒ preset `node-server`, onde `/_vercel/insights/script.js` não é servido.
const isVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  // Substituição literal, visível ao bundle **cliente** (que decide em runtime se monta o
  // `<Analytics />`).  Mesma origem do preset escolhido acima — gate e preset não podem divergir.
  define: { __VERCEL_ANALYTICS_ENABLED__: JSON.stringify(isVercel) },
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
    // Nativo do Vite 8 (substitui o plugin legado `vite-tsconfig-paths`; DSO-022).
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: { host: "::", port: 8080 },
  environments: {
    client: {
      build: {
        manifest: true,
        rolldownOptions: {
          // DBT-109: o diagnóstico [PLUGIN_TIMINGS] do rolldown é telemetria de
          // performance com texto dinâmico (tempos/contagens variam por build),
          // irregistrável por assinatura exata no gate de warnings do build — e
          // derrubou a publicação de produção no cache frio (dpl_8sjNJvBbiFkHrR6hUcMx1iDR1Jrf).
          // Suprimido na origem com a opção oficial do rolldown ("checks.pluginTimings
          // !== false" é o gate do recorder; false ⇒ nenhum callback ao nativo).
          // O gate de warnings permanece fail-closed, sem afrouxamento.
          checks: { pluginTimings: false },
          output: {
            codeSplitting: {
              groups: [
                {
                  name: "tanstack-vendor",
                  test: /node_modules[\\/]@tanstack[\\/](?:history|query-core|react-query|react-router|router-core|store)[\\/]/,
                  priority: 10,
                },
              ],
            },
          },
        },
      },
    },
    ssr: {
      build: {
        rolldownOptions: {
          checks: { pluginTimings: false },
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper);
    // nitro/vite builds from this. Split each route into its own chunk so the initial bundle
    // only carries the visited route (plan mestre §17.6).
    tanstackStart({
      server: { entry: "server" },
      // O code-splitting de rotas (plan mestre §17.6) é comportamento do plugin de
      // router; o schema de entrada da versão instalada não expõe
      // `router.autoCodeSplitting` (o zod o descarta — o wrapper antigo o repassava
      // sem tipo, então o caminho anterior era exatamente esta omissão).
      // G-SEC: o código de servidor nunca pode aparecer no bundle do cliente; o build falha
      // de forma explícita em vez de vazar `server-only`/`**/server/**` para o browser.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // O preset `vercel` (VERCEL=1) emite a Build Output API (`.vercel/output`), consumida
    // pela Vercel; fora dela (local e CI) o `node-server` é o alvo, servido via
    // `node .output/server/index.mjs` (`npm start`) e `nitro preview`.
    nitro({ preset: isVercel ? "vercel" : "node-server" }),
    react(),
  ],
});
