import { describe, expect, test } from "vite-plus/test";
import {
  clockLabel,
  clockTime,
  minutesOfDay,
  nextFullHour,
  relativeLabel,
  hasPassed,
  zonedMoment,
} from "./time";
import { localizer } from "./localize";

const NOW = new Date("2026-11-21T18:00:00Z"); // 19:00 in Berlin
const berlin = { timeZone: "Europe/Berlin", language: "en-GB", hour12: false };
const at = (iso: string) => new Date(iso);

describe("relativeLabel", () => {
  test.each([
    ["2026-11-21T18:00:30Z", "in 1 min"],
    ["2026-11-21T18:25:00Z", "in 25 min"],
    ["2026-11-21T19:00:00Z", "in 1 hr"],
    ["2026-11-21T19:05:00Z", "in 1 hr 5 min"],
    ["2026-11-24T18:00:00Z", "in 3 days"],
    ["2026-11-21T17:59:00Z", "now"],
  ])("%s is %s", (runAt, label) => {
    expect(relativeLabel(at(runAt), NOW, "en", localizer("en"))).toBe(label);
  });

  test("speaks the user's language", () => {
    expect(relativeLabel(at("2026-11-21T19:05:00Z"), NOW, "de", localizer("de"))).toBe(
      "in 1 Std. 5 Min."
    );
    expect(relativeLabel(at("2026-11-21T17:59:00Z"), NOW, "de", localizer("de"))).toBe("jetzt");
  });
});

describe("clockLabel", () => {
  test("shows today's due times as a clock time in the Home Assistant time zone", () => {
    expect(clockLabel(at("2026-11-21T19:00:00Z"), NOW, berlin)).toBe("20:00");
  });

  test("names tomorrow, in the user's language", () => {
    expect(clockLabel(at("2026-11-22T06:00:00Z"), NOW, berlin)).toBe("tomorrow 07:00");
    expect(clockLabel(at("2026-11-22T06:00:00Z"), NOW, { ...berlin, language: "de" })).toBe(
      "morgen 07:00"
    );
  });

  test("dates anything later", () => {
    expect(clockLabel(at("2026-12-24T17:00:00Z"), NOW, berlin)).toBe("Thu 24 Dec 18:00");
  });

  test("uses a 12-hour clock where the language or the user setting does", () => {
    expect(
      clockLabel(at("2026-11-21T19:00:00Z"), NOW, {
        ...berlin,
        language: "en-US",
        hour12: undefined,
      })
    ).toBe("8:00 PM");
    expect(
      clockLabel(at("2026-11-21T19:00:00Z"), NOW, { ...berlin, language: "en-US", hour12: true })
    ).toBe("8:00 PM");
  });

  test("follows the time zone, not UTC", () => {
    const tokyo = { ...berlin, timeZone: "Asia/Tokyo" };
    // 03:00 on the 22nd in Tokyo, where it is already the 22nd.
    expect(clockLabel(at("2026-11-21T18:00:00Z"), NOW, tokyo)).toBe("03:00");
  });
});

describe("dates and times on Home Assistant's clock", () => {
  test("defaults to the next full hour, tomorrow after 23:00", () => {
    expect(nextFullHour(NOW, "Europe/Berlin")).toEqual({ date: "2026-11-21", time: "20:00" });
    expect(nextFullHour(at("2026-11-21T22:30:00Z"), "Europe/Berlin")).toEqual({
      date: "2026-11-22",
      time: "00:00",
    });
  });

  test("a date and time in a time zone is that moment, across daylight saving changes", () => {
    expect(zonedMoment("2026-11-22", "07:30", "Europe/Berlin")).toEqual(at("2026-11-22T06:30:00Z"));
    expect(zonedMoment("2026-07-01", "07:30", "Europe/Berlin")).toEqual(at("2026-07-01T05:30:00Z"));
    expect(zonedMoment("2026-11-22", "07:30", "America/New_York")).toEqual(
      at("2026-11-22T12:30:00Z")
    );
    // 02:30 does not exist on 29 March in Berlin; it lands an hour later.
    expect(zonedMoment("2026-03-29", "02:30", "Europe/Berlin")).toEqual(at("2026-03-29T01:30:00Z"));
    expect(zonedMoment("tomorrow", "07:30", "Europe/Berlin")).toBeUndefined();
  });

  test("reads a moment back as the time a time field holds", () => {
    expect(clockTime(at("2026-11-22T06:30:00Z"), "Europe/Berlin")).toBe("07:30");
    expect(clockTime(at("2026-11-21T23:05:00Z"), "Europe/Berlin")).toBe("00:05");
  });

  test("a due time in the current minute has not passed yet", () => {
    const now = at("2026-11-21T18:00:40Z");
    expect(hasPassed(at("2026-11-21T18:00:00Z"), now)).toBe(false);
    expect(hasPassed(at("2026-11-21T17:59:00Z"), now)).toBe(true);
  });

  test("parses HH:MM and rejects anything else", () => {
    expect(minutesOfDay("07:30")).toBe(450);
    expect(minutesOfDay("25:00")).toBeUndefined();
    expect(minutesOfDay("noon")).toBeUndefined();
  });
});
