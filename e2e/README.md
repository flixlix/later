# Home Assistant playground and e2e tests

A real Home Assistant in Docker with the `later` integration mounted from
`custom_components/later`, a few dummy entities, a dashboard with the card, and a Playwright
smoke suite for what only a real Home Assistant can show: the card loading without a resource,
the config entry, and schedules created, cancelled and run.

## Start

```bash
pnpm hass:up       # build the card, start HA in the background, bootstrap it
pnpm hass:restart  # restart HA, e.g. after a Python change or to test restarts
pnpm hass:down     # stop it (state is kept in .hass_dev/)
pnpm hass:reset    # stop and wipe everything HA generated (.storage, database, logs, token)
pnpm hass:logs     # follow the HA log
```

Open <http://localhost:8123> and log in as **`dev` / `dev`**. These credentials are dev-only and
committed on purpose; the instance only listens on localhost.

The bootstrap (`e2e/scripts/bootstrap.ts`, safe to re-run) completes onboarding, writes a
long-lived token to `.hass_dev/.e2e-token` and adds the Later integration through its config
flow, the same flow as Settings → Devices & services → Add integration → Later. To try that
dialog yourself, delete the Later entry and add it again.

The instance runs in `Europe/Berlin`, so clock times in the card differ from the UTC due times
in `.hass_dev/.storage/later.storage`.

**Live development:** compose mounts `packages/later-card/dist/later-card.js` over the committed
`custom_components/later/www/later-card.js`. Run `pnpm dev` in `packages/later-card` and reload
the browser. After a Python change run `pnpm hass:restart`.

## Dashboard

`/later-dev/later` holds `custom:later-card` (default entity `switch.heater`), the dummy entities
and a logbook.

| Entity                            | What it is                                             |
| --------------------------------- | ------------------------------------------------------ |
| `switch.heater`                   | Template switch over `input_boolean.heater_power`      |
| `light.desk_lamp`                 | Template light over `input_boolean.desk_lamp_power`    |
| `climate.office`                  | Generic thermostat over `input_boolean.office_heating` |
| `input_number.office_temperature` | The thermostat's temperature reading                   |

## Checking restarts by hand

1. Schedule `switch.heater` off in 5 minutes, `pnpm hass:restart`: the schedule is still listed
   and runs at its original time.
2. Schedule it off in 1 minute, `pnpm hass:down`, wait two minutes, `pnpm hass:up`: about ten
   seconds after startup the heater turns off, the log says the schedule ran late, and the row is
   gone.

## Tests

```bash
pnpm e2e
```

The tests run one at a time against the instance from `pnpm hass:up`, and fail on any console
error.
