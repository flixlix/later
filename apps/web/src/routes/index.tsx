import { Link, createFileRoute } from "@tanstack/react-router";
import { Code } from "../components/code";
import { Page } from "../components/page";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Page title="Later">
      <p className="lead">
        One-off scheduled actions for Home Assistant: “turn off the heater at 20:00”, “turn this off
        in 30 minutes”. A schedule runs once, then deletes itself.
      </p>
      <p>
        Later is a Home Assistant integration with its own dashboard card. There is no repeat, no
        pause and no “what now?” after a run: the action is called once and the schedule is gone. It
        is not an automation, and it creates no entity per schedule.
      </p>
      <Code label="Dashboard card">{`type: custom:later-card`}</Code>
      <Code label="Or from an automation or Developer tools">{`
action: later.add
data:
  entity_id: switch.heater
  action: turn_off
  at: "20:00"
`}</Code>
      <h2>How it behaves</h2>
      <ul>
        <li>
          <b>Clock times</b> are in the Home Assistant time zone. A time that has already passed
          today means tomorrow.
        </li>
        <li>
          <b>“In 30 minutes”</b> is turned into a fixed due time when you create the schedule, so a
          restart does not move it.
        </li>
        <li>
          <b>Restarts</b>: pending schedules are stored and run at their original time.
        </li>
        <li>
          <b>Missed schedules</b> (due while Home Assistant was down) run once, 10 seconds after
          startup, and are logged as late. “Turn off the heater at 20:00” still turns it off if Home
          Assistant comes back at 20:30.
        </li>
        <li>
          <b>Failures</b> (missing entity or service, an error from the service) are logged with the
          schedule id, target and service. The schedule is deleted anyway and not retried.
        </li>
      </ul>
      <p>
        <Link to="/installation">Install Later</Link>, then see the{" "}
        <Link to="/configuration">card and services</Link> and some{" "}
        <Link to="/examples">examples</Link>.
      </p>
    </Page>
  );
}
