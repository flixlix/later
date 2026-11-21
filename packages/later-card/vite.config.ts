import { createCardConfig } from "@later/bundler";
import { defineConfig } from "vite-plus";

export default defineConfig(createCardConfig({ entry: "src/later-card.ts", name: "later-card" }));
