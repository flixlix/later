import { type Localize } from "./localize";
import { clockTime, dayKey, hasPassed, zonedMoment } from "./time";
import { SHORTCUTS, type AddRequest, type Schedule, type Shortcut } from "./types";

/** `date` is `2026-11-21` and `time` `HH:MM[:SS]` on the dashboard's clock. */
export type When = { kind: "in"; minutes: number } | { kind: "at"; date: string; time: string };

/** What the create form holds. */
export type Draft = {
  entity?: string;
  action?: Shortcut | "service";
  service?: string;
  data?: Record<string, unknown>;
  when?: When;
  name?: string;
};

/** Services of the entity's domain that the shortcut chips stand for. */
export function shortcutsFor(
  entityId: string | undefined,
  services: Record<string, Record<string, unknown>>
): Shortcut[] {
  const domain = entityId?.split(".")[0];
  const available = domain ? services[domain] : undefined;
  return available ? SHORTCUTS.filter((shortcut) => shortcut in available) : [];
}

const actionPart = (draft: Draft): AddRequest | string => {
  if (draft.action === "service") {
    if (!draft.service?.includes(".")) {
      return "error.pick_service";
    }
    return { service: draft.service, data: draft.data ?? {} };
  }
  if (!draft.action) {
    return "error.pick_action";
  }
  return draft.entity ? { action: draft.action } : "error.pick_entity";
};

const whenPart = (when: When | undefined, now: Date, timeZone: string): AddRequest | string => {
  if (!when) {
    return "error.pick_when";
  }
  if (when.kind === "in") {
    return Number.isInteger(when.minutes) && when.minutes > 0
      ? { in: when.minutes }
      : "error.whole_minutes";
  }
  const moment = zonedMoment(when.date, when.time, timeZone);
  if (!moment) {
    return "error.pick_date_time";
  }
  if (hasPassed(moment, now)) {
    return "error.in_the_past";
  }
  // Without an offset: the integration reads it in Home Assistant's time zone, as the card does.
  return { at: `${when.date} ${when.time.slice(0, 5)}` };
};

/**
 * The `later/add` (or `later/update`) payload for a draft, or the translation key of what is
 * still missing (`error.pick_when`). Dates and
 * times are in `timeZone`, Home Assistant's.
 */
export function addRequest(draft: Draft, now: Date, timeZone: string): AddRequest | string {
  const action = actionPart(draft);
  if (typeof action === "string") {
    return action;
  }
  const when = whenPart(draft.when, now, timeZone);
  if (typeof when === "string") {
    return when;
  }
  const name = draft.name?.trim();
  return {
    ...(draft.entity ? { entity_id: draft.entity } : {}),
    ...action,
    ...when,
    ...(name ? { name } : {}),
  };
}

/** The draft that edits `schedule`: its target, action, due date and time, and name. */
export function draftOf(schedule: Schedule, timeZone: string): Draft {
  const runAt = new Date(schedule.run_at);
  const entity = schedule.entity_id ?? undefined;
  const [domain, name] = schedule.service.split(".");
  const shortcut = SHORTCUTS.find((candidate) => candidate === name);
  const isShortcut =
    shortcut !== undefined &&
    entity?.split(".")[0] === domain &&
    Object.keys(schedule.data).length === 0;
  return {
    entity,
    ...(isShortcut
      ? { action: shortcut }
      : { action: "service", service: schedule.service, data: schedule.data }),
    when: { kind: "at", date: dayKey(runAt, timeZone), time: clockTime(runAt, timeZone) },
    name: schedule.name,
  };
}

/** `Turn off` for a shortcut, in the user's language. */
export const shortcutLabel = (shortcut: Shortcut, localize: Localize): string =>
  localize(`action.${shortcut}`);

/** `Turn off` for `switch.turn_off`, the service itself otherwise. */
export function actionSummary(service: string, localize: Localize): string {
  const name = service.split(".")[1];
  const shortcut = SHORTCUTS.find((candidate) => candidate === name);
  return shortcut ? shortcutLabel(shortcut, localize) : service;
}
