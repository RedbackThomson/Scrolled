import type { EquipRecord } from '@/db';
import type { ListCardStat } from '@/components/data-table/listCardLayout';
import { ABILITY_STAT_FIELDS } from '@scrolled/game-db/domain/abilityStats';
import { isAnyClass, parseEquipReqJob } from '@scrolled/game-db/domain/equipJobs';

/** Card stats for an equip: an optional headline stat, then slots, level and its main stat requirement. */
export function equipCardStats(row: EquipRecord, headline?: ListCardStat): ListCardStat[] {
  const stats: ListCardStat[] = [];
  if (headline) stats.push(headline);
  if (row.upgradeSlots !== null) stats.push({ label: 'Slots', value: row.upgradeSlots });
  if (row.requiredLevel !== null) stats.push({ label: 'Req Lv', value: row.requiredLevel });
  const main = ABILITY_STAT_FIELDS.map((f) => ({ label: f.label, value: row[f.required] ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)[0];
  if (main) stats.push({ label: `Req ${main.label}`, value: main.value });
  return stats;
}

/** Who can use it, and whether it's a cash item. */
export function equipCardTags(row: EquipRecord): string[] {
  const jobs = parseEquipReqJob(row.requiredJob);
  return [isAnyClass(jobs) ? 'Any class' : jobs.join(', '), row.cash ? 'Cash' : 'Regular'];
}
