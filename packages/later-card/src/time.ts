import { type Localize } from "./localize";

/** How the dashboard shows times: Home Assistant's time zone, and the user's language and hour cycle. */
export type Clock = { timeZone: string; language: string; hour12?: boolean };

const MINUTE = 60_000;

const unit = (value: number, name: "minute" | "hour" | "day", language: string): string =>
  new Intl.NumberFormat(language, { style: "unit", unit: name, unitDisplay: "short" }).format(
    value
  );

/** `25 min`, `1 hr 5 min`, `3 days` in `language`. */
export function durationLabel(minutes: number, language: string): string {
  if (minutes < 60) {
    return unit(minutes, "minute", language);
  }
  if (minutes < 24 * 60) {
    const hours = unit(Math.floor(minutes / 60), "hour", language);
    const rest = minutes % 60;
    return rest === 0 ? hours : `${hours} ${unit(rest, "minute", language)}`;
  }
  return unit(Math.round(minutes / (24 * 60)), "day", language);
}

/** `today`, `tomorrow` (offset 0 and 1) in `language`. */
export const dayWord = (offset: 0 | 1, language: string): string =>
  new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(offset, "day");

/** `in 25 min`, `in 1 hr 5 min`, `in 3 days`; `now` once due. */
export function relativeLabel(
  runAt: Date,
  now: Date,
  language: string,
  localize: Localize
): string {
  const minutes = Math.ceil((runAt.getTime() - now.getTime()) / MINUTE);
  if (minutes <= 0) {
    return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(0, "second");
  }
  return localize("time.in", { duration: durationLabel(minutes, language) });
}

/** `2026-11-21`: the day `moment` falls on in `timeZone`. */
export const dayKey = (moment: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);

const usesHour12 = (clock: Clock): boolean =>
  clock.hour12 ??
  new Intl.DateTimeFormat(clock.language, { hour: "numeric" }).resolvedOptions().hour12 === true;

/** `20:00` on a 24-hour clock, `8:00 PM` on a 12-hour one. */
const timeOfDay = (moment: Date, clock: Clock): string => {
  const hour12 = usesHour12(clock);
  return new Intl.DateTimeFormat(clock.language, {
    timeZone: clock.timeZone,
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12,
  }).format(moment);
};

/** `20:00` today, `tomorrow 07:00`, otherwise `Wed, 24 Dec 07:00`. */
export function clockLabel(runAt: Date, now: Date, clock: Clock): string {
  const day = dayKey(runAt, clock.timeZone);
  if (day === dayKey(now, clock.timeZone)) {
    return timeOfDay(runAt, clock);
  }
  if (day === dayKey(new Date(now.getTime() + 24 * 60 * MINUTE), clock.timeZone)) {
    return `${dayWord(1, clock.language)} ${timeOfDay(runAt, clock)}`;
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

/** What a wall clock in `timeZone` reads at `moment`, as if that reading were UTC. */
const wallClockAsUtc = (moment: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(moment);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines format midnight as 24:00.
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour") % 24, part("minute"));
};

/**
 * The moment a wall clock in `timeZone` reads `date` (`2026-11-21`) and `time` (`HH:MM`), or
 * undefined if either does not parse. A time skipped by a daylight saving change lands an hour
 * later.
 */
export function zonedMoment(date: string, time: string, timeZone: string): Date | undefined {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const minutes = minutesOfDay(time);
  if (!day || minutes === undefined) {
    return undefined;
  }
  const wanted = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])) + minutes * MINUTE;
  // Guess with the offset at `wanted`, then correct once with the offset at the guess.
  const firstGuess = wanted - (wallClockAsUtc(new Date(wanted), timeZone) - wanted);
  return new Date(wanted - (wallClockAsUtc(new Date(firstGuess), timeZone) - firstGuess));
}

/** The next full hour in `timeZone`: the default date and time for a schedule. */
export function nextFullHour(now: Date, timeZone: string): { date: string; time: string } {
  const hour = (Math.floor(wallClockAsUtc(now, timeZone) / (60 * MINUTE)) + 1) % 24;
  return {
    date: dayKey(new Date(now.getTime() + 60 * MINUTE), timeZone),
    time: `${String(hour).padStart(2, "0")}:00`,
  };
}

/** `HH:MM` of `moment` in `timeZone`, as a time field holds it. */
export function clockTime(moment: Date, timeZone: string): string {
  const minutes = Math.floor(wallClockAsUtc(moment, timeZone) / MINUTE) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Whether a due time picked to the minute is already past; the current minute is not. */
export const hasPassed = (moment: Date, now: Date): boolean =>
  moment.getTime() < now.getTime() - (now.getTime() % MINUTE);

/** Milliseconds until the next minute starts. */
export const msToNextMinute = (now: Date): number => MINUTE - (now.getTime() % MINUTE);
