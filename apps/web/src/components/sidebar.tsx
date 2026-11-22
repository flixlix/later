import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  Coffee,
  Download,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
  Wand2,
} from "lucide-react";
import { type ComponentType } from "react";

import { type DocsPage, PAGES, REPO_URL } from "../lib/site";
import { type ThemeMode, setThemeMode, useThemeMode } from "../lib/theme";
import { GithubIcon, cx } from "./docs";

const ICONS: Record<DocsPage["path"], ComponentType<{ className?: string }>> = {
  "/": BookOpen,
  "/installation": Download,
  "/configuration": SlidersHorizontal,
  "/examples": Wand2,
};

const ITEM =
  "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors [&>svg]:size-4 [&>svg]:shrink-0";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md p-1">
      <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
      <span className="grid leading-tight">
        <span className="font-semibold tracking-[-0.01em]">Later</span>
        <span className="text-muted-foreground text-xs">One-off actions for Home Assistant</span>
      </span>
    </Link>
  );
}

/** The site's navigation: on wide screens beside the page, on phones in a drawer. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <Logo />
      </div>
      <nav aria-label="Docs" className="flex-1 overflow-y-auto p-2">
        <p className="text-muted-foreground px-2 pb-1 text-xs font-medium">Docs</p>
        <ul className="space-y-0.5">
          {PAGES.map((page) => {
            const Icon = ICONS[page.path];
            const active = pathname === page.path;
            return (
              <li key={page.path}>
                <Link
                  to={page.path}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    ITEM,
                    active
                      ? "bg-accent text-foreground font-medium"
                      : "text-foreground/80 hover:bg-accent/60 [&>svg]:text-muted-foreground"
                  )}
                >
                  <Icon />
                  {page.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground px-2 pt-5 pb-1 text-xs font-medium">Project</p>
        <ul className="space-y-0.5">
          <li>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(
                ITEM,
                "text-foreground/80 hover:bg-accent/60 [&>svg]:text-muted-foreground"
              )}
            >
              <GithubIcon />
              <span className="flex-1">Source on GitHub</span>
              <ArrowUpRight aria-label="opens in a new tab" className="size-3.5!" />
            </a>
          </li>
          <li>
            <a
              href="https://cards.flixlix.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cx(
                ITEM,
                "text-foreground/80 hover:bg-accent/60 [&>svg]:text-muted-foreground"
              )}
            >
              <BookOpen />
              <span className="flex-1">flixlix-cards</span>
              <ArrowUpRight aria-label="opens in a new tab" className="size-3.5!" />
            </a>
          </li>
        </ul>
      </nav>
      <div className="flex items-center justify-between gap-2 border-t p-2">
        <a
          href="https://ko-fi.com/flixlix"
          target="_blank"
          rel="noopener noreferrer"
          className={cx(ITEM, "text-muted-foreground hover:text-foreground hover:bg-accent/60")}
        >
          <Coffee className="text-solar-ink" />
          Buy me a coffee
        </a>
        <ThemeToggle />
      </div>
    </div>
  );
}

const MODES: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "auto", label: "System", Icon: Monitor },
];

function ThemeToggle() {
  const current = useThemeMode();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-background inline-flex items-center gap-0.5 rounded-full border p-1"
    >
      {MODES.map(({ mode, label, Icon }) => (
        <label
          key={mode}
          title={label}
          className={cx(
            "has-focus-visible:ring-ring/50 size-6 cursor-pointer rounded-full p-1.5 transition-colors has-focus-visible:ring-3",
            current === mode
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <input
            type="radio"
            name="theme"
            aria-label={label}
            checked={current === mode}
            onChange={() => setThemeMode(mode)}
            className="sr-only"
          />
          <Icon className="size-full" />
        </label>
      ))}
    </div>
  );
}
