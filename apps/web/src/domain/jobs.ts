// Canonical job id → English name map for v83-era MapleStory.
//
// Most dumps we've seen carry these names in `String.wz/Job.img`; some
// versions (KMS-derived, certain private-server repacks) ship without
// `Job.img` entirely. The map here is used as a fallback by
// `extractors/extractJobs.ts` when the WZ tree is silent, so the skills
// listing still reads "Hero" instead of "Job 112" on those datasets.
//
// English-only by design: nothing in the project should ship a localised
// fallback for the same reason it doesn't ship game data — that belongs
// to the user's WZ files. When those exist, their names win.

/**
 * Job id → display name. Pure ASCII, English, no trademark references —
 * these are the in-game class names that have been the same since v83.
 */
export const JOB_NAMES_FALLBACK: Readonly<Record<number, string>> = {
  0: 'Beginner',

  100: 'Warrior',
  110: 'Fighter',
  111: 'Crusader',
  112: 'Hero',
  120: 'Page',
  121: 'White Knight',
  122: 'Paladin',
  130: 'Spearman',
  131: 'Dragon Knight',
  132: 'Dark Knight',

  200: 'Magician',
  210: 'F/P Wizard',
  211: 'F/P Mage',
  212: 'F/P Arch Mage',
  220: 'I/L Wizard',
  221: 'I/L Mage',
  222: 'I/L Arch Mage',
  230: 'Cleric',
  231: 'Priest',
  232: 'Bishop',

  300: 'Bowman',
  310: 'Hunter',
  311: 'Ranger',
  312: 'Bowmaster',
  320: 'Crossbowman',
  321: 'Sniper',
  322: 'Marksman',

  400: 'Thief',
  410: 'Assassin',
  411: 'Hermit',
  412: 'Night Lord',
  420: 'Bandit',
  421: 'Chief Bandit',
  422: 'Shadower',

  500: 'Pirate',
  510: 'Brawler',
  511: 'Marauder',
  512: 'Buccaneer',
  520: 'Gunslinger',
  521: 'Outlaw',
  522: 'Corsair',
};
