import { createFileRoute } from "@tanstack/react-router";

import { DocsPage } from "../components/docs-page";
import { CodeBlock, OptionList, PageHeader, Prose, Section } from "../components/docs";
import { LiveCard } from "../components/live-card";
import { pageHead } from "../lib/head";
import { ADD_FIELDS, CARD_OPTIONS, ID_FIELD, PAGE } from "../lib/site";

const page = PAGE.configuration;

export const Route = createFileRoute("/configuration")({
  head: () => pageHead(page),
  component: Configuration,
});

const LANGUAGES =
  "Catalan, Czech, Danish, Dutch, English, Finnish, French, German, Hindi, Italian, Polish, Portuguese (Portugal and Brazil), Russian, Slovak, Spanish, Swedish and Ukrainian";

function Configuration() {
  return (
    <DocsPage page={page}>
      <PageHeader
        eyebrow="Reference"
        title="Configuration"
        description={
          <>
            Every card option and service field, what it does and its default. Required fields are
            marked with <span className="text-destructive">*</span>.
          </>
        }
      />

      <Section id="card" title="Card" description="Set in the card's UI editor or in YAML.">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-4">
            <OptionList options={CARD_OPTIONS} />
            <CodeBlock
              label="example.yaml"
              code={`
type: custom:later-card
title: Heating
entity: switch.heater
`}
            />
          </div>
          <LiveCard
            config={{ type: "custom:later-card", title: "Heating", entity: "switch.heater" }}
            className="mx-auto"
          />
        </div>

        <Section id="using-the-card" title="Using the card" level={3}>
          <Prose>
            <ul>
              <li>
                Pending schedules are listed soonest first, with the due time (“20:00”, “tomorrow
                07:00”), how long until then, the target and the action. Times are in the Home
                Assistant time zone, on your 12- or 24-hour setting.
              </li>
              <li>
                <strong>+</strong> opens a dialog: pick an entity, an action (turn on, turn off,
                toggle or any service with data) and when (in 15, 30 or 60 minutes, another number
                of minutes, or any date and time), optionally a name, then <strong>Schedule</strong>
                .
              </li>
              <li>
                <strong>Click a schedule</strong> to edit it in the same dialog. A schedule with the
                default name is renamed to match the change; a name you picked stays.
              </li>
              <li>
                <strong>✕</strong> cancels a schedule without running it.
              </li>
            </ul>
          </Prose>
        </Section>

        <Section id="languages" title="Languages" level={3}>
          <Prose>
            <p>
              The card speaks your Home Assistant language: {LANGUAGES}. Anything else falls back to
              English. The integration's setup, services and errors are translated into the same
              languages.
            </p>
          </Prose>
        </Section>
      </Section>

      <Section
        id="services"
        title="Services"
        description="Call them from automations, scripts or Developer tools → Actions."
      >
        <Section
          id="later-add"
          title="later.add"
          level={3}
          description="Creates a schedule and returns it."
        >
          <OptionList options={ADD_FIELDS} />
          <CodeBlock
            label="example.yaml"
            code={`
action: later.add
data:
  entity_id: climate.office
  service: climate.set_temperature
  data:
    temperature: 17
  in: 45
response_variable: schedule
`}
          />
        </Section>
        <Section
          id="later-cancel"
          title="later.cancel"
          level={3}
          description="Deletes a pending schedule without running it."
        >
          <OptionList options={ID_FIELD} />
        </Section>
        <Section
          id="later-run-now"
          title="later.run_now"
          level={3}
          description={
            <>
              Runs a pending schedule now, then deletes it. Takes the same <code>id</code> as{" "}
              <code>later.cancel</code>.
            </>
          }
        >
          <CodeBlock
            code={`
action: later.run_now
data:
  id: 3f9a1c2e
`}
          />
        </Section>
      </Section>

      <Section
        id="schedule"
        title="A schedule"
        description="What later.add returns and the card shows. Stored in .storage/later.storage."
      >
        <CodeBlock
          code={`
id: 3f9a1c2e            # 8 hex characters
name: "Heater: turn off at 20:00"
run_at: "2026-11-21T19:00:00+00:00"      # due time, UTC
created_at: "2026-11-21T18:12:04+00:00"  # UTC
service: switch.turn_off
data: {}
entity_id: switch.heater # or null
source: service          # or card
`}
        />
      </Section>

      <Section id="events" title="Events and logbook">
        <Prose>
          <p>
            After each run Home Assistant fires a <code>later_ran</code> event (with{" "}
            <code>late</code>, <code>success</code> and <code>error</code>) and the logbook shows it
            on the target entity.
          </p>
        </Prose>
      </Section>

      <Section id="websocket" title="Websocket API">
        <Prose>
          <p>
            The card uses <code>later/list</code>, <code>later/add</code> (the fields of{" "}
            <code>later.add</code>), <code>later/update</code> (<code>schedule_id</code> and the
            fields of <code>later.add</code>), <code>later/cancel</code> (<code>schedule_id</code>)
            and <code>later/subscribe</code>, which sends the pending list at once and again after
            every change, with the change type: <code>created</code>, <code>updated</code>,{" "}
            <code>cancelled</code>, <code>ran</code>, <code>late_ran</code> or <code>failed</code>.
          </p>
        </Prose>
      </Section>
    </DocsPage>
  );
}
