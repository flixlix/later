import { type Infer, object, optional, string } from "superstruct";

export const laterCardConfigStruct = object({
  type: string(),
  title: optional(string()),
  /** Preselected in the create form. */
  entity: optional(string()),
});

export type LaterCardConfig = Infer<typeof laterCardConfigStruct>;

/** One pending one-off action. Mirrors `Schedule` in custom_components/later/store.py. */
export type Schedule = {
  id: string;
  name: string;
  /** UTC ISO-8601 */
  run_at: string;
  created_at: string;
  /** `domain.service` */
  service: string;
  data: Record<string, unknown>;
  entity_id: string | null;
  source: "card" | "service";
};

export type ScheduleChangeType =
  | "created"
  | "updated"
  | "cancelled"
  | "ran"
  | "late_ran"
  | "failed";

/** What `later/subscribe` pushes: the whole list first, then one event per change. */
export type ScheduleEvent =
  | { type: "list"; schedules: Schedule[] }
  | { type: ScheduleChangeType; schedule: Schedule; schedules: Schedule[] };

export const SHORTCUTS = ["turn_on", "turn_off", "toggle"] as const;
export type Shortcut = (typeof SHORTCUTS)[number];

/** The payload of `later/add` and `later/update`, as for the `later.add` service. */
export type AddRequest = {
  entity_id?: string;
  action?: Shortcut;
  service?: string;
  data?: Record<string, unknown>;
  at?: string;
  in?: number;
  name?: string;
};
