# Navigator Implementation Plan

How we build the navigation app described in
[`navigator_requirements.md`](navigator_requirements.md), in code, inside the
Scrolled monorepo. This is the technical companion to that product spec; where
the two disagree, the requirements doc wins for *what* and this doc wins for
*how*. Stack and boundary rules defer to
[`technical_requirements.md`](technical_requirements.md) and
[`data_boundaries.md`](data_boundaries.md).

## 0. What's fixed coming in

From the requirements brainstorm, these are settled and the plan below assumes
them:

- **Entirely handwritten graph** authored as a TypeScript intermediate
  representation (IR). **No data is extracted or derived from Scrolled.**
- **Nodes are author-assigned names/slugs** — the author's own area/hub concepts,
  with **no `mapId`**. Edge *requirements* reference real `itemId` / `questId`
  (plus numeric level and meso amounts).
- **Separate app, shared packages, one monorepo.** Goal: eventually embeddable
  into Scrolled, so it must share Scrolled's design language.
- **MVP pathfinding = fewest hops (BFS)**; optional **hard eligibility filter**;
  **automatic (force-directed) layout**; scope = major hubs + inter-region
  transport.

## 1. Findings from Scrolled that shape this plan

A read of the current codebase established the conventions and reuse surface:

- **Monorepo:** pnpm workspaces over `apps/*` + `packages/*`; only `apps/web`
  (`@scrolled/web`) exists today. ESM everywhere, `workspace:*` deps, per-package
  `tsconfig` with `@/*` → `./src/*`, strict TS `noEmit`, Vitest, ESLint with
  enforced layer boundaries. No Turbo/Nx — root scripts are `pnpm --filter` /
  `pnpm -r`. Three build modes via `.env.<mode>` (generic / `fixed` / `identity`).
- **The SQLite-in-a-worker + multi-tab broker machinery is heavy *for a reason*:**
  OPFS exclusive file handles and a ~40k-row dataset. It is the wrong template
  for a few-hundred-node graph (see §3).
- **A reusable pan/zoom surface already exists:** `GraphicViewerCanvas`
  (`apps/web/src/components/GraphicViewer/`) is pure React + DOM transforms — fit
  image, wheel/pinch zoom around cursor, bounds-clamped pan, overlay children
  positioned in content space. It is a strong basis for a generic pan/zoom canvas
  (see §7), independent of whatever graph library we pick.
- **Deep-link targets:** Scrolled exposes `/items/:id`, `/quests/:id`,
  `/npcs/:id`, `/maps/:id` (see `lib/entityRoutes.ts`). Navigator links *out* to
  these by `itemId` / `questId`. Entity IDs are plain `number`s.
- **`@dagrejs` is already a dependency** (referenced in `apps/web` Vite
  `manualChunks`), so a hierarchical layout is available without a new dep; a
  force-directed layout needs one small addition (see §6).

> We deliberately do **not** use `@scrolled/game-db` map/portal data to build the
> graph. The only role game data plays in Navigator is *optional* display
> enrichment: resolving the names of the `itemId`/`questId` a requirement
> references, and linking to Scrolled. Navigator is fully usable with no game data
> loaded at all.

## 2. Architecture overview

Three new code units, plus edits to `apps/web` to share UI:

```
packages/
  nav-graph/         @scrolled/nav-graph   — framework-agnostic graph core
                       IR types + Zod schema, the authored data, the compiler
                       (IR → runtime adjacency), pathfinding (BFS + eligibility),
                       JSON export for portability. No React, no game-db queries.
  ui/                @scrolled/ui          — shared design system extracted from
                       apps/web: theme tokens + tailwind preset, cn(), shadcn
                       primitives, HoverPopover, PanZoomCanvas, useTheme (with
                       injected persistence), app-shell pieces.
apps/
  navigator/         @scrolled/navigator   — the React app: graph view, directions
                       panel, eligibility panel, deep-links to Scrolled.
  web/               @scrolled/web         — migrated to import shared bits from
                       @scrolled/ui (mechanical, lint-guarded).
```

Dependency direction (must stay acyclic; ESLint enforces it):

