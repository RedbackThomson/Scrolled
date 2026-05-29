# Command Palette — v1 Requirements

Feature spec for the global command palette. Companion to `mapleroyals_wiki_clone_requirements.md` (product scope) and `technical_requirements.md` (stack & layout). Extension contract for new entity types and pages lives in `command_palette_extension_guide.md`.

## Context

The wiki-clone covers six richly cross-referenced entity types (items, equips, mobs, NPCs, maps, quests) plus user-created collections. Today, moving between related entities or invoking power-user features (bulk collection actions, saved filters, debug tools, data reload) requires multi-step navigation or surfacing controls that would clutter the persistent UI.

A command palette compresses those flows into a single keystroke entry point and gives features that don't deserve permanent UI real estate a discoverable home. Reference designs: **Linear** (primary model) and **Raycast** — fast, context-aware, prefix-friendly, with hybrid ranking.

Target user: a player exploring or organizing data deeply enough to hit the palette dozens of times per session.

## Goals

- Single-keystroke entry to every navigable surface and most user-facing actions
- Context-aware commands surface as first-class results on detail pages, not buried
- Both fuzzy free-text matching and prefix shorthand for power users
- Home for features that would otherwise clutter the persistent UI
- Local-first; no network calls (per `CLAUDE.md`)

## Non-goals (v1)

- No natural-language / LLM querying; deterministic matching only
- No remote sync of palette state (recents, pinned searches) across devices

## Entry points

- The palette **replaces** the existing top-bar global search input
- Clicking the search bar opens the palette (the bar acts as a visual affordance / target)
- Global hotkey **Cmd/Ctrl+K** opens the palette from anywhere
- Esc closes the palette

## Command categories

### 1. Global search & navigation

- Fuzzy match across all entity types by name and ID
- Category-prefix shorthand for scoped search (e.g. `m ` for mobs, `i ` for items, `q ` for quests, `qc ` for quest chains, `mp ` for maps, `n ` for NPCs, `e ` for equips, `c ` for collections)
- Raw entity ID resolution — typing a numeric ID jumps to the matching entity
- Top-level destinations: each listing page, settings panes, debug, collections index

### 2. Recents & history

- Recently viewed entities, ranked by recency
- Recent search queries (re-runnable)
- Resume last filtered listing view ("where I was")

### 3. Context-aware jumps (from a detail page)

- **Mob** → drops, spawn maps, quests using this mob
- **Map** → connected maps via portals, "Open in MapViewer"
- **Quest** → prerequisite chain, quests this unlocks, start/end NPC
- **Item / equip** → mobs that drop this, quests using this
- **NPC** → maps where this NPC appears, quests started/ended here
- These appear pinned at the top of the palette when on the relevant detail page

### 4. Filtered navigation in one shot

- Inline filter syntax (Linear/GitHub style `key:value`): `mobs level:50-70 boss`, `equips class:warrior slot:weapon`
- **Pinned/saved searches** — save a filter combination with a name, relaunch by name
- "Reset filters on current listing"

### 5. Collections

- Add to / remove from collection (context-aware on entity detail pages)
- Create new collection, optionally seeded with the current entity
- Move entity between collections
- Rename / delete / duplicate a collection
- Save current filtered listing as a new collection
- Export single collection / export all / import JSON

### 6. Bulk actions on current selection

- "Add N selected to collection…"
- "Remove N selected from collection…"
- "Export N selected as JSON"
- "Save current filtered view as a collection"

### 7. UI & accessibility toggles

- Theme: light / dark / system
- Sidebar collapse
- Density toggle (compact ↔ comfortable)
- Reset column visibility on current listing
- "Show keyboard shortcuts" cheatsheet

### 8. Data management & debug

- Reload data files / re-open setup wizard
- Show data validation warnings / unparsed entities
- Open WZ tree viewer (debug page)
- Copy entity ID / WZ path / permalink to clipboard

### 9. Exploration & discovery

- Random entity — "Random map," "Random boss," "Random anything"
- Open MapViewer directly for a chosen map (skip the detail page)

### 10. Settings & meta

- Jump to a specific settings pane (data, theme, collections)
- Show app + data version

## Design decisions

| Topic               | Decision                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Trigger             | Cmd/Ctrl+K, or click the top-bar search input (which the palette replaces). Esc closes.                            |
| Result ranking      | Hybrid: fuzzy match score blended with recency weight. Context-aware results pinned above globals on detail pages. |
| Context scope       | Show context + globals together, with context pinned at the top. Not context-only.                                 |
| Prefix syntax       | Optional accelerator; free-text always works.                                                                      |
| Filter grammar      | GitHub/Linear-style `key:value`, space-separated terms.                                                            |
| Selection awareness | Palette reads the current listing's row selection and filter state.                                                |
| Persistence         | `idb-keyval` for recents and pinned searches, per the existing convention in `CLAUDE.md`.                          |

## Open questions

- Which categories ship in v1 vs. defer? (Sections 1–5 are the core; 6–10 are graduations.)
- Are there entity-type-specific commands not yet captured (job-class filter for equips, element filter for mobs)?

## Verification

- Manual smoke test of every shipped command category in light + dark
- Keyboard-only navigation: open palette, run each command class without mouse
- Test on a freshly-imported dataset (empty recents, no pinned searches) and on a populated one
- Verify context-aware commands appear correctly on each entity detail page type
- Confirm zero network calls when palette is used (per local-first rule)
- Accessibility: focus trap, screen reader announces results, Esc closes
