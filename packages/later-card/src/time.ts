/** How the dashboard shows times: Home Assistant's time zone (or the browser's) and language. */
export type Clock = { timeZone: string; language: string; hour12?: boolean };

const MINUTE = 60_000;

/** `in 25 min`, `in 1 h 5 min`, `in 3 d`; `now` once due. */
export function relativeLabel(runAt: Date, now: Date): string {
  const minutes = Math.ceil((runAt.getTime() - now.getTime()) / MINUTE);
  if (minutes <= 0) {
    return "now";
  }
  if (minutes < 60) {
    return `in ${minutes} min`;
  }
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
  }
  return `in ${Math.round(minutes / (24 * 60))} d`;
}

const dayKey = (moment: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);

const timeOfDay = (moment: Date, clock: Clock): string =>
  new Intl.DateTimeFormat(clock.language, {
    timeZone: clock.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: clock.hour12,
  }).format(moment);

/** `20:00` today, `tomorrow 07:00`, otherwise `Wed, 24 Dec 07:00`. */
export function clockLabel(runAt: Date, now: Date, clock: Clock): string {
  const day = dayKey(runAt, clock.timeZone);
  if (day === dayKey(now, clock.timeZone)) {
    return timeOfDay(runAt, clock);
  }
  if (day === dayKey(new Date(now.getTime() + 24 * 60 * MINUTE), clock.timeZone)) {
    return `tomorrow ${timeOfDay(runAt, clock)}`;
  }
  const date = new Intl.DateTimeFormat(clock.language, {
    timeZone: clock.timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(runAt);
  return `${date} ${timeOfDay(runAt, clock)}`;
}

/** Minutes since midnight of `HH:MM[:SS]`, or undefined for anything else. */
export function minutesOfDay(time: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

const nowMinutesOfDay = (now: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines format midnight as 24:00.
  return (part("hour") % 24) * 60 + part("minute");
};

/** Whether a clock time picked now means today or tomorrow, as the integration decides. */
export function clockTimeDay(time: string, now: Date, timeZone: string): "today" | "tomorrow" {
  const picked = minutesOfDay(time) ?? 0;
  return picked > nowMinutesOfDay(now, timeZone) ? "today" : "tomorrow";
}

/** The next full hour as `HH:00`, a default for the clock time. */
export function nextFullHour(now: Date, timeZone: string): string {
  const hour = (Math.floor(nowMinutesOfDay(now, timeZone) / 60) + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00`;
}
