# Fixed hosted-dataset deployment

One codebase builds two kinds of site:

- **Generic** (`scrolled.dev`) — the user imports their own game files and the
  browser builds the library. This is the default; no configuration needed.
- **Fixed hosted dataset** (e.g. `mapleroyals.scrolled.dev`) — the site ships a
  prebuilt dataset that is downloaded into OPFS on first visit. There is no
  import flow; the site works offline after installing.

The two are selected by build-time configuration, not separate codebases.

## Source-repo policy

This repository ships **code only**. A fixed deployment's game files, built
dataset bundle, manifests, and deployment env values live in a **separate
repository** that the operator controls — never here. Nothing dataset-specific or
proprietary (no `.wz`, no `.scrolled-dataset` bundle, no `mapleroyals` strings in
shipped UI copy) is committed to `scrolled`. See `CLAUDE.md` and
`docs/writing_conventions.md`.

## How it works

- `@scrolled/config` resolves an `AppConfig` from `VITE_*` env at build time:
  - `VITE_DEPLOYMENT_PROFILE=fixed-hosted-dataset`
  - `VITE_DATASET_FAMILY=<family>` (e.g. `mapleroyals`)
  - `VITE_DATASET_CHANNEL=latest`
  - `VITE_DATASET_REPO_URL=/datasets` (or an absolute CDN base)
- When `enableUserImport` is false, all import/replace/rebuild/server-profile UI
  is hidden (`apps/web/src/config`).
- On first load with an empty library, `DatasetInstallScreen` resolves the
  channel, downloads + verifies the `.scrolled-dataset` bundle, and restores it
  into OPFS via the existing backup importer. Later visits open from OPFS; the
  site is offline.
- The bundle carries the **full server-profile config inline**
  (`server-profile.json`); the app applies it on install, so the dataset renders
  under its own rates/calculator without the build bundling a matching profile.
  The manifest also declares `serverProfileId`, `calculatorId`, `dataRevision`,
  and `schemaVersion`; the app checks them **before downloading** and refuses
  (with "update the app") if it lacks the calculator or the data is newer than it
  supports. The profile picker UI stays hidden; the dataset decides it.
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

Plus one code contract: the equip stat-range **calculator** is keyed by id, so
the build must register the `calculatorId` the manifest names. (The rest of the
profile — rates, fingerprints — is config and travels in the bundle, so changing
rates only needs a rebuild, not an app release.)

The generated `manifest.json` carries all of these (`dataRevision`,
`schemaVersion`, `serverProfileId`, `calculatorId`), derived from the built
database + profile, so they can't drift from the artifact. `assertDatasetSupported`
checks them **before downloading**; `evaluateBackupImport()` is the backstop on
the data inside the bundle at install/update, both directions:

- Data older than `MINIMUM_SUPPORTED_DATA_REVISION` → blocked.
- Data newer than `CURRENT_DATA_REVISION`, schema beyond `LATEST_SCHEMA_VERSION`,
  or a `calculatorId` the build lacks → blocked with an "update the app" message
  (a cached, older app refuses a dataset built by a newer one rather than risk
  corruption).

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
    latest.json                            # channel -> concrete version
    <version>/
      manifest.json                        # serverProfileId, calculatorId, dataRevision, schemaVersion, artifact{url,sha256,sizeBytes}
      checksums.json
      <id>.scrolled-dataset                # gzip(tar(manifest + game.sqlite3 + server-profile.json))
```

`latest.json` resolves to an immutable version; published versions never change.

## Building a dataset bundle

`pnpm dataset:build` reads the game's WZ files with the same parser/extractors the
app uses and writes the bundle + manifest under Node — no browser, no manual
export. (It runs under `vite-node`; the build pipeline is in
`@scrolled/extractor/builder`.)

```sh
nix develop -c pnpm dataset:build ~/wz \
  --profile mapleroyals --version 2026-06-20 --display-name "MapleRoyals" \
  --out <deployment-repo>/datasets
```

- `--profile` selects a built-in profile (or `--profile-file <json>` for a custom
  one); its full config is embedded in the bundle. `--family` defaults to the
  profile id. The WZ encryption version is auto-detected (`--wz-version` to
  override). A folder of `.img` files works in place of `.wz`.
- Re-running with a new `--version` adds a version and repoints `latest.json`;
  prior immutable versions are left untouched.

## Local testing

`apps/web/public/datasets/` is gitignored and served by Vite at `/datasets`. The
committed `apps/web/.env.fixed` uses `family=local`.

```sh
# 1. Build a local dataset straight from your WZ files into the served folder
nix develop -c pnpm dataset:build ~/wz \
  --profile vanilla-v83 --version 2026-06-20 --display-name "Local Dataset" \
  --family local --out apps/web/public/datasets

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
