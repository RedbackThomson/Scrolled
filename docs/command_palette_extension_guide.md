# Extending the Command Palette

The command palette is the primary keyboard surface for the app. When you add a new entity type, a new route, or any user-facing feature, **palette wiring is part of the feature**, not a follow-up. This doc is the checklist for keeping the palette in lockstep with the app as it grows.

Feature spec: `command_palette_requirements.md`.

## Mental model

The palette is a `cmdk` dialog (`apps/web/src/components/command-palette/Palette.tsx`) bound to `Mod+K` via `@tanstack/react-hotkeys`. Its result list is composed from a stack of **provider components**, each a small React component that subscribes to the shared `useCommandPalette` Zustand store and renders a `CommandGroup` of items when relevant.

Each provider's responsibilities:

1. Read the current query and (when applicable) the active page context from `useCommandPalette`.
2. Decide whether it has anything to contribute — return `null` if not.
3. Render a `<CommandGroup heading="…">` containing one or more `<CommandItemPrimitive>` rows.

The palette result set is the union of four buckets — every provider lands in one of them:

1. **Page-bound context** — driven by the active detail/listing page (e.g. "Copy mob ID", "Add to <existing collection>", "Pin current filter").
2. **Parsed-input commands** — driven by what the user typed (filter syntax, prefix shorthand, raw IDs).
3. **Personal & curated** — recents (entities + queries) and saved pinned searches.
4. **Static globals** — navigation, toggles, write actions, exploration.

When you add a feature, decide which bucket it lands in and register accordingly. Bucket choice dictates render order in `Palette.tsx`, which dictates priority.

## Provider tiers (render order)

`cmdk`'s default ranking is disabled (`shouldFilter={false}` on the root `Command`). Each provider does its own substring filter and renders matching items in DOM order. **The order providers render in `Palette.tsx` is the user-visible priority order.**

The current stack (see `apps/web/src/components/command-palette/Palette.tsx`):

```
1. ContextProvider                    page items (Copy ID, Open in MapViewer, …)
2. CollectionsContextProvider         Add to <existing collection>    (read)
3. PinCurrentProvider                 Pin current filter              (write, but explicit user intent)
4. FilterProvider                     `mobs level:50-70 boss` parsed-input
5. RecentsProvider                    recently viewed + recent queries
6. PinnedSearchesProvider             saved listing filters
7. GlobalSearchProvider               MiniSearch hits across entities       ← search
8. NavigationProvider                 Go to <listing> / Settings / Debug
9. CollectionsNavigationProvider      Go to <collection>
10. CollectionsCreateProvider         Create collection X with this <entity>  (write)
11. TogglesProvider                   theme cycle
12. DataProvider                      Reload data / Parser debug
13. FunProvider                       Random <entity>
```

Two rules of thumb pulled from prior reviews:

- **Read-only context actions outrank search; writes do not.** "Add to <collection>" is a returning user filing an entity into an existing list — pin it above search. "Create collection X with this entity" is a destructive write triggered by free-text — keep it below search where it won't be hit by accident.
- **Pin context above globals on detail pages.** That's the requirements doc's only ranking rule; everything else flows from it.

If you add a provider, pick its slot deliberately and add a comment in `Palette.tsx` explaining why.

## Provider skeleton

A provider is ~30 lines. Copy this shape:

```tsx
// providers/myThing.tsx
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/lib/useCommandPalette';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

export function MyThingProvider() {
  const query = useCommandPalette((s) => s.query);
  const setOpen = useCommandPalette((s) => s.setOpen);
  // const pageContext = useCommandPalette((s) => s.pageContext);  // if context-aware

  const items = ENTRIES.filter((e) => fuzzy(query, `${e.label} ${e.keywords.join(' ')}`));
  if (items.length === 0) return null;

  return (
    <CommandGroup heading="My thing">
      {items.map((e) => (
        <CommandItemPrimitive
          key={e.id}
          value={e.id} // must be unique across the whole palette
          keywords={[e.label, ...e.keywords]}
          onSelect={() => {
            e.action();
            setOpen(false);
          }}
        >
          <e.icon className="text-muted-foreground h-4 w-4" />
          <span>{e.label}</span>
        </CommandItemPrimitive>
      ))}
    </CommandGroup>
  );
}
```

