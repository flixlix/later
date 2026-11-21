import { describe, expect, test } from "vite-plus/test";
import { actionSummary, addRequest, draftOf, shortcutsFor } from "./request";
import { localizer } from "./localize";
import { schedule } from "./testing/fake-later";

const NOW = new Date("2026-11-21T18:00:00Z"); // 19:00 in Berlin
const BERLIN = "Europe/Berlin";

const services = {
  switch: { turn_on: {}, turn_off: {}, toggle: {} },
  climate: { turn_on: {}, turn_off: {}, set_temperature: {} },
  sensor: {},
};

describe("addRequest", () => {
  test("a shortcut in N minutes", () => {
    expect(
      addRequest(
        {
          entity: "switch.heater",
          action: "turn_off",
          when: { kind: "in", minutes: 30 },
        },
        NOW,
        BERLIN
      )
    ).toEqual({ entity_id: "switch.heater", action: "turn_off", in: 30 });
  });

  test("any service on a date and time, with data and a name", () => {
    expect(
      addRequest(
        {
          entity: "climate.office",
          action: "service",
          service: "climate.set_temperature",
          data: { temperature: 17 },
          when: { kind: "at", date: "2026-11-24", time: "20:00:00" },
          name: "  Office cooler ",
        },
        NOW,
        BERLIN
      )
    ).toEqual({
      entity_id: "climate.office",
      service: "climate.set_temperature",
      data: { temperature: 17 },
      at: "2026-11-24 20:00",
      name: "Office cooler",
    });
  });

  test("a service needs no entity", () => {
    expect(
      addRequest(
        { action: "service", service: "script.bedtime", when: { kind: "in", minutes: 5 } },
        NOW,
        BERLIN
      )
    ).toEqual({ service: "script.bedtime", data: {}, in: 5 });
  });

  test.each([
    [{ when: { kind: "in", minutes: 5 } as const }, "error.pick_action"],
    [{ action: "turn_off", when: { kind: "in", minutes: 5 } } as const, "error.pick_entity"],
    [{ entity: "switch.a", action: "turn_off" } as const, "error.pick_when"],
    [
      { action: "service", service: "nope", when: { kind: "in", minutes: 5 } } as const,
      "error.pick_service",
    ],
    [
      { entity: "switch.a", action: "turn_off", when: { kind: "in", minutes: 0 } } as const,
      "error.whole_minutes",
    ],
    [
      {
        entity: "switch.a",
        action: "turn_off",
        when: { kind: "at", date: "2026-11-21", time: "18:30" },
      } as const,
      "error.in_the_past",
    ],
  ])("says what is missing, as a translation key: %o", (draft, message) => {
    expect(addRequest(draft, NOW, BERLIN)).toBe(message);
  });
});

describe("draftOf", () => {
  test("a shortcut on its own entity edits as that shortcut, due on Home Assistant's clock", () => {
    const heater = schedule({ run_at: "2026-11-22T06:30:00Z", name: "Morning" });

    expect(draftOf(heater, BERLIN)).toEqual({
      entity: "switch.heater",
      action: "turn_off",
      when: { kind: "at", date: "2026-11-22", time: "07:30" },
      name: "Morning",
    });
  });

  test("a service with data, or on another domain, edits as a service", () => {
    const cooler = schedule({
      service: "climate.set_temperature",
      data: { temperature: 17 },
      entity_id: "climate.office",
    });
    const script = schedule({ service: "script.turn_on", entity_id: "switch.heater" });

    expect(draftOf(cooler, BERLIN)).toMatchObject({
      action: "service",
      service: "climate.set_temperature",
      data: { temperature: 17 },
    });
    expect(draftOf(script, BERLIN)).toMatchObject({ action: "service", service: "script.turn_on" });
  });
});

describe("shortcutsFor", () => {
  test("offers the shortcuts the entity's domain has", () => {
    expect(shortcutsFor("switch.heater", services)).toEqual(["turn_on", "turn_off", "toggle"]);
    expect(shortcutsFor("climate.office", services)).toEqual(["turn_on", "turn_off"]);
    expect(shortcutsFor("sensor.power", services)).toEqual([]);
    expect(shortcutsFor(undefined, services)).toEqual([]);
  });
});

test("actionSummary names shortcuts and keeps other services", () => {
  expect(actionSummary("light.turn_on", localizer("en"))).toBe("Turn on");
  expect(actionSummary("climate.set_temperature", localizer("en"))).toBe("climate.set_temperature");
});
