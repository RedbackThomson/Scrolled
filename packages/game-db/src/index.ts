// @scrolled/game-db — the read + storage contract.
//
// The web app reads through this package (queries, types, domain decoders,
// server profiles); the extractor writes into it. Consumers may import this
// barrel or any module by subpath (e.g. `@scrolled/game-db/db/queries`,
// `@scrolled/game-db/domain/equipTypes`).

export * from './db';
export * from './serverProfiles';
