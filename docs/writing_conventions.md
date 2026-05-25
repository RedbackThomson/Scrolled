# Writing Conventions

Style guide for every user-visible string in the app — page titles, descriptions, empty states, confirmation dialogs, button labels, error messages, toast text, and any prose that ships in the UI. Also covers user-visible doc copy (README, in-app help) and the rare comment that reaches a contributor's eyes.

When this doc disagrees with copy already in the codebase, **this doc wins** — update the copy.

---

## 1. Brand safety — the unbreakable rule

**Do not reference anything trademarked or copyrighted in any user-visible string.** This is non-negotiable.

In particular, never use:

- **MapleStory**, **Nexon**, or any Nexon product name
- **MapleRoyals**, **MapleLegends**, or any other private-server name
- Class names, location names, item names, NPC names, mob names, or any other proper nouns lifted from those properties as UI chrome
- Logos, mascots, or other visual marks from those properties
- Phrases that imply affiliation, endorsement, or partnership with any of the above

The app is a **generic, format-agnostic wiki tool**. It happens to read a file format that some games use; that's a technical fact, not a brand identity. Write copy as if the underlying game is unnamed.

### Naming the underlying game

When you must refer to the game whose files the user loaded, call it:

- **"the Mushroom Game"** — friendly, neutral, used in welcome / pitch copy
- **"your game"** or **"your version of the game"** — when referring to _this user's_ loaded data
- **"the game"** — in passing references where context makes it clear

Never: "MapleStory", "Maple", "MS", "the Maple wiki", "your MapleStory data", etc.

### Naming file formats

In **user-visible copy**, prefer:

- **"game files"** over "WZ files"
- **"your library"** or **"your wiki"** over "the database" or "the WZ index"
- **"backup file"** or **"library backup"** over `.sqlite3` jargon (unless the user is power-tool-context — see §6)

The `.wz` format is a real fact and the file picker may need to mention the extension to set expectations — that's fine in narrow technical context (e.g. `accept=".wz"` tooltip, Diagnostics page). It is **not** fine in marketing or welcome copy.

### Internal docs and code comments

This doc is primarily about user-visible strings. Internal architecture docs (`docs/technical_requirements.md`, code comments) may use nominative technical references — e.g. "MapleRoyals v83-era encryption" when describing a real compatibility constraint — because that's documenting fact, not affiliating. Even there, **default to neutral language** unless precision genuinely requires the proper noun.

---

## 2. Voice

- **Plain, neutral, terse.** No marketing energy. No exclamation points (with one exception: the post-setup "Go Explore!" CTA).
- **Second person ("you", "your") when speaking to the user.** First person ("we") is fine in docs but not in the app UI.
- **Active voice.** "Run setup to add them" — not "files can be added by running setup".
- **Sentence case** for headings, buttons, labels. Not Title Case. ("New collection", not "New Collection".)
- **No emoji** in UI strings unless the user explicitly asks for them.

---

## 3. Page descriptions

**Default to no description.** Most list pages don't need one — the heading and the table speak for themselves.

Add a one-line description **only when it tells the user something they couldn't infer from the page itself**, such as:

- A scope clarification ("Consumables, scrolls, etc, and setup items. Equipment is listed separately.")
- A cross-reference ("Weapons are on the Weapons page.")
- A non-obvious page-level interaction ("Filter by weapon type to see the stat columns most relevant to it.")

**Do not write descriptions that:**

- Define the entity ("NPCs are non-player characters." → users know.)
- Explain how to use a table or search bar ("Search by name to find a specific X." → users know.)
- Restate the page title ("This is the Maps page where you can browse maps." → useless.)
- Use marketing adjectives ("Every quest in the game!" → no.)

If you can't write a description that adds value in under ~15 words, **don't write one**.

---

## 4. Empty states, not-found states, errors

These should be **consistent across the app**. Pick the right template; don't improvise.

### List page empty state

Pattern: `"No <entities> loaded yet. Run setup to add them."` — with `Run setup` linking to `/setup`.

```
No items loaded yet. Run setup to add them.
No quests loaded yet. Run setup to add them.
No collections yet. Click "New collection" to create one…
```

### Detail page "not found"

Pattern: `"<Entity> {id} isn't in your library yet. It may not have been loaded — visit Setup to add more files."`

```
Item 2000000 isn't in your library yet. It may not have been loaded — visit Setup to add more files.
```

### Inline empty subsection (e.g. "Drops" with no rows)

A single italicized word: `None.`

### Error messages

- Lead with what failed, not what the user did. "Couldn't restore from this file" → not "You picked a bad file".
- Include the underlying message verbatim if it's likely actionable; otherwise summarize.
- Offer a next step when one exists ("Try again" / "Pick a different file" / "See Diagnostics for the full error chain").

