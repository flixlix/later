import ca from "./translations/ca.json";
import cs from "./translations/cs.json";
import da from "./translations/da.json";
import de from "./translations/de.json";
import en from "./translations/en.json";
import es from "./translations/es.json";
import fi from "./translations/fi.json";
import fr from "./translations/fr.json";
import hi from "./translations/hi.json";
import it from "./translations/it.json";
import nl from "./translations/nl.json";
import pl from "./translations/pl.json";
import ptBR from "./translations/pt-BR.json";
import pt from "./translations/pt.json";
import ru from "./translations/ru.json";
import sk from "./translations/sk.json";
import sv from "./translations/sv.json";
import uk from "./translations/uk.json";

/** Keyed by Home Assistant's language codes, the ones `hass.locale.language` reports. */
export const TRANSLATIONS: Readonly<Record<string, unknown>> = {
  ca,
  cs,
  da,
  de,
  en,
  es,
  fi,
  fr,
  hi,
  it,
  nl,
  pl,
  "pt-BR": ptBR,
  pt,
  ru,
  sk,
  sv,
  uk,
};

/** `card.edit_named` with `{ name: "Heater off" }` gives `Edit Heater off`. */
export type Localize = (key: string, values?: Record<string, string | number>) => string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const lookup = (translation: unknown, key: string): string | undefined => {
  let node = translation;
  for (const part of key.split(".")) {
    node = isRecord(node) ? node[part] : undefined;
  }
  return typeof node === "string" && node !== "" ? node : undefined;
};

/**
 * Translates into `language` (`pt-BR`, `de-CH`, `de`): the exact language, else its base
 * language, else English, else the key itself.
 */
export function localizer(language: string): Localize {
  const candidates = [language, language.split("-")[0] ?? language, "en"].map(
    (code) => TRANSLATIONS[code]
  );
  return (key, values = {}) => {
    const text = candidates.reduce<string | undefined>(
      (found, translation) => found ?? lookup(translation, key),
      undefined
    );
    return (text ?? key).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder
    );
  };
}
