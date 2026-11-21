import baseConfig from "@later/testing";
import { mergeConfig } from "vite-plus";
import packageJson from "./package.json";

export default mergeConfig(baseConfig, {
  test: {
    name: packageJson.name,
    environment: "jsdom",
    server: { deps: { inline: [/lit/, /@lit/, /@later\/shared/] } },
  },
});
