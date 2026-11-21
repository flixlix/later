# Contributing

Later is one Home Assistant integration (`custom_components/later`, Python) and the Lovelace card it ships (`packages/later-card`, TypeScript + Lit). Both live in this repo and release together.

## Requirements

- **Node.js** `>=22.18.0` (see `.nvmrc`) and **pnpm** (the version in `package.json` `packageManager`; `corepack enable` picks it up)
- **uv** for the Python tools: [install](https://docs.astral.sh/uv/getting-started/installation/)
- **Docker** for the local Home Assistant (`pnpm hass:up`) and the visual tests (`pnpm test:visual`)

## Layout

| Path                          | What it holds                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `custom_components/later`     | The integration: storage, timers, services, websocket API, config flow         |
| `custom_components/later/www` | The release build of the card, served by the integration. Generated; see below |
| `tests/`                      | pytest for the integration                                                     |
| `packages/later-card`         | The card                                                                       |
| `packages/shared`             | Card helpers: registration, console banner, `ha-form` loading, test helpers    |
| `packages/tooling/*`          | Bundler, lint rules, Vitest configs, TypeScript config, changeset tooling      |
| `apps/web`                    | Docs site                                                                      |
| `e2e/`                        | Playwright tests against a real Home Assistant in Docker                       |
| `.hass_dev/`                  | Config of that Home Assistant                                                  |

## Setup

```bash
pnpm install   # also enables the git hooks in .vite-hooks
uv sync        # Python 3.14 venv in .venv with Home Assistant, pytest and Ruff from uv.lock
```

## Local Home Assistant

```bash
pnpm hass:up
```

Builds the card, starts Home Assistant at <http://localhost:8123> (user `dev`, password `dev`) with the integration mounted from `custom_components/later` and a dashboard that already has the card. See [`e2e/README.md`](e2e/README.md).

Run `pnpm dev` in `packages/later-card` to rebuild the card on change, then reload the browser. After a Python change run `pnpm hass:restart`.

## Checks

TypeScript:

```bash
pnpm check          # format, lint, type errors, changesets, versions in step
pnpm test           # unit tests and browser tests (Chromium)
pnpm test:visual    # screenshot tests in the pinned Playwright Docker image
pnpm build:card     # fails on syntax older Home Assistant webviews cannot parse
```

Python:

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest
```

Docs site (`apps/web`, TanStack Start; Vercel preset, meant for later.flixlix.com):

```bash
pnpm --filter @later/web dev    # http://localhost:3000
pnpm --filter @later/web build
```

End to end, against `pnpm hass:up`:

```bash
pnpm e2e
```

## The bundled card

Home Assistant loads the card from `custom_components/later/www/later-card.js`, which is committed so HACS installs it with the integration. When a PR changes card source, run:

```bash
pnpm build:integration
```

and commit the result. CI rebuilds it and fails if the committed file differs.

## Releasing

Add a changeset to every user-facing PR (`pnpm changeset`, select `later-card`). On main, the Release workflow opens a "Version packages" PR; merging it bumps `later-card` and `manifest.json` to the same version, rebuilds the card, tags `v<version>` and publishes the GitHub release HACS installs.

Follow [`CODING_STANDARDS.md`](CODING_STANDARDS.md) and write PR bodies as in [`docs/pull-requests.md`](docs/pull-requests.md).
