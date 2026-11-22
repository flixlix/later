import { expect, test } from "vite-plus/test";

import { InvalidRequest, scheduleFields } from "./demo-integration";

const NOW = new Date(2026, 10, 21, 18, 0);

test("a shortcut becomes the entity's domain service, named as the integration names it", () => {
  expect(
    scheduleFields({ entity_id: "switch.heater", action: "turn_off", at: "20:00" }, NOW)
  ).toEqual({
    name: "Heater: turn off at 20:00",
    service: "switch.turn_off",
    entity_id: "switch.heater",
    data: {},
    run_at: new Date(2026, 10, 21, 20, 0).toISOString(),
  });
});

test("a clock time that has passed means tomorrow; `in` counts from now", () => {
  const passed = scheduleFields({ entity_id: "switch.pump", action: "toggle", at: "07:30" }, NOW);
  expect(passed.run_at).toBe(new Date(2026, 10, 22, 7, 30).toISOString());
  const later = scheduleFields({ service: "script.holiday_lights", in: 45 }, NOW);
  expect(later.run_at).toBe(new Date(2026, 10, 21, 18, 45).toISOString());
  expect(later.entity_id).toBeNull();
});

test.each([
  [{ in: 30 }, "must contain at least one of service, action."],
  [{ action: "turn_off", in: 30 }, "`action` (turn_on, turn_off, toggle) needs an `entity_id`"],
  [{ service: "light.turn_on" }, "must contain at least one of at, in."],
  [{ service: "light.turn_on", at: "20:00", in: 5 }, "send either `at` or `in`, not both"],
  [{ service: "turn_on", in: 5 }, "Service turn_on does not match format <domain>.<name>"],
  [{ service: "light.turn_on", in: 0 }, "`in` is a number of minutes above 0"],
])("rejects %j as the integration does", (request, message) => {
  expect(() => scheduleFields(request, NOW)).toThrow(new InvalidRequest(message));
});

test("an edit renames a default-named schedule and keeps a picked name", () => {
  const defaultNamed = scheduleFields(
    { entity_id: "light.garage", action: "turn_off", in: 10 },
    NOW
  );
  const picked = { ...defaultNamed, name: "Garage light" };
  const edit = { entity_id: "light.garage", action: "turn_on", at: "21:00" };
  expect(scheduleFields(edit, NOW, defaultNamed).name).toBe("Garage: turn on at 21:00");
  expect(scheduleFields(edit, NOW, picked).name).toBe("Garage light");
});
