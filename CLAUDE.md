# CLAUDE.md

Guidance that applies to every change in this repository. Source of truth for product scope is `docs/mapleroyals_wiki_clone_requirements.md`; source of truth for technical decisions is `docs/technical_requirements.md`. If this file disagrees with either, those win — update this file.

## Hard rules

1. **Never commit proprietary game data.** No `.wz`, no extracted `.img`, no PNG sprites or icons, no JSON snapshots derived from MapleStory/MapleRoyals files, no pre-generated databases. This applies to test fixtures and CI too. Tests use synthetic raw-tree fixtures only.
2. **Local-first. No network calls for parsing or data.** The only traffic the app makes is fetching its own static assets. No analytics, no telemetry, no remote logging, no remote storage of user files.
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

## When in doubt

- Reach for the boring, conventional option.
- Check `docs/technical_requirements.md` before introducing a new library or pattern.
- If a change would require touching more than one layer, name the boundary you're crossing and why.