```
@scrolled/nav-graph  ──(types only, optional)──▶  @scrolled/game-db (types)
        ▲                                               ▲
        │                                               │ (read contract, optional
        │                                               │  — name resolution only)
   apps/navigator ───────────▶ @scrolled/ui ───────────┘
        │                          ▲
        └──────────▶ @scrolled/config (Scrolled base URL, analytics gate)
                                   │
                            apps/web (also consumes @scrolled/ui)
```

`@scrolled/nav-graph` is a **leaf-ish core**: it may import *types* from
`@scrolled/game-db` to brand `itemId`/`questId`, but nothing that pulls in SQLite
or React. It must be runnable in Node (for the JSON-export script and tests).

## 3. No graph database, no worker

The requirements floated "maybe a graph DB in a WASM worker like SQLite." The
recommendation is **no** on both, with a clear escalation path.

**Why no graph database.** The MVP graph is hundreds of nodes and maybe low
thousands of edges. The runtime representation is a plain adjacency map built once
at startup; fewest-hops pathfinding is breadth-first search — microseconds at this
scale, in-process, no query language, no storage engine, no WASM asset to ship.
A graph DB (or SQLite-as-graph) would add bundle weight, async boundaries, and an
extraction/load step to buy nothing. It would also fight the offline tenet (the
SQLite path needs OPFS plumbing). The handwritten IR *is* the database; we compile
it to memory.

**Why no worker (for MVP).** Scrolled's worker exists to keep WZ parsing and big
SQL queries off the main thread, and the multi-tab broker exists because OPFS file
handles are exclusive. Neither applies. BFS over a tiny graph does not block a
frame. Building adjacency at startup is trivial.

**Escalation path (documented, not built):** if a future cost model makes
pathfinding expensive — large weighted graph, multi-criteria optimization, all-pairs
precompute — move *only the solver* into a plain comlink worker, mirroring
`apps/web/src/workers/parseWorker.ts` (a single `expose(new Engine())`, `wrap` on
the client). **No SharedWorker broker, no Web Locks, no OPFS** — the graph is
ephemeral and per-tab. This is a localized change behind the `findPath` interface,
so designing for it now costs nothing.

## 4. Data model — the TypeScript IR

Authored as `.ts` so contributors get types, autocomplete, and compile errors
instead of hand-writing JSON. The type system is the schema; a Zod schema mirrors
it for runtime/CI validation of the compiled form.

```ts
// packages/nav-graph/src/ir/types.ts

/** Author-assigned stable id. kebab-case. NOT a game map id. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Optional cluster used for future semantic-zoom grouping. Author-invented. */
export type GroupId = string & { readonly __brand: 'GroupId' };

export interface AreaNode {
  id: NodeId;          // 'kerning-hub'  (author-chosen)
  name: string;        // display label (authored — see writing_conventions)
  group?: GroupId;     // optional region cluster ('victoria') — author concept
  // No coordinates in MVP: layout is automatic (see §6).
  // No mapId: nodes are authored concepts, not game maps.
}

export type TravelMethod = 'walk' | 'portal' | 'npc' | 'item' | 'skill' | 'other';

export type Requirement =
  | { kind: 'meso'; amount: number }
  | { kind: 'item'; itemId: number; consumed: boolean; quantity?: number }
  | { kind: 'quest'; questId: number }   // must be completed
  | { kind: 'level'; min: number };

export interface TravelEdge {
  from: NodeId;
  to: NodeId;
  bidirectional?: boolean;     // default false (directed from→to)
  method: TravelMethod;
  /** Author-facing description shown verbatim in directions, e.g.
   *  "Talk to the sailor at the dock". Free text; no entity id required. */
  via?: string;
  /** Optional deep-link hooks for entities that DO exist in the game. */
  refs?: { itemId?: number; questId?: number; npcId?: number };
  requirements?: Requirement[];
  /** Estimated on-foot travel time, in seconds. Valid only on walk edges
   *  (other methods are instant); drives the weighted Dijkstra routing. */
  seconds?: number;
  notes?: string;
}

export interface NavGraphSource {
  profileId: string;           // which server profile this data set targets
  nodes: AreaNode[];
  edges: TravelEdge[];
  groups?: { id: GroupId; name: string }[];
}
```

Key properties of this model:

