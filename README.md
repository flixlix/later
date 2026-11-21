<img src="docs/brand/icon.svg" alt="" width="96" align="right">

# Later

One-off scheduled actions for Home Assistant: "turn off the heater at 20:00", "turn this off in 30 minutes". A schedule runs once, then deletes itself. There is no repeat, no pause and no "what now?" after it runs.

Later is a Home Assistant integration that ships its own dashboard card. It is not an automation, and it creates no entity per schedule.

This README is the documentation until the docs site (`apps/web`) has its own domain.

## Install

Needs Home Assistant 2025.12 or newer. The card is part of the integration: no separate card download, no dashboard resource.

### HACS

1. [Open Later in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=flixlix&repository=later&category=integration), or add `https://github.com/flixlix/later` in HACS as a custom repository of type **Integration**.
2. Download Later and restart Home Assistant.
3. [Add the integration](https://my.home-assistant.io/redirect/config_flow_start/?domain=later): Settings → Devices & services → Add integration → Later. It has no options.
4. Add the **Later** card to a dashboard (`type: custom:later-card`). Reload the browser once if it is not listed yet.

### Manual

1. Download the latest [release](https://github.com/flixlix/later/releases).
2. Copy `custom_components/later` (including `www/later-card.js`) into `<config>/custom_components/later`.
3. Restart Home Assistant and add the integration as above.

### How the card gets onto your dashboards

On startup the integration serves `custom_components/later/www/later-card.js` at `/later/later-card.js` and registers it as an extra frontend module, so `custom:later-card` works on every dashboard. If you added a dashboard resource for it by hand, remove it.

## Card

```yaml
type: custom:later-card
title: Heating # optional, default "Later"
entity: switch.heater # optional, preselected when you schedule something
```

| Option   | Default | Description                                                |
| -------- | ------- | ---------------------------------------------------------- |
| `type`   |         | `custom:later-card`                                        |
| `title`  | `Later` | Card title.                                                |
| `entity` |         | Entity preselected in the form. Editable in the UI editor. |

The card lists pending schedules, soonest first: due time (`20:00`, `tomorrow 07:00`), how long until then (`in 25 min`), name, target and action. Times are in the Home Assistant time zone, on your 12- or 24-hour setting. ✕ cancels a schedule without running it.

\+ opens a dialog: pick an entity, an action (turn on, turn off, toggle, or any service with data), when (in 15, 30 or 60 minutes, another number of minutes, or any date and time), optionally a name, then **Schedule**. An empty list shows a button for the same dialog.

Click a schedule to edit it in the same dialog. **Save** keeps its id; a schedule with the default name is renamed to match the change, a name you picked stays.

The card speaks your Home Assistant language: Catalan, Czech, Danish, Dutch, English, Finnish, French, German, Hindi, Italian, Polish, Portuguese (Portugal and Brazil), Russian, Slovak, Spanish, Swedish and Ukrainian; anything else falls back to English. The integration's setup, services and errors are translated into the same languages. Default schedule names (`Heater: turn off at 20:00`) stay English.

Without the integration the card says so and links to HACS. If the integration is installed but not added, it says that instead.

## Services

### `later.add`

Creates a schedule and returns it (`response_variable`).

| Field       | Description                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity_id` | Target entity. Required with `action`.                                                                                                               |
| `action`    | `turn_on`, `turn_off` or `toggle`, called on the entity's domain (`switch.turn_off`). Send either `action` or `service`.                             |
| `service`   | Any service as `domain.service`. Send either `action` or `service`.                                                                                  |
| `data`      | Service data. `entity_id` is added unless `data` has its own.                                                                                        |
| `at`        | `20:00` (today, or tomorrow once it has passed) or a date and time such as `2026-12-24 18:00`, in the Home Assistant time zone. Either `at` or `in`. |
| `in`        | Minutes from now, a whole number above 0. Either `at` or `in`.                                                                                       |
| `name`      | Shown in the card and the logbook. Default: `Heater: turn off at 20:00`.                                                                             |

```yaml
action: later.add
data:
  entity_id: switch.heater
  action: turn_off
  at: "20:00"
```

```yaml
action: later.add
data:
  entity_id: climate.office
  service: climate.set_temperature
  data:
    temperature: 17
  in: 45
response_variable: schedule
```

A call with both `at` and `in`, neither, both `action` and `service`, neither, or `action` without `entity_id` is rejected.

### `later.cancel`

Deletes a pending schedule without running it. Field: `id`.

### `later.run_now`

Runs a pending schedule now, then deletes it. Field: `id`.

## Behaviour

- **Clock times** are in the Home Assistant time zone (Settings → System → General). A clock time that has passed today means tomorrow.
- **Due times are stored in UTC.** "In 30 minutes" becomes a fixed due time when you create the schedule; a restart does not move it.
- **After a run** the action has been called once, a `later_ran` event is fired and shown in the logbook on the target entity, and the schedule is gone. Nothing asks what to do next.
- **The schedule is deleted before the action is called,** so it runs at most once, even if the action restarts Home Assistant.
- **Failures** (missing entity or service, an error from the service) are logged with the schedule id, name, service and target. The schedule is deleted anyway and not retried: a failed one-off that stays pending forever is worse than a logged miss.

### Restarts and missed runs

Schedules are stored in `.storage/later.storage` and survive restarts. 10 seconds after Home Assistant has started, so entities can come up:

- a schedule due in the future is armed for its original due time;
- a schedule whose due time has passed (Home Assistant was down, crashed or lost power) runs once, is logged as late (a warning in the log, `late: true` on the event, "ran … late" in the logbook), and is deleted.

"Turn off the heater at 20:00" still turns it off if Home Assistant comes back at 20:30. Later does not ask, and does not need a recorded shutdown time: the due time is enough.

## A schedule

What `later.add` returns, `later/list` lists and the card shows:

```yaml
id: 3f9a1c2e # 8 hex characters
name: "Heater: turn off at 20:00"
run_at: "2026-11-21T19:00:00+00:00" # due time, UTC
created_at: "2026-11-21T18:12:04+00:00" # UTC
service: switch.turn_off
data: {}
entity_id: switch.heater # or null
source: service # or card
```

## Websocket API

`later/list`, `later/add` (fields of `later.add`), `later/update` (`schedule_id` and the fields of `later.add`; replaces the schedule's action, due time and name), `later/cancel` (`schedule_id`) and `later/subscribe`, which sends `{type: "list", schedules}` at once and then `{type, schedule, schedules}` after every change, with `type` one of `created`, `updated`, `cancelled`, `ran`, `late_ran`, `failed`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
