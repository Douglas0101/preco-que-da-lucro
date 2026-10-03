import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Local fork/jsdom workers have crashed without test failures on this bench.
    // Serial files are the measured mitigation; CI keeps its existing parallelism.
    fileParallelism: process.env.CI === "true" || process.env.CI === "1",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
  },
});