- **Nodes ship their own names** (authored), so Navigator needs no game data to
  render. The flip side is a **constraint**: authored node/group names are
  user-visible copy and must obey [`writing_conventions.md`](writing_conventions.md)
  — no trademarked/copyrighted place names. This is consistent with treating these
  as the author's own area concepts rather than verbatim game locations.
- **Requirements and `refs` carry numeric `itemId`/`questId`/`npcId`** — the only
  game-entity coupling, used for eligibility checks and outbound Scrolled links.
  No item/quest *names* are shipped; those resolve at runtime when available.
- **Per-profile data set.** Each `NavGraphSource` declares its `profileId`. MVP
  targets one profile; multi-profile is just multiple source files selected by the
  active profile (resolved the same way Scrolled does, via
  `lib/serverProfileResolution.ts`).
- **Authoring ergonomics.** Authors write `// Kerning City` comments freely for
  readability; comments never reach the shipped artifact. A dev-only resolver
  (§8) can surface item/quest names next to IDs while editing.

### 4.1 Authoring DX — defining the graph nicely

The IR above is the *compile target and serialization format*, not what a human
should type by hand. Raw `TravelEdge[]` with `from: 'henesys'` / `to: 'ellinia'`
string fields has three DX problems: (1) endpoints are stringly-typed — typos
slip through, no autocomplete, no go-to-definition, rename-refactor doesn't work;
(2) bidirectional links and multi-requirement edges are noisy to spell out; (3)
the region grouping has to be repeated on every node. So we layer an **authoring
DSL** on top whose only job is to emit `NavGraphSource`.

**Prior art we're borrowing from** (pattern-level, not copying any one API):

- **AWS CDK** — *construct identity*: hold an object handle, wire relationships
  through methods on it. No re-typed string IDs. This is the big one.
- **Drizzle `relations()`** — references between *declared* entities are
  type-checked; a bad target won't compile.
- **XState transition maps** — edges declared *next to the node they leave*, which
  reads like "from here you can go to…".
- **`satisfies` + literal keys** — compile-time ID safety from plain literals with
  no runtime builder.
- **Graphology** — the imperative `addNode`/`addEdge` baseline (what we're
  improving on).

**Three candidate styles** (all compile to the same IR):

| Style | Gist | Pros | Cons |
|---|---|---|---|
| **A. Declarative + `satisfies`** | `nodes` object literal + `edges` array, with `from`/`to` typed as `keyof typeof nodes` | Compile-time ID safety, zero runtime, trivially serializable | Edges verbose; bidirectional + requirements noisy; grouping repeated |
| **B. Imperative builder** | `g.addNode(...)`, `g.addEdge(a, b, {...})` | Familiar (Graphology-like), simple | Stringly-typed unless you capture handles; no nesting; order-sensitive |
| **C. Scoped fluent builder w/ handles** *(recommended)* | `region(scope, v => { const a = v.node(...); a.walk(b) })` | Object identity (autocomplete/refactor/go-to-def), edges co-located with source, region scoping removes repetition, terse verbs | A small builder layer to build & test |

**Committed design — a hybrid of A and C.** Author nodes as `satisfies` literals so
`type NodeId = keyof typeof nodes` is known to the compiler (A), and express edges
with handles + verb methods (C). Because the union is derived up front rather than
accumulated through call order, `g.ref()` and edge endpoints are **type-checked
in-editor with autocomplete, and forward / cross-region references work** (no
order-sensitivity, multi-file authoring fine via a central merge). Sketch:

```ts
import { defineGraph, meso, item, quest, level } from '@scrolled/nav-graph';

export default defineGraph({ profileId: 'mapleroyals-compatible' }, (g) => {
  // region scope (CDK-style nesting): nodes inside inherit group 'victoria'
  g.region('victoria', 'Victoria Island', (v) => {
    const henesys = v.node('henesys', 'Henesys');
    const ellinia = v.node('ellinia', 'Ellinia');
    const kerning = v.node('kerning', 'Kerning City');

    henesys.walk(ellinia);          // bidirectional by default — "on foot, both ways"
    ellinia.walk(kerning);

    henesys.npcTo(kerning, {        // directed by default — a one-way taxi
      via: 'Take the taxi at the station',
      cost: meso(1000),             // `cost` = single requirement sugar
      ref: { npcId: 1012000 },      // optional Scrolled deep-link
    });
  });

  const orbis = g.node('orbis', 'Orbis', { group: 'ossyria' });

  // cross-region edge: g.ref() returns a typed handle to an already-declared node
  g.ref('ellinia').itemTo(orbis, {
    via: 'Use at the Ellinia station',
    require: [item(4031746, { consumed: true }), level(30)], // `require` = many
  });
});
```

