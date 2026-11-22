import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "later:theme-change";

/** Runs before the first paint, so a dark page never flashes light. Mirrors `applyThemeMode`. */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${STORAGE_KEY}');if(m!=='light'&&m!=='dark')m='auto';var d=m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)");

function readMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function applyThemeMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "auto" && prefersDark().matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function setThemeMode(mode: ThemeMode) {
  applyThemeMode(mode);
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ponytail: private windows can't store it; the choice then lasts until reload.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onSystemChange = () => {
    if (readMode() === "auto") {
      applyThemeMode("auto");
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  prefersDark().addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    prefersDark().removeEventListener("change", onSystemChange);
  };
}

/** The chosen mode; `null` while server rendering. */
export const useThemeMode = () =>
  useSyncExternalStore<ThemeMode | null>(subscribe, readMode, () => null);

/** What the page shows now: light or dark. */
export const useScheme = () =>
  useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light" as const
  );
