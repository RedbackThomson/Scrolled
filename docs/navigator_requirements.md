# Navigator Requirements

Working name: **Scrolled Navigator** (the app needs a generic, trademark-free
name — see Open Questions). This document is the product source of truth for the
navigation app. Technical decisions defer to
[`technical_requirements.md`](technical_requirements.md); the data-layer boundary
rules in [`data_boundaries.md`](data_boundaries.md) and the prohibitions in
[`writing_conventions.md`](writing_conventions.md) apply here exactly as they do
to Scrolled.

## Overview

The game world is confusingly laid out: without many hours of play it's hard to
know which NPC on which map will take you where, and there is no central source
for getting around. Scrolled Navigator is that source. It models the world as a
**directed graph** of area/hub **nodes** connected by travel **edges** (walk,
portal, NPC teleport, item use), and answers "how do I get from A to B?" with a
shortest path drawn on a pannable/zoomable graph plus step-by-step directions.

It is the **second step** in a broader goal of building tools that make the game
easier to understand and navigate; Scrolled (the wiki) was the first.

## Users

- **Primary:** Players (new or returning) who don't have the world's transit
  routes memorized and want turn-by-turn directions between locations.
- **Secondary:** Community contributors who author and extend the graph data via
  pull requests; existing Scrolled users who cross-link from entity pages.

## Functional Requirements

### Core Features (MVP — Must Have)

1. **Graph data as a TypeScript IR.** Nodes (areas/hubs) and edges (travel
   methods) are authored as type-checked `.ts` files in the repo; the type
   system *is* the schema, so contributors get autocomplete, inline docs, and
   compile errors instead of learning a graph-DB query language. The IR is
   compiled at build time into a runtime adjacency structure for traversal, and
   is serializable to plain JSON for portability to other targets.
   - *Acceptance:* a contributor can add a node + edge in TS, get compile-time
     validation, and see it appear after a build with no DB syntax involved.

2. **Authored node identity; requirements reference Scrolled IDs.** Nodes are
   identified by **author-assigned names/slugs** — they are the author's own
   area/hub concepts, *not* game maps, and carry **no `mapId`**. Edge
   *requirements* reference Scrolled's canonical IDs for entities that genuinely
   exist in the game — `itemId` and `questId` — plus numeric level and meso
   amounts. The graph is **entirely handwritten**: no data is extracted or derived
   from Scrolled's game data. An authored data set targets a specific server
   profile, since item/quest IDs and transport knowledge are server-specific.
   - *Acceptance:* nodes render from their authored names with no dependency on
     extracted game data; item/quest requirements can deep-link to the
     corresponding Scrolled page when name resolution is available.

3. **Edge model with directionality + requirements.** Edges are directional or
   bi-directional and carry requirements: meso cost, item (distinguishing *held*
   vs *consumed*), completed quest(s), and minimum level. Walk edges also carry
   an **optional `seconds` field** (estimated on-foot travel time) that feeds the
   weighted routing in FR5; portal/npc/item/skill transitions are instant.
   - *Acceptance:* the IR can express every requirement type; directions render
     each edge's requirements per step.

4. **Pan/zoom graph view (automatic layout).** The full graph renders with an
   automatic force-directed layout (no authored coordinates in the MVP); users
   pan and zoom to browse. The graph may look busy — that is accepted for the
   MVP and addressed by the deferred clutter-management features.
   - *Acceptance:* the MVP graph (major hubs + inter-region transport) loads and
     is navigable by pan and zoom.

5. **Get Directions (least travel time).** The user selects a start node and an
   end node and requests directions. The app finds the shortest path by **summed
   travel time** (Dijkstra over walk-edge `seconds`; non-walk transitions are
   instant), highlights it on the graph, and shows a step-by-step summary listing
   each edge's travel method, its walking time, and any requirements. With no
   times authored, uniform edge costs make this collapse to fewest hops.
   - *Acceptance:* for any connected A→B, a correct least-time path is
     highlighted on the graph and listed as ordered steps, each stating its
     travel method, walking time, and requirements; the panel shows the total.

6. **Optional eligibility filter (hard filter).** The user may declare their
   state — current level, items held, quests completed — and ineligible edges are
   **pruned before pathfinding**. With no state declared, all edges are eligible.
   - *Acceptance:* declaring state that blocks an edge removes it from candidate
     routes; the returned path uses only eligible edges.

7. **Unreachable-destination handling.** When eligibility filtering (or a gap in
   the graph) leaves no valid path, the app degrades gracefully: it surfaces that
   no eligible route exists and, preferably, shows the best *unfiltered* path with
   the blocking step(s) clearly flagged.
   - *Acceptance:* a destination unreachable under the user's constraints
     produces a clear, actionable message — never an empty or error state.

### Deferred Features (Should / Could Have — post-MVP)

- **Measured-time refinement.** Weighted routing over walk-edge `seconds` ships
  in FR5 (Dijkstra). The remaining post-MVP work is *empirical* times — replacing
  authored estimates with recorded traversal data — plus per-method costs for the
  transitions currently modeled as instant, if they prove non-negligible.
- **Region grouping & semantic zoom.** Nodes are tagged with authored region
  names; the zoomed-out view collapses to region super-nodes and expands on
  zoom-in, giving a "big picture" overview.
