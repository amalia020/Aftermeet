import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for the intelligence layer.
 *
 * - Resolves the `@/` path alias used across the app (mirrors tsconfig paths).
 * - Stubs the `server-only` marker package to an empty module so server modules
 *   can be unit-tested in the Node test environment without throwing.
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  },
});
