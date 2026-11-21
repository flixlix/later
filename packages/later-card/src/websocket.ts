import { type HomeAssistant } from "custom-card-helpers";
import { type AddRequest, type Schedule, type ScheduleEvent } from "./types";

export const subscribeSchedules = (
  hass: HomeAssistant,
  onEvent: (event: ScheduleEvent) => void
): Promise<() => Promise<void>> =>
  hass.connection.subscribeMessage<ScheduleEvent>(onEvent, { type: "later/subscribe" });

export const addSchedule = (hass: HomeAssistant, request: AddRequest): Promise<Schedule> =>
  hass.callWS<Schedule>({ type: "later/add", ...request });

export const updateSchedule = (
  hass: HomeAssistant,
  scheduleId: string,
  request: AddRequest
): Promise<Schedule> =>
  hass.callWS<Schedule>({ type: "later/update", schedule_id: scheduleId, ...request });

export const cancelSchedule = (hass: HomeAssistant, scheduleId: string): Promise<Schedule> =>
  hass.callWS<Schedule>({ type: "later/cancel", schedule_id: scheduleId });

export type WebsocketError = { code: string; message: string };

/** Home Assistant rejects websocket calls with `{ code, message }`. */
export function websocketError(error: unknown): WebsocketError {
  if (typeof error === "object" && error !== null && "code" in error) {
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    return { code: String(error.code), message };
  }
  return { code: "unknown_error", message: error instanceof Error ? error.message : String(error) };
}
