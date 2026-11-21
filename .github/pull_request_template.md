<!-- How to fill this in: docs/pull-requests.md -->

Closes #

## Summary

<!-- What changes for the user, from the issue. Then the smallest visual of the change: a service call, YAML, a timeline or a file tree. -->

## Evidence

<!-- Before and after: screenshots for anything visual, otherwise the test that failed and now passes. -->

- **Before:**
- **After:**

## Merge danger

<!-- One-way door: storage format, service names and fields, websocket shapes, card options, breaking changes. -->

**Door:** one-way / two-way
**Blast radius:**

## Not in this PR

<!-- What a reviewer might expect and will not find, and why. Delete if empty. -->

## Checklist

- [ ] Bug fix: a test that fails without the fix
- [ ] User-facing change: changeset, README, docs site (`apps/web`), `services.yaml` for services, UI editor for card options
- [ ] Card source changed: `pnpm build:integration` re-run and `custom_components/later/www/later-card.js` committed
- [ ] Visual change: baselines updated only for intended changes
