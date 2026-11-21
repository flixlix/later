# Domain glossary

- **Schedule**: one pending one-off action. It has an id, a name, a due time, a service, service data and optionally a target entity. It runs once and is then deleted.
- **Due time** (`run_at`): when a schedule runs, stored as a UTC ISO-8601 timestamp. "In 30 minutes" is turned into a due time when the schedule is created, never stored as a delay.
- **Created at** (`created_at`): when the schedule was created, UTC.
- **Action**: the Home Assistant service call a schedule makes: `service` (`domain.service`) and `data`.
- **Shortcut**: turn on, turn off or toggle for the target's domain (`switch.turn_off`), as opposed to picking any service.
- **Target** (`entity_id`): the entity a schedule acts on. Optional: a schedule can call any service with its own data.
- **Source**: who created the schedule, `card` or `service`.
- **Run**: calling the action. A schedule is deleted before its action is called, so it runs at most once, even if the action restarts Home Assistant.
- **Late run**: a run after the due time because Home Assistant was not running then. Missed schedules run once, shortly after startup, and are logged as late.
- **Edit**: replace a pending schedule's action, due time and name (`later/update`); it keeps its id and created at.
- **Cancel**: delete a schedule without running it.
- **Pending list**: every schedule not yet run or cancelled, sorted by due time.
- **Subscription**: the websocket feed (`later/subscribe`) that pushes the pending list to the card whenever it changes.
