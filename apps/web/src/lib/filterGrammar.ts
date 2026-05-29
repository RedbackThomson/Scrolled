// Parses palette filter queries like `mobs level:50-70 boss:true gob` into
// a URL-ready `{ entity, params }` shape. Output keys match the column-filter
// param convention from `components/data-table/useColumnFilters.ts` so
// navigating to `<listing>?<params>` lights up the same filters the column
// popovers produce.
//
// Grammar (informal):
//   <query>      ::= <entityWord>? <token>*
//   <entityWord> ::= 'mobs' | 'items' | 'equips' | 'npcs' | 'maps' | 'quests'
//                  | 'mob'  | 'item'  | 'equip'  | 'npc'  | 'map'  | 'quest'
//   <token>      ::= <kv> | <term>
//   <kv>         ::= key ':' value
//   key          ::= [a-zA-Z_]+
//   value        ::= bareWord | range | comparison
//   range        ::= N '-' N
//   comparison   ::= ('>=' | '<=' | '>' | '<') N
//
// Unknown keys fall back to free-text terms.

import type { EntityKind } from '@/db';
import { ELEMENT_ORDER } from '@/domain/mobElements';

type EntityScope = EntityKind;

type FilterSpec =
  | { kind: 'number'; param: string }
  | { kind: 'string'; param: string }
  | { kind: 'enum'; param: string; values?: readonly string[] }
  | { kind: 'boolean'; param: string };

type FilterMap = Record<string, FilterSpec>;

const MOB_ELEMENT_VALUES: readonly string[] = ELEMENT_ORDER.map((n) => n.toLowerCase());

const ENTITY_ALIAS: Record<string, EntityScope> = {
  mobs: 'mob',
  mob: 'mob',
  items: 'item',
  item: 'item',
  equips: 'equip',
  equip: 'equip',
  npcs: 'npc',
  npc: 'npc',
  maps: 'map',
  map: 'map',
  quests: 'quest',
  quest: 'quest',
  chains: 'questChain',
  chain: 'questChain',
  questchains: 'questChain',
  questchain: 'questChain',
};

const FILTER_KEYS: Record<EntityScope, FilterMap> = {
  mob: {
    level: { kind: 'number', param: 'level' },
    hp: { kind: 'number', param: 'hp' },
    mp: { kind: 'number', param: 'mp' },
    exp: { kind: 'number', param: 'exp' },
    weak: { kind: 'enum', param: 'weakAgainst', values: MOB_ELEMENT_VALUES },
    strong: { kind: 'enum', param: 'strongAgainst', values: MOB_ELEMENT_VALUES },
    immune: { kind: 'enum', param: 'immuneTo', values: MOB_ELEMENT_VALUES },
    boss: { kind: 'boolean', param: 'boss' },
  },
  item: {
    category: {
      kind: 'enum',
      param: 'category',
      values: ['use', 'setup', 'etc', 'cash'],
    },
    subcategory: { kind: 'string', param: 'subcategory' },
    level: { kind: 'number', param: 'requiredLevel' },
    price: { kind: 'number', param: 'price' },
  },
  equip: {
    slot: { kind: 'enum', param: 'slot' },
    cash: { kind: 'boolean', param: 'cash' },
    class: { kind: 'enum', param: 'requiredJob' },
    job: { kind: 'enum', param: 'requiredJob' },
    level: { kind: 'number', param: 'requiredLevel' },
    attack: { kind: 'number', param: 'attack' },
    defense: { kind: 'number', param: 'defense' },
  },
  npc: {},
  map: {
    street: { kind: 'string', param: 'streetName' },
  },
  quest: {
    level: { kind: 'number', param: 'level' },
  },
  questChain: {
    // Tokens match the user-facing labels (Quests / Stage / Starts / Loop)
    // so a palette query reads the same way the chain index does.
    count: { kind: 'number', param: 'size' },
    stage: { kind: 'number', param: 'maxDepth' },
    starts: { kind: 'number', param: 'rootCount' },
    loop: { kind: 'boolean', param: 'hasCycles' },
    parent: { kind: 'string', param: 'parent' },
  },
};

const NAME_COLUMN: Record<EntityScope, string> = {
  mob: 'name',
  item: 'name',
  equip: 'name',
  npc: 'name',
  map: 'name',
  quest: 'name',
  questChain: 'name',
};

export interface ParsedFilterQuery {
  entity: EntityScope | null;
  params: Record<string, string>;
  /** Free-text remainder after kv tokens were extracted (joined with spaces). */
  freeText: string;
  /** Whether anything filter-ish was actually parsed out of the input. */
  hasFilters: boolean;
}

function isBareWord(s: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(s);
}

