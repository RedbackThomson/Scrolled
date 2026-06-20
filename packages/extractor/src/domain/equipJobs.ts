// Maps a WZ "which classes can have this" field to the list of classes it
// names.
//
// `0` (or null/undefined) is the universal "no class restriction" sentinel and
// expands to every class. From there the encoding splits between two parts of
// the game data, with *different bit assignments*:
//
//   1. **Equips** (Item.wz info.reqJob, persisted to `equips.required_job`):
//      Beginner-only items use the sentinel `-1` (e.g. Frozen Tuna). Every
//      other restriction is the OR of the positive bits Warrior=1, Magician=2,
//      Bowman=4, Thief=8, Pirate=16. There is no Beginner bit.
//
//   2. **Quest rewards** (Act.img item entries, persisted to
//      `quest_rewards.job`): the equip layout shifted left by one, with bit 0
//      (=1) reserved for Beginner. So Beginner=1, Warrior=2, Magician=4,
//      Bowman=8, Thief=16, Pirate=32. Real data also carries high bits
//      (1024+, 32768+) marking sub-class / job-advancement gates; the player-
//      facing class picker only speaks to the low six bits.
//
// Each scheme has its own parser. Don't pass an equip's required_job through
// the reward parser or vice versa — the answers will be wrong by one class.

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
 * Equip-side class → `required_job` bit. Beginner is absent because
 * Beginner-only equips don't use a bit — they use the sentinel
 * {@link BEGINNER_EQUIP_REQ_JOB}. Imported by `db/queries.ts` so the
 * equip class-mask filter and the display-side parser stay in lockstep.
 */
export const EQUIP_REQ_JOB_BIT: Readonly<Record<Exclude<EquipClass, 'Beginner'>, number>> = {
  Warrior: 1,
  Magician: 2,
  Bowman: 4,
  Thief: 8,
  Pirate: 16,
};

/**
 * Sentinel `required_job` value for Beginner-only equips. Two's complement
 * `-1` has every bit set, so a naive bitwise decode would call it "every
 * class"; the server treats it as "Beginner only" by convention. Callers
 * that filter or count equips by Beginner match on this constant directly.
 */
export const BEGINNER_EQUIP_REQ_JOB = -1;

/**
 * Quest-reward class → `quest_rewards.job` bit. Distinct from the equip
 * map: bit 0 is Beginner, and every other class is shifted up one slot.
 */
export const REWARD_JOB_BIT: Readonly<Record<EquipClass, number>> = {
  Beginner: 1,
  Warrior: 2,
  Magician: 4,
  Bowman: 8,
  Thief: 16,
  Pirate: 32,
};

/**
 * Decode an equip's `required_job`. `-1` is Beginner-only; 0/null is "any
 * class". Positive values are the OR of {@link EQUIP_REQ_JOB_BIT}.
 */
export function parseEquipReqJob(reqJob: number | null | undefined): EquipClass[] {
  if (reqJob === null || reqJob === undefined || reqJob === 0) {
    return [...ALL_EQUIP_CLASSES];
  }
  if (reqJob === BEGINNER_EQUIP_REQ_JOB) {
    return ['Beginner'];
  }
  const classes: EquipClass[] = [];
  for (const cls of ALL_EQUIP_CLASSES) {
    if (cls === 'Beginner') continue;
    if ((reqJob & EQUIP_REQ_JOB_BIT[cls]) !== 0) classes.push(cls);
  }
  return classes;
}

/**
 * Decode a quest reward's `job` bitfield. 0/null is "any class"; positive
 * values are the OR of {@link REWARD_JOB_BIT} (Beginner=1, Pirate=32 …).
 * High sub-class bits the picker doesn't model are silently ignored.
 */
export function parseRewardJob(job: number | null | undefined): EquipClass[] {
  if (job === null || job === undefined || job === 0) {
    return [...ALL_EQUIP_CLASSES];
  }
  const classes: EquipClass[] = [];
  for (const cls of ALL_EQUIP_CLASSES) {
    if ((job & REWARD_JOB_BIT[cls]) !== 0) classes.push(cls);
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
