# @scrolled/dataset-client

Orchestrates installing a hosted dataset: resolve the channel, validate the
manifest, download the artifact, and hand the bytes to an injected sink. The sink
is where storage lives (the web app writes to OPFS via the DB worker), so this
package stays free of any DB/OPFS dependency and is unit-testable.

**Owns:** `installDataset()`, the `DatasetSink` interface, and the
`InstallProgress` / `InstallPhase` reporting types.

**May import:** `@scrolled/dataset-core` (manifest type) and
`@scrolled/dataset-repository` (the repository interface).

**Imported by:** the web app's dataset install/update hooks.
