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
(this repo, public)                 packages your dataset, builds, and publishes
                                    to your-server.example.com
                                          ▲
                                          │ uploaded when the game data changes
                                    your .scrolled-backup (object storage / LFS)
```

Three moving parts, only **one of which is manual**:

| Part                                          | How often                  | Automated?          |
| --------------------------------------------- | -------------------------- | ------------------- |
| Export a dataset artifact from the game files | when **game data** changes | ❌ manual (browser) |
| Package + build + publish the site            | every change               | ✅ CI               |
| Pull a newer **app** version                  | when you choose to update  | ✅ CI (bump a pin)  |

The manual export is inherent: the app builds its database in the browser, so a
human with the game files produces the artifact once per data update. Everything
else is CI.

---

## Prerequisites

- A **deployment repository** you control (holds CI config + published output).
- Somewhere to store the `.scrolled-backup` artifact that CI can read — object
  storage (Cloudflare R2 / S3) with CI credentials, a GitHub Release asset, or
  Git LFS. **Not** plain git (it's ~100 MB+) and **never** the public `scrolled`
  repo.
- A static host. GitHub Pages works and is assumed in the examples; any static
  host does.
- Node 22+ in CI (`dataset:build` runs TypeScript via `--experimental-strip-types`).

---

## Step 1 — Produce a dataset artifact (manual, on game-data updates)

Do this once whenever the game's data changes. It needs the game files and a
browser.

1. Run the **generic** app (hosted `scrolled.dev` or a local `pnpm dev`).
2. Import the new game files and let it build the library.
3. **Settings → Import & Export → Export backup → "Game data only."** This saves
   `scrolled-game-<date>.scrolled-backup` — a gzip container holding the game
   database plus its schema/data-revision contract.
4. Upload that file to your artifact storage (or attach it to a deploy-repo
   release). This is the input CI consumes.

> Export **"Game data only"**, not "Everything" — a shared dataset must not carry
> anyone's personal collections.

---

## Step 2 — Package it into a dataset repository (CI)

`pnpm dataset:build` turns the backup into the static layout the app installs
from. It's fully parameterized — point it at your storage and your output dir:

```bash
pnpm dataset:build \
  --input ./data/game.scrolled-backup \
  --out ./scrolled/apps/web/public/datasets \
  --family your-server \
  --version 2026-06-01 \
  --display-name "Your Server"
```

Produces:

```
datasets/your-server/latest.json                      # channel -> concrete version
datasets/your-server/2026-06-01/manifest.json         # id, version, displayName, artifact{url,sha256,sizeBytes}
datasets/your-server/2026-06-01/checksums.json
datasets/your-server/2026-06-01/game.scrolled-backup  # copy of the artifact
```

- `--version` should be immutable (a date or content hash). Re-running with a new
  `--version` **adds** a version and repoints `latest.json`; published versions
  are never rewritten.
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

      - name: Fetch dataset artifact # from object storage / release — keep it out of logs
        run: |
          mkdir -p data
          aws s3 cp "s3://$BUCKET/game.scrolled-backup" data/game.scrolled-backup
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          BUCKET: ${{ secrets.DATASET_BUCKET }}

      - name: Package dataset
        working-directory: scrolled
        run: |
          pnpm dataset:build \
            --input ../data/game.scrolled-backup \
            --out apps/web/public/datasets \
            --family "$DATASET_FAMILY" \
            --version "$DATASET_VERSION" \
            --display-name "$DATASET_DISPLAY_NAME"

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

You don't have to re-export the dataset on every app update. Whether the existing
dataset survives an app bump depends on the compatibility rules below — and the
app enforces them at runtime regardless, so a mismatch is **safe, never
corrupting**.

---

## Version compatibility (the sync contract)

The dataset is a database export, so it carries two version contracts that must
match the app build that opens it (see [CLAUDE.md](CLAUDE.md) → schema vs. data
revisions):

- **schema version** (`_migrations`) — the app migrates an older schema up, never
  down.
- **data revision** (`app_meta.data_revision`) — the data contract the app
  understands; readable down to `MINIMUM_SUPPORTED_DATA_REVISION`.

Both ride inside the artifact, and the app checks them on install/update
(`evaluateBackupImport`). A dataset newer than the app, or older than the app can
read, is **refused with an "update the app" message** instead of loading corrupt
data. So the worst case is a clear prompt, not a broken wiki.

What that means per change:

| Change                                                                                   | Existing dataset still works?    | What to do                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| App patch, no data-revision change                                                       | ✅ Yes                           | Bump the pin, rebuild — done                                                |
| App update, **additive** data-revision bump                                              | ✅ Yes (new fields render blank) | Rebuild now; refresh the dataset later if you want the new fields populated |
| App update, **breaking** bump (`MINIMUM_SUPPORTED_DATA_REVISION` rises past the dataset) | ❌ No (app refuses)              | Re-export the dataset from the new app build (Step 1), then publish         |
| Game data update                                                                         | n/a (new content)                | Re-export (Step 1), publish a new `--version`                               |

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

1. Export "Game data only" from the generic app (Step 1).
2. Upload the backup to storage (fires the publish workflow, or run it manually).
3. CI packages a new `--version`, repoints `latest`, rebuilds, deploys.
4. Returning visitors get a "newer dataset available" prompt; new visitors get it
   on first load.

**App version changed:**

1. Merge the watcher's `SCROLLED_REF` bump (or bump it by hand).
2. CI rebuilds against the new app. If the build's data revision still accepts the
   current dataset, you're done.
3. If it's a breaking bump, the smoke test / runtime guard flags it — re-export
   the dataset (Step 1) and publish both together.

---

## Rollback

Published versions are immutable, so rollback is just repointing:

- **Dataset:** edit `latest.json` back to a previous version directory and
  redeploy (or re-run publish with the older `--version`).
- **App:** set `SCROLLED_REF` back to the previous release and re-run publish.

Because each deployment is its own repo + host, removing it (delete the repo /
DNS) never affects the generic `scrolled.dev`.

---

## Reference

- Build env: `VITE_DEPLOYMENT_PROFILE`, `VITE_DATASET_FAMILY`,
  `VITE_DATASET_CHANNEL`, `VITE_DATASET_REPO_URL` (+ the usual `BASE_PATH`,
  `VITE_SITE_URL`).
- Commands: `pnpm dataset:build …`, `pnpm --filter @scrolled/web build:fixed`,
  and `pnpm --filter @scrolled/web dev:fixed` for local testing.
- Local testing walkthrough and architecture:
  [`docs/fixed_dataset_deployment.md`](docs/fixed_dataset_deployment.md).
