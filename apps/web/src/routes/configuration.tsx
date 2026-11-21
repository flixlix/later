import { createFileRoute } from "@tanstack/react-router";
import { Code } from "../components/code";
import { Page } from "../components/page";

export const Route = createFileRoute("/configuration")({
  head: () => ({ meta: [{ title: "Configuration | Later" }] }),
  component: Configuration,
});

const CARD_OPTIONS = [
  ["type", "Required", "custom:later-card"],
  ["title", "Later", "Card title."],
  ["entity", "none", "Entity preselected when you schedule something."],
];

const ADD_FIELDS = [
  ["entity_id", "Target entity. Required with action."],
  ["action", "turn_on, turn_off or toggle for the entity's domain. Either this or service."],
  ["service", "Any service as domain.service. Either this or action."],
  ["data", "Service data. The entity_id is added unless data has its own."],
  [
    "at",
    "20:00 (today, or tomorrow once it has passed) or a date and time such as 2026-12-24 18:00, in the Home Assistant time zone. Either this or in.",
  ],
  ["in", "Minutes from now, a whole number above 0. Either this or at."],
  ["name", "Shown in the card and the logbook. Default: “Heater: turn off at 20:00”."],
];

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td key={cell}>{index === 0 ? <code>{cell}</code> : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Configuration() {
  return (
    <Page title="Configuration">
      <h2 id="card">Card</h2>
      <Code>{`
type: custom:later-card
title: Heating
entity: switch.heater
`}</Code>
      <Table head={["Option", "Default", "Description"]} rows={CARD_OPTIONS} />
      <p>
        The card lists pending schedules, soonest first, with the due time (“20:00”, “tomorrow
        07:00”), how long until then, the target and the action. The ✕ cancels a schedule without
        running it. The + opens the form: pick an entity, an action (turn on, turn off, toggle or
        any service with data) and when (15, 30 or 60 minutes, another number of minutes, or a clock
        time), optionally a name, then <b>Schedule</b>.
      </p>
      <h2 id="services">Services</h2>
      <h3>later.add</h3>
      <p>Creates a schedule and returns it.</p>
      <Table head={["Field", "Description"]} rows={ADD_FIELDS} />
      <Code>{`
action: later.add
data:
  entity_id: climate.office
  service: climate.set_temperature
  data:
    temperature: 17
  in: 45
response_variable: schedule
`}</Code>
      <h3>later.cancel</h3>
      <p>
        Deletes a pending schedule without running it. Field: <code>id</code>.
      </p>
      <h3>later.run_now</h3>
      <p>
        Runs a pending schedule now, then deletes it. Field: <code>id</code>.
      </p>
      <h2 id="schedule">A schedule</h2>
      <Code label="What later.add returns and the card shows">{`
id: 3f9a1c2e            # 8 hex characters
name: "Heater: turn off at 20:00"
run_at: "2026-11-21T19:00:00+00:00"      # due time, UTC
created_at: "2026-11-21T18:12:04+00:00"  # UTC
service: switch.turn_off
data: {}
entity_id: switch.heater # or null
source: service          # or card
`}</Code>
      <p>
        Schedules are stored in <code>.storage/later.storage</code>. After each run Home Assistant
        fires a <code>later_ran</code> event (with <code>late</code>, <code>success</code> and{" "}
        <code>error</code>) and the logbook shows it on the target entity.
      </p>
      <h2 id="websocket">Websocket API</h2>
      <p>
        The card uses <code>later/list</code>, <code>later/add</code> (the fields of{" "}
        <code>later.add</code>), <code>later/cancel</code> (<code>schedule_id</code>) and{" "}
        <code>later/subscribe</code>, which sends the pending list at once and again after every
        change, with the change type: <code>created</code>, <code>cancelled</code>, <code>ran</code>
        , <code>late_ran</code> or <code>failed</code>.
      </p>
    </Page>
  );
}
