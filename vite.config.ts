import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { ConfigEnv, PluginOption } from "vite";

const lovableConfig = defineConfig({
  // The BFF is deployed as a Node server (Neon/Better Auth), and CI's
  // Playwright webServer starts the generated Nitro output directly.  The
  // Lovable default targets Cloudflare, which leaves `nitro preview` trying
  // to start Wrangler and makes the preview health check time out.
  nitro: { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    environments: {
      client: {
        build: {
          manifest: true,
          rolldownOptions: {
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
    },
  },
});

function isLegacyTsconfigPathsPlugin(plugin: PluginOption) {
  return (
    typeof plugin === "object" &&
    plugin !== null &&
    !Array.isArray(plugin) &&
    "name" in plugin &&
    (plugin.name === "vite-tsconfig-paths" || plugin.name === "vite-plugin-tsconfig-paths")
  );
}

export default async function config(env: ConfigEnv) {
  const resolved = await lovableConfig(env);

  return {
    ...resolved,
    plugins: resolved.plugins?.filter((plugin) => !isLegacyTsconfigPathsPlugin(plugin)),
    resolve: {
      ...resolved.resolve,
      tsconfigPaths: true,
    },
  };
}
