# @scrolled/dataset-repository

Resolves a hosted dataset over static HTTP: channel → concrete manifest, then
downloads and integrity-checks the artifact bytes. Deals only in bytes — no DB,
OPFS, or extractor knowledge — so it runs anywhere `fetch` and Web Crypto exist.

**Owns:** the `DatasetRepository` interface, `StaticHttpDatasetRepository`,
download-progress reporting, and `DatasetRepositoryError` (with a `kind` callers
branch on for messaging/retry).

**May import:** `@scrolled/dataset-core` (manifest/channel schemas).

**Imported by:** `@scrolled/dataset-client` and the web app.
