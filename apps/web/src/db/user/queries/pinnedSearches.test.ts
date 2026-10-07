// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { USER_MIGRATIONS } from '../migrations';
import {
  createPinnedSearch,
  listPinnedSearches,
  reorderPinnedSearches,
  updatePinnedSearch,
} from './pinnedSearches';

async function openAt(version: number): Promise<Sqlite> {
  const db = new Sqlite({
    logTag: 'pinned-searches-test',
    migrations: USER_MIGRATIONS.filter((m) => m.version <= version),
  });
  await db.open();
  return db;
}

describe('saved search migration', () => {
  it('keeps existing rows, pins them, and accepts every list page', async () => {
    const db = await openAt(11);
    db.exec(
      `INSERT INTO pinned_searches (name, entity, params_json, created_at, updated_at, uuid)
       VALUES ('Bosses', 'mob', '{"f_boss":"1"}', 1, 2, 'abc')`,
    );
    db.exec(USER_MIGRATIONS.find((m) => m.version === 12)!.sql);

    expect(listPinnedSearches(db)).toMatchObject([
      { name: 'Bosses', entity: 'mob', params: { f_boss: '1' }, pinned: true, icon: null },
    ]);
    expect(createPinnedSearch(db, { name: 'Claws', entity: 'weapon', params: {} }).entity).toBe(
      'weapon',
    );
  });
});

describe('saved searches', () => {
  it('appends to its page, styles, pins and reorders', async () => {
    const db = await openAt(Infinity);
    const a = createPinnedSearch(db, { name: 'A', entity: 'skill', params: {} });
    const b = createPinnedSearch(db, {
      name: 'B',
      entity: 'skill',
      params: {},
      icon: 'star',
      color: 'pink',
      pinned: true,
    });
    createPinnedSearch(db, { name: 'C', entity: 'mob', params: {} });
    expect([a.position, b.position]).toEqual([0, 1]);
    expect(b).toMatchObject({ icon: 'star', color: 'pink', pinned: true });

    reorderPinnedSearches(db, [b.id, a.id]);
    expect(
      listPinnedSearches(db)
        .filter((s) => s.entity === 'skill')
        .map((s) => s.name),
    ).toEqual(['B', 'A']);

    expect(updatePinnedSearch(db, a.id, { pinned: true, color: null }).pinned).toBe(true);
  });
});
