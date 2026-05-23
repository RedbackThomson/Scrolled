# Mushroom Game Explorer — Requirements Draft

## 1. Goal

Build a self-hostable wiki-style web application, working title **Mushroom Game Explorer**, for old MapleStory / MapleRoyals-style game data where the application does not distribute proprietary game assets or extracted data.

Users provide their own local game files at runtime. The application parses those files in the browser or local server process, builds an in-memory/searchable data model, and renders pages for maps, NPCs, mobs, items, equips, and quests.

## 2. Core Principle

The project should ship code only.

It should not ship:

- MapleStory `.wz` files
- extracted `.img` files
- PNG sprites, icons, maps, audio, or other game assets
- pre-generated item/map/mob databases derived from proprietary files
- trademarked branding beyond nominative/descriptive references where necessary

Users must supply their own files locally.

## 3. Target User Flow

1. User downloads or self-hosts the web app.
2. User opens the app in a browser or runs a local server.
3. User selects their local game files, such as `String.wz`, `Item.wz`, `Map.wz`, `Mob.wz`, `Npc.wz`, `Quest.wz`, `Skill.wz`, and related files.
4. App parses files locally.
5. App builds a normalized index.
6. User searches/browses generated pages.
7. Optional: user exports a local cache/index for faster reloads, but the app should not publish or redistribute that cache.

## 4. Supported Input Formats

### 4.1 MVP Input

Prioritize direct `.wz` parsing.

Reason: `.wz` files are the canonical MapleStory client archive format and existing libraries/reference implementations are built around them.

### 4.2 Secondary Input

Support extracted `.img` filesystem layouts later.

Reason: `.img` workflows are useful for diffing, review, and version control, but they are less likely to be the raw format a normal user starts with.

### 4.3 Input Handling Requirements

- Allow multiple WZ files to be uploaded/selected together.
- Detect missing required files and show clear warnings.
- Detect unsupported/invalid WZ files.
- Keep uploaded files local to the user unless explicitly running a private local server.
- Do not persist original proprietary files to any hosted backend.

## 5. Legal / Distribution Constraints

This is not legal advice, but the project should be designed conservatively:

- Do not distribute Nexon-owned game data or images.
- Do not include extracted JSON snapshots from MapleStory files.
- Do not include screenshots/icons/sprites in the repository.
- Do not use MapleStory or Nexon branding as if affiliated.
- Add a clear notice: users are responsible for providing files they are legally allowed to use.
- Prefer local-only parsing and local-only caching.

## 6. Functional Requirements

### 6.1 Search

- Global search by name and ID.
- Type-specific filters: item, equip, mob, NPC, map, quest.
- Fuzzy search for partial names.
- Direct ID lookup.

### 6.2 Items

Pages for all items, including:

- Item ID
- Name
- Description
- Icon
- Category/type
- Price/vendor metadata where available
- Stack size where available
- Required level where applicable
- Stat effects where applicable
- Quest relevance where derivable

### 6.3 Equipment

Pages for equips, including:

- Equip ID
- Name
- Icon
- Slot/category
- Required level/job/stats
- Attack/magic attack/defense/stat bonuses
- Upgrade slots
- Restrictions/tradeability metadata if available

### 6.4 Mobs

Pages for mobs, including:

- Mob ID
- Name
- Sprite/thumbnail where available
- Level
- HP/MP
- EXP
- Boss flag where available
- Elemental properties where available
- Spawn maps, if derivable from map data
- Drops only if drop data is available from a user-provided source; WZ alone may not contain complete server drop tables

### 6.5 NPCs

Pages for NPCs, including:

- NPC ID
- Name
- Sprite/thumbnail
- Map locations, derived from map data
- Shop/quest linkage only where available from provided files/data

### 6.6 Maps

Pages for maps, including:

- Map ID
- Map name and street/region name
- Rendered minimap or map preview where feasible
- NPCs on the map
- Mobs/spawns on the map
- Portals
- Footholds/basic geometry if useful
- Links to connected maps where portal targets are available

### 6.7 Quests

Pages for quests, including:

- Quest ID
- Quest name
- Start/end NPCs where available
- Required level/job/prerequisites
- Required items/mobs
- Rewards
- Quest chain relationships where derivable

## 7. Optional / Later Features

