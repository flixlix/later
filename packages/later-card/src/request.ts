import { SHORTCUTS, type AddRequest, type Shortcut } from "./types";

export type When = { kind: "in"; minutes: number } | { kind: "at"; time: string };

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
      return "Pick a service";
    }
    return { service: draft.service, data: draft.data ?? {} };
  }
  if (!draft.action) {
    return "Pick an action";
  }
  return draft.entity ? { action: draft.action } : "Pick an entity";
};

const whenPart = (when: When | undefined): AddRequest | string => {
  if (!when) {
    return "Pick when";
  }
  if (when.kind === "in") {
    return Number.isInteger(when.minutes) && when.minutes > 0
      ? { in: when.minutes }
      : "Minutes must be a whole number above 0";
  }
  return /^\d{1,2}:\d{2}/.test(when.time) ? { at: when.time.slice(0, 5) } : "Pick a time";
};

/** The `later/add` payload for a draft, or what is still missing. */
export function addRequest(draft: Draft): AddRequest | string {
  const action = actionPart(draft);
  if (typeof action === "string") {
    return action;
  }
  const when = whenPart(draft.when);
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

const SHORTCUT_LABELS: Record<Shortcut, string> = {
  turn_on: "Turn on",
  turn_off: "Turn off",
  toggle: "Toggle",
};

export const shortcutLabel = (shortcut: Shortcut): string => SHORTCUT_LABELS[shortcut];

/** `Turn off` for `switch.turn_off`, the service itself otherwise. */
export function actionSummary(service: string): string {
  const name = service.split(".")[1];
  const shortcut = SHORTCUTS.find((candidate) => candidate === name);
  return shortcut ? SHORTCUT_LABELS[shortcut] : service;
}
