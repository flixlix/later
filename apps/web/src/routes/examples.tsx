import { createFileRoute } from "@tanstack/react-router";

import { DocsPage } from "../components/docs-page";
import { Callout, CodeBlock, PageHeader, Section } from "../components/docs";
import { LiveCard, type LiveCardConfig } from "../components/live-card";
import { pageHead } from "../lib/head";
import { PAGE } from "../lib/site";

const page = PAGE.examples;

export const Route = createFileRoute("/examples")({
  head: () => pageHead(page),
  component: Examples,
});

const yamlOf = (config: LiveCardConfig) =>
  Object.entries(config)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

/** An example card config next to the card it draws. */
function CardExample({ title, config }: { title: string; config: LiveCardConfig }) {
  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <CodeBlock code={yamlOf(config)} />
      <LiveCard config={config} />
    </figure>
  );
}

function Examples() {
  return (
    <DocsPage page={page}>
      <PageHeader
        eyebrow="Recipes"
        title="Examples"
        description="Copy, paste, change the entity IDs. Cards are shown live; services go in an automation, a script or Developer tools → Actions."
      />

      <Section id="cards" title="Cards">
        <div className="grid gap-8 md:grid-cols-2">
          <CardExample title="Every schedule" config={{ type: "custom:later-card" }} />
          <CardExample
            title="A card for one device"
            config={{ type: "custom:later-card", title: "Heater", entity: "switch.heater" }}
          />
        </div>
      </Section>

      <Section id="heater-off-tonight" title="Heater off tonight">
        <CodeBlock
          code={`
action: later.add
data:
  entity_id: switch.heater
  action: turn_off
  at: "20:00"
`}
        />
      </Section>

      <Section id="light-off-in-30-minutes" title="Light off in 30 minutes">
        <CodeBlock
          code={`
action: later.add
data:
  entity_id: light.desk_lamp
  action: turn_off
  in: 30
`}
        />
      </Section>

      <Section id="script-on-a-date" title="A script on a date">
        <CodeBlock
          code={`
action: later.add
data:
  service: script.turn_on
  data:
    entity_id: script.holiday_lights
  at: "2026-12-24 17:00"
  name: Holiday lights
`}
        />
      </Section>

      <Section
        id="off-again-after-on"
        title="Turn something off again after an automation turns it on"
        description="Unlike a delay in the automation, the schedule survives a restart and shows up in the card, where you can cancel it."
      >
        <CodeBlock
          label="automation.yaml"
          code={`
triggers:
  - trigger: state
    entity_id: binary_sensor.garage_door
    to: "on"
actions:
  - action: light.turn_on
    target:
      entity_id: light.garage
  - action: later.add
    data:
      entity_id: light.garage
      action: turn_off
      in: 10
`}
        />
      </Section>

      <Section id="cancel-from-automation" title="Cancel the schedule an automation created">
        <CodeBlock
          label="automation.yaml"
          code={`
actions:
  - action: later.add
    data:
      entity_id: switch.pump
      action: turn_off
      in: 20
    response_variable: pump_off
  - wait_for_trigger:
      - trigger: state
        entity_id: input_boolean.keep_pump_running
        to: "on"
    timeout: "00:15:00"
  - if: "{{ wait.trigger is not none }}"
    then:
      - action: later.cancel
        data:
          id: "{{ pump_off.id }}"
`}
        />
        <Callout variant="tip" title="Don't forget">
          Replace the entity IDs with your own.
        </Callout>
      </Section>
    </DocsPage>
  );
}