### Confirmation dialogs (destructive actions)

Three parts, in order:

1. **What's about to happen**, framed as a question. ("Clear all data from the local library?")
2. **The scope** of the destruction. ("Every loaded item, mob, NPC, map, and quest will be removed.")
3. **What's _not_ affected**, when relevant. ("Your game files on disk are untouched.")

---

## 5. Vocabulary cheat sheet

| Prefer                | Avoid                                            | Why                          |
| --------------------- | ------------------------------------------------ | ---------------------------- |
| the Mushroom Game     | MapleStory, Maple, MS, MapleRoyals               | Brand safety                 |
| your game / your wiki | their game, the source game                      | Speaks to the user           |
| your library          | the database, the SQLite store, the index        | Plain language               |
| game files            | WZ files, `.wz` files                            | In welcome/marketing copy    |
| Run setup / Setup     | the wizard, the importer, the loader             | Matches the URL/button label |
| Diagnostics           | Debug, Parser debug, the dev page                | Matches the page title       |
| load / loaded         | extract / extracted, ingest / ingested           | Plain                        |
| library / loaded data | dataset, dataset record, corpus                  | Plain                        |
| backup file           | `.sqlite3` export, raw dump                      | Hides implementation         |
| collection            | bookmark folder, saved list (in formal contexts) | The product term             |

---

## 6. Implementation language — keep it out of UI copy

These belong in code, comments, or the Diagnostics page only. **Never** in headings, descriptions, empty states, button labels, or confirmation dialogs:

- File format names: `Item.wz`, `String.wz`, `Mob.wz`, `Character.wz`, `Map.wz`, `Quest.wz`, `String.wz/Eqp.img`, etc.
- Internal paths: `String.wz/Consume.img/2000000`, `Item.wz/Consume/…`
- Database internals: `sqlite3`, `OPFS`, `schema v3`, `BLOB`, `WAL`
- Worker / runtime internals: `comlink`, `worker`, `parser pool`, `extractor`
- Project-roadmap language: "Phase 1", "Phase 2", "spike", "MVP", "v0", "alpha goal"
- Code-shape leaks: `Math.floor(id / 10000)`, `bitfield N`, regex fragments, type names

The Diagnostics page (`/debug`) is the **one exception**. That page is explicitly the place for power-user / contributor inspection, so technical terms are appropriate there.

### Project phases are dead

The codebase used to refer to "Phase 1 / 2 / 3" implementation milestones. **Those phases are over.** Don't introduce phase-numbered language in either UI strings or code comments. If you need to mark sequential steps inside a function, use "Step 1 / Step 2" — they're unambiguous and don't imply a roadmap.

---

## 7. Microcopy

- **Buttons:** verb + object. "Save", "New collection", "Import", "Export all", "Run setup". Not "Click here", not "Submit".
- **Links:** match the destination label. A link to `/setup` reads "Setup" or "Run setup", not "click here" or "this page".
- **Counts:** singular vs. plural matters. `1 item`, `0 items`, `12 items`. Use a helper if you're branching inline.
- **Numbers:** thousands separators in display (`12,345`), monospace font for IDs and counts.
- **Em dashes** (`—`), not double hyphens (`--`). Curly quotes (`'`, `"`) are fine if surrounding code preserves them; ASCII (`'`, `"`) is also fine. Pick one per file and stay consistent.

---

## 8. Examples — before / after

**Page description**

```
Before: Items extracted from Item.wz, joined with localized names from String.wz.
After:  Consumables, scrolls, etc, and setup items. Equipment is listed separately.
```

**Empty state**

```
Before: No quests yet. Load Quest.wz via setup to populate this list.
After:  No quests loaded yet. Run setup to add them.
```

**Welcome pitch**

```
Before: Set up your wiki by loading your local WZ files. Everything stays in your
        browser — no uploads, no remote services.
After:  A personal wiki that adapts to your version of the Mushroom Game. Load
        your game files to fill it in.
```

**Detail page not-found**

```
Before: ID 2000000 isn't in the local database. Try running extraction on the
        /debug page.
After:  Item 2000000 isn't in your library yet. It may not have been loaded —
        visit Setup to add more files.
```

**Destructive confirm**

```
Before: Clear all data from the local database? Loaded items, mobs, NPCs, maps,
        and dataset records will be deleted. Your WZ files on disk are untouched.
After:  Clear all data from the local library? Every loaded item, mob, NPC, map,
        and quest will be removed. Your game files on disk are untouched.
```

---

## 9. When in doubt

- Read it aloud. If it sounds like an internal Slack message or a code comment, rewrite.
- Cut adjectives. Cut adverbs. Cut anything that doesn't add information.
- If you wouldn't write it on a sticky note, don't ship it.
