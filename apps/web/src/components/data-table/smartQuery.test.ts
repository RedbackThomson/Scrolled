import { describe, expect, it } from 'vitest';
import type { FilterableCol } from './Filterable';
import type { FacetDef } from './presets';
import { buildParsers, filterHints, suggest } from './smartQuery';

const COLS: FilterableCol[] = [
  { id: 'name', label: 'Name', type: 'string' },
  {
    id: 'equipType',
    label: 'Type',
    type: 'enum',
    enumOptions: ['claw', 'one-handed-sword', 'two-handed-sword'],
    enumLabel: (v) =>
      ({
        claw: 'Claw',
        'one-handed-sword': 'One Handed Sword',
        'two-handed-sword': 'Two Handed Sword',
      })[v] ?? v,
  },
  { id: 'requiredJob', label: 'Class', type: 'enum', enumOptions: ['Thief', 'Warrior'] },
  { id: 'requiredLevel', label: 'Req Lvl', type: 'number' },
  { id: 'attack', label: 'Atk', type: 'number' },
  { id: 'upgradeSlots', label: 'Slots', type: 'number' },
  {
    id: 'cash',
    label: 'Cash',
    type: 'boolean',
    booleanLabels: { trueLabel: 'Cash', falseLabel: 'Regular' },
  },
];
const FACETS: FacetDef[] = [
  { columnId: 'equipType', label: 'Type', hue: 235 },
  { columnId: 'requiredJob', label: 'Class', hue: 300 },
  { columnId: 'requiredLevel', label: 'Req Lvl', hue: 148, aroundMyLevel: true },
];
const parsers = buildParsers(COLS, FACETS);
const top = (text: string) => suggest(text, parsers)[0]!;

describe('suggest', () => {
  it('matches enum values by prefix of any word', () => {
    expect(top('thief')).toMatchObject({
      columnId: 'requiredJob',
      valueLabel: 'Thief',
      filter: { kind: 'enum', values: ['Thief'] },
      remainder: '',
    });
    const sword = suggest('sword', parsers).map((s) => s.valueLabel);
    expect(sword).toEqual(['One Handed Sword', 'Two Handed Sword', '“sword”']);
  });

  it('reads bare and prefixed ranges as the level facet', () => {
    expect(top('30-50')).toMatchObject({
      columnId: 'requiredLevel',
      filter: { kind: 'range', min: 30, max: 50 },
    });
    expect(top('lvl 30-50').filter).toEqual({ kind: 'range', min: 30, max: 50 });
    expect(top('30+').filter).toEqual({ kind: 'range', min: 30, max: undefined });
  });

  it('parses comparisons, alias ranges and counts on number columns', () => {
    expect(top('atk > 20')).toMatchObject({
      columnId: 'attack',
      valueLabel: '> 20',
      filter: { kind: 'range', min: 21 },
    });
    expect(top('atk<=20').filter).toEqual({ kind: 'range', max: 20, min: undefined });
    expect(top('atk 10-20').filter).toEqual({ kind: 'range', min: 10, max: 20 });
    expect(top('7 slots')).toMatchObject({ columnId: 'upgradeSlots', filter: { min: 7, max: 7 } });
    expect(top('req lvl >= 30').columnId).toBe('requiredLevel');
  });

  it('suggests boolean labels', () => {
    expect(top('regular').filter).toEqual({ kind: 'range', min: 0, max: 0 });
  });

  it('leaves the earlier text as the remainder', () => {
    const s = top('claw 30-50');
    expect(s.columnId).toBe('requiredLevel');
    expect(s.remainder).toBe('claw');
    expect(top(s.remainder)).toMatchObject({ columnId: 'equipType', remainder: '' });
  });

  it('always ends with a name fallback for the whole text', () => {
    const all = suggest('red potion', parsers);
    expect(all.at(-1)).toMatchObject({
      columnId: 'name',
      filter: { kind: 'string', mode: 'contains', value: 'red potion' },
    });
    expect(suggest('   ', parsers)).toEqual([]);
  });

  it('caps the list at six rows', () => {
    const many = buildParsers(
      [
        {
          id: 'e',
          label: 'E',
          type: 'enum',
          enumOptions: ['aa1', 'aa2', 'aa3', 'aa4', 'aa5', 'aa6', 'aa7'],
        },
      ],
      [],
    );
    const rows = suggest('aa', many);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)!.columnId).toBe('name');
  });
});

describe('filterHints', () => {
  it('builds examples and the placeholder from the pinned facets', () => {
    expect(filterHints(COLS, [...FACETS, { columnId: 'attack', label: 'Atk', hue: 185 }])).toEqual({
      examples: ['claw 30-50', 'claw', 'atk > 20'],
      placeholder: 'Filter by name, or type “claw”, “30-50”…',
    });
  });

  it('falls back to a boolean label, a comparison, or plain name search', () => {
    const boss: FilterableCol = {
      id: 'boss',
      label: 'Boss',
      type: 'boolean',
      booleanLabels: { trueLabel: 'Boss', falseLabel: 'Non-boss' },
    };
    expect(
      filterHints(
        [boss, ...COLS],
        [
          { columnId: 'boss', label: 'Boss', hue: 185 },
          { columnId: 'attack', label: 'Atk', hue: 185 },
        ],
      ).placeholder,
    ).toBe('Filter by name, or type “boss”, “atk > 20”…');
    expect(filterHints(COLS, []).placeholder).toBe('Filter by name…');
  });
});
