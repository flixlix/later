import { Link } from "@tanstack/react-router";
import {
  Bug,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import { Children, type ComponentType, type ReactNode, useState } from "react";

import { type Option, PAGES, newIssueUrl } from "../lib/site";

export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export const BUTTON =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-[background-color,transform] active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0";
export const BUTTON_PRIMARY = `${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
export const BUTTON_OUTLINE = `${BUTTON} border bg-card hover:bg-accent`;

/** Text with `backticks` as inline code. */
export function Rich({ text }: { text: string }) {
  return Children.toArray(
    text.split("`").map((part, index) => (index % 2 === 1 ? <code>{part}</code> : part))
  );
}

/** Fills a modal `<dialog>` behind its content; clicking it closes the dialog. */
export function Scrim({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClose}
      className="bg-background/70 fixed inset-0 cursor-default backdrop-blur-sm"
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header className="mb-10">
      {eyebrow ? <p className="text-muted-foreground mb-2 text-sm font-medium">{eyebrow}</p> : null}
      <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance md:text-[2.75rem]">
        {title}
      </h1>
      {description ? (
        <p className="text-foreground/75 mt-4 max-w-[62ch] text-[17px] leading-relaxed text-pretty">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function Section({
  id,
  title,
  description,
  level = 2,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section id={id} className={cx("scroll-mt-20", level === 2 ? "mb-12" : "mt-8 mb-8")}>
      <Heading
        className={cx(
          "mb-2 font-semibold",
          level === 2 ? "text-[1.375rem] tracking-[-0.02em]" : "font-mono text-base"
        )}
      >
        <a href={`#${id}`} className="group">
          {title}
          <span
            aria-hidden
            className="text-muted-foreground ml-1.5 text-base opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            #
          </span>
        </a>
      </Heading>
      {description ? (
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">{description}</p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const PROSE = [
  "text-foreground/85 max-w-[68ch] text-[15px] leading-relaxed",
  "[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:pl-1",
  "[&_a]:text-foreground [&_a]:decoration-solar [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px]",
  "[&_strong]:text-foreground [&_strong]:font-semibold",
].join(" ");

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(PROSE, className)}>{children}</div>;
}

export function CodeBlock({ code, label = "yaml" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const text = code.trim();

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-sm dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 py-1.5 pr-1.5 pl-3.5 font-mono text-[11px] font-medium text-stone-400">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy code"}
          className="inline-flex h-6 items-center rounded px-2 text-stone-400 transition-colors hover:bg-white/10 hover:text-stone-100"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-stone-200">
        <code>{text}</code>
      </pre>
    </div>
  );
}

const CALLOUTS: Record<
  "info" | "warning" | "tip",
  { classes: string; icon: ComponentType<{ className?: string }>; title: string }
> = {
  info: { classes: "bg-sky-400/10 text-sky-700 dark:text-sky-300", icon: Info, title: "Note" },
  warning: {
    classes: "bg-amber-400/10 text-amber-700 dark:text-amber-300",
    icon: TriangleAlert,
    title: "Warning",
  },
  tip: {
    classes: "bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
    icon: Lightbulb,
    title: "Tip",
  },
};

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: keyof typeof CALLOUTS;
  title?: string;
  children: ReactNode;
}) {
  const style = CALLOUTS[variant];
  return (
    <div className={cx("my-4 flex max-w-[68ch] gap-3 rounded-lg p-3.5 text-sm", style.classes)}>
      <style.icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="mb-1 font-semibold">{title ?? style.title}</div>
        <div className="text-foreground/90 [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]">
          {children}
        </div>
      </div>
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  string: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  number: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  boolean: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  object: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export const optionAnchor = (name: string) => `option-${name}`;

/** Each option on its own row with a link anchor, its type, its default and what it does. */
export function OptionList({ options }: { options: Option[] }) {
  return (
    <div className="bg-card divide-y overflow-hidden rounded-xl border">
      {options.map((option) => (
        <div
          key={option.name}
          id={optionAnchor(option.name)}
          className="hover:bg-accent/40 scroll-mt-20 px-4 py-3.5 transition-colors"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <a href={`#${optionAnchor(option.name)}`} className="font-mono text-sm font-semibold">
              {option.name}
              {option.required ? <span className="text-destructive ml-0.5">*</span> : null}
            </a>
            <span
              className={cx(
                "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium",
                TYPE_TONE[option.type] ?? "bg-muted text-muted-foreground"
              )}
            >
              {option.type}
            </span>
            {option.default ? (
              <span className="text-muted-foreground text-[11px]">
                default{" "}
                <code className="bg-muted text-foreground/80 rounded px-1 py-0.5 font-mono text-[11px]">
                  {option.default}
                </code>
              </span>
            ) : null}
            {option.required ? (
              <span className="text-destructive ml-auto text-xs font-medium">Required</span>
            ) : null}
          </div>
          <p className="text-foreground/80 [&_code]:bg-muted mt-1.5 text-[13px] leading-relaxed [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]">
            <Rich text={option.description} />
          </p>
        </div>
      ))}
    </div>
  );
}

/** Rows of links to other pages. */
export function PageLinks({
  links,
}: {
  links: { to: string; title: string; description: string }[];
}) {
  return (
    <ul className="bg-card max-w-3xl divide-y overflow-hidden rounded-xl border">
      {links.map((link) => (
        <li key={link.to}>
          <Link
            to={link.to}
            className="hover:bg-accent/60 group flex items-center gap-4 px-4 py-3.5 transition-colors"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{link.title}</span>
              <span className="text-muted-foreground block text-sm">{link.description}</span>
            </span>
            <ChevronRight
              aria-hidden
              className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 ease-(--ease-out-strong) group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Previous and next page, in the order of `PAGES`. */
export function NextPageNav({ path }: { path: string }) {
  const index = PAGES.findIndex((page) => page.path === path);
  const prev = PAGES[index - 1];
  const next = PAGES[index + 1];
  const linkClass =
    "group hover:bg-accent/60 flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors";
  return (
    <nav aria-label="Pages" className="mt-16 grid grid-cols-2 gap-3 border-t pt-8 text-sm">
      {prev ? (
        <Link to={prev.path} className={linkClass}>
          <ChevronLeft aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <span>
            <span className="text-muted-foreground block text-xs">Previous</span>
            <span className="mt-0.5 block font-medium">{prev.label}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.path} className={cx(linkClass, "justify-end text-right")}>
          <span>
            <span className="text-muted-foreground block text-xs">Next</span>
            <span className="mt-0.5 block font-medium">{next.label}</span>
          </span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function SupportLinks() {
  return (
    <aside
      aria-label="Support"
      className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3.5"
    >
      <div className="text-sm">
        <p className="font-medium">Something broken or missing?</p>
        <p className="text-muted-foreground">Open an issue on GitHub.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={newIssueUrl("bug-report.yaml")}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(BUTTON_OUTLINE, "h-8 px-3")}
        >
          <Bug aria-hidden /> Report a bug
        </a>
        <a
          href={newIssueUrl("feature-request.yaml")}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(BUTTON_OUTLINE, "h-8 px-3")}
        >
          <Lightbulb aria-hidden /> Request a feature
        </a>
      </div>
    </aside>
  );
}

/** Lucide dropped brand icons; this is GitHub's mark. */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.9 18 5.2 18 5.2c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

export function HomeAssistantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="#18BCF2" className={className}>
      <path d="M22.939 10.627 13.061.749a1.505 1.505 0 0 0-2.121 0l-9.879 9.878C.478 11.21 0 12.363 0 13.187v9c0 .826.675 1.5 1.5 1.5h9.227l-4.063-4.062a2.034 2.034 0 0 1-.664.113c-1.13 0-2.05-.92-2.05-2.05s.92-2.05 2.05-2.05 2.05.92 2.05 2.05c0 .233-.041.456-.113.665l3.163 3.163V9.928a2.05 2.05 0 0 1-1.15-1.84c0-1.13.92-2.05 2.05-2.05s2.05.92 2.05 2.05a2.05 2.05 0 0 1-1.15 1.84v8.127l3.146-3.146A2.051 2.051 0 0 1 18 12.239c1.13 0 2.05.92 2.05 2.05s-.92 2.05-2.05 2.05a2.03 2.03 0 0 1-.709-.13L12.9 20.602v3.088h9.6c.825 0 1.5-.675 1.5-1.5v-9c0-.825-.477-1.977-1.061-2.561z" />
    </svg>
  );
}