### 7.1 Map Navigation Graph

Build a graph where:

- nodes = map IDs
- edges = portals between maps
- edge weight = 1 by default

User can choose source and destination map and request shortest path.

Limitations:

- Some travel requires scripts, NPCs, ships, quests, or paid transport.
- Some portal relationships may not be fully derivable from client files alone.
- MVP can start with direct portal edges only.

### 7.2 Server-Specific Overrides

Allow users to import optional local override files for:

- drop tables
- NPC shops
- custom quest behavior
- custom map links
- custom item changes

Format should be open JSON/YAML and documented.

### 7.3 Exported Local Cache

Allow users to save a local generated index to speed up startup.

Important: cache export must be user-generated and local; the project repository should not include generated caches.

## 8. Technical Architecture

### 8.1 Recommended Stack

Recommended MVP stack:

- TypeScript
- Vite or Next.js static app
- WZ parsing through an existing JS/TS-compatible parser where possible
- SQLite-compatible normalized database layer for portability
- Browser MVP can use SQLite via WASM, such as sql.js or SQLite WASM, or fall back to IndexedDB-backed persistence
- Web Workers for parsing large files without freezing the UI
- Lunr, FlexSearch, Minisearch, or similar for client-side search

Alternative stack:

- Local server in C#/.NET using MapleLib
- Frontend in TypeScript/React
- Server exposes a local-only API over localhost

### 8.2 Parser Boundary

Create a parser abstraction early:

```ts
interface GameDataSource {
  load(files: File[]): Promise<RawWzTree>;
}

interface Extractor<T> {
  extract(tree: RawWzTree): Promise<T[]>;
}
```

Keep WZ parsing separate from domain extraction.

Suggested layers:

1. File loader
2. WZ/IMG parser
3. Raw tree adapter
4. Domain extractors
5. Normalized database/index
6. UI routes/search

### 8.3 Normalized Data Model

Use a normalized SQLite-friendly data model rather than keeping the entire extracted dataset only in memory. The app may still keep hot indexes in memory for fast UI/search, but SQLite should be treated as the portable canonical extracted store.

Benefits:

- easier migration from browser-only to local/server-side mode
- easier export/import of user-generated indexes
- more natural joins between maps, mobs, NPCs, items, and quests
- better debugging and inspection
- avoids coupling the frontend to raw WZ tree structure

Use normalized records keyed by ID:

```ts
type GameDatabase = {
  items: Record<string, ItemRecord>;
  equips: Record<string, EquipRecord>;
  mobs: Record<string, MobRecord>;
  npcs: Record<string, NpcRecord>;
  maps: Record<string, MapRecord>;
  quests: Record<string, QuestRecord>;
};
```

Avoid storing entire raw parsed WZ trees in app state after extraction.

### 8.4 SQLite Storage Strategy

Suggested approach:

- Store structured extracted metadata in SQLite tables.
- Store large binary assets separately where practical, referenced by content key/path.
- Avoid storing original WZ files in the database.
- Allow the user to export/import a generated `.sqlite` database for personal/local reuse.
- Keep schema migrations explicit from the beginning.

Initial table groups:

- `items`
- `equips`
- `mobs`
- `npcs`
- `maps`
- `quests`
- `map_npcs`
- `map_mobs`
- `map_portals`
- `quest_requirements`
- `quest_rewards`
- `assets` or `asset_refs`

Browser implementation options:

- SQLite compiled to WASM for maximum portability.
- OPFS-backed SQLite where browser support allows it.
- IndexedDB as a fallback persistence layer if SQLite-in-browser becomes too awkward.

### 8.5 Asset Handling

Assets should be lazy-loaded and object-URL based:

- decode icons/sprites only when needed
- cache decoded thumbnails in memory or IndexedDB
- do not upload assets to a remote service
- allow the user to clear cache

## 9. Parser Strategy

### 9.1 First Choice: Existing Library

Evaluate these paths first:

1. `@tybys/wz` / `toyobayashi/wz`: JS/TS and browser-oriented WZ reader.
2. MapleLib / HaRepacker-resurrected: C# reference implementation with broad version support.
3. Rust/C++ parsers if a WASM route becomes attractive later.

### 9.2 MVP Recommendation

