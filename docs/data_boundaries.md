# Data & Package Boundaries

The source of truth for **which package owns which domain** and **who may import
whom**. Companion to `technical_requirements.md` (the *how* of the stack) and the
architectural rules in `CLAUDE.md` (which point here). When this document
disagrees with the code, the code is the bug.

The motivating goal: the web app should contain only the minimum needed to
**drive extraction** and **read & display** the data. Everything else —
extracting, storing, encoding, transferring — lives in packages with one owner
each, so domains don't sprawl back into the app.

## The two paths

Every dependency in this repo serves one of two paths:

- **Write path** — turning a user's WZ files into a stored, queryable database.
  `wz` → `extractor` (parser → extractors → builder) → `game-db` (storage).
- **Read path** — interpreting and displaying a database that already exists.
  `game-db` (queries, types, domain decoders, server profiles) → the web app.

The web app sits at the top of both. It depends on the **read** contract for
everything it renders, and on the **write** contract *only* in the narrow layer
that drives in-browser extraction (the wizard, the parser/db workers, the
extraction hooks). UI/display code never reaches into the write path.

## Package graph

```
@scrolled/wz            leaf — WZ crypto/io, version detection
@scrolled/dataset-core  leaf — hosted-DATASET distribution: manifest/channel
                               schemas + the .scrolled-dataset artifact
                               (encode/decode) + shared tar/gzip codec
@scrolled/game-db       READ + STORAGE contract  → deps: dataset-core
                          db/            sqlite, schema, migrations, queries,
                                         types, GameDatabase interface
                          domain/        decoders: equipTypes, equipJobs, jobs,
                                         skillElements, mobElements, abilityStats,
                                         skillTemplate, portal-types
                          versions       CURRENT_DATA_REVISION, MIN_SUPPORTED_*
                          serverProfiles types, schema, registry, fingerprints,
                                         equip-stat calculators
                          backup/        .scrolled-backup pack/read + compat eval
                          lib/           logger, progress, math (worker-safe)
@scrolled/dataset-repository  → deps: dataset-core      (resolve/download)
@scrolled/dataset-client      → deps: dataset-core, dataset-repository (install)
@scrolled/extractor     WRITE path  → deps: wz, game-db, dataset-core
                          parser/        WZ tree, image decode, webp anim
                          extractors/    tree → records
                          builder/       CLI, runExtraction, .scrolled-dataset
                                         packing, extractStats, store-extraction
apps/web  → deps: game-db (display), extractor (in-browser extraction),
                  dataset-client/-core/-repository, config, wz, mcp-protocol
```

The graph is acyclic. A package never imports "up" toward the web app. The web
app is the only integrator.

## Ownership & allowed imports

| Concern | Owner | May import |
| --- | --- | --- |
| WZ bytes → tree, crypto, image decode | `wz`, `extractor/parser` | wz |
| tree → typed records | `extractor/extractors` | game-db (record types, domain) |
| extraction orchestration / CLI / packing | `extractor/builder` | wz, game-db, dataset-core |
| db schema / migrations / queries / types | `game-db/db` | dataset-core, game-db/lib |
| domain decoders (labels, elements, jobs…) | `game-db/domain` | (leaf) |
| data & schema versioning | `game-db` | — |
| server profiles (incl. equip-stat calculator) | `game-db` | dataset-core |
| `.scrolled-dataset` artifact (hosted distribution) | `dataset-core` | zod, fflate |
| shared tar/gzip codec | `dataset-core` | fflate |
| `.scrolled-backup` artifact (user db backup) | `game-db` | dataset-core (codec) |
| backup/dataset compatibility (version gating) | `game-db` | dataset-core |
| hosted dataset resolve / download / install | `dataset-repository`, `dataset-client` | dataset-core |
| **display / read of extracted data** | `apps/web` | **game-db, dataset-\*** |
| **driving in-browser extraction** | `apps/web` (`workers/`, `hooks/extraction/`, `parser/`, `components/wizard/`) | **extractor** |
| user DB (collections, pinned searches, prefs) | `apps/web/db/user` | game-db/db (sqlite only) |

## The hard rule, lint-enforced

**Web UI/display code must not import `@scrolled/extractor`.** The read path goes
through `@scrolled/game-db`. The extractor is reachable only from the extraction
layer: `apps/web/src/workers/`, `hooks/extraction/`, `parser/`, and
`components/wizard/`.

This is enforced in `eslint.config.js` via file-scoped `no-restricted-imports`
blocks, not left to discipline:

- `apps/web` display dirs (`components/` except `wizard/`, `routes/`, `lib/`,
  `search/`) — cannot import `@scrolled/extractor` or its subpaths. One
  documented exception: `components/common/extractorCatalog.ts` imports the
  extractor's canonical key vocabulary (it pairs label + lucide icon to each
  extraction category, so it can't live in the extractor). That's a type/const
  import, not extraction logic.
- `packages/game-db` — cannot import `@scrolled/extractor` or `@scrolled/wz`.
- `packages/dataset-core` — cannot import any `@scrolled/*` package (it is a
  leaf; only `zod`/`fflate`).

## The two artifacts (don't conflate them)

Two tar+gzip-of-sqlite containers exist for two **different deployment modes**.
They are similar but have separate schemas, separate `format`/`formatVersion`
strings, and separate owners. Do not merge them.

- **`.scrolled-backup`** — *generic mode.* The user exports their own game +
  user databases to back up and restore. Owned by `game-db` (`packBackup` /
  `readBackup`). A storage concern.
- **`.scrolled-dataset`** — *hosted mode.* Published game data the user
  downloads, described by `dataset-core`'s `datasetManifestSchema`
  (serverProfileId, calculatorId, dataRevision, schemaVersion). Owned by
  `dataset-core` (`packDataset` / `readDataset`). A distribution concern.

The shared tar/gzip codec lives in `dataset-core`; both artifacts reuse it.
Where the schemas legitimately overlap (a db-section shape, the version fields),
factor the shared piece into a small reused type — never one combined artifact.

## Known compromise

The equip-stat **calculator** lives in `game-db` (the whole server-profile domain
does) but is *invoked from the web app's display layer* at render time. That is
acceptable because the web app already depends on `game-db` as its read contract.
It is a candidate for a future rewrite (precompute ranges at extraction), but it
does not justify splitting the server-profile domain across packages today.

## Versioning

Two independent versions guard the database; know which a change needs. Mechanics
live in `DEVELOPMENT.md` → "Schema and data versioning". Both constants live in
`game-db`. Splitting code between packages or renaming an artifact format is not,
by itself, a data-revision change — bump `CURRENT_DATA_REVISION` only when
extraction *output* changes.
