# @scrolled/extractor

The **write path**: turn a user's WZ/IMG files into typed records stored in
`@scrolled/game-db`. Parsing and extraction only — it does not own the database
schema or the read API.

**Owns:** WZ/IMG parsing and image decoding (`parser/`), the per-entity
extractors that turn the raw tree into records (`extractors/`), and the build
orchestration (`builder/` — the headless `dataset:build` CLI, `runExtraction`,
the shared `store*` step that persists results, the extractor file-dependency
graph, and run statistics).

**May import:** `@scrolled/wz` (WZ crypto/version detection), `@scrolled/game-db`
(record types, domain decoders, the DB it writes into), `@scrolled/dataset-core`
(the `.scrolled-dataset` packer + manifest schema for the build CLI).

**Imported by:** the web app's extraction layer only (`workers/`,
`hooks/extraction/`, `parser/`, `components/wizard/`). Display/read code must not
import it — it reads through `@scrolled/game-db`.

See [`docs/data_boundaries.md`](../../docs/data_boundaries.md).
