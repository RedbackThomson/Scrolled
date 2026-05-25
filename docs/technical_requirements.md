# Mushroom Explorer — Technical Requirements

Companion document to `mapleroyals_wiki_clone_requirements.md`. This document commits to a concrete tech stack, design language, and phased implementation order. Where the MVP doc describes _what_ to build and _why_, this doc describes _how_.

## 1. Guiding principles

1. **Local-first.** No remote services participate in parsing or storage. The app runs in the user's browser; the only network traffic is fetching the app itself.
2. **Ship code only.** The repository never contains proprietary game data — not even as test fixtures. Tests use synthetic raw-tree fixtures.
3. **Browser-first, portable.** The MVP targets the browser, but the parser and storage layers are isolated behind interfaces so a Tauri or local Node server backend can be swapped in later without touching the UI.
4. **Open-source from day one.** LICENSE, legal notices, public README, and CI exist before Milestone 0 closes.
5. **Boring choices.** Standard wiki patterns, mainstream libraries, conventional folder layout. Novelty is reserved for the WZ parsing problem itself.

## 2. Tech stack

### 2.1 Language and tooling

| Concern         | Choice                            | Why                                                                                    |
| --------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Language        | TypeScript (strict)               | Type safety across the parser → DB → UI boundary.                                      |
| Runtime         | Node 20+                          | Modern fetch/streams, native test runner where useful.                                 |
| Package manager | pnpm with workspaces              | Disk-efficient; workspaces let us add a CLI/Tauri package later without restructuring. |
| Bundler         | Vite (React+TS template)          | Fast HMR; first-class Web Worker + WASM support; no SSR overhead we don't need.        |
| Linting         | ESLint + `@typescript-eslint`     | Standard.                                                                              |
| Formatting      | Prettier                          | Zero-config.                                                                           |
| Git hooks       | husky + lint-staged               | Pre-commit format + lint on changed files.                                             |
| Unit tests      | Vitest                            | Shares Vite's config and ESM handling.                                                 |
| E2E tests       | Playwright (deferred to post-MVP) | Avoid the maintenance cost until UX stabilizes.                                        |
| CI              | GitHub Actions                    | Typecheck + lint + unit tests on every PR.                                             |

### 2.2 UI

| Concern              | Choice                                      | Why                                                                                                                |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Framework            | React 18+                                   | Largest ecosystem for wiki/data UI patterns.                                                                       |
| Routing              | React Router v6 (`createBrowserRouter`)     | Familiar, well-documented. TanStack Router considered but deferred unless type-safety pressure justifies the swap. |
| Styling              | Tailwind CSS v3, `class` dark-mode strategy | Utility-first; pairs with shadcn/ui.                                                                               |
| Component primitives | shadcn/ui (Radix-based)                     | Components copied into the repo — no runtime version lock-in, full control over markup.                            |
| Icons                | Lucide                                      | Matches shadcn's defaults.                                                                                         |
| Design tokens        | CSS variables in `:root` / `.dark`          | A future game-nostalgic theme is a token swap, not a rewrite.                                                      |

### 2.3 State and data

| Concern         | Choice                           | Why                                                                                          |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Async cache     | TanStack Query                   | Caching, retries, and request deduplication for parsing and DB queries.                      |
| Global UI state | Zustand                          | Small, unopinionated, no provider boilerplate. Used for current dataset, theme, load status. |
| Form state      | React Hook Form (only if needed) | Defer unless a form materially exceeds a few inputs.                                         |
| Validation      | Zod                              | Runtime validation at the parser → domain boundary. Schemas double as TS types.              |

Redux is explicitly out of scope.

### 2.4 WZ parsing