function parseNumberValue(raw: string, param: string): Record<string, string> | null {
  // `>=N`, `<=N`, `>N`, `<N`
  const cmpMatch = raw.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmpMatch) {
    const op = cmpMatch[1];
    const n = cmpMatch[2];
    if (op.startsWith('>')) return { [`f_${param}_min`]: n };
    return { [`f_${param}_max`]: n };
  }
  // `N-M`
  const rangeMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return { [`f_${param}_min`]: rangeMatch[1], [`f_${param}_max`]: rangeMatch[2] };
  }
  // `N` (treated as exact)
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return { [`f_${param}_min`]: raw, [`f_${param}_max`]: raw };
  }
  return null;
}

function parseBooleanValue(raw: string, param: string): Record<string, string> | null {
  const v = raw.toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return { [`f_${param}`]: '1' };
  if (v === 'false' || v === 'no' || v === '0') return { [`f_${param}`]: '0' };
  return null;
}

export function parseFilterQuery(raw: string): ParsedFilterQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { entity: null, params: {}, freeText: '', hasFilters: false };
  }

  let entity: EntityScope | null = null;
  let i = 0;
  const head = tokens[0].toLowerCase();
  if (ENTITY_ALIAS[head]) {
    entity = ENTITY_ALIAS[head];
    i = 1;
  }

  // We can only produce filter params if we know the entity (since column
  // ids differ per listing). Without an entity, the parsed result is empty.
  const map = entity ? FILTER_KEYS[entity] : null;
  const params: Record<string, string> = {};
  const free: string[] = [];
  let producedFilter = false;

  for (; i < tokens.length; i++) {
    const tok = tokens[i];
    const colon = tok.indexOf(':');
    if (colon > 0 && colon < tok.length - 1) {
      const key = tok.slice(0, colon).toLowerCase();
      const value = tok.slice(colon + 1);
      const spec = map?.[key];
      if (spec) {
        if (spec.kind === 'number') {
          const out = parseNumberValue(value, spec.param);
          if (out) {
            Object.assign(params, out);
            producedFilter = true;
            continue;
          }
        } else if (spec.kind === 'boolean') {
          const out = parseBooleanValue(value, spec.param);
          if (out) {
            Object.assign(params, out);
            producedFilter = true;
            continue;
          }
        } else if (spec.kind === 'enum') {
          if (isBareWord(value) && (!spec.values || spec.values.includes(value.toLowerCase()))) {
            params[`f_${spec.param}`] = value.toLowerCase();
            producedFilter = true;
            continue;
          }
        } else if (spec.kind === 'string') {
          if (value.length > 0) {
            params[`f_${spec.param}`] = value;
            producedFilter = true;
            continue;
          }
        }
      }
      // Bare boolean shortcut: a lone `boss` token == `boss:true`.
    } else if (map && map[tok.toLowerCase()]?.kind === 'boolean') {
      const spec = map[tok.toLowerCase()];
      if (spec.kind === 'boolean') {
        params[`f_${spec.param}`] = '1';
        producedFilter = true;
        continue;
      }
    }
    free.push(tok);
  }

  // Free text → name filter (contains) when an entity is scoped.
  if (entity && free.length > 0) {
    params[`f_${NAME_COLUMN[entity]}`] = free.join(' ');
    producedFilter = true;
  }

  return {
    entity,
    params,
    freeText: free.join(' '),
    hasFilters: producedFilter,
  };
}

export interface FilterKeyHint {
  /** Keys that all map to the same column (e.g. `class` + `job`). */
  aliases: string[];
  kind: FilterSpec['kind'];
}

/**
 * Surfaceable filter keys for `entity`, deduped by underlying param so a
 * column with synonyms (e.g. equips `class` / `job` → `requiredJob`) becomes
 * one hint entry with both aliases listed. Used by the palette to render
 * the "available filters" chip row above the result list.
 */
export function filterKeyHintsFor(entity: EntityScope): FilterKeyHint[] {
  const map = FILTER_KEYS[entity];
  const byParam = new Map<string, FilterKeyHint>();
  for (const [key, spec] of Object.entries(map)) {
    const existing = byParam.get(spec.param);
    if (existing) existing.aliases.push(key);
    else byParam.set(spec.param, { aliases: [key], kind: spec.kind });
  }
  return Array.from(byParam.values());
}

export function buildFilterUrl(entity: EntityScope, params: Record<string, string>): string {
  const base = {
    mob: '/mobs',
    item: '/items',
    equip: '/equips',
    npc: '/npcs',
    map: '/maps',
    quest: '/quests',
    questChain: '/quest-chains',
  }[entity];
  const sp = new URLSearchParams(params);
  return sp.toString() ? `${base}?${sp.toString()}` : base;
}
