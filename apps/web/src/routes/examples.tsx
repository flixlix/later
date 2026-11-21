import { createFileRoute } from "@tanstack/react-router";
import { Code } from "../components/code";
import { Page } from "../components/page";

export const Route = createFileRoute("/examples")({
  head: () => ({ meta: [{ title: "Examples | Later" }] }),
  component: Examples,
});

function Examples() {
  return (
    <Page title="Examples">
      <h2>Heater off tonight</h2>
      <Code>{`
action: later.add
data:
  entity_id: switch.heater
  action: turn_off
  at: "20:00"
`}</Code>
      <h2>Light off in 30 minutes</h2>
      <Code>{`
action: later.add
data:
  entity_id: light.desk_lamp
  action: turn_off
  in: 30
`}</Code>
      <h2>A script on a date</h2>
      <Code>{`
action: later.add
data:
  service: script.turn_on
  data:
    entity_id: script.holiday_lights
  at: "2026-12-24 17:00"
  name: Holiday lights
`}</Code>
      <h2>Turn something off again after an automation turns it on</h2>
      <Code>{`
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
`}</Code>
      <h2>A card for one device</h2>
      <Code>{`
type: custom:later-card
title: Heater
entity: switch.heater
`}</Code>
      <h2>Cancel the schedule an automation created</h2>
      <Code>{`
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
`}</Code>
    </Page>
  );
}
