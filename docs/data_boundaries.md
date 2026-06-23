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
@scrolled/identity-core  leaf — provider-agnostic identity contract:
                                IdentityProvider, UserSession, anonymous
                                provider; React context/hooks on /react subpath
@scrolled/identity-cloud  → deps: identity-core, @supabase/supabase-js
                                Supabase provider; hosted builds only
@scrolled/sync-core      leaf — provider-agnostic sync contract: SyncProvider,
                                protocol types/zod schemas, conflict handler,
                                SyncEngine, in-memory mock provider; React status
                                context/hooks on /react subpath. Ships everywhere.
@scrolled/sync-supabase  → deps: sync-core, identity-core, @supabase/supabase-js
                                Supabase sync transport (sync_push/sync_pull RPCs +
                                a private Broadcast doorbell for subscribe);
                                hosted builds only — dynamic-imported, DCE'd from
                                self-hosted bundles
apps/web  → deps: game-db (display), extractor (in-browser extraction),
                  dataset-client/-core/-repository, config, wz, mcp-protocol,
                  identity-core (display), identity-cloud (bootstrap only),
                  sync-core (display + user-DB apply), sync-supabase (bootstrap only)
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
| user DB (collections, pinned searches, prefs) | `apps/web/db/user` | game-db/db (sqlite), sync-core (conflict handler + wire types) |
| identity contract (session, provider interface, hooks) | `identity-core` | (leaf) |
| concrete cloud identity (Supabase) | `identity-cloud` | identity-core, supabase-js |
| **choosing the identity provider** | `apps/web` (`identity/` only) | **identity-core, identity-cloud (dynamic)** |
| sync protocol, engine, conflict handler, status hooks | `sync-core` | (leaf) |
| concrete Supabase sync transport | `sync-supabase` | sync-core, identity-core, supabase-js |
| **choosing the sync provider** | `apps/web` (`sync/` only) | **sync-core, sync-supabase (dynamic)** |
| local sync metadata (outbox, cursor, tombstones) | `apps/web/db/user` | game-db/db (sqlite), sync-core |

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
- `apps/web` display dirs and `packages/identity-core` — cannot import
  `@scrolled/identity-cloud` or `@supabase/*` (see the identity rule below).

## Game-data vocabulary lives in the domain layer, not the web app

The web app **renders** game data; it does not **define what game data means**.
Any mapping from a raw extracted code/field to a human term — element letters
(`F` → Fire), status-ailment codes (`C` → Curse), stat short-codes (`pad` →
Weapon Attack), job ids, portal types, skill elements — is *translation of game
data* and belongs in `@scrolled/game-db/domain`, defined once and imported by
whoever displays it. The web layer may hold **presentation** (sentence
templates, grouping, ordering, link wiring, CSS), but not the vocabulary itself.

Why: the same term surfaces in many views (a detail page, a hover card, a
filter, search), and a self-hoster or alternate front-end reads the same
contract. A label spelled inline in one component is a second source of truth
that silently drifts. Keeping vocabulary in the domain layer means "`pad` is
Weapon Attack" is stated once and every reader agrees.

How, by example — consumable `spec` decoding (`apps/web/src/lib/consumableEffects.ts`):

- The **vocabulary** is in `game-db/domain`, split by concept so a name has one
  home: elements reuse `mobElements.ts`, ailments live in `statusAilments.ts`,
  combat-stat names in `combatStats.ts`. Don't pile unrelated enums into one
  file — group them by the game concept they describe.
- The consumable-specific *structure* (which `spec` field is a buff vs. a cure,
  how `defenseAtt`/`defenseState` decode) is in `domain/consumableSpec.ts`,
  which **imports** those vocabularies rather than restating them.
- The web builder turns the decoded data into grouped sentences and entity
  links. It owns wording and layout, and reaches for the domain decoders for
  every game term — it never hardcodes one.

Rule of thumb: if you're about to write a `Record<code, "Some Game Term">` or a
`switch` over WZ codes inside `apps/web`, stop — it's a domain decoder. Add or
extend a module under `game-db/domain` and import it. (This isn't lint-enforced
today; it's a review expectation. A new label map in `apps/web/src/lib` or a
component is the smell to catch.)

## Identity is identity-aware, not auth-provider-aware (lint-enforced)

Identity is orthogonal to the read/write data paths: it never touches game data.
Sign-in is **optional and additive** — the self-hosted/local build runs the
anonymous provider, requires no login, and must not even bundle the auth SDK.

The core app consumes only the provider-agnostic contract `@scrolled/identity-core`
(a generic `UserSession` plus `login`/`logout`). It never imports the concrete
provider or `@supabase/supabase-js`. The provider is chosen at bootstrap in
`apps/web/src/identity/` via a **dynamic `import()`**, so when the build is not
configured for cloud accounts the cloud chunk is unreachable and dropped — no
Supabase code, no vendor strings, mirroring how `apps/web/src/analytics/` gates
its provider. Enforced in `eslint.config.js`:

- `apps/web` display dirs (`components/` except `wizard/`, `routes/`, `lib/`,
  `search/`) and `packages/identity-core` — cannot import `@scrolled/identity-cloud`
  or `@supabase/*`. The sole exception is `apps/web/src/identity/`, the sanctioned
  bootstrap shim that dynamic-imports the cloud provider.

## Sync is sync-aware, not sync-provider-aware (lint-enforced)

Sync mirrors the identity split exactly. Only the user DB (`/user.sqlite3`)
syncs; the game DB never does. The core app consumes the provider-agnostic
contract `@scrolled/sync-core` (the `SyncProvider` interface, protocol
types/schemas, the conflict handler, the `SyncEngine`, and `useSyncStatus()`) and
nothing else — it is sync-aware but not provider-aware. The concrete Supabase
transport (`@scrolled/sync-supabase`) is chosen at bootstrap in
`apps/web/src/sync/createProvider.ts` via a **dynamic `import()`** behind the
`__SYNC_SUPABASE__` build constant, so self-hosted/forked builds
that configure no sync never bundle it or `@supabase/*`. The user-DB worker
(`apps/web/src/db/user`) additionally imports `sync-core` for the conflict
handler and wire types its `applyRemoteChanges` runs. Enforced in
`eslint.config.js`:

- `apps/web` display dirs (`components/` except `wizard/`, `routes/`, `lib/`,
  `search/`) and `packages/sync-core` — cannot import `@scrolled/sync-supabase`
  or `@supabase/*`. The sole exception is `apps/web/src/sync/`, the sanctioned
  bootstrap shim that dynamic-imports the sync transport.

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