- **Off-page connectors (PCB net-label style).** Instead of drawing long edges
  across the whole canvas, long or cross-region edges render as a labeled stub
  naming their far endpoint, letting subgraphs sit neatly in their own area
  without spaghetti lines crossing the map.
- **Hand-tuned / frozen layout coordinates.** Move from pure auto-layout to
  author-adjusted positions (likely echoing the real game geography) if
  auto-layout reads as too messy; requires tooling to capture adjusted positions
  back into the IR.
- **In-app authoring tool.** A visual editor that reads/writes the graph and
  exports PR-ready IR diffs, lowering the contribution barrier below "edit TS and
  open a PR."
- **Broader content coverage.** Fill in intra-region detail and additional server
  profiles beyond the MVP's major-hub slice.

## Non-Functional Requirements

- **Local-first / offline.** The graph ships with the app; directions and
  rendering run fully client-side with no network dependency. (Inherits Scrolled
  tenet 4 and hard rule 2.)
- **Open-source & self-hostable.** No privileged backend; a self-hoster gets the
  same capabilities as the canonical deployment. (Tenets 1 and 2.)
- **Nothing proprietary.** No game assets are shipped. The curated graph is
  treated as *derived factual knowledge* (analogous to a wiki's written prose),
  not extracted proprietary data. All user-visible copy follows
  [`writing_conventions.md`](writing_conventions.md) — no trademarked or
  copyrighted names. (Tenet 3, hard rules 1 and 3.)
- **Performance.** Pathfinding is trivial at the expected scale (hundreds of hub
  nodes); the real budget is smooth pan/zoom rendering of a busy graph — target
  interactive (~60fps) pan/zoom at MVP scale.
- **Shared foundations.** Reuses Scrolled's entity types, domain decoders, server
  profiles, and UI components, and respects Scrolled's layer boundaries
  ([`data_boundaries.md`](data_boundaries.md)).

## Constraints

- **Same UI design language as Scrolled.** The app must look and feel like part
  of Scrolled — standard wiki/app patterns, the same neutral slate/zinc light and
  dark theming, the same component library (shadcn/ui + Lucide, Tailwind v3), and
  shared layout/UI packages. The goal is for Navigator to eventually be
  **embeddable into Scrolled** — or at minimum to link directly to and from it
  seamlessly — so visual and interaction consistency is a hard requirement, not a
  nice-to-have.
- **Monorepo, shared packages.** Lives in the Scrolled monorepo as a *separate
  app* that shares packages (entity types, domain decoders, UI components) with
  Scrolled. Bound to the committed stack in `technical_requirements.md` (Vite +
  React 18 + TypeScript strict, React Router v6, Tailwind v3, etc.).
- **Server-profile-specific graph.** Cross-server support requires a separate
  curated graph per server profile.
- **Manual, PR-based curation.** Data quality depends on contributors; there is no
  automated extraction backstop for the curated edges.

## Assumptions

- The curated graph counts as derived factual knowledge and is acceptable under
  "nothing proprietary," analogous to wiki prose.
- The MVP targets a single server profile.
- Region tags (for future grouping) are authored, not derived.

## Open Questions

- **App name** — must be generic and trademark-free.
- **Graph rendering library** — React Flow vs Cytoscape.js vs sigma.js vs custom
  (a `technical_requirements.md` decision once we prototype).
- **Eligibility input UX** — exactly how the user declares level/items/quests, and
  whether it can read from a Scrolled collection or character profile rather than
  manual entry.
- **Unreachable fallback UX** — message-only vs an annotated best-effort path with
  blocking steps flagged.
- **Scrolled deep-linking depth** — how tightly directions link into Scrolled
  (inline embeds vs new-tab links), and the eventual embedding mechanism.

## Decision Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Data source | Entirely handwritten community graph (no extraction) | Complete and accurate from day one; captures NPC/item/quest/walk edges impractical to extract; intentionally not derived from Scrolled's extracted data |
| 2 | Relationship to Scrolled | Separate app, shared packages, one monorepo | Product independence with entity-ID and UI reuse |
| 3 | Storage & authoring | TypeScript IR, PR-based; compiled to a runtime form, serializable to JSON | Easy community contributions without graph-DB syntax; type-checked; portable |
| 4 | Node identity & entity refs | Nodes = author-assigned names/slugs (no `mapId`); requirements reference `itemId`/`questId`; fully handwritten; data set targets a server profile | Keeps the graph self-contained and offline, decoupled from extracted map data; item/quest refs stay accurate and linkable into Scrolled |
| 5 | Cost model | Least travel time — Dijkstra over walk-edge `seconds`; non-walk transitions instant; falls back to fewest hops when no times are authored | Reflects that walking dominates real travel time while teleports do not; empirical times remain a post-MVP refinement |
| 6 | Requirements model | Optional hard filter; all edges eligible by default | Matches the intended UX; requires graceful unreachable handling |
| 7 | Graph layout | Auto force-directed (MVP); region grouping + off-page connectors + frozen coords later | Lowest authoring cost first; clutter-management features designed into the IR |
| 8 | MVP content scope | Major hubs + inter-region transport only | Proves cross-world directions with the fewest curated nodes |
| 9 | UI / design language | Match Scrolled exactly; design for eventual embedding | Consistency so Navigator can be embedded into or seamlessly linked with Scrolled |
