// Maps a WZ `reqJob` bitfield to the list of classes that can equip the item.
//
// The DB stores the raw value as it came from the parser; this helper turns
// it into a friendly list for display. `0` (or null/undefined) means "no
// class restriction" and expands to every class including Beginner — bits
// 1/2/4/8/16 are the five non-Beginner job lines and only appear when the
// equip is restricted to those classes.

export type EquipClass =
  | 'Beginner'
  | 'Warrior'
  | 'Magician'
  | 'Bowman'
  | 'Thief'
  | 'Pirate';

export const ALL_EQUIP_CLASSES: readonly EquipClass[] = [
  'Beginner',
  'Warrior',
  'Magician',
  'Bowman',
  'Thief',
  'Pirate',
];

export function parseReqJob(reqJob: number | null | undefined): EquipClass[] {
  if (!reqJob) {
    return [...ALL_EQUIP_CLASSES];
  }
  const classes: EquipClass[] = [];
  if (reqJob & 1) classes.push('Warrior');
  if (reqJob & 2) classes.push('Magician');
  if (reqJob & 4) classes.push('Bowman');
  if (reqJob & 8) classes.push('Thief');
  if (reqJob & 16) classes.push('Pirate');
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