**Design choices baked into the builder:**

- **Node handles, not strings.** `v.node()` returns a handle; edges are methods on
  it (`henesys.walk(ellinia)`). The common path is fully refactor-safe and
  autocompleted. `g.ref('id')` is the one place an ID string appears — for
  forward/cross-scope references — and it is validated (see below).
- **Verb-per-method with sane directionality defaults.** `walk` / `portalTo`
  default **bidirectional** (you can come back the way you came); `npcTo` /
  `itemTo` / `skillTo` default **directed** (a paid teleport is one-way per use).
  Override with an option (`{ both: true }`) or a paired verb — defaults chosen so
  the common case needs no flag.
- **Requirement constructors.** `meso(n)`, `item(id, { consumed, quantity })`,
  `quest(id)`, `level(n)` return the discriminated-union members. `cost:` takes
  one; `require: [...]` takes several. Reads like prose.
- **Region scoping.** `g.region(id, name, fn)` (nestable) assigns `group` to every
  node created inside, mirroring the semantic-zoom grouping without per-node
  repetition.
- **`.build()` validates and emits IR.** The builder collects everything, runs the
  same checks as `compileGraph` (dangling/duplicate/self-loop, group exists,
  unresolved `g.ref`), throws a precise error on failure, and returns plain
  `NavGraphSource`. **The DSL is pure authoring sugar — it adds nothing to the
  shipped artifact and the IR/JSON portability story is untouched.**

**Type-safe references — decided.** `NodeId` is `keyof typeof nodes`, derived from
the merged `satisfies` node literals; every edge endpoint and `g.ref()` is
constrained to it, so a non-existent node is a compile error with autocomplete,
regardless of declaration order or which file a node lives in. **No codegen
required** for existence checking — the derived union does it. The one accepted
footgun: spread-merging region literals lets a later duplicate ID silently
override an earlier one (TS only errors on duplicate keys *within a single*
literal). **We accept that risk** and catch it mechanically instead — a
compilation pass (§8) collects node declarations *before* the merge collapses
them and fails on any duplicate ID. Binding handles to `const`s
(`const henesys = g.ref('henesys')`) additionally restores rename-refactor and
go-to-definition.

## 5. `@scrolled/nav-graph` — the core package

Pure, framework-agnostic, Node-runnable. Public surface:

```ts
// compile IR → immutable runtime graph (validates with Zod, dedups, builds
// directed adjacency, expands bidirectional edges into both directions)
export function compileGraph(source: NavGraphSource): NavGraph;

// fewest-hops BFS; honors an optional eligibility predicate per edge
export function findPath(
  graph: NavGraph,
  from: NodeId,
  to: NodeId,
  opts?: { eligible?: (edge: TravelEdge) => boolean },
): PathResult;

export interface PathResult {
  status: 'found' | 'unreachable' | 'unreachable-when-filtered';
  steps: TravelEdge[];                 // ordered edges from→…→to
  // When filtering disconnects the destination, we also return the best
  // UNFILTERED path with the blocking steps flagged (requirements §FR7).
  fallback?: { steps: TravelEdge[]; blocked: number[] /* step indices */ };
}

// user-declared state → an eligibility predicate
export function eligibilityFilter(state: UserCapability): (e: TravelEdge) => boolean;

export interface UserCapability {
  level?: number;
  mesos?: number;
  questsCompleted?: ReadonlySet<number>;
  itemsHeld?: ReadonlyMap<number, number>; // itemId → quantity
}

// portability: emit the compiled graph as plain JSON for other targets
export function toJSON(graph: NavGraph): NavGraphJSON;
```

Design notes:

- **Compile step is in-memory at startup**, not a build plugin. The authored data
  is imported as ordinary TS, `compileGraph` runs once (memoized), adjacency lives
  in a `Map<NodeId, TravelEdge[]>`. Hundreds of nodes ⇒ negligible.
