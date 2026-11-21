# Changesets

Add one with `pnpm changeset` for every user-visible change. Rules: [`CODING_STANDARDS.md`](../CODING_STANDARDS.md); `pnpm check:changesets` enforces them.

`later-card` carries the version of the whole release: `pnpm version-packages` copies it into `custom_components/later/manifest.json` and rebuilds the card into `custom_components/later/www/`.
