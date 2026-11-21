import { describe, expect, test } from "vite-plus/test";
import { clockLabel, clockTimeDay, minutesOfDay, nextFullHour, relativeLabel } from "./time";

const NOW = new Date("2026-11-21T18:00:00Z"); // 19:00 in Berlin
const berlin = { timeZone: "Europe/Berlin", language: "en-GB", hour12: false };
const at = (iso: string) => new Date(iso);

describe("relativeLabel", () => {
  test.each([
    ["2026-11-21T18:00:30Z", "in 1 min"],
    ["2026-11-21T18:25:00Z", "in 25 min"],
    ["2026-11-21T19:00:00Z", "in 1 h"],
    ["2026-11-21T19:05:00Z", "in 1 h 5 min"],
    ["2026-11-24T18:00:00Z", "in 3 d"],
    ["2026-11-21T17:59:00Z", "now"],
  ])("%s is %s", (runAt, label) => {
    expect(relativeLabel(at(runAt), NOW)).toBe(label);
  });
});

describe("clockLabel", () => {
  test("shows today's due times as a clock time in the Home Assistant time zone", () => {
    expect(clockLabel(at("2026-11-21T19:00:00Z"), NOW, berlin)).toBe("20:00");
  });

  test("names tomorrow", () => {
    expect(clockLabel(at("2026-11-22T06:00:00Z"), NOW, berlin)).toBe("tomorrow 07:00");
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

describe("clock times", () => {
  test("a clock time still ahead today is today, otherwise tomorrow", () => {
    expect(clockTimeDay("20:00", NOW, "Europe/Berlin")).toBe("today");
    expect(clockTimeDay("19:00", NOW, "Europe/Berlin")).toBe("tomorrow");
    expect(clockTimeDay("18:30:00", NOW, "Europe/Berlin")).toBe("tomorrow");
  });

  test("defaults to the next full hour", () => {
    expect(nextFullHour(NOW, "Europe/Berlin")).toBe("20:00");
    expect(nextFullHour(at("2026-11-21T22:30:00Z"), "Europe/Berlin")).toBe("00:00");
  });

  test("parses HH:MM and rejects anything else", () => {
    expect(minutesOfDay("07:30")).toBe(450);
    expect(minutesOfDay("25:00")).toBeUndefined();
    expect(minutesOfDay("noon")).toBeUndefined();
  });
});
