import {
  DateFormat,
  FirstWeekday,
  type HomeAssistant,
  NumberFormat,
  TimeFormat,
  TimeZone,
} from "custom-card-helpers";
import { type Connection, type HassEntity, type MessageBase } from "home-assistant-js-websocket";

/** Answers the websocket messages a card sends: one-off calls and subscriptions. */
export type FakeWebsocket = {
  call(message: MessageBase): Promise<unknown>;
  subscribe(callback: (event: unknown) => void, message: MessageBase): Promise<() => Promise<void>>;
};

export type StateFixture = { state: string; attributes?: Record<string, unknown> };

export type FakeHassOptions = {
  states?: Record<string, StateFixture>;
  /** Service names per domain, e.g. `{ switch: ["turn_on", "turn_off", "toggle"] }`. */
  services?: Record<string, string[]>;
  timeZone?: string;
  websocket?: FakeWebsocket;
};

const unexpected: FakeWebsocket = {
  call: (message) => Promise.reject(new Error(`fakeHass: unexpected ${message.type}`)),
  subscribe: (_callback, message) =>
    Promise.reject(new Error(`fakeHass: unexpected subscription ${message.type}`)),
};

/** A state object as Home Assistant sends it. */
export const entityState = (entityId: string, fixture: StateFixture): HassEntity => ({
  entity_id: entityId,
  state: fixture.state,
  attributes: fixture.attributes ?? {},
  last_changed: "2026-11-21T18:00:00.000Z",
  last_updated: "2026-11-21T18:00:00.000Z",
  context: { id: "fixture", user_id: null, parent_id: null },
});

const services = (domains: Record<string, string[]>): HomeAssistant["services"] =>
  Object.fromEntries(
    Object.entries(domains).map(([domain, names]) => [
      domain,
      Object.fromEntries(names.map((name) => [name, { name, description: "", fields: {} }])),
    ])
  );

/** A Home Assistant frontend object for mounting cards without Home Assistant. */
export const fakeHass = (options: FakeHassOptions = {}): HomeAssistant => {
  const websocket = options.websocket ?? unexpected;
  const connection: Partial<Connection> = {
    subscribeMessage: (callback: (result: never) => void, message: MessageBase) =>
      websocket.subscribe((event) => callback(event as never), message),
  };
  const hass: Partial<HomeAssistant> = {
    states: Object.fromEntries(
      Object.entries(options.states ?? {}).map(([id, fixture]) => [id, entityState(id, fixture)])
    ),
    services: services(options.services ?? {}),
    config: {
      latitude: 0,
      longitude: 0,
      elevation: 0,
      radius: 100,
      unit_system: {
        length: "km",
        mass: "kg",
        temperature: "°C",
        volume: "L",
        pressure: "hPa",
        wind_speed: "km/h",
        accumulated_precipitation: "mm",
      },
      location_name: "Home",
      time_zone: options.timeZone ?? "Europe/Berlin",
      components: ["later"],
      config_dir: "/config",
      allowlist_external_dirs: [],
      allowlist_external_urls: [],
      version: "2026.11.0",
      config_source: "storage",
      safe_mode: false,
      recovery_mode: false,
      state: "RUNNING",
      external_url: null,
      internal_url: null,
      currency: "EUR",
      country: "DE",
      language: "en",
    },
    locale: {
      language: "en",
      number_format: NumberFormat.language,
      time_format: TimeFormat.twenty_four,
      date_format: DateFormat.language,
      first_weekday: FirstWeekday.monday,
      time_zone: TimeZone.server,
    },
    language: "en",
    localize: () => "",
    connection: connection as Connection,
    callWS: <T>(message: MessageBase) => websocket.call(message) as Promise<T>,
  };
  return hass as HomeAssistant;
};
