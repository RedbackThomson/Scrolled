# CLAUDE.md

Guidance that applies to every change in this repository. Source of truth for product scope is `docs/mapleroyals_wiki_clone_requirements.md`; source of truth for technical decisions is `docs/technical_requirements.md`. If this file disagrees with either, those win — update this file.

When you add an entity type, a route, or a user-facing feature, follow `docs/command_palette_extension_guide.md` so the command palette grows with the app. Palette wiring is part of the feature, not a follow-up. The palette's own spec is `docs/command_palette_requirements.md`.

**Any time you write or touch user-visible copy** (UI strings, page descriptions, empty states, confirmations, error messages, button labels), follow `docs/writing_conventions.md`. That doc is the source of truth for tone, vocabulary, and — most importantly — the absolute prohibition on referencing trademarked or copyrighted properties (MapleStory, Nexon, MapleRoyals, MapleLegends, etc.) in shipped strings.

## Core tenets

Four principles motivate the hard and architectural rules below. They're philosophical, not procedural — the tie-breakers when no specific rule covers a decision. If a change would weaken one of these, that's a signal to stop and reconsider.

1. **Open source first.** The project is open from day one — permissively licensed, developed in the open, and free to fork. It's a community tool, not a proprietary product. Nothing essential may live behind private data, assets, or credentials; what's published is the whole thing.
2. **Self-hostable.** Anyone can run their own instance, on their own infrastructure, with no dependency on us. There is no privileged central server the app needs to function, no account to create, no service to pay for. Whatever the canonical deployment can do, a self-hoster can do too.
3. **Nothing proprietary.** We ship our own code and nothing else — no game data, assets, or third-party content in the project, and no trademarked names or branding in what users see. The app is a generic tool that reads a file format; the user brings their own content and owns the rights to it.
4. **Support offline mode.** The app belongs to the user and runs on their device. Their data stays with them — it is never required to leave the machine — and the app keeps working without a network connection. Connectivity may enhance the experience, but it is never a precondition for using it.

## Hard rules

1. **Never commit proprietary game data.** No `.wz`, no extracted `.img`, no PNG sprites or icons, no JSON snapshots derived from MapleStory/MapleRoyals files, no pre-generated databases. This applies to test fixtures and CI too. Tests use synthetic raw-tree fixtures only.
2. **Local-first. No network calls for parsing or data.** Parsing, extraction, storage, and search run entirely in the user's browser. No remote services participate, no user files are uploaded, no remote logging. The only exception is anonymous pageview analytics on the canonical hosted deployment — see §2.7 of `docs/technical_requirements.md`. That carve-out is opt-out, ad-blocker-friendly, host-gated so forks don't inherit it, and tracks no entity IDs, file contents, or user identifiers.
3. **No proprietary branding.** Don't use MapleStory or Nexon names/logos as if affiliated. Nominative references in docs are fine; visual branding is not.
4. **All commands run inside the nix flake dev shell.** Node, pnpm, and the rest of the toolchain are only guaranteed to exist there. Wrap every shell invocation as `nix develop -c <command>` (e.g. `nix develop -c pnpm install`, `nix develop -c pnpm typecheck`). Don't assume `node` / `pnpm` are on PATH outside the shell, and don't suggest commands the user would have to run bare.

## Architectural rules

4. **Respect the layer boundary.** The pipeline is `parser/` → `extractors/` → `db/` → `search/` + `routes/`/`components/`. UI code must not import from `parser/` or `extractors/`. The parser must not know about React or SQLite. This boundary is what makes a future Tauri/local-server backend a swap, not a rewrite.
5. **Heavy work runs in a Worker.** WZ parsing and SQLite live in Workers, addressed via `comlink`. The main thread doesn't block on parsing or queries.
6. **Validate at the parser/domain boundary.** Use Zod schemas where raw parsed data becomes typed domain records. Don't propagate untyped tree shapes into the UI.

## Stack — committed choices

Don't switch these without updating `docs/technical_requirements.md` first.

- Vite + React 18 + TypeScript (strict), pnpm workspaces
- React Router v6, Tailwind CSS v3, shadcn/ui, Lucide
- TanStack Query (async cache) + Zustand (UI state). **No Redux.**
- `@tybys/wz` for WZ parsing, `comlink` for Worker RPC
- `@sqlite.org/sqlite-wasm` with OPFS (IndexedDB fallback)
- MiniSearch for search, `idb-keyval` for small KV, Zod for validation
- Vitest for tests

## Design language

- Standard wiki patterns — sidebar with nested nav, top search bar, Cmd/Ctrl+K palette, MediaWiki-style infobox detail pages. Don't reinvent.
- Light + dark via Tailwind `class` strategy, neutral slate/zinc tokens, no game branding.
- Desktop-first, accessible (WCAG AA), keyboard navigable.

## Coding standards

- Strict TS. `any` only at FFI boundaries, with a justification comment.
- Path aliases: `@/parser`, `@/extractors`, `@/db`, `@/search`, `@/routes`, `@/components`, `@/lib`.
- Named exports by default; one default export per route component.
- Tests colocated as `*.test.ts`.
- Comments only for non-obvious _why_. Don't describe _what_ the code does.
- No backwards-compatibility shims, no speculative abstractions, no error handling for cases that can't occur.

## Data integrity — schema vs. data revisions

The library is a derived cache of the user's game files, guarded by two
independent versions. Know which one a change needs. Mechanics: `DEVELOPMENT.md`
→ "Schema and data versioning".

- **Schema version** (`_migrations`, `db/migrations.ts`): the SQL shape. Add a
  migration for any DDL change. Forward-only — append, never edit or reorder.
- **Data revision** (`db/dataVersion.ts`): the extracted-data contract. Bump it
  when extraction output changes (new extraction-fed column, reinterpreted field,
  changed extractor); a migration changes the shape, the bump refills the rows.

Two ways to bump, and prefer breaking:

- **Breaking** (the data changes): raise **both** constants. The cache is
  destructively cleared _before_ migrations run, so your migration hits empty
  tables — write a clean schema (`ADD COLUMN … NOT NULL`, no nullable sentinels).
- **Additive** (old data still renders): raise `CURRENT_DATA_REVISION` only. The
  migration hits populated tables, so new columns must tolerate existing rows
  (nullable or `NOT NULL DEFAULT`) — the only case a nullable backfill belongs.

Don't bump revisions for UI-only or extraction-independent schema changes.

## When in doubt

- Reach for the boring, conventional option.
- Check `docs/technical_requirements.md` before introducing a new library or pattern.
- If a change would require touching more than one layer, name the boundary you're crossing and why.