Then mount it in the right slot in `Palette.tsx`'s `<CommandList>`.

**Item `value` must be unique across the whole palette**, not just within the group — cmdk uses it as a global identifier for keyboard nav. Convention: prefix by provider, e.g. `nav-mobs`, `coll-add-42`, `hit-mob-12345`, `theme-system`.

## Checklist: adding a new entity type

1. **Register entity records in the global search index.** Name + ID both searchable, plus a stable category label. Add the entity to `db/queries.ts:listSearchEntries` so MiniSearch picks it up automatically — no palette-internal edits required.
2. **Assign a category prefix** (single-token, leading position). Existing prefixes (`apps/web/src/components/command-palette/providers/globalSearch.tsx`): `m` mobs, `i` items, `e` equips, `n` NPCs, `mp` maps, `q` quests, `qc` quest chains, `s` skills, `c` collections. Pick a short, collision-free shorthand and add it to the table in `command_palette_requirements.md`.
3. **Register the listing route as a "Go to …" command** in `NavigationProvider` (`providers/navigation.tsx`). The listing must be reachable by name from the palette.
4. **Register detail-page context commands.** On every detail page, call `useDetailPalette({ entity, id, name, items })` from `components/command-palette/useDetailPalette.ts` with a memoized items array — see `routes/MobDetail.tsx` for the canonical pattern. This single hook handles both the context registration AND the recents tracking.
5. **Declare filter grammar.** Add an entry to `FILTER_KEYS` in `lib/filterGrammar.ts` listing the keys you accept. For each key:
   - `kind: 'number'` for ranges/comparisons (`level:50`, `level:50-70`, `level:>=80`)
   - `kind: 'enum'` for fixed sets (`category:use`)
   - `kind: 'string'` for substring (`subcategory:foo`)
   - `kind: 'boolean'` for flags (`cash:true`, bare `cash`)
     The grammar emits standard `f_<param>=…` URL params — the same shape the column-filter pipeline produces — so navigating to `<listing>?<params>` lights up the existing filter UI without a parallel code path. Keys you register here surface automatically in the palette's "available filters" chip row (`providers/filterKeys.tsx`) once an entity prefix is typed, so users don't have to read this file to discover them.
6. **Wire collection actions.** If the entity is in `COLLECTION_ENTITY_TYPES`, the existing `CollectionsContextProvider` and bulk-add UI work without changes. Confirm by opening the palette on a detail page of the new type — you should see "Add to <collection>" entries.
7. **Add a random-entity command** in `providers/fun.tsx` by extending the `ENTITY_KINDS`/`enabled` gate.

## Checklist: adding a new page or feature

1. **Add a navigation command** in `NavigationProvider` so the route is reachable by an unambiguous label.
2. **Register toggles and settings.** Every new toggle (theme variant, density mode, debug flag) gets a corresponding palette command in `providers/toggles.tsx`. Don't hide a toggle exclusively behind a settings panel.
3. **Wire bulk/selection actions.** If your page introduces row selection or a filtered view, write a small context-aware provider, or push a selection ref into `useCommandPalette` so a shared bulk provider can pick it up.
4. **Update the cheatsheet.** Any new local shortcut goes into `providers/help.tsx` (rendered when the user types `?`).
5. **Update recents.** Detail pages should call `useDetailPalette` so opening the page feeds the "Recently viewed" provider. (The hook handles this automatically.)

## Filter grammar lessons

**Booleans are uniform — no custom encoders.** If a listing has a boolean filter, the path is:

