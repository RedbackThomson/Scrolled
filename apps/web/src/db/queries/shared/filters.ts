import {
  BEGINNER_EQUIP_REQ_JOB,
  EQUIP_REQ_JOB_BIT,
  type EquipClass,
} from '@/domain/equipJobs';
import { ELEMENT_CODE_BY_NAME, LEVEL_BY_STATUS, type ElementStatus } from '@/domain/mobElements';
import type { ColumnFilter } from '../../types';

/**
 * Per-entity column-filter allowlist. Mirrors the ORDER BY allowlists:
 * public column ids (the same ones the UI sends from URL state) map to
 * the SQL column they back, plus the filter type. Unknown filter keys
 * are silently dropped — same defence-in-depth as ORDER BY.
 *
 * `id` is declared as `'string'` despite being an INTEGER column: the UX
 * is "find IDs containing these digits", not a range. SQLite's LIKE
 * auto-coerces integers to text so `WHERE id LIKE '%5%'` works.
 */
export interface FilterSpec {
  col: string;
  type: 'string' | 'number' | 'classMask' | 'elementStatus' | 'presence';
  /**
   * For `elementStatus` columns: which status against the chosen element
   * the filter should match (`weak` / `resistant` / `immune`). The DB
   * stores the elemAttr string as a flat sequence of `<code><level>`
   * pairs (e.g. `F3I2`), so a "weak to Fire" filter resolves the element
   * to code "F" and the status to level "3", then matches the substring
   * `F3` anywhere in element_attack. Element-code lookup and the
   * status→level mapping both come from `@/domain/mobElements`.
   */
  elementStatus?: Exclude<ElementStatus, 'neutral'>;
}

export const ITEM_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  category: { col: 'category', type: 'string' },
  subcategory: { col: 'subcategory', type: 'string' },
  requiredLevel: { col: 'required_level', type: 'number' },
  price: { col: 'price', type: 'number' },
  id: { col: 'id', type: 'string' },
};

export const EQUIP_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  slot: { col: 'slot', type: 'string' },
  equipType: { col: 'equip_type', type: 'string' },
  // cash is stored as INTEGER 0/1; range filters compare numerically, and
  // {min:1,max:1} or {min:0,max:0} from the UI's boolean filter type maps
  // cleanly to col = ?.
  cash: { col: 'cash', type: 'number' },
  requiredLevel: { col: 'required_level', type: 'number' },
  requiredStr: { col: 'required_str', type: 'number' },
  requiredDex: { col: 'required_dex', type: 'number' },
  requiredInt: { col: 'required_int', type: 'number' },
  requiredLuk: { col: 'required_luk', type: 'number' },
  attack: { col: 'attack', type: 'number' },
  magicAttack: { col: 'magic_attack', type: 'number' },
  incStr: { col: 'inc_str', type: 'number' },
  incDex: { col: 'inc_dex', type: 'number' },
  incInt: { col: 'inc_int', type: 'number' },
  incLuk: { col: 'inc_luk', type: 'number' },
  incHp: { col: 'inc_hp', type: 'number' },
  incMp: { col: 'inc_mp', type: 'number' },
  defense: { col: 'defense', type: 'number' },
  magicDefense: { col: 'magic_defense', type: 'number' },
  accuracy: { col: 'accuracy', type: 'number' },
  avoidability: { col: 'avoidability', type: 'number' },
  incSpeed: { col: 'inc_speed', type: 'number' },
  incJump: { col: 'inc_jump', type: 'number' },
  upgradeSlots: { col: 'upgrade_slots', type: 'number' },
  requiredJob: { col: 'required_job', type: 'classMask' },
  id: { col: 'id', type: 'string' },
};

export const MOB_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  level: { col: 'level', type: 'number' },
  hp: { col: 'hp', type: 'number' },
  mp: { col: 'mp', type: 'number' },
  exp: { col: 'exp', type: 'number' },
  weakAgainst: { col: 'element_attack', type: 'elementStatus', elementStatus: 'weak' },
  strongAgainst: { col: 'element_attack', type: 'elementStatus', elementStatus: 'resistant' },
  immuneTo: { col: 'element_attack', type: 'elementStatus', elementStatus: 'immune' },
  // is_boss is INTEGER 0/1; same trick as equips.cash — a boolean column
  // filter ({min:1,max:1}) maps cleanly through the number filter path.
  boss: { col: 'is_boss', type: 'number' },
  id: { col: 'id', type: 'string' },
};

export const NPC_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  id: { col: 'id', type: 'string' },
};

export const MAP_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  streetName: { col: 'street_name', type: 'string' },
  mobRate: { col: 'mob_rate', type: 'number' },
  returnMapId: { col: 'return_map_id', type: 'number' },
  id: { col: 'id', type: 'string' },
};

export const QUEST_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  parent: { col: 'parent', type: 'string' },
  requiredLevel: { col: 'required_level', type: 'number' },
  repeatable: { col: 'repeat_wait', type: 'presence' },
  id: { col: 'id', type: 'string' },
};

export const QUEST_CHAIN_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  parent: { col: 'parent', type: 'string' },
  size: { col: 'size', type: 'number' },
  maxDepth: { col: 'max_depth', type: 'number' },
  rootCount: { col: 'root_count', type: 'number' },
  // INTEGER 0/1; the UI sends `{ kind: 'range', min: 1 }` to filter to
  // chains that contain at least one cycle, and clears the filter to
  // include everything. No separate "no cycles" filter today.
  hasCycles: { col: 'has_cycles', type: 'number' },
  id: { col: 'id', type: 'string' },
};

