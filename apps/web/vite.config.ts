import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    nitro({
      preset: "vercel",
      rolldownConfig: {
        onwarn(warning, warn) {
          // React Server Component markers in @tanstack/react-router; meaningless for this site.
          if (warning.code !== "MODULE_LEVEL_DIRECTIVE") {
            warn(warning);
          }
        },
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ]),
});
