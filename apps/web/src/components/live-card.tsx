import { useEffect, useRef, useState } from "react";

import {
  DEMO_ENTITIES,
  DEMO_SERVICES,
  InvalidRequest,
  scheduleFields,
} from "../lib/demo-integration";
import { useScheme } from "../lib/theme";
import { cx } from "./docs";

const byDueTime = (a: { run_at: string }, b: { run_at: string }) =>
  a.run_at.localeCompare(b.run_at);

export type LiveCardConfig = { type: "custom:later-card"; title?: string; entity?: string };

// Lit and the card only run in the browser; load them after hydration.
const loadCard = () =>
  Promise.all([
    import("../lib/ha-stand-ins"),
    import("@later/shared/testing/ha-elements"),
    import("@later/shared/testing/fake-hass"),
    import("later-card/testing/fake-later"),
    import("later-card/source"),
  ]).then(([standIns, elements, { fakeHass }, { FakeLater, schedule }, { LaterCard }]) => {
    standIns.defineDocsHaElements();
    elements.defineHaElements();

    /** The Later integration in memory: validates, names and orders schedules as it does. */
    class DemoLater extends FakeLater {
      call(message: Parameters<InstanceType<typeof FakeLater>["call"]>[0]) {
        if (message.type !== "later/add" && message.type !== "later/update") {
          return super.call(message);
        }
        const { type, schedule_id: scheduleId, ...request } = message;
        const old = this.schedules.find((s) => s.id === scheduleId);
        if (type === "later/update" && !old) {
          return Promise.reject({
            code: "not_found",
            message: `No pending schedule with id ${String(scheduleId)}.`,
          });
        }
        try {
          const now = new Date();
          const fields = scheduleFields(request, now, old);
          const saved = old
            ? { ...old, ...fields }
            : { ...schedule({ now }), ...fields, source: "card" as const };
          this.schedules = [...this.schedules.filter((s) => s !== old), saved].toSorted(byDueTime);
          this.emit({
            type: old ? "updated" : "created",
            schedule: saved,
            schedules: this.schedules,
          });
          return Promise.resolve(saved);
        } catch (error) {
          return Promise.reject(
            error instanceof InvalidRequest ? { code: error.code, message: error.message } : error
          );
        }
      }
    }

    /** A schedule due `minutes` from now, as `later.add` with these fields would make it. */
    const pending = (request: Record<string, unknown>, minutes: number, now: Date) => ({
      ...schedule({ now }),
      ...scheduleFields({ ...request, in: minutes }, now),
    });

    return (config: LiveCardConfig) => {
      const now = new Date();
      const later = new DemoLater(
        [
          pending({ entity_id: "switch.heater", action: "turn_off" }, 25, now),
          pending({ entity_id: "light.living_room", action: "turn_off" }, 90, now),
          pending(
            {
              entity_id: "climate.office",
              service: "climate.set_temperature",
              data: { temperature: 17 },
            },
            150,
            now
          ),
          pending({ service: "script.holiday_lights", name: "Holiday lights" }, 60 * 13, now),
        ].toSorted(byDueTime)
      );
      const hass = fakeHass({
        websocket: later,
        states: DEMO_ENTITIES,
        services: DEMO_SERVICES,
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
 * integration: schedule, edit and cancel all work, nothing leaves the page.
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