- **Eligibility as a pure predicate** keeps pathfinding generic. Hard-filter mode
  passes the predicate to `findPath`, which prunes ineligible edges *before*
  traversal. `meso` is treated as "can you afford a single use" (not cumulative
  budget) for MVP; cumulative-cost routing is a future weighted-cost concern.
- **Unreachable handling (FR7) lives here**, not in the UI: Dijkstra once with the
  filter; if no path, Dijkstra again unfiltered and mark which steps the user
  can't satisfy, returning `status: 'unreachable-when-filtered'` + `fallback`.
- **Routing is least-time Dijkstra** over walk-edge `seconds`; portal/npc/item/
  skill transitions cost 0 (instant teleports) and untimed walks fall back to
  `DEFAULT_WALK_SECONDS`. `findPath` returns `totalSeconds` alongside the steps.
  With no times authored, uniform costs make this equivalent to fewest-hops BFS.
- **`toJSON` is the portability guarantee** the requirements asked for — a tiny
  CLI (`pnpm --filter @scrolled/nav-graph export`) writes the JSON so the graph can
  be shipped to a non-TS target without the authoring toolchain.
- **The authoring DSL (§4.1) ships from this package too** (`defineGraph`, the
  requirement constructors). It emits `NavGraphSource`; `compileGraph` neither
  knows nor cares whether a source was hand-written or built by the DSL.
- **Tests** (Vitest, colocated): compile validation (bad refs, dangling edges),
  BFS correctness on fixtures, bidirectional expansion, eligibility pruning, the
  unreachable/fallback branches.

## 6. `apps/navigator` — the app

A **brand-new standalone Vite SPA** — its own `index.html`, its own entry, its
own dependency set. It lives in the monorepo as a sibling of `apps/web` *only* so
it can consume shared `workspace:*` packages; it is **not** bound to Scrolled's
stack, and we pick libraries on this app's merits. The single hard inheritance is
what `@scrolled/ui` peer-requires — **React 18 + Tailwind** — because that is how
the shared design language is delivered. Everything else is re-evaluated for a
graph-centric, mostly-single-view, fully-offline tool, which mostly means *fewer*
dependencies than Scrolled.

**Stack — chosen for this app (not inherited):**

| Concern | Choice | Rationale / vs. Scrolled |
|---|---|---|
| Build / lang | **Vite + TypeScript (strict)** | As requested; aligns tooling across the monorepo. |
| UI runtime | **React 18** | Required to consume `@scrolled/ui`. The one non-negotiable. |
| Styling | **Tailwind v3 + `@scrolled/ui` preset/tokens** | Delivers the shared design language. |
| Graph view | **React Flow (`@xyflow/react` v12) + `d3-force`** | The heart of the app; new to the monorepo, justified below. |
| UI state | **Zustand** | Tiny, ergonomic; happens to match Scrolled — kept on merit, not convention. |
| URL state | **`nuqs`** (or native `URLSearchParams`) | Makes start/end/eligibility a **shareable link** — a core use case. |
| Routing | **Minimal / none for MVP** | Navigator is essentially one screen. Add a light router (React Router or TanStack Router) only if a detail/about route appears — *we drop Scrolled's heavy routing.* |
| Async cache | **None for MVP** | The graph is bundled and synchronous; there's nothing to fetch. *We deliberately drop TanStack Query* unless/until optional async game-db name resolution is added. |
| Validation | **Zod** (inside `@scrolled/nav-graph`) | Validates the compiled graph; not needed in app code. |
| Icons | **`lucide-react`** | Visual consistency with the shared design language. |
| Tests | **Vitest** | Monorepo standard; keeps CI uniform. |

Net effect of the re-evaluation: **add** React Flow + d3-force (the graph
surface), **drop** TanStack Query and heavy routing, **keep** the small stuff that
genuinely fits (Zustand, nuqs, Zod, Vitest, Lucide).

**Rendering library — recommendation: React Flow (`@xyflow/react` v12).** It gives
pan/zoom, minimap, and **custom React node/edge components** out of the box, so
nodes can be rendered with `@scrolled/ui` primitives and look identical to
Scrolled. It directly supports the deferred features: **sub-flows / parent nodes**
for region grouping & semantic zoom, and **custom edge/node types** for the
PCB-style off-page connectors. Layout is decoupled — we feed it positions.

