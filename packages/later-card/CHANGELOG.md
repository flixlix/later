# later-card

## 0.1.0

### Minor Changes

- **New:** The Later card: pick an entity, turn on/off/toggle or any service, and "in 15/30/60 min", custom minutes or a clock time. Pending schedules are listed with their due time and can be cancelled. Loaded on every dashboard by the integration. ([#7](https://github.com/flixlix/later/pull/7))

- **New:** The Later integration: one-off schedules that run a service once at a clock time or in N minutes, then delete themselves. Missed schedules run once after a restart. Services `later.add`, `later.cancel`, `later.run_now`. ([#7](https://github.com/flixlix/later/pull/7))

### Patch Changes

- **New:** The card schedules on any day: "Date & time" picks a date and a time, and says when that is ("Runs tomorrow 07:30, in 12 h"). Times already past are refused. ([#7](https://github.com/flixlix/later/pull/7))

- **Fix:** A new schedule shows the right countdown at once ("in 15 min", not "in 16 min"), and countdowns change exactly when the minute does. ([#7](https://github.com/flixlix/later/pull/7))

- **New:** The card creates and edits schedules in a dialog instead of growing the card, with the action and the due time in visibly separate sections. ([#7](https://github.com/flixlix/later/pull/7))

- **New:** Click a schedule in the card to edit its action, due time or name. A default name follows the change; a name you picked stays. ([#7](https://github.com/flixlix/later/pull/7))

- **Fix:** Entities, services, dates, times, minutes and names picked in the card's form now stick; before, every Home Assistant field in it ignored what you picked. ([#7](https://github.com/flixlix/later/pull/7))

- **Fix:** The card shows and picks every time in the Home Assistant time zone, on your 12- or 24-hour setting, so the list, the form and default names like "Heater: turn off at 16:12" agree. ([#7](https://github.com/flixlix/later/pull/7))

- **New:** Later has its own logo on its integration page in Home Assistant. ([#7](https://github.com/flixlix/later/pull/7))

- **New:** The card and the integration speak your Home Assistant language in the 17 languages of power-flow-card-plus besides English, from Catalan to Ukrainian. Anything else falls back to English. ([#7](https://github.com/flixlix/later/pull/7))
