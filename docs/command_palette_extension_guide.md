# Extending the Command Palette

The command palette is the primary keyboard surface for the app. When you add a new entity type, a new route, or any user-facing feature, **palette wiring is part of the feature**, not a follow-up. This doc is the checklist for keeping the palette in lockstep with the app as it grows.

Feature spec: `command_palette_requirements.md`.

## Mental model

Treat the palette as a registry of **command providers** that contribute results based on (a) the current input string and (b) the current page context. Adding a feature means registering new commands. You should rarely need to touch palette internals to ship a new entity or page.

The palette result set is the union of:

1. **Global commands** — always available (navigation, theme, settings, etc.)
2. **Scoped search results** — fuzzy matches in the global entity index
3. **Context-aware commands** — contributed by the current detail page / listing
4. **Parsed-input commands** — driven by prefix shorthand, raw IDs, or `key:value` filter syntax

When you add a feature, decide which of these buckets it lands in and register accordingly.

## Checklist: adding a new entity type

1. **Register entity records in the global search index.** Name + ID should both be searchable. Provide a stable result label and a Lucide icon.
2. **Assign a category prefix.** Existing prefixes: `m ` mobs, `i ` items, `e ` equips, `n ` NPCs, `mp ` maps, `q ` quests, `c ` collections. Pick a short, collision-free shorthand and add it to the prefix table in `command_palette_requirements.md`.
3. **Register the listing route as a "Go to …" command.** The listing page must be reachable by name from the palette.
4. **Register detail-page context commands** for every cross-reference the entity exposes. If your entity links to mobs, maps, quests, etc., each of those relationships becomes a context command on the detail page (e.g. "Show mobs that drop this", "Show maps where this spawns").
5. **Declare filter grammar.** For each filterable attribute on the listing (level, class, element, slot, boss, etc.), register a `key:value` filter the palette will parse when the user types it. Document accepted values.
6. **Wire collection actions.** If the entity can be added to collections, ensure the existing add/remove/move/save-current-view commands recognize it. New entity types should never require palette-internal edits to participate in collections — the registration alone is enough.
7. **Add a random-entity command** for the new type if it makes sense (e.g. "Random quest").

## Checklist: adding a new page or feature

1. **Add a navigation command.** Every navigable route should be reachable from the palette by an unambiguous label.
2. **Register toggles and settings.** Every new toggle (theme variant, density mode, debug flag) gets a corresponding palette command. Don't hide a toggle exclusively behind a settings panel.
3. **Wire bulk/selection actions.** If your page introduces row selection or a filtered view, contribute commands that act on the selection or the view (add to collection, export, save as collection).
4. **Update the keyboard shortcut cheatsheet.** Any new local shortcut goes into the "Show keyboard shortcuts" command output.
5. **Update recents.** If the page represents a viewable entity, ensure it feeds the "Recently viewed" provider when opened.

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
- Works in both light and dark themes.
- No network calls fire (local-first; see `CLAUDE.md`).
- Esc closes the palette without side effects.

## Documenting your additions

When you add a new entity type or a category-level palette concept, update:

- `command_palette_requirements.md` — the category list and prefix table
- This file — only if the extension pattern itself changed (new bucket, new contract); not for every entity addition
