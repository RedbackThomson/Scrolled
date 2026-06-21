# @scrolled/game-db

The **read + storage contract** for extracted game data. The web app reads
through this package to display data; the extractor writes into it. It is the
single home for everything about *interpreting and storing* a library, as
opposed to *producing* one.

**Owns:** the SQLite engine and schema/migrations, the typed query API
(`DbApi`, `GameDatabase`), domain record types, domain decoders (`domain/` —
equip types/jobs, elements, skills, portals…), the data/schema version contract,
server profiles (incl. the equip-stat calculator), the `.scrolled-backup` format
+ import-compatibility gating, and the extraction key/stats vocabulary, plus
worker-safe `lib/` utilities (logger, progress, math).

**May import:** `@scrolled/dataset-core` (the shared tar/gzip codec; the dataset
container manifest type). Nothing else `@scrolled/*` — in particular **not**
`@scrolled/extractor` or `@scrolled/wz` (it is below the write path).

**Imported by:** the web app's display + extraction layers, and
`@scrolled/extractor` (which produces records typed and stored here).

See [`docs/data_boundaries.md`](../../docs/data_boundaries.md).