1. Add a column to `<Entity>Columns.tsx` with `meta: { filter: 'boolean' }` (visible or not).
2. Add the column key to the entity's `*_FILTER` in `db/queries.ts` as `{ col: '<sql_col>', type: 'number' }` (boolean column filters arrive as `{ kind: 'range', min: 1, max: 1 }` and the number path handles them — see the `equips.cash` and `mobs.boss` entries).
3. Add the key to `FILTER_KEYS` in `lib/filterGrammar.ts` as `{ kind: 'boolean', param: '<colId>' }`.

That's the whole loop. There should be no entity-specific URL params like `?boss=1` living outside the `f_<col>` namespace; if you find one, fold it into the column-filter pipeline (commit `87b3d60d` did this for mobs.boss). The `FilterSpec` union deliberately has no `custom` variant — resist re-adding it.

**Unknown keys fall through to free-text name search.** `parseFilterQuery("mobs colour:blue")` produces `f_name=colour:blue` rather than erroring. This is intentional — users shouldn't need to learn the full grammar to get a reasonable result.

## State and persistence

- **`lib/useCommandPalette.ts`** — Zustand store: `open`, `query`, `pageContext`, `contextItems`, optional `selection`. The single source of truth for palette state.
- **`lib/recents.ts`** — `useRecentEntities` and `useRecentQueries`, backed by `idb-keyval` keys `scrolled.recents.entities` / `scrolled.recents.queries`. Capped LRU (30 entities / 15 queries). Transient — fine to clear, never exported.
- **`lib/usePinnedSearches.ts`** — TanStack Query hooks over the user SQLite DB's `pinned_searches` table. Durable. Travels with the user-DB JSON export (`db/user/collectionsJson.ts`); old export files without the `pinnedSearches` field still import cleanly.

The split is the rule: anything the user explicitly named and saved goes in the user DB. Anything we accumulate on their behalf goes in idb-keyval.

## cmdk gotchas

- **Filtering is off.** `Command` mounts with `shouldFilter={false}`. Each provider filters itself. Don't be tempted to rely on cmdk's built-in fuzzy ranking — it would re-order MiniSearch hits and surprise users.
- **`value` is global.** Two items with the same `value` will confuse keyboard nav. Always prefix.
- **`CommandList` accepts arbitrary children.** That's how `HelpProvider` (`providers/help.tsx`) renders a non-selectable cheatsheet inside the list when the query is `?`.
- **The `CommandDialog` footer slot** (added in `components/ui/command.tsx`) is the right place for global affordances like the kbd legend — keep providers focused on commands.

## When NOT to add a palette command

The palette stays valuable by staying curated. Skip the registration when:

- The action is **hyperlocal**: only meaningful inline (sorting one column, resizing one panel).
- The action has **no stable name** a user could type to find it.
- It **duplicates an existing command** — extend the existing one with smarter default behavior instead.
- It's a **dev-only debug** action not worth surfacing to end users (use the debug page for those).

## Avoiding bloat

- Prefer **fewer, better-named** commands. If two commands feel similar, merge them.
- A typical query should not surface more than ~15 useful results. If your additions push the count past that on common queries, reconsider scoping or ranking.
- Context-aware commands always rank above globals on detail pages.
- Don't ship a command whose label requires explanation — rename until the action is obvious from the label alone.

## Verifying palette work

Before shipping any palette change, manually check:

- The command appears when expected (right page, right entity type, right query).
- It does what its label says, keyboard-only.
- Result has an icon (Lucide) and a stable, scannable label.
- Works in both light and dark themes (including `theme: system` following `prefers-color-scheme`).
- No network calls fire (local-first; see `CLAUDE.md`).
- Esc closes the palette without side effects.
- For filter-grammar additions, add a case to `lib/filterGrammar.test.ts`.

## Documenting your additions

When you add a new entity type or a category-level palette concept, update:

- `command_palette_requirements.md` — the category list and prefix table
- This file — only if the extension pattern itself changed (new bucket, new contract, new gotcha); not for every entity addition
