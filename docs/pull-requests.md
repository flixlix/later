# Writing a PR body

A PR body exists so a reviewer can judge the change without reconstructing it from the diff. Adapted from Matt Pocock's [`pr`](https://github.com/mattpocock/skills) skill.

## Template

```markdown
Closes #<issue>

## Summary

<one or two sentences on what changes for the user, then the smallest visual that shows the shape of the change>

## Evidence

- **Before:** <screenshot / failing test>
  **After:** <screenshot / passing test>

## Merge danger

**Door:** one-way | two-way
**Blast radius:** <what this can break: stored schedules, service calls in automations, the card>

## Not in this PR

<what was deliberately left out, and why>
```

Skip preambles, keep prose brief, and use the vocabulary from [`CONTEXT.md`](../CONTEXT.md): schedule, due time, action, shortcut, target, run, late run, cancel, pending list. Drop a section only when it would be empty.

## Summary

Write the "what" from the issue or the request, not from the diff. Then pick the smallest view that makes the key point:

- **A service or websocket change:** the call a user or the card makes.

  ```yaml
  action: later.add
  data:
    entity_id: switch.heater
    action: turn_off
    at: "20:00"
  ```

- **A card option:** the YAML a user writes, and what the card does with it.
- **Timing or restart behaviour:** a timeline.

  ```text
  19:55 schedule created, due 20:00
  19:58 Home Assistant stops
  20:30 Home Assistant starts; 10 s later the schedule runs, logged as late, and is deleted
  ```

- **Interaction between card, websocket and timers:** a Mermaid `sequenceDiagram`.
- **Moved files:** a shallow file tree diff, one comment per line on what the file owns.

## Evidence

Show a before and an after.

1. **Screenshots** for anything visual, from the `pnpm hass:up` dashboard or the visual test output: light and dark theme, and a narrow (phone) width.
2. **Test runs** where there is nothing to see. Name the test that failed before the fix and passes after, as pseudocode of the scenario:

   ```text
   tests/test_restart.py › missed schedule runs once after startup
     due 20:00, Home Assistant starts 20:30
     before: still pending   after: ran once, logged late, deleted
   ```

## Merge danger

**Door.** A two-way door can be reverted in the next release without users noticing. A one-way door cannot. In this repo, one-way doors are:

- the storage format in `.storage/later.storage` (needs a migration)
- a service name, field or default (users have them in automations)
- a websocket command or event shape (an old card in a browser cache talks to a new integration)
- a card option name, its YAML shape or its default
- anything marked `breaking:` in the changeset

**Blast radius.** Say what could break: schedules stored by an older version, schedules due during a restart, automations calling the services, the card in light/dark themes and on a phone.

## Not in this PR

List what a reviewer might expect and will not find, one line each, with the reason.
