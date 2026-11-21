import { type FakeWebsocket } from "@later/shared/testing/fake-hass";
import { type MessageBase } from "home-assistant-js-websocket";
import { type Schedule, type ScheduleEvent } from "../types";

let nextId = 1;

/** A schedule as the integration returns it; due `minutes` after `now`. */
export const schedule = (
  overrides: Partial<Schedule> & { minutes?: number; now?: Date } = {}
): Schedule => {
  const { minutes = 30, now = new Date(), ...fields } = overrides;
  const id = `s${String(nextId++).padStart(7, "0")}`;
  return {
    id,
    name: "Heater off",
    run_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
    created_at: now.toISOString(),
    service: "switch.turn_off",
    data: {},
    entity_id: "switch.heater",
    source: "card",
    ...fields,
  };
};

/**
 * The `later/*` websocket API of the integration, in memory: records every message, answers
 * add, update and cancel, and pushes changes to subscribers.
 */
export class FakeLater implements FakeWebsocket {
  public readonly messages: MessageBase[] = [];
  public schedules: Schedule[];
  /** Makes `later/subscribe` fail, as Home Assistant does without the integration. */
  public subscribeError?: { code: string; message: string };
  /** Makes `later/add` fail with this error. */
  public addError?: { code: string; message: string };
  private readonly subscribers = new Set<(event: unknown) => void>();

  constructor(schedules: Schedule[] = []) {
    this.schedules = schedules;
  }

  call(message: MessageBase): Promise<unknown> {
    this.messages.push(message);
    if (message.type === "later/add") {
      if (this.addError) {
        return Promise.reject(this.addError);
      }
      const created = schedule({ name: typeof message.name === "string" ? message.name : "New" });
      this.schedules = [...this.schedules, created];
      this.emit({ type: "created", schedule: created, schedules: this.schedules });
      return Promise.resolve(created);
    }
    if (message.type === "later/update") {
      const old = this.schedules.find((s) => s.id === message.schedule_id);
      if (!old) {
        return Promise.reject({ code: "not_found", message: "No pending schedule" });
      }
      const updated = { ...old, name: typeof message.name === "string" ? message.name : old.name };
      this.schedules = this.schedules.map((s) => (s === old ? updated : s));
      this.emit({ type: "updated", schedule: updated, schedules: this.schedules });
      return Promise.resolve(updated);
    }
    if (message.type === "later/cancel") {
      const cancelled = this.schedules.find((s) => s.id === message.schedule_id);
      if (!cancelled) {
        return Promise.reject({ code: "not_found", message: "No pending schedule" });
      }
      this.schedules = this.schedules.filter((s) => s !== cancelled);
      this.emit({ type: "cancelled", schedule: cancelled, schedules: this.schedules });
      return Promise.resolve(cancelled);
    }
    return Promise.reject(new Error(`FakeLater: unexpected ${message.type}`));
  }

  subscribe(callback: (event: unknown) => void, message: MessageBase) {
    this.messages.push(message);
    if (this.subscribeError) {
      return Promise.reject(this.subscribeError);
    }
    this.subscribers.add(callback);
    callback({ type: "list", schedules: this.schedules });
    return Promise.resolve(() => {
      this.subscribers.delete(callback);
      return Promise.resolve();
    });
  }

  /** Pushes an event to every subscribed card. */
  emit(event: ScheduleEvent): void {
    this.subscribers.forEach((callback) => callback(event));
  }

  /** The messages of one type the card sent. */
  sent(type: string): MessageBase[] {
    return this.messages.filter((message) => message.type === type);
  }
}
