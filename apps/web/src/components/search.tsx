import { useRouter } from "@tanstack/react-router";
import {
  CornerDownLeft,
  FileText,
  Hash,
  ListTree,
  Monitor,
  Moon,
  Search as SearchIcon,
  Sun,
} from "lucide-react";
import {
  type ComponentType,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { ADD_FIELDS, CARD_OPTIONS, ID_FIELD, PAGES } from "../lib/site";
import { setThemeMode } from "../lib/theme";
import { Scrim, optionAnchor, cx } from "./docs";

type Result = {
  title: string;
  description: string;
  kind: "Page" | "Section" | "Option" | "Command";
  icon: ComponentType<{ className?: string }>;
  run: { to: string; hash?: string } | (() => void);
};

const optionResults = (options: typeof CARD_OPTIONS, where: string) =>
  options.map((option): Result => ({
    title: option.name,
    description: `${where} · ${option.description.replaceAll("`", "")}`,
    kind: "Option",
    icon: ListTree,
    run: { to: "/configuration", hash: optionAnchor(option.name) },
  }));

/** Every page, section and option, and the theme commands. */
const INDEX: Result[] = [
  ...PAGES.map((page): Result => ({
    title: page.label,
    description: page.description,
    kind: "Page",
    icon: FileText,
    run: { to: page.path },
  })),
  ...PAGES.flatMap((page) =>
    page.headings.map((heading): Result => ({
      title: heading.label,
      description: page.label,
      kind: "Section",
      icon: Hash,
      run: { to: page.path, hash: heading.id },
    }))
  ),
  ...optionResults(CARD_OPTIONS, "Card option"),
  ...optionResults(ADD_FIELDS, "later.add field"),
  ...optionResults(ID_FIELD, "later.cancel and later.run_now field"),
  {
    title: "Light theme",
    description: "Switch the docs to light",
    kind: "Command",
    icon: Sun,
    run: () => setThemeMode("light"),
  },
  {
    title: "Dark theme",
    description: "Switch the docs to dark",
    kind: "Command",
    icon: Moon,
    run: () => setThemeMode("dark"),
  },
  {
    title: "System theme",
    description: "Follow your system's appearance",
    kind: "Command",
    icon: Monitor,
    run: () => setThemeMode("auto"),
  },
];

/** Results holding every word of the query, titles that start with it first. */
export function search(query: string): Result[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return INDEX.filter((result) => result.kind === "Page" || result.kind === "Command");
  }
  const [first = ""] = words;
  const score = (result: Result) => {
    const title = result.title.toLowerCase();
    return title.startsWith(first) ? 0 : title.includes(first) ? 1 : 2;
  };
  return INDEX.filter((result) => {
    const haystack = `${result.title} ${result.description}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  }).toSorted((a, b) => score(a) - score(b));
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

export function Search({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mac = useSyncExternalStore(
    () => () => {},
    isMac,
    () => true
  );

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "border-input bg-background hover:bg-accent/40 text-muted-foreground inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm shadow-xs transition-colors",
          className
        )}
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search docs…</span>
        <kbd className="border-input bg-muted hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
          {mac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
      {open ? createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => search(query), [query]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(result: Result) {
    if (typeof result.run === "function") {
      result.run();
    } else {
      void router.navigate(result.run);
    }
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActive((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActive((index) => (index - 1 + count) % count);
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      choose(results[active]);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Search documentation"
      onClose={onClose}
      className="text-foreground m-0 size-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-transparent"
    >
      <Scrim label="Close search" onClose={onClose} />
      <div className="bg-popover relative mx-auto mt-[12vh] flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" />
          <input
            autoFocus
            type="search"
            placeholder="Search pages, options, services…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            aria-controls="search-results"
            className="placeholder:text-muted-foreground flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground border-input rounded border px-1.5 py-0.5 font-mono text-[10px]"
          >
            esc
          </button>
        </div>
        <ul
          ref={list}
          id="search-results"
          aria-live="polite"
          className="flex-1 overflow-y-auto p-1"
        >
          {results.length === 0 ? (
            <li className="text-muted-foreground px-6 py-10 text-center text-sm">
              No results for “{query}”.
            </li>
          ) : (
            results.map((result, index) => (
              <li key={`${result.kind}-${result.title}-${result.description}`}>
                <button
                  type="button"
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => choose(result)}
                  className={cx(
                    "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm",
                    index === active && "bg-accent"
                  )}
                >
                  <result.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{result.title}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">{result.kind}</span>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {result.description}
                    </div>
                  </div>
                  {index === active ? (
                    <CornerDownLeft className="text-muted-foreground mt-1 size-3.5 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </dialog>
  );
}
