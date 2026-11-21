import { type Page } from "@playwright/test";
import { getJson, readToken } from "../src/hass.ts";
import {
  callHassService,
  entityState,
  expect,
  LATER_DASHBOARD,
  openDashboard,
  test,
} from "../src/fixtures.ts";

const pendingRows = (page: Page) => page.locator("later-card .row");

test.beforeEach(async () => {
  await callHassService("input_boolean", "turn_on", { entity_id: "input_boolean.heater_power" });
});

test("the Later integration is set up", async () => {
  const entries = await getJson("/api/config/config_entries/entry?domain=later", await readToken());

  expect(entries).toEqual([expect.objectContaining({ domain: "later", state: "loaded" })]);
});

test("the dashboard loads the card without a resource and renders it", async ({ page }) => {
  await openDashboard(page, LATER_DASHBOARD);

  await expect(page.locator("later-card ha-card")).toHaveCount(1);
  await expect(page.locator("later-card h1")).toHaveText("Later");
  await expect(page.locator("hui-error-card")).toHaveCount(0);
});

test("schedule from the card, then cancel it", async ({ page }) => {
  await openDashboard(page, LATER_DASHBOARD);
  const card = page.locator("later-card");
  await expect(card.locator(".empty, .list")).toBeVisible();
  const before = await pendingRows(page).count();

  await card
    .getByRole("button", { name: /schedule an action/i })
    .first()
    .click();
  await card.locator('[data-chip="turn_off"]').click();
  await card.locator('[data-chip="in-15"]').click();
  await card.getByRole("button", { name: "Schedule", exact: true }).click();

  const row = pendingRows(page).filter({ hasText: "Heater: turn off at" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("in 15 min");
  await expect(pendingRows(page)).toHaveCount(before + 1);

  await row.getByRole("button", { name: /cancel/i }).click();
  await expect(row).toHaveCount(0);
  await expect(pendingRows(page)).toHaveCount(before);
});

test("picks an entity in Home Assistant's picker inside the dialog", async ({ page }) => {
  await openDashboard(page, LATER_DASHBOARD);
  const card = page.locator("later-card");
  await card
    .getByRole("button", { name: /schedule an action/i })
    .first()
    .click();

  await card.getByRole("button", { name: "Clear", exact: true }).click();
  await card.getByRole("button", { name: /select an entity/i }).click();
  await page.getByPlaceholder("Search").fill("Desk lamp");
  await page.getByRole("option", { name: /^Desk lamp Light/ }).click();

  await expect(card.getByRole("button", { name: /Entity Desk lamp/ })).toBeVisible();
  await card.locator('[data-chip="turn_on"]').click();
  await card.locator('[data-chip="in-15"]').click();
  await card.getByRole("button", { name: "Schedule", exact: true }).click();

  const row = pendingRows(page).filter({ hasText: "Turn on · Desk lamp" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: /cancel/i }).click();
  await expect(row).toHaveCount(0);
});

test("a due schedule runs once and leaves the list without asking", async ({ page }) => {
  await openDashboard(page, LATER_DASHBOARD);
  const at = new Date(Date.now() + 6_000).toISOString();

  await callHassService("later", "add", {
    entity_id: "switch.heater",
    action: "turn_off",
    at,
    name: "e2e heater off",
  });
  const row = pendingRows(page).filter({ hasText: "e2e heater off" });
  await expect(row).toHaveCount(1);

  await expect(row).toHaveCount(0, { timeout: 30_000 });
  await expect
    .poll(async () => {
      const state = await entityState("switch.heater");
      return typeof state === "object" && state !== null && "state" in state ? state.state : "";
    })
    .toBe("off");
  await expect(page.locator("later-card")).not.toContainText("repeat");
});
