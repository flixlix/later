import { describe, expect, test } from "vite-plus/test";
import { localizer, TRANSLATIONS } from "./localize";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function allKeys(node: unknown, prefix = ""): string[] {
  const keys: string[] = [];
  if (isRecord(node)) {
    for (const [key, value] of Object.entries(node)) {
      keys.push(`${prefix}${key}`, ...allKeys(value, `${prefix}${key}.`));
    }
  }
  return keys;
}

/** The placeholders (`{name}`) of every string, by key. */
function placeholders(node: unknown, prefix = ""): Record<string, Set<string>> {
  const found: Record<string, Set<string>> = {};
  if (!isRecord(node)) {
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      found[`${prefix}${key}`] = new Set(value.match(/\{\w+\}/g));
    } else {
      Object.assign(found, placeholders(value, `${prefix}${key}.`));
    }
  }
  return found;
}

describe("language files", () => {
  const english = TRANSLATIONS.en;
  const others = Object.keys(TRANSLATIONS).filter((code) => code !== "en");

  test("cover the languages of power-flow-card-plus", () => {
    expect(others).toEqual([
      "ca",
      "cs",
      "da",
      "de",
      "es",
      "fi",
      "fr",
      "hi",
      "it",
      "nl",
      "pl",
      "pt-BR",
      "pt",
      "ru",
      "sk",
      "sv",
      "uk",
    ]);
  });

  test.each(others)("%s has the same keys as en.json", (code) => {
    expect(allKeys(TRANSLATIONS[code])).toEqual(allKeys(english));
  });

  test.each(others)("%s keeps every placeholder of en.json", (code) => {
    expect(placeholders(TRANSLATIONS[code])).toEqual(placeholders(english));
  });
});

describe("localizer", () => {
  test("translates into the user's language and fills in placeholders", () => {
    expect(localizer("de")("card.edit_named", { name: "Heizung aus" })).toBe(
      "Heizung aus bearbeiten"
    );
  });

  test("prefers the exact regional language, then the base language", () => {
    expect(localizer("pt-BR")("card.loading")).toBe("Carregando…");
    expect(localizer("pt")("card.loading")).toBe("A carregar…");
    expect(localizer("de-CH")("form.save")).toBe("Speichern");
  });

  test("falls back to English, then to the key", () => {
    expect(localizer("tlh")("form.save")).toBe("Save");
    expect(localizer("de")("form.no_such_key")).toBe("form.no_such_key");
  });
});
