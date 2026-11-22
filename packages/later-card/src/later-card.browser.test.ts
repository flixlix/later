import { fakeHass } from "@later/shared/testing/fake-hass";
import { haValueChanged } from "@later/shared/testing/ha-events";
import { TimeZone } from "custom-card-helpers";
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

const dialogTitle = (root: ShadowRoot): unknown => {
  const dialog = root.querySelector("ha-dialog");
  return dialog && "headerTitle" in dialog ? dialog.headerTitle : undefined;
};

/** What Home Assistant's `ha-form` reports when the user picks a value. */
const pick = (formRoot: ShadowRoot, field: string, value: unknown) => {
  const haForm = formRoot.querySelector(`ha-form[data-field="${field}"]`);
  if (!haForm) {
    throw new Error(`no ${field} field`);
  }
  haForm.dispatchEvent(haValueChanged({ [field]: value }));
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
      "Bedtime script.bedtime tomorrow 08:00 in 13 hr",
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

  test("a schedule created after the card loaded counts from now, not from the last tick", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    vi.setSystemTime(new Date(NOW.getTime() + 20_000));
    const created = schedule({ name: "Lamp on", minutes: 15, now: new Date() });

    later.emit({ type: "created", schedule: created, schedules: [created] });
    await settle();

    expect(rows(root)[0]).toContain("in 15 min");
  });

  test("counts down as each minute starts", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(NOW.getTime() + 40_000));
    const later = new FakeLater([schedule({ name: "Heater off", minutes: 25, now: NOW })]);
    const { root, settle } = await mount(later);
    expect(rows(root)[0]).toContain("in 25 min");

    await vi.advanceTimersByTimeAsync(20_000);
    await settle();

    expect(rows(root)[0]).toContain("in 24 min");
  });

  test("cancel sends the schedule id and the row leaves", async () => {
    const heater = schedule({ name: "Heater off", now: NOW });
    const later = new FakeLater([heater, schedule({ name: "Lamp", now: NOW })]);
    const { root, settle } = await mount(later);

    click(root, `.row[data-id="${heater.id}"] button[title="Cancel"]`);
    await settle();

    expect(later.sent("later/cancel")).toEqual([{ type: "later/cancel", schedule_id: heater.id }]);
    expect(rows(root).map((row) => row?.split(" ")[0])).toEqual(["Lamp"]);
  });
});

describe("creating a schedule", () => {
  test("an empty list offers to schedule something", async () => {
    const { root, settle } = await mount(new FakeLater());

    expect(root.querySelector(".empty")?.textContent).toContain("Nothing scheduled");
    click(root, ".empty ha-button");
    await settle();

    expect(root.querySelector("later-create-form")).not.toBeNull();
  });

  test("entity, turn off, in 30 minutes: sends the shortcut and closes the form", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    click(root, ".empty ha-button");
    await settle();

    pick(form(root), "entity_id", "switch.heater");
    await settle();
    click(form(root), '[data-chip="in-30"]');
    await settle();
    click(form(root), ".confirm");
    await settle();

    expect(later.sent("later/add")).toEqual([
      { type: "later/add", entity_id: "switch.heater", action: "turn_off", in: 30 },
    ]);
    expect(root.querySelector("later-create-form")).toBeNull();
    expect(rows(root)).toHaveLength(1);
  });

  test("opens in a dialog, not inside the card", async () => {
    const { root, settle } = await mount(new FakeLater());

    click(root, ".empty ha-button");
    await settle();

    expect(root.querySelector("ha-dialog later-create-form")).not.toBeNull();
    expect(dialogTitle(root)).toBe("Schedule an action");
  });

  test("any day: picks a date and time, and says when that is", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty ha-button");
    await settle();

    click(form(root), '[data-chip="toggle"]');
    click(form(root), '[data-chip="at"]');
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe("Runs today 20:00, in 1 hr");
    pick(form(root), "date", "2026-11-22");
    pick(form(root), "time", "07:30:00");
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe(
      "Runs tomorrow 07:30, in 12 hr 30 min"
    );
    pick(form(root), "date", "2026-11-24");
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe(
      "Runs Tue, Nov 24 07:30, in 3 days"
    );
    pick(form(root), "name", "Morning");
    click(form(root), ".confirm");
    await settle();

    expect(later.sent("later/add")).toEqual([
      {
        type: "later/add",
        entity_id: "switch.heater",
        action: "toggle",
        at: "2026-11-24 07:30",
        name: "Morning",
      },
    ]);
  });

  test("a time already past today is refused", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty ha-button");
    await settle();

    click(form(root), '[data-chip="at"]');
    await settle();
    pick(form(root), "time", "18:30:00");
    await settle();
    expect(form(root).querySelector(".hint")?.textContent).toBe("That time has passed");
    click(form(root), ".confirm");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("Pick a time in the future");
    expect(later.sent("later/add")).toEqual([]);
  });

  test("any service with data, and custom minutes", async () => {
    const later = new FakeLater();
    const { root, settle } = await mount(later);
    click(root, ".empty ha-button");
    await settle();

    click(form(root), '[data-chip="service"]');
    await settle();
    pick(form(root), "service", "script.turn_on");
    pick(form(root), "data", { entity_id: "script.bedtime" });
    click(form(root), '[data-chip="in-custom"]');
    await settle();
    pick(form(root), "minutes", 90);
    await settle();
    click(form(root), ".confirm");
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
    click(root, ".empty ha-button");
    await settle();

    click(form(root), ".confirm");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("Pick when");
    expect(later.sent("later/add")).toEqual([]);
  });

  test("shows the integration's error and keeps the form open", async () => {
    const later = new FakeLater();
    later.addError = { code: "invalid_format", message: "send either `at` or `in`" };
    const { root, settle } = await mount(later, { entity: "switch.heater" });
    click(root, ".empty ha-button");
    await settle();

    click(form(root), '[data-chip="in-15"]');
    click(form(root), ".confirm");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("send either `at` or `in`");
  });
});

