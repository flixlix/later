import baseConfig from "@later/testing";
import { mergeConfig } from "vite-plus";

export default mergeConfig(baseConfig, { test: { name: "@later/shared", environment: "jsdom" } });
