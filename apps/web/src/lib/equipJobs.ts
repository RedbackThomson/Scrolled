// Maps a WZ `reqJob` bitfield to the list of classes that can equip the item.
//
// The DB stores the raw value as it came from the parser; this helper turns
// it into a friendly list for display. `0` (or null/undefined) means "no
// class restriction" and expands to every class including Beginner — bits
// 1/2/4/8/16 are the five non-Beginner job lines and only appear when the
// equip is restricted to those classes.

export type EquipClass = 'Beginner' | 'Warrior' | 'Magician' | 'Bowman' | 'Thief' | 'Pirate';

export const ALL_EQUIP_CLASSES: readonly EquipClass[] = [
  'Beginner',
  'Warrior',
  'Magician',
  'Bowman',
  'Thief',
  'Pirate',
];

/**
 * MapleStory class → WZ `reqJob` bit. `0` is the sentinel for Beginner —
 * Beginner has no dedicated bit and only matches equips with no class
 * restriction. Imported by `db/queries.ts` so the class-mask filter and
 * the display-side parser stay in lockstep.
 */
export const EQUIP_CLASS_BIT: Readonly<Record<EquipClass, number>> = {
  Beginner: 0,
  Warrior: 1,
  Magician: 2,
  Bowman: 4,
  Thief: 8,
  Pirate: 16,
};

export function parseReqJob(reqJob: number | null | undefined): EquipClass[] {
  if (!reqJob) {
    return [...ALL_EQUIP_CLASSES];
  }
  const classes: EquipClass[] = [];
  for (const cls of ALL_EQUIP_CLASSES) {
    const bit = EQUIP_CLASS_BIT[cls];
    if (bit !== 0 && (reqJob & bit) !== 0) classes.push(cls);
  }
  return classes;
}

/** True when the equip has no class restriction (every class can wear it). */
export function isAnyClass(classes: EquipClass[]): boolean {
  return classes.length === ALL_EQUIP_CLASSES.length;
}

export function formatEquipJobs(classes: EquipClass[]): string {
  if (isAnyClass(classes)) return 'Any';
  return classes.join(', ');
}