- *Alternative considered — Cytoscape.js:* superior built-in graph layouts
  (fcose/cose), but renders to its own canvas, making shadcn-styled custom nodes
  and hover cards awkward. *sigma.js/WebGL:* built for 10k+ nodes — overkill here.
  *Reuse `PanZoomCanvas` + render edges/nodes ourselves:* maximum control, but we'd
  reimplement edge routing, selection, and grouping that React Flow gives free.
  React Flow is the boring, well-supported fit for hundreds of design-consistent
  nodes.
- **Auto-layout:** compute positions with a force-directed pass and hand them to
  React Flow. Use `d3-force` (one new dep) for the organic "force-directed" look
  the requirements name; `@dagrejs/dagre` (already present) is the fallback for a
  tidy hierarchical option. Layout runs once per graph load, off the render path.
  Later, frozen/hand-tuned coordinates simply become preset node positions.

**Screens / components (own files under `components/<concern>/`, per repo
convention):**

- `components/graph/GraphCanvas.tsx` — the React Flow surface; custom
  `AreaNodeView`, `TravelEdgeView`; highlights the active path.
- `components/directions/DirectionsBar.tsx` — start/end pickers (searchable
  combobox over node names) + "Get Directions".
- `components/directions/DirectionsPanel.tsx` — the step-by-step list: each step
  renders `method`, `via` text, and requirement chips; item/quest chips deep-link
  to Scrolled.
- `components/eligibility/EligibilityPanel.tsx` — declare level / mesos / items /
  quests; toggles the hard filter; persisted locally (Zustand + `idb-keyval`).
- `stores/` — `useDirections` (start/end/result), `useEligibility`, plus the
  shared `useTheme` from `@scrolled/ui`.
- `hooks/useNavGraph.ts` — selects the data set for the active server profile and
  memoizes `compileGraph`.

**Deep-linking to Scrolled.** Item/quest/NPC chips link to
`${scrolledBaseUrl}/items/:id` etc. `scrolledBaseUrl` comes from
`@scrolled/config` (canonical default, overridable for self-host); when unset,
chips render as plain labels. **Name resolution is optional enrichment:** if a
`@scrolled/game-db` read client is available in context (e.g. when embedded in
Scrolled, or a fixed-dataset build), resolve names; otherwise show the id or the
authored `via` text. Navigator never *requires* game data.

**Command palette (optional, not inherited).** Scrolled's "palette wiring ships
with features" rule is a Scrolled rule, not a constraint on this app. If Navigator
wants a palette, the cheapest path is the `cmdk` primitive from `@scrolled/ui` with
a couple of actions (jump-to-node, set start/end, toggle filter); otherwise skip it
for MVP.

**Analytics (canonical deploy only).** If we want pageview analytics on the hosted
Navigator, reuse the same host-gated, opt-out, identifier-free approach Scrolled
uses (via `@scrolled/config`). Optional and off for self-hosters/forks.

## 7. `@scrolled/ui` — the shared design system

This is the "pull things from Scrolled into a common component library" step. It
lands as milestone **M2** — *after* the headless graph core (M1) but *before* any
Navigator UI — so both apps look identical from the first rendered screen.

**Extract (high value, low coupling first):**

1. **Theme tokens + Tailwind preset.** Move the CSS-variable token block from
   `apps/web/src/styles/index.css` and the `tailwind.config.ts` shape into the
   package as a Tailwind *preset* + a `tokens.css`. Both apps' `tailwind.config`
   extend the preset; both import `tokens.css`. Includes the accent system.
2. **`cn()`** (`lib/utils.ts`) and the **shadcn primitives** in use: `button`,
   `dialog`, `command`, `sheet`, `badge`, `table`, `input`.
3. **`HoverPopover`** (the portaled hover-card primitive used by every entity link).
4. **`useTheme`** store — but with **injected persistence**: today it writes to the
   user DB; extract it behind a `ThemePersistence` interface so Scrolled wires the
   DB adapter and Navigator wires a `localStorage`/`idb-keyval` adapter.