/**
 * Append WHERE fragments + bind params for each known filter. Unknown
 * filter keys, blank-string values, and ranges with neither bound set
 * are skipped. String matches use LIKE … ESCAPE '\' with the LIKE
 * metacharacters (`%`, `_`, `\`) escaped in the user-supplied value, so
 * a user typing "50%" matches the literal three characters regardless
 * of `mode`. SQLite's LIKE is case-insensitive over ASCII by default.
 */
export function applyFilters(
  allow: Record<string, FilterSpec>,
  filters: Record<string, ColumnFilter> | undefined,
  where: string[],
  params: (string | number)[],
): void {
  if (!filters) return;
  for (const [key, filter] of Object.entries(filters)) {
    const spec = allow[key];
    if (!spec) continue;
    if (spec.type === 'string' && filter.kind === 'string' && filter.value) {
      const esc = escapeLikeLiteral(filter.value);
      const pattern =
        filter.mode === 'prefix'
          ? `${esc}%`
          : filter.mode === 'suffix'
            ? `%${esc}`
            : filter.mode === 'equals'
              ? esc
              : `%${esc}%`;
      where.push(`${spec.col} LIKE ? ESCAPE '\\'`);
      params.push(pattern);
    } else if (spec.type === 'string' && filter.kind === 'enum' && filter.values.length > 0) {
      // Enum on a TEXT column → `col IN (?, ?, …)`. One value collapses
      // to a single-element IN, which SQLite plans the same as `col = ?`.
      const placeholders = filter.values.map(() => '?').join(', ');
      where.push(`${spec.col} IN (${placeholders})`);
      params.push(...filter.values);
    } else if (spec.type === 'number' && filter.kind === 'range') {
      if (filter.min !== undefined && Number.isFinite(filter.min)) {
        where.push(`${spec.col} >= ?`);
        params.push(filter.min);
      }
      if (filter.max !== undefined && Number.isFinite(filter.max)) {
        where.push(`${spec.col} <= ?`);
        params.push(filter.max);
      }
    } else if (spec.type === 'presence' && filter.kind === 'range') {
      // Boolean picker writes {min:max:1} for present, {min:max:0} for absent.
      if (filter.min === 1 && filter.max === 1) {
        where.push(`${spec.col} IS NOT NULL`);
      } else if (filter.min === 0 && filter.max === 0) {
        where.push(`${spec.col} IS NULL`);
      }
    } else if (
      spec.type === 'elementStatus' &&
      filter.kind === 'enum' &&
      filter.values.length > 0 &&
      spec.elementStatus
    ) {
      // OR together one LIKE per element name. Each pattern matches the
      // literal `<code><level>` pair anywhere in the elemAttr string —
      // same shape as the single-value branch below, just unioned.
      const level = LEVEL_BY_STATUS[spec.elementStatus];
      const patterns: string[] = [];
      for (const v of filter.values) {
        const code = ELEMENT_CODE_BY_NAME[v.toLowerCase()];
        if (!code) continue;
        patterns.push(`%${escapeLikeLiteral(`${code}${level}`)}%`);
      }
      if (patterns.length === 0) continue;
      where.push(
        '(' + patterns.map(() => `${spec.col} LIKE ? ESCAPE '\\'`).join(' OR ') + ')',
      );
      params.push(...patterns);
    } else if (
      spec.type === 'elementStatus' &&
      filter.kind === 'string' &&
      filter.value &&
      spec.elementStatus
    ) {
      const code = ELEMENT_CODE_BY_NAME[filter.value.toLowerCase()];
      if (!code) continue;
      // Match the literal `<code><level>` pair anywhere in the elemAttr
      // string. Escape LIKE metacharacters even though codes/levels are
      // single safe chars — keeps the pattern shape consistent with the
      // other string branches.
      const esc = escapeLikeLiteral(`${code}${LEVEL_BY_STATUS[spec.elementStatus]}`);
      where.push(`${spec.col} LIKE ? ESCAPE '\\'`);
      params.push(`%${esc}%`);
    } else if (spec.type === 'classMask' && filter.kind === 'enum' && filter.values.length > 0) {
      // Beginner-only equips use the sentinel value -1 (Frozen Tuna et al.);
      // the other five classes are positive bits in EQUIP_REQ_JOB_BIT. We OR
      // those positive bits into one mask and, if Beginner was picked too,
      // add the sentinel check as an alternate condition. Unrestricted gear
      // (reqJob IS NULL / = 0) is intentionally excluded — the filter UX
      // scopes to class-locked gear so generic items don't drown the result.
      let combined = 0;
      let includeBeginner = false;
      for (const v of filter.values) {
        if (v === 'Beginner') {
          includeBeginner = true;
          continue;
        }
        const bit = EQUIP_REQ_JOB_BIT[v as Exclude<EquipClass, 'Beginner'>];
        if (bit === undefined) continue;
        combined |= bit;
      }
      const parts: string[] = [];
      if (combined !== 0) {
        parts.push(`(${spec.col} & ?) != 0`);
        params.push(combined);
      }
      if (includeBeginner) {
        parts.push(`${spec.col} = ?`);
        params.push(BEGINNER_EQUIP_REQ_JOB);
      }
      if (parts.length === 0) continue;
      where.push(`(${parts.join(' OR ')})`);
    } else if (spec.type === 'classMask' && filter.kind === 'string' && filter.value) {
      if (filter.value === 'Beginner') {
        where.push(`${spec.col} = ?`);
        params.push(BEGINNER_EQUIP_REQ_JOB);
      } else {
        const bit = EQUIP_REQ_JOB_BIT[filter.value as Exclude<EquipClass, 'Beginner'>];
        if (bit === undefined) continue;
        where.push(`(${spec.col} & ?) != 0`);
        params.push(bit);
      }
    }
  }
}

function escapeLikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
