import { setupLogger } from "./logging";

declare global {
  interface Window {
    customCards?: unknown[];
  }
}

interface RegisterCardParams {
  type: string;
  name: string;
  description: string;
  version: string;
}

/** Canonical docs; the repository README until the docs site has its own domain. */
export const DOCS_URL = "https://github.com/flixlix/later";

/** Lists the card in the dashboard's card picker and prints the version banner once. */
export function registerCustomCard(params: RegisterCardParams) {
  window.customCards ??= [];
  window.customCards.push({
    ...params,
    preview: true,
    documentationURL: `${DOCS_URL}#card`,
  });

  setupLogger({ name: params.name, version: params.version, readme: DOCS_URL });
}
