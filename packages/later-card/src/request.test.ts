import { describe, expect, test } from "vite-plus/test";
import { actionSummary, addRequest, shortcutsFor } from "./request";

const services = {
  switch: { turn_on: {}, turn_off: {}, toggle: {} },
  climate: { turn_on: {}, turn_off: {}, set_temperature: {} },
  sensor: {},
};

describe("addRequest", () => {
  test("a shortcut in N minutes", () => {
    expect(
      addRequest({
        entity: "switch.heater",
        action: "turn_off",
        when: { kind: "in", minutes: 30 },
      })
    ).toEqual({ entity_id: "switch.heater", action: "turn_off", in: 30 });
  });

  test("any service at a clock time, with data and a name", () => {
    expect(
      addRequest({
        entity: "climate.office",
        action: "service",
        service: "climate.set_temperature",
        data: { temperature: 17 },
        when: { kind: "at", time: "20:00:00" },
        name: "  Office cooler ",
      })
    ).toEqual({
      entity_id: "climate.office",
      service: "climate.set_temperature",
      data: { temperature: 17 },
      at: "20:00",
      name: "Office cooler",
    });
  });

  test("a service needs no entity", () => {
    expect(
      addRequest({ action: "service", service: "script.bedtime", when: { kind: "in", minutes: 5 } })
    ).toEqual({ service: "script.bedtime", data: {}, in: 5 });
  });

  test.each([
    [{ when: { kind: "in", minutes: 5 } as const }, "Pick an action"],
    [{ action: "turn_off", when: { kind: "in", minutes: 5 } } as const, "Pick an entity"],
    [{ entity: "switch.a", action: "turn_off" } as const, "Pick when"],
    [
      { action: "service", service: "nope", when: { kind: "in", minutes: 5 } } as const,
      "Pick a service",
    ],
    [
      { entity: "switch.a", action: "turn_off", when: { kind: "in", minutes: 0 } } as const,
      "Minutes must be a whole number above 0",
    ],
  ])("says what is missing: %o", (draft, message) => {
    expect(addRequest(draft)).toBe(message);
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
  expect(actionSummary("light.turn_on")).toBe("Turn on");
  expect(actionSummary("climate.set_temperature")).toBe("climate.set_temperature");
});