Start with the JS/TS parser because it aligns with a static/browser-local app.

Use MapleLib/HaRepacker as the correctness reference when the JS parser fails or behavior is unclear.

### 9.3 Fallback Plan

If direct browser parsing is too fragile:

- build a local CLI/importer using MapleLib
- have the CLI produce a user-local JSON index
- frontend consumes that SQLite database or JSON index
- still do not ship generated data

## 10. Demo Scope

The first demo should avoid trying to parse everything.

Recommended demo:

1. User selects `String.wz`, `Item.wz`, `Mob.wz`, `Npc.wz`, and `Map.wz`.
2. App parses files locally.
3. App extracts:
   - item names/icons
   - equip names/icons/basic stats
   - mob names/basic stats
   - NPC names/icons
   - map names and NPC placements
4. App renders:
   - global search
   - item page
   - mob page
   - NPC page
   - map page with NPC/mob lists

Skip quests and full map rendering until after basic extraction is stable.

## 11. Milestone Plan

### Milestone 0 — Research Spike

- Confirm parser can open MapleRoyals-era WZ files.
- Confirm required encryption/version settings.
- Parse one file and print a tree.
- Extract one known item by ID.

Success criteria: can read a known record from user-provided files.

### Milestone 1 — Local Parser Prototype

- File picker for required WZ files.
- Web Worker parses files.
- Raw tree explorer/debug view.
- Basic error handling.

Success criteria: user can inspect parsed WZ structure locally.

### Milestone 2 — Item + String Extraction

- Extract item/equip records.
- Join item IDs to names/descriptions from `String.wz`.
- Render searchable item list and detail page.

Success criteria: user can search an item by name and view icon/stats.

### Milestone 3 — Mobs, NPCs, Maps

- Extract mob records.
- Extract NPC records.
- Extract map names and placements.
- Link NPC/mob pages back to maps.

Success criteria: map page shows NPCs and mobs present on that map.

### Milestone 4 — Quests

- Extract quest metadata.
- Link quests to NPCs/items/mobs where possible.
- Add quest pages and quest search.

Success criteria: user can search a quest and see requirements/rewards.

### Milestone 5 — Polish + Local Database

- SQLite-backed extracted database, with IndexedDB/OPFS persistence where appropriate.
- Loading progress.
- Better search.
- Error reports for missing/unsupported files.
- Clear-cache control.

Success criteria: app reloads quickly without reparsing unless files change.

### Milestone 6 — Navigation Graph

- Extract portal links from maps.
- Build graph.
- Add shortest-path UI.
- Allow manual override edges for ships/scripts/special transport.

Success criteria: user can route between two maps for simple portal-connected regions.

## 12. Initial Repository Structure

```txt
/app
  /src
    /parser
      GameDataSource.ts
      WzDataSource.ts
      ImgFolderDataSource.ts
    /extractors
      extractItems.ts
      extractEquips.ts
      extractMobs.ts
      extractNpcs.ts
      extractMaps.ts
      extractQuests.ts
    /db
      schema.ts
      migrations.ts
      normalize.ts
      sqlite.ts
      persistence.ts
    /search
      buildSearchIndex.ts
    /routes
      Items.tsx
      ItemDetail.tsx
      Mobs.tsx
      MobDetail.tsx
      Npcs.tsx
      NpcDetail.tsx
      Maps.tsx
      MapDetail.tsx
      Quests.tsx
      QuestDetail.tsx
    /workers
      parseWorker.ts
  /public
    empty-placeholder-assets-only.txt
/docs
  input-files.md
  legal-notes.md
  data-model.md
  parser-notes.md
```

## 13. Open Questions

- Which exact MapleRoyals client files and version are users expected to provide?
- Are MapleRoyals files standard `.wz`, extracted `.img`, or a mix?
- Does the target data include server-only data such as drop tables and shops?
- Should the first app be browser-only, local-server, or both?
- Is the project intended only for personal use, or for public open-source distribution?

## 14. Recommended First Task

Create a tiny parser + database spike:

- TypeScript project
- file input for `String.wz` and `Item.wz`
- parse files with an existing WZ library
- create a minimal SQLite schema
- extract one item ID into SQLite
- query SQLite to render its name/icon

This validates the hardest unknown before building the full wiki UI.

