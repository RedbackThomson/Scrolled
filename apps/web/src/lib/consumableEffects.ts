// Turns a raw `ConsumableSpecRecord` into label/value rows for the item detail
// sidebar — the same key-on-the-left, value-on-the-right shape the other aside
// sections (Info, Stats, chair Recovery) use. The point is to pair magnitudes
// with context so a reader never sees a bare number: a lone `prob` becomes the
// value of an "Item drop rate" row, `time` becomes a "Duration" row, a
// `defenseAtt` letter becomes a "Fire defense" row.
//
// Pure and framework-free (no React) so it's unit-testable on its own; the
// component renders each row through `InfoRow`.

import type { ConsumableSpecRecord } from '@scrolled/game-db/db';
import {
  CURE_FLAGS,
  STAT_BUFF_LABELS,
  decodeDefenseAtt,
  decodeDefenseState,
} from '@scrolled/game-db/domain/consumableSpec';
import { formatDurationSeconds } from './duration';

/** A reference to another entity the renderer turns into a link. `note` is an
 *  optional suffix shown after the link (e.g. a spawn count or probability). */
export interface EntityRef {
  entity: 'map' | 'npc' | 'mob';
  id: number;
  note?: string;
}

/** One sidebar row: a label and either a text value or linked entities. */
export interface EffectRow {
  label: string;
  value?: string;
  refs?: EntityRef[];
}

const TOWN_RETURN_MAP_ID = 999999999;

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function buildConsumableEffects(spec: ConsumableSpecRecord): EffectRow[] {
  const rows: EffectRow[] = [];

  // Recovery (instant)
  if (spec.hp !== null) rows.push({ label: 'HP', value: String(spec.hp) });
  if (spec.mp !== null) rows.push({ label: 'MP', value: String(spec.mp) });
  if (spec.hpR !== null) rows.push({ label: 'HP', value: `${spec.hpR}%` });
  if (spec.mpR !== null) rows.push({ label: 'MP', value: `${spec.mpR}%` });
  if (spec.mhpR !== null) rows.push({ label: 'Max HP', value: `${spec.mhpR}%` });
  if (spec.mmpR !== null) rows.push({ label: 'Max MP', value: `${spec.mmpR}%` });
  if (spec.mhp !== null) rows.push({ label: 'Max HP', value: `+${spec.mhp}` });

  // Timed buffs
  for (const b of STAT_BUFF_LABELS) {
    const flat = spec[b.flat];
    if (typeof flat === 'number' && flat !== 0) rows.push({ label: b.label, value: signed(flat) });
    if (b.rate !== b.flat) {
      const rate = spec[b.rate];
      if (typeof rate === 'number' && rate !== 0) {
        rows.push({ label: b.label, value: `${signed(rate)}%` });
      }
    }
  }
  if (spec.expBuff !== null) rows.push({ label: 'EXP rate', value: `${signed(spec.expBuff)}%` });

  // Drop / meso bonuses (prob is the magnitude)
  if (spec.itemupbyitem !== null) {
    rows.push({ label: 'Item drop rate', value: spec.prob !== null ? `+${spec.prob}%` : 'Increased' });
  }
  if (spec.mesoupbyitem !== null) {
    rows.push({ label: 'Meso drop rate', value: spec.prob !== null ? `+${spec.prob}%` : 'Increased' });
  }

  // Monster-card resistances
  if (spec.defenseAtt !== null) {
    rows.push({
      label: `${decodeDefenseAtt(spec.defenseAtt)} defense`,
      value: spec.prob !== null ? `+${spec.prob}%` : 'Yes',
    });
  }
  if (spec.defenseState !== null) {
    rows.push({
      label: `${decodeDefenseState(spec.defenseState)} resist`,
      value: spec.prob !== null ? `+${spec.prob}%` : 'Yes',
    });
  }
  if (spec.respectPimmune !== null) rows.push({ label: 'Immune to', value: 'Physical attacks' });
  if (spec.respectMimmune !== null) rows.push({ label: 'Immune to', value: 'Magic attacks' });

  // Duration applies to every timed row above; show it once after them.
  if (spec.time !== null && spec.time > 0) {
    rows.push({ label: 'Duration', value: formatDurationSeconds(spec.time / 1000) });
  }

  // Cures (instant)
  const cured = CURE_FLAGS.filter((c) => {
    const v = spec[c.field];
    return typeof v === 'number' && v > 0;
  }).map((c) => c.label);
  if (cured.length > 0) rows.push({ label: 'Cures', value: cured.join(', ') });

  // Transform
  if (spec.morph !== null || spec.ghost !== null || spec.morphRandom !== null) {
    rows.push({ label: 'Transform', value: 'Changes form' });
  }

  // Warp
  if (spec.moveTo !== null) {
    rows.push(
      spec.moveTo === TOWN_RETURN_MAP_ID
        ? { label: 'Warps to', value: 'Nearest town' }
        : { label: 'Warps to', refs: [{ entity: 'map', id: spec.moveTo }] },
    );
  }
  if (spec.returnMapQr !== null) {
    rows.push({ label: 'Returns to', refs: [{ entity: 'map', id: spec.returnMapQr }] });
  }
  if (spec.randomMoveInFieldSet !== null) rows.push({ label: 'Warp', value: 'Random nearby' });

  // Summon — NPCs, and summoning-sack mob spawn tables. The same mob id may
  // repeat (one entry per spawn), so collapse to distinct mobs with a ×count
  // and show the probability only when it isn't a guaranteed 100%.
  if (spec.npc !== null) rows.push({ label: 'Summons', refs: [{ entity: 'npc', id: spec.npc }] });
  if (spec.summonMobs !== null && spec.summonMobs.length > 0) {
    const order: number[] = [];
    const agg = new Map<number, { count: number; prob: number }>();
    for (const e of spec.summonMobs) {
      const cur = agg.get(e.mobId);
      if (cur) cur.count += 1;
      else {
        agg.set(e.mobId, { count: 1, prob: e.prob });
        order.push(e.mobId);
      }
    }
    const refs: EntityRef[] = order.map((id) => {
      const { count, prob } = agg.get(id)!;
      const parts: string[] = [];
      if (count > 1) parts.push(`×${count}`);
      if (prob < 100) parts.push(`(${prob}%)`);
      return { entity: 'mob', id, note: parts.length > 0 ? parts.join(' ') : undefined };
    });
    rows.push({ label: 'Summons', refs });
  }

  // Pet & mount
  if (spec.inc !== null) rows.push({ label: 'Pet fullness', value: `+${spec.inc}` });
  if (spec.incFatigue !== null) rows.push({ label: 'Mount fatigue', value: signed(spec.incFatigue) });

  // Experience & events
  if (spec.exp !== null) rows.push({ label: 'EXP', value: `+${spec.exp.toLocaleString()}` });
  if (spec.expinc !== null) rows.push({ label: 'EXP', value: `+${spec.expinc.toLocaleString()}` });
  if (spec.cp !== null) rows.push({ label: 'Carnival Points', value: `+${spec.cp}` });
  if (spec.eventPoint !== null) rows.push({ label: 'Event points', value: `+${spec.eventPoint}` });

  return rows;
}
