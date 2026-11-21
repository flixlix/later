// Renders docs/brand/icon.svg into the integration's brand images: `pnpm brand`.
// Home Assistant shows custom_components/later/brand/ on the integration's page and
// falls back from logo and dark variants to these icons.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const svg = await readFile(`${root}docs/brand/icon.svg`, "utf8");
const browser = await chromium.launch();
const SIZES = [
  ["icon.png", 256],
  ["icon@2x.png", 512],
] as const;
await Promise.all(
  SIZES.map(async ([file, size]) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`
    );
    await page.screenshot({
      path: `${root}custom_components/later/brand/${file}`,
      omitBackground: true,
    });
  })
);
await browser.close();
