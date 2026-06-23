# Development

Guidance for working on Scrolled itself. For a user-facing overview, see [README.md](README.md). For the rules every change must follow, see [CLAUDE.md](CLAUDE.md).

## Core tenets

Four principles shape every decision here. They're philosophical; [CLAUDE.md](CLAUDE.md) turns them into the binding rules that enforce them. When a choice isn't covered by a rule, let these guide it.

- **Open source first.** Open, permissively licensed, and free to fork from day one. It's a community tool, not a proprietary product — nothing essential should live behind private data, assets, or credentials.
- **Self-hostable.** Anyone can run their own instance with no dependency on us — no privileged central server the app needs, no account, no paid service. A self-hoster can do everything the canonical deployment can.
- **Nothing proprietary.** Ship our own code and nothing else — no game data, assets, or third-party content, and no trademarked names or branding in what users see. Users bring their own content and own the rights to it.
- **Support offline mode.** The app runs on the user's device and their data stays with them. It keeps working with no network connection; connectivity may enhance the experience but is never required.

## Requirements

- Node.js 20+ and [pnpm](https://pnpm.io/) 9+
- Or [Nix](https://nixos.org/) with flakes enabled (recommended — pins the full toolchain)

## Quickstart

```bash
pnpm install
pnpm dev
```

Then open the printed URL.

### Nix users

A flake is provided. With Nix + flakes enabled:

```bash
nix develop
pnpm install
pnpm dev
```

Or, with [direnv](https://direnv.net/) installed, `direnv allow` will load the dev shell automatically.

All scripts in this repo are expected to run inside the flake dev shell. If you're not using direnv, prefix commands with `nix develop -c`, e.g. `nix develop -c pnpm typecheck`.

## Scripts

| Script               | What it does                                                                    |
| -------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`           | Start the Vite dev server for the web app (generic profile: user imports files). |
| `pnpm dev:fixed`     | Start the dev server in fixed hosted-dataset mode. See below.                   |
| `pnpm build`         | Production build.                                                               |
| `pnpm build:fixed`   | Production build in fixed hosted-dataset mode (`dist-fixed`).                   |
| `pnpm dataset:build` | Headless dataset builder — WZ files → `.scrolled-dataset` bundle.               |
| `pnpm preview`       | Preview the production build locally.                                           |
| `pnpm typecheck`     | Run TypeScript in all packages.                                                 |
| `pnpm lint`          | Run ESLint in all packages.                                                     |
| `pnpm test`          | Run Vitest in all packages.                                                     |
| `pnpm format`        | Format the repo with Prettier.                                                  |

## Fixed-dataset local dev

`pnpm dev` runs the **generic** profile: an empty library that expects the user to
import their own game files in the browser. `pnpm dev:fixed` instead runs the
**fixed hosted-dataset** profile — the import flow is disabled and the app
installs a prebuilt dataset served from `/datasets`. To exercise that path
locally you first have to generate the dataset the dev server will serve.

The settings in [`apps/web/.env.fixed`](apps/web/.env.fixed) (loaded by
`--mode fixed`) decide where the app looks: family `local`, channel `latest`,
repository `/datasets`. Vite serves `apps/web/public/datasets/` at `/datasets`,
so the build has to land there under the `local` family. That directory is
git-ignored — it holds your own derived data, never committed.

**1. Build the dataset** from a directory of your `.wz` archives (or a tree of
`.img` files). Match the `.env.fixed` family/channel so the app can find it:

```bash
pnpm dataset:build /path/to/wz \
  --profile mapleroyals-compatible \
  --version 2026-06-20 \
  --family local \
  --out apps/web/public/datasets
```

This writes `apps/web/public/datasets/local/2026-06-20/` (the bundle, manifest,
and checksums) and points `apps/web/public/datasets/local/latest.json` at it.
`--version` is any immutable label; `--out` and `--family` must resolve to that
`public/datasets/local` location. Pass `--wz-version <BMS|GMS|EMS|CLASSIC>` if
auto-detection can't determine the encryption version, and `--profile-file
<path>` to use a custom server profile instead of a built-in id.

**2. Start the server** in fixed mode:

```bash
pnpm dev:fixed
```

Open the printed URL; the app installs the `local/latest` dataset into OPFS on
first load. Rebuild step 1 with a new `--version` and refresh to pick up changes.

> Per [CLAUDE.md](CLAUDE.md), `.wz` files and the datasets derived from them are
> never committed — the source files stay on your machine and `public/datasets/`
> is git-ignored.

## Layout

```
apps/web/        Vite + React + TS app (the wiki UI)
packages/        Shared libraries (parser, extractors, db, search)
docs/            Product and technical requirements
```

The source of truth for product scope is [`docs/mapleroyals_wiki_clone_requirements.md`](docs/mapleroyals_wiki_clone_requirements.md). Technical decisions live in [`docs/technical_requirements.md`](docs/technical_requirements.md). Command palette extension is covered in [`docs/command_palette_extension_guide.md`](docs/command_palette_extension_guide.md). The WZ format reference sources used to decode game files — for adding parser/extractor features — are collected in [`docs/format_sources.md`](docs/format_sources.md).

Which package owns which domain — and the rule that **game-data translation (code→term vocabulary) lives in `@scrolled/game-db/domain`, not the web app** — is the canonical boundary spec [`docs/data_boundaries.md`](docs/data_boundaries.md). Read it before adding a label map, enum, or `switch` over WZ codes; the web app renders game data but never defines what it means.

Cross-device sync is designed in [`docs/sync_design.md`](docs/sync_design.md); to make a new piece of user data sync, follow [`docs/adding_a_synced_entity.md`](docs/adding_a_synced_entity.md).

## Schema and data versioning

The library is a derived cache of the user's game files, not a source of truth.
Two independent versions protect it across releases; picking the wrong one
silently corrupts what existing users see.

**Schema version** (`_migrations`, `db/migrations.ts`) — the SQL shape. Append a
numbered entry for any DDL change; the runner applies pending ones on open and
on import. Forward-only: never edit or reorder a shipped migration.

**Data revision** (`db/dataVersion.ts`) — the extracted-data contract, stored in
`app_meta.data_revision`, stamped on every successful run. On open the app
compares it to `CURRENT_DATA_REVISION` (what this build produces) and
`MINIMUM_SUPPORTED_DATA_REVISION` (the oldest it can read):

| Stored revision         | `useDataState`          | Effect                                         |
| ----------------------- | ----------------------- | ---------------------------------------------- |
| `< MINIMUM`             | `reinitialize-required` | Blocked; redirected to setup with an explainer |
| `MINIMUM ≤ r < CURRENT` | `update-recommended`    | Non-blocking toast + amber sidebar             |
| `≥ CURRENT`             | `current`               | Nothing                                        |

A missing key reads as 0, so a pre-tracking library is flagged for rebuild.

### Destructive reset (the `< MINIMUM` case)

The Room `fallbackToDestructiveMigration` pattern: too-old caches are discarded
and rebuilt from source, not migrated. `Sqlite`'s `resetBeforeMigrate` hook runs
after open but **before** migrations; for the game DB, `gameDataPreMigrateReset`
clears every table when the revision is `< MINIMUM` and data exists, so the
migrations that follow hit **empty tables**. `importBytes` runs the same hook.

The wipe leaves empty tables that look like a first run, so it sets a
`pending_rebuild` flag in `app_meta`; `status()` exposes it and `useDataState`
maps it to `reinitialize-required` (over the first-run shortcut) for the
explainer. The next successful run clears it.

### When to bump, and how to shape the migration

Bump the data revision whenever extraction output changes (new extraction-fed
column, reinterpreted field, changed extractor) — usually alongside a migration.

- **Breaking** (preferred): raise **both** constants. The cache is discarded and
  rebuilt rather than reinterpreted — use this when old rows can't be migrated in
  place. It does **not** license a bare `NOT NULL` add: see the rule below.
- **Additive**: raise `CURRENT_DATA_REVISION` only. No reset happens, so old rows
  survive and must keep rendering — new columns must tolerate them (nullable or
  `NOT NULL DEFAULT`). The only case a nullable backfill belongs.

**Write every migration as if the tables already hold rows.** Don't assume the
destructive reset emptied them first: it only fires for a `< MINIMUM` cache that
actually has data — never for an additive bump, an import of current-revision
data, or a plain re-run — and it's a hook a refactor could move. SQLite rejects
`ALTER TABLE … ADD COLUMN … NOT NULL` without a `DEFAULT` on a non-empty table
("Cannot add a NOT NULL column with default value NULL"); that throws inside the
migration transaction and bricks `open()` for everyone who upgrades with data.
So **every `NOT NULL` column you add needs a `DEFAULT`** (e.g. `NOT NULL DEFAULT
''` / `DEFAULT 0`) — extraction overwrites the placeholder on the next run.

Don't bump for UI-only or extraction-independent schema changes. Shipped
migrations (e.g. the nullable equip-bonus columns in 14) predate this and must
not be edited.

### Where it surfaces

`useDataState` (`lib/useDataState.ts`) classifies; `AppShell#useSetupRedirect`
redirects (passing `{ reason: 'data-incompatible' }` for the explainer in
`Setup.tsx`); `Sidebar.tsx` shows the status chip; `DataUpdatePrompt.tsx` is the
soft toast.

## Reporting parser issues

If something goes wrong loading WZ files, open the **Parser debug** page in the sidebar and click **Copy log**. That captures the parser's log buffer (main thread + worker), the AES smoke-test result, and minimal environment info. Paste that into your GitHub issue along with what you tried.

For extra verbosity, set `localStorage.setItem('scrolled.debug', '1')` in the browser console before reproducing — that enables debug-level entries that are otherwise filtered out of the console (they're always captured in the buffer).

## Status

Pre-alpha. See [`docs/technical_requirements.md`](docs/technical_requirements.md) for the phase plan.
