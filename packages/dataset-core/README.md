# @scrolled/dataset-core

Hosted-**dataset distribution** primitives: the contracts and container format
for publishing and downloading game data. A leaf package.

**Owns:** the manifest/channel Zod schemas (`DatasetManifest`, `DatasetChannel`,
`DatasetRef`), the `.scrolled-dataset` container format (`packDataset` /
`readDataset` + its container manifest schema), and the shared tar/gzip/sha256
codec reused by both the dataset and the `.scrolled-backup` formats.

**May import:** third-party only (`zod`, `fflate`). No `@scrolled/*` imports — it
is a leaf, so the distribution contract has no dependency on the DB or extractor.

**Imported by:** `@scrolled/dataset-repository`, `@scrolled/dataset-client`,
`@scrolled/game-db` (the codec), `@scrolled/extractor` (the build CLI), and the
web app.

> Not to be confused with `.scrolled-backup` (a user's own game + user database
> export), which is owned by `@scrolled/game-db`. See
> [`docs/data_boundaries.md`](../../docs/data_boundaries.md).