describe("editing a schedule", () => {
  test("opens the dialog filled in, and saves the change under the same id", async () => {
    const heater = schedule({ name: "Heater off", minutes: 25, now: NOW });
    const later = new FakeLater([heater]);
    const { root, settle } = await mount(later);

    click(root, `.row[data-id="${heater.id}"] button[title="Edit"]`);
    await settle();
    expect(dialogTitle(root)).toBe("Edit schedule");
    expect(form(root).querySelector('[data-chip="turn_off"]')?.getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(form(root).querySelector(".hint")?.textContent).toBe("Runs today 19:25, in 25 min");
    expect(form(root).querySelector(".confirm")?.textContent?.trim()).toBe("Save");

    click(form(root), '[data-chip="turn_on"]');
    pick(form(root), "date", "2026-11-22");
    await settle();
    click(form(root), ".confirm");
    await settle();

    // The name is unchanged, so it is not sent: the integration renames a default name itself.
    expect(later.sent("later/update")).toEqual([
      {
        type: "later/update",
        schedule_id: heater.id,
        entity_id: "switch.heater",
        action: "turn_on",
        at: "2026-11-22 19:25",
      },
    ]);
    expect(later.sent("later/add")).toEqual([]);
    expect(root.querySelector("ha-dialog")).toBeNull();
  });
});

describe("Home Assistant's clock", () => {
  test("shows due times in Home Assistant's time zone, even when the user picked the browser's", async () => {
    const later = new FakeLater([schedule({ name: "Heater off", minutes: 60, now: NOW })]);
    const hass = hassWith(later);
    hass.locale = { ...hass.locale, time_zone: TimeZone.local };

    const { root } = await mountCard(LaterCard, { type: "custom:later-card" }, hass);

    expect(rows(root)[0]).toContain("20:00");
  });
});

describe("in the user's language", () => {
  test("speaks German when Home Assistant does: list, form, chips and errors", async () => {
    const later = new FakeLater([schedule({ name: "Heizung aus", minutes: 25, now: NOW })]);
    const hass = hassWith(later);
    hass.locale = { ...hass.locale, language: "de" };
    const { root, settle } = await mountCard(LaterCard, { type: "custom:later-card" }, hass);

    expect(rows(root)[0]).toBe("Heizung aus Ausschalten · Heater 19:25 in 25 Min.");
    click(root, 'button[title="Aktion planen"]');
    await settle();
    pick(form(root), "entity_id", "switch.heater");
    await settle();
    expect(form(root).querySelector('[data-chip="turn_on"]')?.textContent?.trim()).toBe(
      "Einschalten"
    );
    expect(
      form(root).querySelector<HTMLElement & { label: string }>('[data-chip="in-60"]')?.label
    ).toBe("In 1 Std.");
    click(form(root), ".confirm");
    await settle();

    expect(form(root).querySelector(".error")?.textContent).toBe("Wähle einen Zeitpunkt");
    expect(dialogTitle(root)).toBe("Aktion planen");
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
