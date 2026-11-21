import path from "node:path";
import process from "node:process";
import { defineConfig } from "vite-plus";

/** Unit tests: `src/**\/*.test.ts` in Node (or jsdom, per package); browser tests run elsewhere. */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    alias: [{ find: /^@\//, replacement: `${path.resolve(process.cwd(), "src")}/` }],
    // Lit ships ESM only.
    server: { deps: { inline: [/lit/, /@lit/] } },
    include: ["src/**/*.test.ts"],
    // Mounted in Chromium by ./vitest-browser.js instead.
    exclude: ["src/**/*.browser.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "src/testing/**"],
    },
  },
});
