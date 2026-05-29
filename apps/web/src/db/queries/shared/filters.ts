import { EQUIP_CLASS_BIT, type EquipClass } from '@/domain/equipJobs';
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
  type: 'string' | 'number' | 'classMask' | 'elementStatus';
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
      // OR the per-value class bits. Beginner has no dedicated reqJob
      // bit — Beginner-wearable means "unrestricted" — so it pulls in
      // the IS NULL / = 0 patterns. Every other class requires its bit
      // to be explicitly set; unrestricted gear is technically wearable
      // by everyone but treating it that way drowns the filter in
      // generic items, so the filter UX scopes to class-locked gear.
      let combined = 0;
      let allowUnrestricted = false;
      for (const v of filter.values) {
        const bit = EQUIP_CLASS_BIT[v as EquipClass];
        if (bit === undefined) continue;
        if (bit === 0) allowUnrestricted = true;
        else combined |= bit;
      }
      const parts: string[] = [];
      if (allowUnrestricted) {
        parts.push(`${spec.col} IS NULL`, `${spec.col} = 0`);
      }
      if (combined !== 0) {
        parts.push(`(${spec.col} & ?) != 0`);
        params.push(combined);
      }
      if (parts.length === 0) continue;
      where.push(`(${parts.join(' OR ')})`);
    } else if (spec.type === 'classMask' && filter.kind === 'string' && filter.value) {
      const bit = EQUIP_CLASS_BIT[filter.value as EquipClass];
      if (bit === undefined) continue;
      // Beginner-wearable means unrestricted (no Beginner bit); for any
      // other class the filter restricts to gear with that class bit
      // explicitly set. See the enum branch above for the rationale.
      if (bit === 0) {
        where.push(`(${spec.col} IS NULL OR ${spec.col} = 0)`);
      } else {
        where.push(`(${spec.col} & ?) != 0`);
        params.push(bit);
      }
    }
  }
}

function escapeLikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
