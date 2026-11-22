import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Check } from "lucide-react";

import { DocsPage } from "../components/docs-page";
import {
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  CodeBlock,
  HomeAssistantIcon,
  PageLinks,
  Prose,
  Section,
} from "../components/docs";
import { LiveCard } from "../components/live-card";
import { pageHead } from "../lib/head";
import { HACS_LINK, PAGE, PAGES } from "../lib/site";

const page = PAGE.overview;

export const Route = createFileRoute("/")({ head: () => pageHead(page), component: Home });

const HIGHLIGHTS = [
  "Turn on, turn off or toggle, or call any service with its data",
  "In 15, 30 or 60 minutes, any number of minutes, or any date and time",
  "Survives restarts; missed schedules run once, late, after startup",
  "Click a schedule to edit it, ✕ to cancel it",
  "later.add, later.cancel and later.run_now for automations",
  "No entity per schedule, nothing left behind after a run",
  "UI editor, and the card ships inside the integration",
  "Translated into 18 languages",
];

const FAQ = [
  {
    question: "How is this different from an automation?",
    answer:
      "An automation repeats: it waits for its trigger forever. A schedule runs once and is gone. You don't write YAML, give it a trigger or remember to delete it afterwards.",
  },
  {
    question: "Why not a timer helper?",
    answer:
      "A timer needs a helper per device and an automation that acts when it finishes. A schedule is the action and its due time in one, created from the dashboard in two taps.",
  },
  {
    question: "What happens if Home Assistant is down at the due time?",
    answer:
      "The schedule runs once, 10 seconds after Home Assistant starts again, and the logbook marks it as late. “Turn off the heater at 20:00” still turns it off at 20:30.",
  },
  {
    question: "Does it repeat?",
    answer:
      "No. Later has no repeat and no pause by design; that is what automations and the schedule helper are for.",
  },
];

function Home() {
  return (
    <DocsPage page={page} toc={false}>
      <div className="mb-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-8">
          <header>
            <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-[3.25rem]">
              Do it later. <span className="text-solar-ink">Once.</span>
            </h1>
            <p className="text-foreground/75 mt-4 max-w-[52ch] text-[17px] leading-relaxed text-pretty">
              “Turn off the heater at 20:00”, “turn this off in 30 minutes”. Later runs a Home
              Assistant action once, at a time or in a few minutes, then deletes the schedule.
            </p>
          </header>
          <div className="flex flex-wrap gap-2">
            <a
              href={HACS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={BUTTON_PRIMARY}
            >
              <HomeAssistantIcon /> Install in Home Assistant
            </a>
            <Link to="/installation" className={BUTTON_OUTLINE}>
              <BookOpen /> Read the guide
            </Link>
          </div>
          <ul className="text-muted-foreground -mt-4 flex flex-wrap gap-x-2 text-xs">
            {["HACS custom repository", "Home Assistant 2025.12+", "UI & YAML", "18 languages"].map(
              (tag, index) => (
                <li key={tag} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden>·</span> : null}
                  {tag}
                </li>
              )
            )}
          </ul>
        </div>
        <LiveCard
          config={{ type: "custom:later-card", entity: "switch.heater" }}
          className="mx-auto lg:mx-0"
        />
      </div>

      <Section
        id="try-it"
        title="Try it"
        description="The card above is the real one, against an in-memory Later and a dozen dummy devices: press + to schedule something, click a schedule to edit it, ✕ to cancel it. Nothing leaves this page."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">On a dashboard</p>
            <CodeBlock code="type: custom:later-card" />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">From an automation or Developer tools</p>
            <CodeBlock
              code={`
action: later.add
data:
  entity_id: switch.heater
  action: turn_off
  at: "20:00"
`}
            />
          </div>
        </div>
      </Section>

      <Section id="highlights" title="Highlights">
        <ul className="text-foreground/85 grid max-w-3xl grid-cols-1 gap-x-8 gap-y-1 text-[15px] md:grid-cols-2">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2.5 py-1">
              <Check aria-hidden className="text-solar-ink mt-0.5 size-4 shrink-0" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how-it-behaves" title="How it behaves">
        <Prose>
          <ul>
            <li>
              <strong>Clock times</strong> are in the Home Assistant time zone. A time that has
              already passed today means tomorrow.
            </li>
            <li>
              <strong>“In 30 minutes”</strong> is turned into a fixed due time when you create the
              schedule, so a restart does not move it.
            </li>
            <li>
              <strong>Restarts</strong>: pending schedules are stored and run at their original
              time.
            </li>
            <li>
              <strong>Missed schedules</strong> (due while Home Assistant was down) run once, 10
              seconds after startup, and are logged as late.
            </li>
            <li>
              <strong>Failures</strong> (missing entity or service, an error from the service) are
              logged with the schedule id, target and service. The schedule is deleted anyway and
              not retried.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section id="faq" title="Common questions">
        <div className="bg-card max-w-3xl divide-y overflow-hidden rounded-xl border">
          {FAQ.map((item) => (
            <details key={item.question} className="group px-4 py-3.5">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-4">
                  {item.question}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="text-foreground/80 mt-2 text-[15px] leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="docs" title="What's in the docs">
        <PageLinks
          links={PAGES.slice(1).map((docs) => ({
            to: docs.path,
            title: docs.label,
            description: docs.description,
          }))}
        />
      </Section>
    </DocsPage>
  );
}
