// @scrolled/extractor — the write path: WZ files → typed records → game-db.
//
// Parsing and extraction only; the records it produces are typed by and stored
// through @scrolled/game-db. Consumers may import this barrel or any module by
// subpath (e.g. `@scrolled/extractor/parser/WzDataSource`,
// `@scrolled/extractor/builder/extractStats`).

export * from './parser';
export * from './extractors';
