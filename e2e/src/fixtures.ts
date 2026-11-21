import { test as base, expect, type Page } from "@playwright/test";
import { callService, getJson, type JsonObject, readToken } from "./hass.ts";

type Fixtures = {
  /** Console errors and uncaught exceptions of the page; checked after every test. */
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const LATER_DASHBOARD = "later-dev/later";

export async function callHassService(domain: string, service: string, data: JsonObject) {
  return callService(await readToken(), domain, service, data);
}

export async function entityState(entityId: string): Promise<unknown> {
  return getJson(`/api/states/${entityId}`, await readToken());
}

/** Opens a dashboard view and waits until Home Assistant has rendered it. */
export async function openDashboard(page: Page, path: string): Promise<void> {
  await page.goto(`/${path}`);
  await expect(
    page.locator("hui-view, hui-sections-view, hui-masonry-view").first()
  ).toBeAttached();
}
