# @scrolled/config

Deployment profiles and build-time feature flags — how a given build of the app
is configured (generic vs. fixed-dataset deployment, hosted-only carve-outs). A
leaf package with no runtime dependencies.

**Owns:** `resolveAppConfig`, the `AppConfig` type, and the deployment-profile
definitions.

**May import:** nothing `@scrolled/*` (leaf).

**Imported by:** the web app (and, where relevant, the build tooling).
