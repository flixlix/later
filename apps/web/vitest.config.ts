import baseConfig from "@later/testing";
import { mergeConfig } from "vite-plus";

// Without the app's Vite plugins (Nitro, TanStack Start): the tests are plain modules.
export default mergeConfig(baseConfig, { test: { name: "@later/web" } });
