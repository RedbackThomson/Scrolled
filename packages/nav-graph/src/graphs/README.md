# Authored graphs

Each subdirectory here is one `NavGraphSource` — the curated topology for a
single server profile (a `profileId` matching `@scrolled/game-db`'s server
profile registry once the Navigator app picks it up).

**This directory holds graphs that ship inside this open-source repo.** They
must follow [`docs/writing_conventions.md`](../../../../docs/writing_conventions.md)
— no trademarked or copyrighted place names. The `starter/` graph below uses
fictional placeholder names and is what gets tested in CI.

Per-deployment graphs that target a specific real server (and inevitably need
that server's place names) live in **the deployment's own repo**, not here.
They are authored as a standalone TS file, fed to the CLI via `--source`, and
compiled to JSON at deploy time:

```
pnpm --filter @scrolled/nav-graph export \
  --source /abs/path/to/your-deployment/nav-graph/graph.ts \
  --out /abs/path/to/your-dist/nav-graph.json
```

## Layout

```
graphs/
├── starter/              demo graph used by tests + the default CLI run
│   ├── index.ts          defineGraph(...) → NavGraphSource
│   └── connectivity.test.ts
├── index.ts              registry: profileId → NavGraphSource (in-repo only)
└── README.md
```

## Authoring a new in-repo graph

Adding a graph that ships from this repo (rare — see the deployment-repo note
above) is three steps:

1. **Create a subdirectory** named after the profile (kebab-case).
2. **Author `index.ts`** with `defineGraph({ profileId: '<your-id>' }, (g) => { ... })`.
   Split into more files if it grows large — region files re-exporting builder
   functions that the index calls inside the `defineGraph` body work well.
3. **Register it** by adding an entry to `graphs/index.ts`. Then the CLI can
   emit it via `pnpm --filter @scrolled/nav-graph export -- --graph=<your-id>`.

## Authoring rules

- **Node ids are kebab-case slugs**, author-chosen — they are *not* game map
  ids. Pick whatever reads well in code.
- **Node/region/`via` text is user-visible copy.** In this repo it must follow
  [`docs/writing_conventions.md`](../../../../docs/writing_conventions.md) —
  no trademarked or copyrighted place names. Per-deployment graphs in their
  own repo make their own writing-policy call.
- **Numeric `itemId` / `questId` / `npcId` reference real entities.** They are
  the only direct coupling to game data; the Navigator app uses them to
  resolve names (when a dataset is loaded) and to deep-link into Scrolled.
- Default directionality: `walk` / `portalTo` are **bidirectional**; `npcTo` /
  `itemTo` / `skillTo` are **directed**. Override with `{ both: true }` or
  `{ both: false }` when the situation calls for it.
- Run `pnpm --filter @scrolled/nav-graph test` after editing — the validator
  catches duplicate ids, dangling refs, and unknown group ids before they
  reach the renderer.
