import { fakeHass } from "@later/shared/testing/fake-hass";
import { mountCard } from "@later/shared/testing/mount-card";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { LaterCard } from "./later-card";
import { FakeLater, schedule } from "./testing/fake-later";

const NOW = new Date("2026-11-21T18:00:00Z");

const pending = () =>
  new FakeLater([
    schedule({ name: "Heater off", minutes: 25, now: NOW }),
    schedule({
      name: "Office: set temperature",
      service: "climate.set_temperature",
      entity_id: "climate.office",
      minutes: 120,
      now: NOW,
    }),
    schedule({
      name: "Bedtime",
      service: "script.bedtime",
      entity_id: null,
      minutes: 60 * 13,
      now: NOW,
    }),
  ]);

const hassWith = (later: FakeLater) =>
  fakeHass({
    websocket: later,
    states: {
      "switch.heater": { state: "on", attributes: { friendly_name: "Heater" } },
      "climate.office": { state: "heat", attributes: { friendly_name: "Office" } },
    },
    services: { switch: ["turn_on", "turn_off", "toggle"] },
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

test.each(["light", "dark"] as const)("pending list, %s theme", async (scheme) => {
  const { card } = await mountCard(LaterCard, { type: "custom:later-card" }, hassWith(pending()), {
    scheme,
  });
  await expect.element(page.elementLocator(card)).toMatchScreenshot(`pending-${scheme}`);
});

test("pending list on a phone", async () => {
  const { card } = await mountCard(LaterCard, { type: "custom:later-card" }, hassWith(pending()), {
    width: 320,
  });
  await expect.element(page.elementLocator(card)).toMatchScreenshot("pending-phone");
});

test("empty", async () => {
  const { card } = await mountCard(
    LaterCard,
    { type: "custom:later-card" },
    hassWith(new FakeLater())
  );
  await expect.element(page.elementLocator(card)).toMatchScreenshot("empty");
});

test("create form with a clock time", async () => {
  const { card, root, settle } = await mountCard(
    LaterCard,
    { type: "custom:later-card", entity: "switch.heater" },
    hassWith(new FakeLater())
  );
  root.querySelector<HTMLElement>(".empty button")?.click();
  await settle();
  root
    .querySelector("later-create-form")
    ?.shadowRoot?.querySelector<HTMLElement>('[data-chip="at"]')
    ?.click();
  await settle();
  await expect.element(page.elementLocator(card)).toMatchScreenshot("create-form");
});

test("integration missing", async () => {
  const later = new FakeLater();
  later.subscribeError = { code: "unknown_command", message: "Unknown command." };
  const { card } = await mountCard(LaterCard, { type: "custom:later-card" }, hassWith(later));
  await expect.element(page.elementLocator(card)).toMatchScreenshot("integration-missing");
});
