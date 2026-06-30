# @scrolled/nav-graph

Framework-agnostic graph core for Scrolled Navigator. See
[`docs/navigator_implementation.md`](../../docs/navigator_implementation.md) for
the design.

## What's in here

- **IR** — the TypeScript intermediate representation of the authored graph
  (`src/ir/`). Branded `NodeId` / `GroupId`, the `TravelEdge` and `Requirement`
  unions, and a Zod schema that mirrors them.
- **DSL** — `defineGraph(...)`, region scopes, and the verb methods (`walk`,
  `portalTo`, `npcTo`, `itemTo`, `skillTo`) authors call on node handles
  (`src/dsl/`). The requirement constructors (`meso`, `item`, `quest`, `level`)
  live here too. The DSL emits `NavGraphSource` — nothing more.
- **Compiler** — `compileGraph(source)` validates the source with Zod, runs the
  pre-merge duplicate pass, expands bidirectional edges, and freezes adjacency
  into a runtime `NavGraph` (`src/compile/`).
- **Pathfinding** — `findPath(graph, from, to, opts?)` is BFS with optional
  per-edge eligibility filtering. When filtering disconnects the destination it
  returns the best unfiltered path with blocking step indices flagged
  (`src/path/`).
- **JSON** — `toJSON(graph)` serializes a compiled graph to the portability
  shape (`src/json/`); `vite-node src/cli/export.ts` runs it from the command
  line.

The package is a leaf: no `@scrolled/*` deps, no React, no SQLite. It runs in
Node and in the browser.

## Releasing to npm

This package is published to npm as `@scrolled/nav-graph` so external
deployment repos (e.g. `scrolled-mapleroyals`) can consume it without cloning
the monorepo.

Authentication uses **npm Trusted Publishers (OIDC)** — no `NPM_TOKEN` secret
lives in this repo. The GitHub Actions OIDC token authenticates directly
against the trust relationship npm has on file for this package + workflow.

**One-time setup:**
1. Register the `@scrolled` scope on [npmjs.com](https://www.npmjs.com/) (or
   rename the package to a scope you own).
2. Reserve the package name. The easiest way is to publish an initial `0.0.0`
   placeholder locally with a classic token, then immediately delete the
   token. (Alternatively: pre-claim the name from npmjs's package settings.)
3. On the package's npmjs page, open *Settings → Trusted Publishers* and add
   a GitHub Actions entry:
   - **Repository:** `RedbackThomson/scrolled`
   - **Workflow filename:** `nav-graph-publish.yml`
   - **Environment:** (leave blank)

   That's it — npm will accept publishes only from this workflow file in this
   repo. No long-lived credentials live anywhere.

**Release flow (pre-1.0 — fast iteration).** The
[publish workflow](../../.github/workflows/nav-graph-publish.yml) runs on
every push to `main` that touches `packages/nav-graph/**` and picks a mode
based on whether `package.json`'s version is already on npm:

| `package.json` version | What ships | npm dist-tag | Pull with |
|---|---|---|---|
| Not yet on npm (you bumped) | The version as-is | `latest` | `npm i @scrolled/nav-graph` |
| Already on npm (unchanged) | `<version>-dev.<sha7>` | `dev` | `npm i @scrolled/nav-graph@dev` |

So the day-to-day loop is just: edit code, commit, push. Each push gets a
unique `0.1.0-dev.<sha7>` build under the `dev` tag — pullable immediately,
pinnable by full version, never overwritten. When you're ready to cut a
stable release, bump the version in `package.json` to a value that isn't on
npm yet, push, and that publishes to `latest`.

Either mode runs typecheck + tests + `tsc` build, then `npm publish
--provenance`. The OIDC handshake happens inside the npm CLI; the tarball
gets a Sigstore-signed provenance attestation that shows on the package
page.

**Dry-run a build without publishing:** trigger the workflow manually from
the Actions tab with `dry_run: true`. It uploads the packed tarball as an
artifact so you can inspect it before flipping the toggle off.

The published tarball contains only `dist/` (compiled JS + .d.ts +
sourcemaps), `LICENSE`, and `README.md`. `main`/`types`/`exports` in
`package.json` point directly at `dist/`; running tests or the export CLI
inside this monorepo works without consulting the exports field (Vitest and
the CLI use relative imports), so the dist-only exports don't get in the way
of source-tree dev.
