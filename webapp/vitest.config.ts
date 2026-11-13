import { defineConfig } from "vitest/config";

// Dedicated vitest config so tests run against the TypeScript source even
// though `npm run typecheck` emits sibling .js files (which Vite would
// otherwise resolve first).
export default defineConfig({
  resolve: {
    extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
