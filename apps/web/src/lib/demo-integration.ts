// What the docs' Later integration does with `later/add` and `later/update`, in the browser:
// validation as in custom_components/later/schema.py, due times and default names as in
// schedules.py. Its Home Assistant runs in the visitor's time zone, so clock times are local.

export type DemoEntity = { state: string; attributes: { friendly_name: string } };

/** The demo dashboard's entities; the docs' examples target these. */
export const DEMO_ENTITIES: Record<string, DemoEntity> = {
  "light.living_room": { state: "on", attributes: { friendly_name: "Living room" } },
  "light.desk_lamp": { state: "on", attributes: { friendly_name: "Desk lamp" } },
  "light.garage": { state: "off", attributes: { friendly_name: "Garage" } },
  "switch.heater": { state: "on", attributes: { friendly_name: "Heater" } },
  "switch.coffee_machine": { state: "off", attributes: { friendly_name: "Coffee machine" } },
  "switch.pump": { state: "on", attributes: { friendly_name: "Pump" } },
  "fan.bedroom": { state: "on", attributes: { friendly_name: "Bedroom fan" } },
  "climate.office": { state: "heat", attributes: { friendly_name: "Office" } },
  "cover.garage_door": { state: "closed", attributes: { friendly_name: "Garage door" } },
  "media_player.living_room_tv": { state: "on", attributes: { friendly_name: "Living room TV" } },
  "input_boolean.guest_mode": { state: "off", attributes: { friendly_name: "Guest mode" } },
  "script.holiday_lights": { state: "off", attributes: { friendly_name: "Holiday lights" } },
};

const ON_OFF = ["turn_on", "turn_off", "toggle"];

/** Services per domain, as Home Assistant lists them; the shortcuts come from these. */
export const DEMO_SERVICES: Record<string, string[]> = {
  light: ON_OFF,
  switch: ON_OFF,
  fan: [...ON_OFF, "set_percentage"],
  climate: ["turn_on", "turn_off", "set_temperature", "set_hvac_mode"],
  cover: ["open_cover", "close_cover", "toggle"],
  media_player: [...ON_OFF, "media_pause", "volume_set"],
  input_boolean: ON_OFF,
  script: ["turn_on", "turn_off", "holiday_lights"],
  notify: ["notify"],
};

const SHORTCUTS = new Set(["turn_on", "turn_off", "toggle"]);
const MINUTE = 60_000;

export type ScheduleFields = {
  name: string;
  service: string;
  entity_id: string | null;
  data: Record<string, unknown>;
  run_at: string;
};

/** A rejected request, with the message Home Assistant's websocket sends. */
export class InvalidRequest extends Error {
  readonly code = "invalid_format";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const two = (n: number) => String(n).padStart(2, "0");

const clock = (date: Date) => `${two(date.getHours())}:${two(date.getMinutes())}`;

/** `20:00` is the next 20:00; `2026-12-24 17:00` is that local date and time. */
function dueAt(at: unknown, now: Date): Date {
  const text = String(at).trim();
  const time = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (time) {
    const due = new Date(now);
    due.setHours(Number(time[1]), Number(time[2]), 0, 0);
    if (due <= now) {
      due.setDate(due.getDate() + 1);
    }
    return due;
  }
  const date = /^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?$/.test(text)
    ? new Date(text.replace(" ", "T"))
    : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    throw new InvalidRequest(
      `\`at\` must be a time (20:00) or a date and time (2026-11-21 20:00), got '${text}'`
    );
  }
  return date;
}

function dueTime(request: Record<string, unknown>, now: Date): Date {
  if ("at" in request && "in" in request) {
    throw new InvalidRequest("send either `at` or `in`, not both");
  }
  if ("in" in request) {
    const minutes = Number(request.in);
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new InvalidRequest("`in` is a number of minutes above 0");
    }
    return new Date(now.getTime() + minutes * MINUTE);
  }
  if ("at" in request) {
    return dueAt(request.at, now);
  }
  throw new InvalidRequest("must contain at least one of at, in.");
}

function serviceOf(request: Record<string, unknown>, entity: string | null): string {
  if ("service" in request && "action" in request) {
    throw new InvalidRequest("send either `service` or `action`, not both");
  }
  if ("action" in request) {
    const action = String(request.action);
    if (!SHORTCUTS.has(action)) {
      throw new InvalidRequest("value must be one of ['toggle', 'turn_off', 'turn_on']");
    }
    if (!entity) {
      throw new InvalidRequest("`action` (turn_on, turn_off, toggle) needs an `entity_id`");
    }
    return `${entity.split(".")[0]}.${action}`;
  }
  if ("service" in request) {
    const service = String(request.service);
    if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(service)) {
      throw new InvalidRequest(`Service ${service} does not match format <domain>.<name>`);
    }
    return service;
  }
  throw new InvalidRequest("must contain at least one of service, action.");
}

function entityOf(request: Record<string, unknown>): string | null {
  if (!("entity_id" in request)) {
    return null;
  }
  const entity = String(request.entity_id);
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entity)) {
    throw new InvalidRequest(`Entity ID ${entity} is an invalid entity ID`);
  }
  return entity;
}

/** `Heater: turn off at 20:00`. */
export function defaultName(entity: string | null, service: string, runAt: Date): string {
  const target =
    (entity ? DEMO_ENTITIES[entity]?.attributes.friendly_name : undefined) ?? entity ?? service;
  const verb = (service.split(".")[1] ?? service).replaceAll("_", " ");
  return `${target}: ${verb} at ${clock(runAt)}`;
}

/**
 * The schedule a `later/add` request makes, or `later/update` makes of `old`: a default-named
 * schedule is renamed to match, a picked name stays. Throws `InvalidRequest` as the integration
 * would reject it.
 */
export function scheduleFields(
  request: Record<string, unknown>,
  now: Date,
  old?: ScheduleFields
): ScheduleFields {
  const entity = entityOf(request);
  const service = serviceOf(request, entity);
  const runAt = dueTime(request, now);
  const trimmed = typeof request.name === "string" ? request.name.trim().slice(0, 255) : "";
  const picked = trimmed === "" ? undefined : trimmed;
  const kept =
    old && old.name !== defaultName(old.entity_id, old.service, new Date(old.run_at))
      ? old.name
      : undefined;
  return {
    name: picked ?? kept ?? defaultName(entity, service, runAt),
    service,
    entity_id: entity,
    data: isRecord(request.data) ? request.data : {},
    run_at: runAt.toISOString(),
  };
}
