import { fakeHass } from "@later/shared/testing/fake-hass";
import { mountCard } from "@later/shared/testing/mount-card";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { LaterCard } from "./later-card";
import { FakeLater, schedule } from "./testing/fake-later";

const NOW = new Date("2026-11-21T18:00:00Z"); // 19:00 in Berlin

const hassWith = (later: FakeLater) =>
  fakeHass({
    websocket: later,
    states: {
      "switch.heater": { state: "on", attributes: { friendly_name: "Heater" } },
    },
    services: {
      switch: ["turn_on", "turn_off", "toggle"],
      script: ["turn_on", "bedtime"],
    },
  });

const mount = (later: FakeLater, config: object = {}) =>
  mountCard(LaterCard, { type: "custom:later-card", ...config }, hassWith(later));

const rows = (root: ShadowRoot) =>
  [...root.querySelectorAll(".row")].map((row) => row.textContent?.replace(/\s+/g, " ").trim());

const click = (root: ParentNode, selector: string) => {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`nothing matches ${selector}`);
  }
  element.click();
};

const form = (root: ShadowRoot) => {
  const element = root.querySelector("later-create-form");
  if (!element?.shadowRoot) {
    throw new Error("the create form is not open");
  }
  return element.shadowRoot;
};

/** What Home Assistant's `ha-form` reports when the user picks a value. */
const pick = (formRoot: ShadowRoot, field: string, value: unknown) => {
  const haForm = formRoot.querySelector(`ha-form[data-field="${field}"]`);
  if (!haForm) {
    throw new Error(`no ${field} field`);
  }
  haForm.dispatchEvent(new CustomEvent("value-changed", { detail: { value: { [field]: value } } }));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pending list", () => {
  test("shows each schedule's due time, target and action, soonest first", async () => {
    const later = new FakeLater([
      schedule({ name: "Heater off", minutes: 25, now: NOW }),
      schedule({
        name: "Bedtime",
        service: "script.bedtime",
        entity_id: null,
        minutes: 60 * 13,
        now: NOW,
      }),
    ]);

    const { root } = await mount(later, { title: "Later today" });

    expect(root.querySelector("h1")?.textContent).toBe("Later today");
    expect(rows(root)).toEqual([
      "Heater off Turn off · Heater 19:25 in 25 min",
      "Bedtime script.bedtime tomorrow 08:00 in 13 h",
    ]);
  });

  test("follows the subscription: rows come and go as schedules are created and run", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    const created = schedule({ name: "Lamp on", minutes: 5, now: NOW });

    later.emit({ type: "created", schedule: created, schedules: [created] });
    await settle();
    expect(rows(root)).toHaveLength(1);

    later.emit({ type: "ran", schedule: created, schedules: [] });
    await settle();
    expect(rows(root)).toEqual([]);
    expect(root.querySelector(".empty")?.textContent).toContain("Nothing scheduled");
  });

  test("cancel sends the schedule id and the row leaves", async () => {
    const heater = schedule({ name: "Heater off", now: NOW });
    const later = new FakeLater([heater, schedule({ name: "Lamp", now: NOW })]);
    const { root, settle } = await mount(later);

    click(root, `.row[data-id="${heater.id}"] button`);
    await settle();

    expect(later.sent("later/cancel")).toEqual([{ type: "later/cancel", schedule_id: heater.id }]);
    expect(rows(root).map((row) => row?.split(" ")[0])).toEqual(["Lamp"]);
  });
});

describe("creating a schedule", () => {
  test("an empty list offers to schedule something", async () => {
    const { root, settle } = await mount(new FakeLater());

    expect(root.querySelector(".empty")?.textContent).toContain("Nothing scheduled");
    click(root, ".empty button");
    await settle();

    expect(root.querySelector("later-create-form")).not.toBeNull();
  });

  test("entity, turn off, in 30 minutes: sends the shortcut and closes the form", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    click(root, ".empty button");
    await settle();

    pick(form(root), "entity_id", "switch.heater");
    await settle();
    click(form(root), '[data-chip="in-30"]');
    await settle();
    click(form(root), ".primary");
    await settle();

    expect(later.sent("later/add")).toEqual([
      { type: "later/add", entity_id: "switch.heater", action: "turn_off", in: 30 },
    ]);
    expect(root.querySelector("later-create-form")).toBeNull();
    expect(rows(root)).toHaveLength(1);
  });

  test("a clock time says whether it runs today or tomorrow", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty button");
    await settle();

    click(form(root), '[data-chip="toggle"]');
    click(form(root), '[data-chip="at"]');
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe("Runs today at 20:00");
    pick(form(root), "time", "07:30:00");
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe("Runs tomorrow at 07:30");
    pick(form(root), "name", "Morning");
    click(form(root), ".primary");
    await settle();

    expect(later.sent("later/add")).toEqual([
      {
        type: "later/add",
        entity_id: "switch.heater",
        action: "toggle",
        at: "07:30",
        name: "Morning",
      },
    ]);
  });

  test("any service with data, and custom minutes", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    click(root, ".empty button");
    await settle();

    click(form(root), '[data-chip="service"]');
    await settle();
    pick(form(root), "service", "script.turn_on");
    pick(form(root), "data", { entity_id: "script.bedtime" });
    click(form(root), '[data-chip="in-custom"]');
    await settle();
    pick(form(root), "minutes", 90);
    await settle();
    click(form(root), ".primary");
    await settle();

    expect(later.sent("later/add")).toEqual([
      {
        type: "later/add",
        service: "script.turn_on",
        data: { entity_id: "script.bedtime" },
        in: 90,
      },
    ]);
  });

  test("says what is missing and sends nothing", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty button");
    await settle();

    click(form(root), ".primary");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("Pick when");
    expect(later.sent("later/add")).toEqual([]);
  });

  test("shows the integration's error and keeps the form open", async () => {
    const later = new FakeLater();
    later.addError = { code: "invalid_format", message: "send either `at` or `in`" };
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty button");
    await settle();

    click(form(root), '[data-chip="in-15"]');
    click(form(root), ".primary");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("send either `at` or `in`");
  });
});

describe("without the integration", () => {
  test("names the Later integration and how to install it", async () => {
    const later = new FakeLater();
    later.subscribeError = { code: "unknown_command", message: "Unknown command." };

    const { root, text } = await mount(later);

    expect(text(".notice")).toContain("The Later integration is not installed");
    expect(root.querySelector<HTMLAnchorElement>(".notice a")?.href).toContain(
      "category=integration"
    );
  });

  test("says when it is installed but not set up", async () => {
    const later = new FakeLater();
    later.subscribeError = { code: "not_loaded", message: "not set up" };

    const { text } = await mount(later);

    expect(text(".notice")).toContain("installed but not set up");
  });
});

test("rejects an unknown config shape", () => {
  const card = new LaterCard();

  expect(() => card.setConfig({ type: "custom:later-card", title: 3 } as never)).toThrow(
    /Invalid later-card config/
  );
});

test("lists itself in the card picker", () => {
  const cards: unknown[] = window.customCards ?? [];

  expect(cards).toContainEqual(
    expect.objectContaining({ type: "later-card", name: "Later", preview: true })
  );
  expect(LaterCard.getStubConfig()).toEqual({ type: "custom:later-card" });
});
