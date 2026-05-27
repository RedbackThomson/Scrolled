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

| Script           | What it does                               |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Start the Vite dev server for the web app. |
| `pnpm build`     | Production build.                          |
| `pnpm preview`   | Preview the production build locally.      |
| `pnpm typecheck` | Run TypeScript in all packages.            |
| `pnpm lint`      | Run ESLint in all packages.                |
| `pnpm test`      | Run Vitest in all packages.                |
| `pnpm format`    | Format the repo with Prettier.             |

## Layout

```
apps/web/        Vite + React + TS app (the wiki UI)
packages/        Shared libraries (parser, extractors, db, search)
docs/            Product and technical requirements
```

The source of truth for product scope is [`docs/mapleroyals_wiki_clone_requirements.md`](docs/mapleroyals_wiki_clone_requirements.md). Technical decisions live in [`docs/technical_requirements.md`](docs/technical_requirements.md). Command palette extension is covered in [`docs/command_palette_extension_guide.md`](docs/command_palette_extension_guide.md).

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

| Stored revision          | `useDataState`          | Effect                                        |
| ------------------------ | ----------------------- | --------------------------------------------- |
| `< MINIMUM`              | `reinitialize-required` | Blocked; redirected to setup with an explainer |
| `MINIMUM ≤ r < CURRENT`  | `update-recommended`    | Non-blocking toast + amber sidebar             |
| `≥ CURRENT`              | `current`               | Nothing                                        |

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

- **Breaking** (preferred): raise **both** constants. The reset clears the cache
  before migrating, so write the clean schema directly — `ADD COLUMN … NOT NULL`,
  tightened constraints, no nullable "not-yet-extracted" sentinels, no throwaway
  defaults. (The reset runs *before* migrations precisely so a `NOT NULL` add
  can't hit populated rows, throw, and brick `open()`.)
- **Additive**: raise `CURRENT_DATA_REVISION` only. No reset happens, so the
  migration hits populated tables — new columns must tolerate existing rows
  (nullable or `NOT NULL DEFAULT`). The only case a nullable backfill belongs.

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