5. **`PanZoomCanvas`** — generalize `GraphicViewerCanvas` (drop the
   image-specific bits, keep the fit/zoom-around-cursor/clamped-pan transform and
   content-space overlay). Useful to Navigator as a fallback renderer and to
   Scrolled's existing viewers.

**Extract later (more coupled):** `AppShell` / `Sidebar` / `TopBar`. These are
tangled with Scrolled's feature gates, nav items, and stores, so Navigator should
start with a thin local shell that consumes the shared theme + primitives, and we
generalize the shell only once both apps' needs are clear. Entity-display/link,
MapViewer/WorldMapViewer, and the command-palette *providers* stay app-specific.

**Migration mechanics.** Add `@scrolled/ui` as a `workspace:*` dep of `apps/web`,
replace local imports with package imports (mechanical, mostly find/replace),
update `eslint.config.js` boundaries to allow the new package and keep the
extractor/cloud-SDK prohibitions intact. **Risk:** this touches many files in
`apps/web`; do it as its own reviewed change *before* Navigator features, run
`pnpm -r typecheck` + the web app's tests to confirm parity, and keep each
extraction a separate commit so regressions bisect cleanly.

## 8. Validation & data integrity

The handwritten IR needs guardrails since there's no extraction to keep it honest:

- **Compile-time (TS):** the IR types reject structural mistakes (unknown
  `method`, wrong requirement shape) at author time.