- **Primary parser**: [`@tybys/wz`](https://www.npmjs.com/package/@tybys/wz) — TypeScript-friendly, browser-oriented WZ reader. **Phase 1 verdict: go.** Validated against real MapleRoyals client files; resolves Red Potion (ID 2000000) end-to-end through the worker pipeline.
- **Encryption version**: `WzMapleVersion.GMS` for the v83-era MapleRoyals client. The name is misleading — it's the "old Global MapleStory" encryption scheme. `BMS` opens the files but produces garbled names; treat that as the canary for a wrong version.
- **Worker isolation**: [`comlink`](https://www.npmjs.com/package/comlink) so the main thread never blocks on parsing. Browser uses a Vite-bundled Worker; the same `WzDataSource` class runs directly in Node for Vitest integration tests.
- **WASM bootstrap**: the library ships a small `wz.wasm` (crypto). In the browser we resolve its URL with Vite's `?url` import and pass that URL via `init({ locateFile })`. In Node, `init()` is a no-op and native crypto is used.
- **Lazy image parsing**: `WzImage.parseImage()` must be awaited before reading properties. The path resolver in `WzDataSource` calls it on demand as it traverses.
- **Reference correctness**: MapleLib / HaRepacker-resurrected used as an out-of-band oracle. Not a runtime dependency.
- **Fallback (not needed)**: A MapleLib-based local CLI importer that emits a SQLite file the frontend consumes. Held in reserve in case future client versions break the JS parser.

### 2.5 Storage

| Concern     | Choice                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Engine      | [`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) (official build), run in a Worker  |
| Persistence | OPFS-backed VFS where available; IndexedDB blob fallback elsewhere                                                    |
| Migrations  | Hand-rolled, versioned files under `apps/web/src/db/migrations/`                                                      |
| Query layer | Drizzle ORM (spike during Phase 2; fall back to hand-written SQL if integration friction outweighs the type benefits) |
| Small KV    | `idb-keyval` for things like "last loaded dataset id" and theme preference                                            |

Schema and join-table inventory follow §8.4 of the MVP doc.

### 2.6 Search

- **MiniSearch** for full-text + fuzzy across items, equips, mobs, NPCs, maps, quests.
- Index lives in memory after build; serialized form persisted via `idb-keyval` and rehydrated on startup.

### 2.7 Other

- Asset decoding pipeline: `URL.createObjectURL` for sprites, LRU memoization for decoded thumbnails, IndexedDB cache for repeat sessions, explicit "clear cache" control.
- **Pageview analytics — narrow carve-out from local-first.** The canonical hosted deployment loads an external pageview-analytics beacon (currently Cloudflare Web Analytics). Every other deployment, including local dev and forks, ships with no analytics. Constraints:
  - **Swappable provider.** Implementation lives in `apps/web/src/lib/analytics/` behind an `AnalyticsProvider` interface so the vendor can be replaced without touching call sites.
  - **Build-time gate.** Activated only when `VITE_ANALYTICS_PROVIDER`, `VITE_ANALYTICS_TOKEN`, and `VITE_ANALYTICS_ALLOWED_HOSTS` are all set at build time. When unset (default), the analytics module is a no-op and tree-shakes out.
  - **Runtime host gate.** Even with the env vars set, the beacon is only loaded when `window.location.hostname` matches the allowlist. A fork that somehow inherits the env vars still won't ship traffic to the upstream account.
  - **Privacy signals respected.** Skip the beacon when `navigator.doNotTrack === '1'` or `navigator.globalPrivacyControl === true`.
  - **Opt-out.** A Settings toggle writes `mushex.analytics.optout=1` to localStorage; the beacon is skipped when present.
  - **No identifiers, no events.** Pageviews only. No user IDs, no entity IDs in URLs sent as custom events, no fingerprinting. Whatever the provider's URL-tracking does is the only signal we collect.
  - **Ad-blocker tolerant.** The beacon must be blockable by uBlock Origin and similar without breaking the app. No fallback proxying.
- No telemetry beyond the pageview carve-out above. No remote error reporting, no usage analytics, no remote logging of game data or user actions.
- PWA / offline: [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) with Workbox's `generateSW`. Precaches the full build output (including `.wasm` for sqlite-wasm) so the app loads and runs with no network once installed. Generates the web app manifest for installability. Updates are surfaced via a user-driven "reload to update" prompt rather than silent activation.

## 3. Design language

### 3.1 Layout

- **Persistent left sidebar** with nested navigation: Items, Equips, Mobs, NPCs, Maps, Quests — each expands to subcategories (e.g. Items → Use, Setup, Etc, Cash).
- **Top bar** with global search input and Cmd/Ctrl+K command palette trigger.
- **Main content area** to the right.
- **Detail pages** follow the MediaWiki convention: infobox on the right rail (ID, icon, key stats), main body on the left (description, related entities, cross-links).

### 3.2 Visual

- **Themes**: light and dark, via Tailwind's `class` strategy, defaulting to system preference. Persisted per user.
- **Palette**: neutral slate/zinc tokens. No proprietary game branding.
- **Typography**: system font stack + Inter for UI text; JetBrains Mono for IDs and inline code.
- **Density**: medium-default with an optional compact mode for power users (toggle in settings).
- **Iconography**: Lucide throughout.

### 3.3 Behavior

- **Keyboard-first**: Cmd/Ctrl+K opens command palette; `/` focuses the search bar; arrow keys navigate result lists.
- **Accessibility**: WCAG AA contrast in both themes; Radix primitives handle the heavy lifting on focus management and ARIA roles.
- **Responsive**: desktop-first. Tablet and mobile remain usable but are not the primary target — sidebar collapses to a sheet on narrow viewports.
- **Loading**: granular progress UI during parsing (file → tree → extracted → indexed). Never show a blocking spinner without context.

## 4. Architecture

### 4.1 Layered pipeline

```
File picker / drag-drop
     │
     ▼
File loader (browser File API)
     │
     ▼
Parser worker (comlink) — @tybys/wz
     │
     ▼
RawWzTree (in-memory, scoped to parsing session)
     │
     ▼
Domain extractors (extractItems, extractMobs, …)
     │
     ▼
Normalized records (zod-validated)
     │
     ▼
SQLite (WASM, OPFS) — canonical extracted store
     │
     ▼
TanStack Query (read API)
     │
     ▼
React routes / components / MiniSearch
```

### 4.2 Boundary contracts

- **`parser/`** exposes `GameDataSource` and a `RawWzTree`. Knows nothing about React or SQLite. Adheres to the interfaces from §8.2 of the MVP doc.
- **`extractors/`** consumes a `RawWzTree`, produces normalized domain records. Pure functions where practical.
- **`db/`** owns schema, migrations, and query helpers. Hides whether the underlying engine is sqlite-wasm or something else.
- **`routes/` and `components/`** only depend on `db/` and `search/`. Never import from `parser/` or `extractors/`.

This is the portability seam: a future Tauri or local-server backend replaces `parser/` and the `db/` adapter; the UI is untouched.

### 4.3 Workers

- One **parser worker** owns `@tybys/wz` and the extraction pipeline.
- One **db worker** owns sqlite-wasm and OPFS.
- One **hash worker** owns `crypto.subtle.digest` for WZ-file fingerprinting in the first-run wizard. Reads each File once via `arrayBuffer()` (no JS-side chunk coalescing) and queues calls so concurrent drops run sequentially.
- All workers are addressed via `comlink` proxies. Cross-worker traffic uses transferable byte buffers where size warrants it.

## 5. Repository layout

```
/
  package.json
  pnpm-workspace.yaml
  /apps
    /web                       # the Vite app
      /src
        /parser                # GameDataSource, WzDataSource, ImgFolderDataSource (later)
        /extractors            # extractItems.ts, extractEquips.ts, ...
        /db
          schema.ts
          /migrations
          sqlite.ts
          persistence.ts
        /search
          buildSearchIndex.ts
        /workers
          parseWorker.ts
          dbWorker.ts
        /routes                # one folder per top-level route
        /components            # shared UI primitives (mostly shadcn-generated)
        /lib                   # small utilities, hooks
        /styles                # tailwind.css, design tokens
      /public
        empty-placeholder-assets-only.txt
      index.html
      vite.config.ts
  /docs
    mapleroyals_wiki_clone_requirements.md
    technical_requirements.md  ← this doc
    input-files.md
    legal-notes.md
    data-model.md
    parser-notes.md
  README.md
  LICENSE
  .github/
    workflows/ci.yml
    ISSUE_TEMPLATE/
```

The single-package-now / workspace-ready layout means adding a CLI importer or a Tauri shell later is purely additive — `/apps/cli`, `/apps/desktop`.

## 6. Coding standards

- Strict TypeScript. `any` is only acceptable at FFI boundaries with an inline justification comment.
- Path aliases: `@/parser`, `@/extractors`, `@/db`, `@/search`, `@/routes`, `@/components`, `@/lib`.
- Named exports by default. One default export per route component (for React Router lazy loading).
- Zod schemas live alongside the type they validate; the inferred type is the public export.
- No comments that describe _what_ the code does. Comments only for non-obvious _why_.
- Tests colocated as `*.test.ts` next to the code they cover.

## 7. Phased implementation plan

Each phase maps to a milestone in the MVP doc where applicable. Phases ship in order; each closes with a tagged commit and an updated CHANGELOG entry.

### Phase 0 — Scaffold _(new)_

- Vite + React + TS + Tailwind + shadcn/ui scaffolded under `apps/web/`.
- ESLint, Prettier, husky, lint-staged, GitHub Actions CI (typecheck + lint + test).
- LICENSE (MIT or Apache-2.0 — final decision in this phase), README with legal notice and quickstart.
- Empty domain folder structure with `index.ts` stubs.
- Theme tokens and dark-mode toggle.
- App shell: sidebar + top bar + content area, with placeholder routes.

**Exit criteria:** `pnpm dev` opens a themed empty shell; CI is green.

### Phase 1 — Parser spike _(MVP M0)_

- `@tybys/wz` integrated inside a Worker via comlink.
- File picker accepting `String.wz` + `Item.wz`.
- Debug page that prints a parsed tree summary and extracts one known item by ID.
- **Go/no-go decision** on `@tybys/wz` for MapleRoyals-era encryption. If no-go, switch to the MapleLib CLI fallback and update this document.

**Exit criteria:** a user can load real WZ files and see a known record's name in the UI.

### Phase 2 — Storage layer _(MVP M5, brought forward)_

- `@sqlite.org/sqlite-wasm` + OPFS bootstrap, IndexedDB fallback.
- Migration runner with v1 schema covering all entity tables and join tables from §8.4 of the MVP doc.
- Drizzle ORM spike — commit or roll back to hand-written SQL based on ergonomics.
- Persistence helpers: load existing DB on startup, "clear data" control, dataset metadata table tracking last-loaded files.

**Exit criteria:** the record extracted in Phase 1 round-trips through SQLite and survives a page reload.

### Phase 3 — Items + Equips _(MVP M2)_

- Item and equip extractors.
- Join with `String.wz` for names and descriptions.
- Icon decoding pipeline (object URLs, lazy, LRU-memoized).
- Item list route and item detail route.
- Equip list route and equip detail route.
- MiniSearch index covering items + equips.

**Exit criteria:** search "Red Potion", click the result, see its icon and stats on a detail page.

### Phase 4 — Mobs, NPCs, Maps _(MVP M3)_

- Mob, NPC, and Map extractors.
- Join tables populated: `map_npcs`, `map_mobs`, `map_portals`.
- Detail pages for each entity type.
- Map detail page lists NPCs and mobs present on that map, with portal links to connected maps.
- Unified MiniSearch index now covers all entity types.

**Exit criteria:** from a map page, navigate to an NPC, then to a quest-relevant map.

### Phase 5 — Quests _(MVP M4)_

- Quest extractor with requirements and rewards joins.
- Quest list and detail routes.
- Cross-links: NPC pages list their quests; item pages list quests using them; mob pages list quests requiring them.

**Exit criteria:** complete MVP entity coverage.

### Phase 6 — Polish & release _(MVP M5 finish)_

- Granular loading progress UI (parse → extract → persist → index).
- Cmd/Ctrl+K command palette with cross-entity navigation.
- Improved fuzzy ranking; field-weighted scoring.
- Error reports for missing/unsupported files.
- Export and import of `.sqlite` database files.
- Tagged **v0.1.0** release on GitHub.

**Exit criteria:** a new user can install, load files, and use the app without consulting documentation.

### Phase 7 — Navigation graph _(MVP M6, optional)_

- Portal graph builder.
- Shortest-path UI between two maps.
- Manual override edges (ships, scripted travel, NPC transports).

**Exit criteria:** route between two portal-connected regions; visualize the path.

### Post-MVP — not committed

- `.img` folder data source.
- Tauri desktop wrapper.
- Server-specific override files (drop tables, NPC shops, custom quests).
- Public static hosting of the app (code only, no data).

## 8. Verification strategy

Every phase ships with explicit success criteria (above) plus the automated checks below.

| Layer       | Approach                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Manual      | Load real user-provided WZ files; spot-check extracted records against MapleLib output for a known set of IDs. |
| Unit        | Extractor tests against small synthetic raw-tree fixtures committed to the repo. No proprietary data in tests. |
| Integration | In-memory SQLite + extractor + query happy paths.                                                              |
| CI          | Typecheck + lint + unit tests on every PR. No proprietary fixtures in CI.                                      |

## 9. Open decisions deferred to implementation

- Drizzle ORM vs hand-written SQL — decide in Phase 2.
- React Router vs TanStack Router — default to React Router; revisit only if type-safety friction is severe.
- Playwright now vs post-MVP — default post-MVP.
- License: MIT vs Apache-2.0 — decide in Phase 0.

## 10. Risks

| Risk                                                 | Mitigation                                                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tybys/wz` cannot handle MapleRoyals-era encryption | Phase 1 is the gate. Fallback: MapleLib-based local CLI importer that emits a SQLite file the frontend consumes — preserves the UI investment.                              |
| SQLite-WASM OPFS support varies by browser           | IndexedDB fallback path is implemented and exercised in CI from Phase 2 onward.                                                                                             |
| Asset decoding is slow at scale                      | Lazy decoding, LRU memoization, IndexedDB cache, optional manual cache-clear. Measure before optimizing.                                                                    |
| Scope creep into rendering maps/sprites in full      | Hard rule: MVP does not render minimap geometry beyond static thumbnails. Revisit only after Phase 6.                                                                       |
| Public distribution attracts legal scrutiny          | LEGAL notice and README make the "user provides files" model explicit. No proprietary data in repo or CI. License chosen with an eye toward defensibility (MIT/Apache-2.0). |
