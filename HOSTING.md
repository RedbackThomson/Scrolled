# Hosting a fixed-dataset deployment

This guide is for developers who want to publish a **prebuilt** version of the
app — a site that ships a ready-made library (e.g. a specific server's data) that
visitors download and use offline, with no file import. Think
`scrolled.dev` (generic, bring-your-own-files) vs. a `your-server.scrolled.dev`
(fixed dataset).

For the architecture behind this, see
[`docs/fixed_dataset_deployment.md`](docs/fixed_dataset_deployment.md). This
document is the operational runbook, optimized for running through CI.

---

## The shape of it

```
RedbackThomson/scrolled            your-org/your-deploy   (private or public)
─────────────────────────          ──────────────────────────────────────────
app source + build tooling   --->  CI checks out scrolled @ a pinned version,
(this repo, public)                 builds your dataset from the WZ files, builds
                                    the site, and publishes to your-server.example.com
                                          ▲
                                          │ uploaded when the game data changes
                                    your game's .wz files (object storage / LFS)
```

Three moving parts, and CI does **all** of them:

| Part                                     | How often                  | Automated?              |
| ---------------------------------------- | -------------------------- | ----------------------- |
| Build a dataset bundle from the WZ files | when **game data** changes | ✅ CI (`dataset:build`) |
| Package + build + publish the site       | every change               | ✅ CI                   |
| Pull a newer **app** version             | when you choose to update  | ✅ CI (bump a pin)      |

The dataset build is headless now — `dataset:build` reads the WZ files with the
same parser/extractors the app uses and writes a SQLite-backed bundle under
Node, no browser. The only human input is uploading the game's WZ files when the
game data itself changes.

---

## Prerequisites

- A **deployment repository** you control (holds CI config + published output).
- Somewhere to store the game's **WZ files** that CI can read — object storage
  (Cloudflare R2 / S3) with CI credentials, a GitHub Release asset, or Git LFS.
  **Not** plain git (they're ~100 MB+) and **never** the public `scrolled` repo.
  (A folder of `.img` files works too; the build auto-detects WZ vs IMG.)
- A static host. GitHub Pages works and is assumed in the examples; any static
  host does.
- Node 22+ in CI (`dataset:build` runs under `vite-node`).

---

## Step 1 — Make the game's WZ files available to CI (on game-data updates)

Do this once whenever the game's data changes. There's no browser step: CI builds
the dataset straight from the WZ files.

1. Gather the game's WZ files. The build reads only the ones it needs —
   `String`, `Item`, `Character`, `Mob`, `Npc`, `Map`, `Quest`, `Skill` (`.wz`).
   A folder tree of extracted `.img` files works too.
2. Upload them to your artifact storage (object storage, a deploy-repo release,
   or Git LFS). This directory is the input CI consumes.

> These are the game's own files. They are **never** committed to `scrolled` or
> any public repo — keep them in private storage. The build output (a derived
> SQLite bundle) is what gets published, not the WZ files.

---

## Step 2 — Build the dataset bundle (CI)

`pnpm dataset:build` reads the WZ files and writes the static layout the app
installs from — a self-contained `.scrolled-dataset` bundle plus a generated
manifest. Point it at your WZ directory and your output dir:

```bash
pnpm dataset:build ./data/wz \
  --profile your-server \
  --version 2026-06-01 \
  --display-name "Your Server" \
  --out ./scrolled/apps/web/public/datasets
```

Produces:

```
datasets/your-server/latest.json                              # channel -> concrete version
datasets/your-server/2026-06-01/manifest.json                 # generated: serverProfileId, calculatorId, dataRevision, schemaVersion, artifact{url,sha256,sizeBytes}
datasets/your-server/2026-06-01/checksums.json
datasets/your-server/2026-06-01/your-server-2026-06-01.scrolled-dataset   # gzip(tar(manifest + game.sqlite3)); the server profile is baked into game.sqlite3
```

- `--version` should be immutable (a date or content hash). Re-running with a new
  `--version` **adds** a version and repoints `latest.json`; published versions
  are never rewritten.
- A profile is **required**, and you give it one of two ways:
  - `--profile-file <path>` — a JSON profile file you keep **in your deployment
    repo** (validated against the profile schema). This is the normal path: a
    deployment owns its own profile, and `scrolled` ships no server-specific
    profiles.
  - `--profile <id>` — a profile the build ships built-in (the baseline
    `vanilla-v83` and a small curated set); use this for a generic build.

  Either way the profile names the rules (EXP rate, equip stat-range calculator)
  the data renders under, and `dataset:build` **bakes the full profile config
  into the dataset's own game DB**. It travels *as* the dataset — so a server can
  change its rates by rebuilding, no app release needed, and nothing is applied
  as local install state. The app only needs to ship the **calculator** the
  profile names (code keyed by id); a brand-new calculator still needs an app
  release.
- `--family` defaults to the profile id; pass it to host several datasets under
  one name. The WZ encryption version is auto-detected (override with
  `--wz-version` if detection is inconclusive).
- Writing into `apps/web/public/datasets` means the next site build copies the
  tree into the output automatically.

---

## Step 3 — Build and publish the site (CI)

The app build is selected by environment, so CI sets the deployment config and
runs `build:fixed`:

```bash
VITE_DEPLOYMENT_PROFILE=fixed-hosted-dataset \
VITE_DATASET_FAMILY=your-server \
VITE_DATASET_CHANNEL=latest \
VITE_DATASET_REPO_URL=/datasets \
pnpm --filter @scrolled/web build:fixed     # -> apps/web/dist-fixed
```

Real env values override the committed `.env.fixed` defaults (which use
`family=local` for local testing). Then publish `apps/web/dist-fixed`.

### Example workflow (deployment repo) — publish

Lives in **your deployment repo**, not in `scrolled`. It checks out `scrolled` at
a pinned version, fetches your backup, packages, builds, and deploys to Pages.

```yaml
name: Publish fixed dataset site
on:
  workflow_dispatch: # run by hand, or...
  repository_dispatch: # ...triggered when a new backup is uploaded
    types: [dataset-updated]

permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: false }

env:
  SCROLLED_REF: v1.4.0 # the app version this deployment is pinned to
  DATASET_FAMILY: your-server
  DATASET_VERSION: '2026-06-01'
  DATASET_DISPLAY_NAME: Your Server
  # The server profile lives in this deployment repo (server-profile.json); the
  # build bakes it in. Only its calculator id must exist in SCROLLED_REF.

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out scrolled (pinned)
        uses: actions/checkout@v4
        with:
          repository: RedbackThomson/scrolled
          ref: ${{ env.SCROLLED_REF }}
          path: scrolled

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: scrolled/.nvmrc
          cache: pnpm
          cache-dependency-path: scrolled/pnpm-lock.yaml

      - name: Install
        working-directory: scrolled
        run: pnpm install --frozen-lockfile

      - name: Fetch WZ files # from object storage / release — keep them out of logs
        run: |
          mkdir -p data/wz
          aws s3 sync "s3://$BUCKET/wz" data/wz
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          BUCKET: ${{ secrets.DATASET_BUCKET }}

      - name: Build dataset bundle
        working-directory: scrolled
        # Absolute paths: `dataset:build` runs from the @scrolled/extractor
        # package dir, so relative paths resolve against it, not this step's cwd.
        run: |
          pnpm dataset:build "$GITHUB_WORKSPACE/data/wz" \
            --profile-file "$GITHUB_WORKSPACE/server-profile.json" \
            --version "$DATASET_VERSION" \
            --display-name "$DATASET_DISPLAY_NAME" \
            --family "$DATASET_FAMILY" \
            --out "$GITHUB_WORKSPACE/scrolled/apps/web/public/datasets"

      - name: Build site
        working-directory: scrolled
        env:
          VITE_DEPLOYMENT_PROFILE: fixed-hosted-dataset
          VITE_DATASET_FAMILY: ${{ env.DATASET_FAMILY }}
          VITE_DATASET_CHANNEL: latest
          VITE_DATASET_REPO_URL: /datasets
          VITE_SITE_URL: ${{ vars.SITE_URL }} # e.g. https://your-server.scrolled.dev
        run: pnpm --filter @scrolled/web build:fixed

      - name: SPA fallback
        run: cp scrolled/apps/web/dist-fixed/index.html scrolled/apps/web/dist-fixed/404.html

      - uses: actions/upload-pages-artifact@v3
        with: { path: scrolled/apps/web/dist-fixed }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@v4
```

Notes:

- **Base path:** a custom subdomain serves at the root, so `/datasets` and the
  default base are correct. If you host under a sub-path
  (`user.github.io/repo/`), set `BASE_PATH=/repo/` and
  `VITE_DATASET_REPO_URL=/repo/datasets` so both line up.
- Trigger the `dataset-updated` event from your storage upload step (a
  `repository_dispatch` API call) so a new backup auto-publishes.

---

## Keeping in sync with the latest app version

The deployment is **pinned** to a `scrolled` version (`SCROLLED_REF` above).
Updating the app = bumping that pin and re-running the publish workflow.

Automate it with a scheduled watcher in the deployment repo that opens a PR when
`scrolled` cuts a newer release:

```yaml
name: Watch for app updates
on:
  schedule: [{ cron: '0 7 * * 1' }]   # weekly
  workflow_dispatch:
jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Bump SCROLLED_REF to the latest release
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
        run: |
          latest=$(gh release view --repo RedbackThomson/scrolled --json tagName -q .tagName)
          # update SCROLLED_REF in the publish workflow, then open a PR
          # (sed/yq the value, git checkout -b, gh pr create …)
```

Merging the PR triggers a rebuild against the new app version. **Pin
deliberately** rather than tracking a moving branch — a release is a known-good
app/data contract; `main` is not.

You don't have to rebuild the dataset on every app update. Whether the existing
dataset survives an app bump depends on the compatibility rules below — and the
app enforces them at runtime regardless, so a mismatch is **safe, never
corrupting**.

---

## Version compatibility (the sync contract)

The dataset is a database export, so it carries contracts that must match the app
build that opens it (see [CLAUDE.md](CLAUDE.md) → schema vs. data revisions):

- **schema version** (`_migrations`) — the app migrates an older schema up, never
  down.
- **data revision** (`app_meta.data_revision`) — the data contract the app
  understands; readable down to `MINIMUM_SUPPORTED_DATA_REVISION`.
- **stat calculator** (`calculatorId` in the manifest) — the equip stat-range
  algorithm is code keyed by id, so the build must register that calculator. The
  server profile _config_ (rates, fingerprints) is baked into the bundle's game
  DB at build, so only a brand-new calculator needs an app release.

The manifest carries all four (`dataRevision`, `schemaVersion`, `serverProfileId`,
`calculatorId`) and is checked **before downloading**; `evaluateBackupImport` is
the backstop on the data inside the bundle at install/update. A dataset newer than
the app, older than the app can read, or naming a **calculator** the build doesn't
ship is **refused with an "update the app" message** instead of loading wrong or
corrupt data. (The `serverProfileId` is *not* gated — the profile config travels
in the bundle, so a build can install a dataset whose profile id it's never seen.)
So the worst case is a clear prompt, not a broken wiki.

What that means per change:

| Change                                                                                   | Existing dataset still works?    | What to do                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| App patch, no data-revision change                                                       | ✅ Yes                           | Bump the pin, rebuild — done                                                |
| App update, **additive** data-revision bump                                              | ✅ Yes (new fields render blank) | Rebuild now; refresh the dataset later if you want the new fields populated |
| App update, **breaking** bump (`MINIMUM_SUPPORTED_DATA_REVISION` rises past the dataset) | ❌ No (app refuses)              | Rebuild the dataset from the WZ files on the new app build, then publish    |
| App update drops the dataset's stat **calculator**                                       | ❌ No (app refuses)              | Restore the calculator in `scrolled`, or repin to a build that has it       |
| Server changes its rates (same game data)                                                | ✅ Yes (config is in the bundle) | Rebuild with the updated profile; no app release needed                     |
| Game data update                                                                         | n/a (new content)                | Rebuild from the new WZ files, publish a new `--version`                    |

**Recommended CI gate:** after building, run a quick headless smoke test — serve
`dist-fixed`, load it in a headless browser, and assert the library installs.
This catches an incompatible pairing in CI instead of in front of users. (The
runtime guard is the safety net; the smoke test is the early warning.)

**Operational rule:** when an app update needs a fresh dataset, publish them
**together** — flip `latest.json` in the same deploy that ships the new app. The
canonical site then never serves a mismatched pair, and the runtime guard only
ever covers the brief service-worker cache window.

---

## Update checklists

**Game data changed (new server content):**

1. Upload the new WZ files to storage (Step 1) — fires the publish workflow, or
   run it manually.
2. CI builds a new `--version`, repoints `latest`, rebuilds the site, deploys.
3. Returning visitors get a "newer dataset available" prompt; new visitors get it
   on first load.

**App version changed:**

1. Merge the watcher's `SCROLLED_REF` bump (or bump it by hand).
2. CI rebuilds against the new app. If the build's data revision still accepts the
   current dataset, you're done.
3. If it's a breaking bump, the smoke test / runtime guard flags it — rebuild the
   dataset from the WZ files (Step 1) and publish both together.

---

## Rollback

Published versions are immutable, so rollback is just repointing:

- **Dataset:** edit `latest.json` back to a previous version directory and
  redeploy (or re-run publish with the older `--version`).
- **App:** set `SCROLLED_REF` back to the previous release and re-run publish.

Because each deployment is its own repo + host, removing it (delete the repo /
DNS) never affects the generic `scrolled.dev`.

---

## Enabling cloud accounts (optional)

Accounts are **opt-in and orthogonal** to the dataset profile — a generic or a
fixed-dataset deployment can enable them, and a deployment that doesn't set the
env below is unchanged: no sign-in UI, and the auth SDK is never even emitted
into the bundle. There is no feature that requires being signed in; the core app
works identically whether or not accounts are configured. (Sign-in enables
optional cross-device sync — see below — which is itself off unless turned on.)

The first identity backend is [Supabase](https://supabase.com) with OAuth social
login. The app talks to it only through a provider-agnostic interface, so other
backends can be added later without touching the app.

**1. Create a Supabase project** and, under Authentication → Providers, enable the
OAuth provider(s) you want (e.g. Google). Under Authentication → URL
Configuration, add your site's callback to the allowed redirect URLs:

```
https://your-site.example.com/auth/callback
```

**2. Build the site with the cloud identity env** (combine with whatever dataset
env you already use):

```bash
VITE_IDENTITY_MODE=cloud \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<...> \
VITE_SUPABASE_OAUTH_PROVIDERS=google \
pnpm --filter @scrolled/web build      # or build:fixed for a fixed-dataset site
```

- `VITE_IDENTITY_MODE=cloud` is the switch. Any other value (or unset) → anonymous
  baseline, and the Supabase SDK is dropped from the build at compile time.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` come from the project's API
  settings. The publishable key (`sb_publishable_…`) is a public client key —
  safe to ship in the bundle (Row Level Security, not key secrecy, guards your
  data). It replaces the legacy `anon` key; if your project predates the new
  keys, set `VITE_SUPABASE_ANON_KEY` instead — it's accepted as a fallback until
  Supabase retires it at the end of 2026.
- `VITE_SUPABASE_OAUTH_PROVIDERS` is a comma-separated list of provider ids the
  sign-in screen offers (defaults to `google`). They must match the providers
  enabled in the project.
- A cloud build missing the URL or a key **fails loudly** rather than shipping a
  site whose sign-in can't work.

What turning it on adds: a sign-in button + account menu in the top bar, an
Account section in Settings, `/sign-in` and `/auth/callback` routes, and command
palette entries — all gated, so they're absent when accounts are off.

### Cross-device sync (optional, requires cloud identity)

Signed-in users can mirror their collections, pinned searches, and preferences
across devices. Sync is **off by default** and **layered on top of cloud
identity** — there's no account to scope synced data to otherwise. Self-hosted
and sync-off builds ship zero sync-transport or Supabase-SDK code (the adapter is
dead-code-eliminated at compile time), and the app stays fully usable offline and
signed-out — sync is purely additive.

**1. Provision the backend.** Apply the SQL in [`supabase/`](supabase/) to your
Supabase project (`supabase db push`, or paste it into the SQL editor). The
migrations create the change log, the push/pull RPC functions, Row Level
Security, the realtime Broadcast doorbell (for sub-second propagation — enable
the project's Realtime feature), and the change-log GC. See
[`supabase/README.md`](supabase/README.md). Schedule the GC to run periodically
(e.g. `select cron.schedule('sync-gc-daily', '17 3 * * *', $$select public.sync_gc(90)$$);`
once `pg_cron` is enabled) so delete-tombstones don't accumulate forever.

**2. Build with sync turned on** (on top of the cloud identity env above):

```bash
VITE_IDENTITY_MODE=cloud \
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<...> \
VITE_SYNC_MODE=supabase \
pnpm --filter @scrolled/web build
```

- `VITE_SYNC_MODE=supabase` is the switch; any other value (or unset) → no sync,
  and the sync transport is dropped from the build. It reuses the cloud
  identity's Supabase project, so no extra URL/key is needed.
- A build that sets `VITE_SYNC_MODE=supabase` **without** `VITE_IDENTITY_MODE=cloud`
  **fails loudly** — sync has no account to scope data to.

---

## Reference

- Build env: `VITE_DEPLOYMENT_PROFILE`, `VITE_DATASET_FAMILY`,
  `VITE_DATASET_CHANNEL`, `VITE_DATASET_REPO_URL` (+ the usual `BASE_PATH`,
  `VITE_SITE_URL`). Optional cloud accounts: `VITE_IDENTITY_MODE`,
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or legacy
  `VITE_SUPABASE_ANON_KEY`), `VITE_SUPABASE_OAUTH_PROVIDERS`. Optional
  cross-device sync (requires cloud identity): `VITE_SYNC_MODE=supabase` plus the
  SQL in `supabase/`.
- Commands: `pnpm dataset:build …`, `pnpm --filter @scrolled/web build:fixed`,
  and `pnpm --filter @scrolled/web dev:fixed` for local testing.
- Local testing walkthrough and architecture:
  [`docs/fixed_dataset_deployment.md`](docs/fixed_dataset_deployment.md).
