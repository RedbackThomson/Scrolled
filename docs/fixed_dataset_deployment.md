# Fixed hosted-dataset deployment

One codebase builds two kinds of site:

- **Generic** (`scrolled.dev`) — the user imports their own game files and the
  browser builds the library. This is the default; no configuration needed.
- **Fixed hosted dataset** (e.g. `mapleroyals.scrolled.dev`) — the site ships a
  prebuilt dataset that is downloaded into OPFS on first visit. There is no
  import flow; the site works offline after installing.

The two are selected by build-time configuration, not separate codebases.

## Source-repo policy

This repository ships **code only**. A fixed deployment's game data, exported
database, manifests, and deployment env values live in a **separate repository**
that the operator controls — never here. Nothing dataset-specific or proprietary
(no `.wz`, no `.scrolled-backup`, no `mapleroyals` strings in shipped UI copy) is
committed to `scrolled`. See `CLAUDE.md` and `docs/writing_conventions.md`.

## How it works

- `@scrolled/config` resolves an `AppConfig` from `VITE_*` env at build time:
  - `VITE_DEPLOYMENT_PROFILE=fixed-hosted-dataset`
  - `VITE_DATASET_FAMILY=<family>` (e.g. `mapleroyals`)
  - `VITE_DATASET_CHANNEL=latest`
  - `VITE_DATASET_REPO_URL=/datasets` (or an absolute CDN base)
- When `enableUserImport` is false, all import/replace/rebuild/server-profile UI
  is hidden (`apps/web/src/config`).
- On first load with an empty library, `DatasetInstallScreen` resolves the
  channel, downloads + verifies the artifact, and restores it into OPFS via the
  existing backup importer. Later visits open from OPFS; the site is offline.
- The manifest declares the dataset's required `serverProfileId`. The app pins it
  on install (overriding whatever the backup carried) so the data always renders
  under the right rules, and refuses — before downloading — if the build doesn't
  ship that profile. The profile picker UI stays hidden; the dataset decides it.
- OPFS storage is namespaced per deployment (`db/opfsNamespace.ts`), so the
  generic site and each fixed dataset keep separate databases on one origin.
- A newer published version surfaces a `DatasetUpdatePrompt` (distinct from the
  PWA app-update prompt); accepting it re-installs in place.

## Keeping the app and dataset in sync

The dataset is a database export, so it carries two contracts that must match the
app build that opens it (see `CLAUDE.md` → schema vs. data revisions):

- **schema version** (`_migrations`) — the SQL shape. The app migrates an older
  schema up, but cannot go down.
- **data revision** (`app_meta.data_revision`) — the extracted-data contract the
  app understands.

These ride inside the artifact itself (the `.scrolled-backup` manifest), so
compatibility is decided from the artifact, not from hand-entered metadata.
`evaluateBackupImport()` enforces it on every install/update, both directions:

- Data older than `MINIMUM_SUPPORTED_DATA_REVISION` → blocked.
- Data newer than `CURRENT_DATA_REVISION`, or schema beyond
  `LATEST_SCHEMA_VERSION` → blocked with an "update the app" message (a cached,
  older app refuses a dataset built by a newer one rather than risk corruption).

This makes a mismatch **safe** rather than corrupting. The usual way an app and
dataset drift is the **service-worker cache**: a returning visitor can run a
previously-cached app build after the deployment has advanced. The guard turns
that into a clear "update the app" prompt; the PWA update path then heals it.

**Operationally, publish them together.** When you cut a new app build that bumps
the data revision, rebuild and republish the dataset from that same build and
flip `latest.json` alongside the app deploy. The canonical deployment then never
serves a mismatched pair, and the guard covers the transient cache window.

## The dataset repository layout

A static tree, hostable from GitHub Pages, R2, S3, or any static host:

```
datasets/
  <family>/
    latest.json                       # channel -> concrete version
    <version>/
      manifest.json                   # id, version, displayName, serverProfileId, artifact{url,sha256,sizeBytes}
      checksums.json
      <artifact>.scrolled-backup      # the prebuilt library
```

`latest.json` resolves to an immutable version; published versions never change.

## Building a dataset artifact

The artifact is the generic site's own backup export, packaged by
`@scrolled/dataset-builder`:

1. Run the generic site, import your game files, let it build the library.
2. Settings → Import & Export → **Export backup → "Game data only"**. This saves
   a `.scrolled-backup` file.
3. Package it into the repository layout (output is wherever your deployment repo
   keeps datasets):

   ```sh
   nix develop -c pnpm dataset:build \
     --input ~/Downloads/scrolled-game-2026-06-20.scrolled-backup \
     --out <deployment-repo>/datasets \
     --family mapleroyals --version 2026-06-20 --display-name "MapleRoyals" \
     --server-profile mapleroyals
   ```

   Re-running with a new `--version` adds a version and repoints `latest.json`;
   prior immutable versions are left untouched.

## Local testing

`apps/web/public/datasets/` is gitignored and served by Vite at `/datasets`. The
committed `apps/web/.env.fixed` uses `family=local`.

```sh
# 1. Build a local dataset from a backup into the served folder
nix develop -c pnpm dataset:build \
  --input ~/Downloads/scrolled-game-2026-06-20.scrolled-backup \
  --out apps/web/public/datasets \
  --family local --version 2026-06-20 --display-name "Local Dataset" \
  --server-profile vanilla-v83

# 2. Run the fixed deployment (loads .env.fixed)
nix develop -c pnpm dev:fixed
```

Because OPFS is namespaced per deployment, the fixed site starts with an empty
library and runs the install flow even if the generic site already has data in
the same browser.

## Building and publishing

```sh
nix develop -c pnpm build:fixed   # -> apps/web/dist-fixed (loads .env.fixed)
```

The build copies `public/datasets` into the output. Publish `dist-fixed/` to the
deployment's own static host / pages repository. The dataset artifacts are
excluded from the PWA precache (`vite.config.ts` `globIgnores`) since they are
installed into OPFS at runtime, not served from the app cache.

Each deployment is operationally independent: removing a fixed deployment's
repo/DNS leaves the generic deployment untouched.