- **Load/CI-time (Zod + a pre-merge pass):** `compileGraph` validates the assembled
  source — every edge endpoint resolves to a declared node, no self-loops unless
  intended, `group` references exist. **Duplicate node IDs are caught by a
  dedicated pre-merge collection pass**: the DSL gathers every node declaration as
  a list *before* the spread-merge collapses same-key entries (a post-merge object
  can't reveal an override — this is the accepted §4.1 footgun, handled here). A
  Vitest test runs the whole validation over the real data set so CI fails on a
  duplicate or otherwise broken graph.
- **Entity-ref reconciliation (optional, CI + dev):** a script cross-checks each
  `itemId`/`questId`/`npcId` against a reference dataset for the target profile
  (the fixed hosted dataset, which exists at CI time) and reports unknown ids.
  This is a *warning-grade authoring aid*, never a runtime requirement — Navigator
  must still run with no dataset present.
- **No schema/data-revision coupling.** Navigator does not use `@scrolled/game-db`
  migrations or `dataVersion`; the graph is app-bundled data, versioned by git.

## 9. Monorepo wiring (concrete)

- **Workspaces:** already glob `apps/*` + `packages/*`; new dirs are picked up with
  no `pnpm-workspace.yaml` change.
- **Root scripts:** add `"dev:navigator": "pnpm --filter @scrolled/navigator dev"`
  and `"build:navigator": "pnpm --filter @scrolled/navigator build"`. `typecheck`,
  `lint`, `test` already fan out via `pnpm -r`.
- **Each new package/app:** own `tsconfig` (reuse the repo's strict shape: ES2022,
  `bundler` resolution, strict, `noEmit`, `@/*` alias), own `package.json` with
  `workspace:*` deps, Vitest, ESLint. These are *conventions worth keeping for
  consistency*, not stack constraints.
- **`apps/navigator/vite.config.ts`:** its own **minimal** config — React plugin,
  `@` alias, Tailwind via PostCSS. It does **not** copy `apps/web`'s specifics:
  no `@sqlite.org/sqlite-wasm` exclude, no PWA unless we want offline-install, no
  worker block unless/until the solver moves to a worker (§3).
- **Build:** a single standard build. **None** of Scrolled's `fixed` / `identity`
  modes are needed — no datasets, no auth, no sync. (A `fixed`-style bundled-dataset
  build is only relevant if we later add offline item/quest name resolution.)
- **ESLint boundaries:** add rules so `@scrolled/nav-graph` cannot import React,
  `@scrolled/game-db` queries, or the extractor (types-only from game-db); and so
  `apps/navigator` display code follows the same display-layer prohibitions as
  `apps/web`.
- **Deploy:** Navigator is a separate static SPA (its own `dist/`, its own Pages
  target / base path), mirroring the existing GitHub Actions flow.

## 10. Offline, self-host & tenet compliance

- **Offline (tenet 4):** the graph is bundled JS; pathfinding and rendering are
  fully client-side. Navigator works with no network and no data import — a
  *stronger* offline story than Scrolled. Outbound Scrolled links and optional name
  resolution are the only network/data touchpoints and degrade gracefully.
- **Self-hostable (tenet 2):** static build, no backend, no account. `scrolledBaseUrl`
  is configurable so a self-hoster points at their own Scrolled instance (or none).
- **Open source / nothing proprietary (tenets 1 & 3):** no game assets or extracted
  data ship; the IR is original authored topology + numeric ids. Node/group names
  are authored copy under `writing_conventions.md`.
- **Analytics:** host-gated, opt-out, no identifiers — inherited via `@scrolled/config`.

## 11. Testing

- `@scrolled/nav-graph`: unit tests for compile/validate, BFS, bidirectional
  expansion, eligibility pruning, unreachable + fallback; a "real data set
  compiles & is connected" guard test.
- `apps/navigator`: component tests for `DirectionsPanel` rendering of steps and
  requirement chips; `EligibilityPanel` filter wiring; a smoke test that "Get
  Directions" between two fixture nodes highlights a path.
- `@scrolled/ui`: render/snapshot of primitives in light/dark; `useTheme`
  persistence-adapter contract.

## 12. Phased delivery

The whole data layer is built and proven **headless, before any UI exists.** No
React, no rendering, no app shell until the graph compiles to JSON and the
pathfinding/search test suite is green.

1. **M1 — Graph core & data engine (no UI).** `@scrolled/nav-graph` end to end: IR
   types; the `satisfies`/handle authoring DSL with type-safe references (§4.1);
   `compileGraph` + the pre-merge duplicate/validation pass (§8); `findPath` (BFS +
   eligibility + unreachable/fallback); `toJSON` + the export CLI. Author enough
   real data to exercise it (fixtures + a starter slice). **Exit criteria: the
   graph compiles to JSON, and the full pathfinding / eligibility / search test
   suite passes — entirely headless, zero UI code.**
2. **M2 — Shared UI foundation.** Create `@scrolled/ui` with theme preset + tokens
   + `cn()` + core primitives + `HoverPopover` + `useTheme` (injected persistence)
   + `PanZoomCanvas`. Migrate `apps/web` to it; confirm parity. *(De-risks the
   design language before any Navigator UI.)*
3. **M3 — App skeleton + graph view.** Scaffold `apps/navigator`; React Flow canvas
   with force-directed auto-layout; render the compiled graph; pan/zoom.
4. **M4 — Directions.** Start/end pickers, "Get Directions", path highlight,
   `DirectionsPanel` with requirement chips + Scrolled deep-links.
5. **M5 — Eligibility filter.** `EligibilityPanel`, hard-filter wiring, unreachable
   fallback UX.
6. **M6 — Content + polish.** Author the full MVP data set (major hubs +
   inter-region transport), optional palette, analytics gate, deploy target.
7. **Post-MVP (per requirements):** empirical (recorded) walk times refining the
   authored `seconds` estimates, region grouping / semantic zoom (React Flow
   sub-flows), off-page connectors (custom edge/node types), frozen layout coords,
   in-app authoring tool.

## 13. Open questions / decisions to confirm

- **NPC references:** modeled here as free-text `via` plus an optional `refs.npcId`
  for linking. Confirm whether NPC deep-linking matters enough to require ids, or
  whether free text is enough (the user emphasized item/quest ids).
- **Meso semantics:** MVP treats meso requirements as per-use affordability, not a
  cumulative trip budget. Confirm that's acceptable until the weighted-cost phase.
- **`@scrolled/ui` shell scope:** start with a thin local shell in Navigator and
  generalize `AppShell`/`Sidebar` later — confirm we're comfortable deferring the
  shared shell.
- **React Flow dependency:** confirm adding `@xyflow/react` + `d3-force` is
  acceptable (vs. building on the reused `PanZoomCanvas`).
- **Scrolled base URL config:** where it lives (`@scrolled/config` vs a
  Navigator-local config) and its default.
- **Name resolution:** is item/quest name display in-scope for MVP (requires a
  data source), or do we ship IDs + links only until embedding?
