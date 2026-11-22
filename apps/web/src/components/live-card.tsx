import { useEffect, useRef, useState } from "react";

import { useScheme } from "../lib/theme";
import { cx } from "./docs";

export type LiveCardConfig = { type: "custom:later-card"; title?: string; entity?: string };

/** The entities the demo dashboard has; examples target these. */
const STATES: Record<string, { state: string; attributes: { friendly_name: string } }> = {
  "switch.heater": { state: "on", attributes: { friendly_name: "Heater" } },
  "light.desk_lamp": { state: "on", attributes: { friendly_name: "Desk lamp" } },
  "switch.pump": { state: "on", attributes: { friendly_name: "Pump" } },
  "climate.office": { state: "heat", attributes: { friendly_name: "Office" } },
};

const SHORTCUT_LABELS: Record<string, string> = {
  turn_on: "turn on",
  turn_off: "turn off",
  toggle: "toggle",
};

type Request = { type: string; [field: string]: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/**
 * The schedule fields a `later/add` or `later/update` asks for, named as the integration names
 * them. The demo's Home Assistant runs in the visitor's time zone, so `at` reads as local time.
 */
function requestedFields(request: Request, now: Date) {
  const entity = text(request.entity_id) ?? null;
  const action = text(request.action);
  const service = text(request.service) ?? `${entity?.split(".")[0]}.${action}`;
  const runAt =
    typeof request.in === "number"
      ? new Date(now.getTime() + request.in * 60_000)
      : new Date(String(request.at).replace(" ", "T"));
  const target = (entity && STATES[entity]?.attributes.friendly_name) ?? service;
  const what = (action && SHORTCUT_LABELS[action]) ?? service;
  return {
    name: text(request.name) ?? `${target}: ${what}`,
    service,
    entity_id: entity,
    data: isRecord(request.data) ? request.data : {},
    run_at: runAt.toISOString(),
  };
}

const byDueTime = (a: { run_at: string }, b: { run_at: string }) =>
  a.run_at.localeCompare(b.run_at);

// Lit and the card only run in the browser; load them after hydration.
const loadCard = () =>
  Promise.all([
    import("@later/shared/testing/ha-elements"),
    import("@later/shared/testing/fake-hass"),
    import("later-card/testing/fake-later"),
    import("later-card/source"),
  ]).then(([elements, { fakeHass }, { FakeLater, schedule }, { LaterCard }]) => {
    elements.defineHaElements();

    /** The integration in memory: schedules are due when `later/add` and `later/update` say. */
    class DemoLater extends FakeLater {
      call(message: Request) {
        if (message.type !== "later/add" && message.type !== "later/update") {
          return super.call(message);
        }
        const now = new Date();
        const fields = requestedFields(message, now);
        if (message.type === "later/update") {
          const old = this.schedules.find((s) => s.id === message.schedule_id);
          if (!old) {
            return Promise.reject({ code: "not_found", message: "No pending schedule" });
          }
          const updated = { ...old, ...fields };
          this.schedules = this.schedules.map((s) => (s === old ? updated : s)).toSorted(byDueTime);
          this.emit({ type: "updated", schedule: updated, schedules: this.schedules });
          return Promise.resolve(updated);
        }
        const created = { ...schedule({ now }), ...fields };
        this.schedules = [...this.schedules, created].toSorted(byDueTime);
        this.emit({ type: "created", schedule: created, schedules: this.schedules });
        return Promise.resolve(created);
      }
    }

    return (config: LiveCardConfig) => {
      const now = new Date();
      const later = new DemoLater([
        schedule({ name: "Heater: turn off", minutes: 25, now }),
        schedule({
          name: "Office: set temperature",
          service: "climate.set_temperature",
          entity_id: "climate.office",
          minutes: 120,
          now,
        }),
        schedule({
          name: "Holiday lights",
          service: "script.turn_on",
          entity_id: null,
          minutes: 60 * 13,
          now,
        }),
      ]);
      const hass = fakeHass({
        websocket: later,
        states: STATES,
        services: {
          switch: ["turn_on", "turn_off", "toggle"],
          light: ["turn_on", "turn_off", "toggle"],
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const card = new LaterCard();
      card.setConfig(config);
      card.hass = hass;
      return { card, haDashboardStyle: elements.haDashboardStyle };
    };
  });

/**
 * The real Later card on a Home Assistant dashboard background, talking to an in-memory
 * integration: cancel, schedule and edit all work, nothing leaves the page.
 */
export function LiveCard({ config, className }: { config: LiveCardConfig; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState<{
    card: HTMLElement;
    haDashboardStyle: (scheme: "light" | "dark") => string;
  }>();
  const [error, setError] = useState<string>();
  const scheme = useScheme();
  const { title, entity } = config;

  useEffect(() => {
    const abort = new AbortController();
    async function mount() {
      try {
        const create = await loadCard();
        if (!abort.signal.aborted) {
          setMounted(create({ type: "custom:later-card", title, entity }));
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    }
    void mount();
    return () => abort.abort();
  }, [title, entity]);

  useEffect(() => {
    if (mounted && host.current) {
      host.current.style.cssText = mounted.haDashboardStyle(scheme);
      host.current.replaceChildren(mounted.card);
    }
  }, [mounted, scheme]);

  return (
    <div className={cx("w-full max-w-[400px] min-w-0", className)}>
      <div ref={host} className="min-h-40 rounded-2xl p-3" />
      {error ? (
        <p className="text-destructive mt-2 text-sm">The live card failed to load: {error}</p>
      ) : null}
    </div>
  );
}
