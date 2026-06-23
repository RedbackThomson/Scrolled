import type { Row, Sqlite } from '../sqlite';
import type { ConsumableSpecRecord, MorphRandomEntry, SummonMobEntry } from '../types';

interface ConsumableSpecRow extends Row {
  item_id: number;
  hp: number | null;
  mp: number | null;
  hp_r: number | null;
  mp_r: number | null;
  mhp: number | null;
  mhp_r: number | null;
  mmp_r: number | null;
  mhp_r_rate: number | null;
  mmp_r_rate: number | null;
  time: number | null;
  pad: number | null;
  mad: number | null;
  pdd: number | null;
  mdd: number | null;
  acc: number | null;
  eva: number | null;
  speed: number | null;
  jump: number | null;
  luk: number | null;
  pad_rate: number | null;
  mad_rate: number | null;
  pdd_rate: number | null;
  mdd_rate: number | null;
  acc_rate: number | null;
  eva_rate: number | null;
  speed_rate: number | null;
  curse: number | null;
  darkness: number | null;
  poison: number | null;
  seal: number | null;
  weakness: number | null;
  thaw: number | null;
  barrier: number | null;
  respect_pimmune: number | null;
  respect_mimmune: number | null;
  respect_fs: number | null;
  defense_att: string | null;
  defense_state: string | null;
  prob: number | null;
  itemupbyitem: number | null;
  mesoupbyitem: number | null;
  item_code: number | null;
  item_range: number | null;
  morph: number | null;
  ghost: number | null;
  move_to: number | null;
  return_map_qr: number | null;
  ignore_continent: number | null;
  random_move_in_field_set: number | null;
  npc: number | null;
  attack_mob_id: number | null;
  attack_index: number | null;
  inc: number | null;
  inc_fatigue: number | null;
  exp: number | null;
  expinc: number | null;
  exp_buff: number | null;
  max_level_buff: number | null;
  cp: number | null;
  event_point: number | null;
  event_rate: number | null;
  consume_on_pickup: number | null;
  only_pickup: number | null;
  run_on_pickup: number | null;
  repeat_effect: number | null;
  other_party: number | null;
  party: number | null;
  mob_json: string | null;
  morph_random_json: string | null;
  skillbook_json: string | null;
  summon_mob_json: string | null;
}

function parseNumberArray(json: string | null): number[] | null {
  if (!json) return null;
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? (parsed as number[]) : null;
}

function rowToConsumableSpec(row: ConsumableSpecRow): ConsumableSpecRecord {
  return {
    itemId: row.item_id,
    hp: row.hp,
    mp: row.mp,
    hpR: row.hp_r,
    mpR: row.mp_r,
    mhp: row.mhp,
    mhpR: row.mhp_r,
    mmpR: row.mmp_r,
    mhpRRate: row.mhp_r_rate,
    mmpRRate: row.mmp_r_rate,
    time: row.time,
    pad: row.pad,
    mad: row.mad,
    pdd: row.pdd,
    mdd: row.mdd,
    acc: row.acc,
    eva: row.eva,
    speed: row.speed,
    jump: row.jump,
    luk: row.luk,
    padRate: row.pad_rate,
    madRate: row.mad_rate,
    pddRate: row.pdd_rate,
    mddRate: row.mdd_rate,
    accRate: row.acc_rate,
    evaRate: row.eva_rate,
    speedRate: row.speed_rate,
    curse: row.curse,
    darkness: row.darkness,
    poison: row.poison,
    seal: row.seal,
    weakness: row.weakness,
    thaw: row.thaw,
    barrier: row.barrier,
    respectPimmune: row.respect_pimmune,
    respectMimmune: row.respect_mimmune,
    respectFs: row.respect_fs,
    defenseAtt: row.defense_att,
    defenseState: row.defense_state,
    prob: row.prob,
    itemupbyitem: row.itemupbyitem,
    mesoupbyitem: row.mesoupbyitem,
    itemCode: row.item_code,
    itemRange: row.item_range,
    morph: row.morph,
    ghost: row.ghost,
    moveTo: row.move_to,
    returnMapQr: row.return_map_qr,
    ignoreContinent: row.ignore_continent,
    randomMoveInFieldSet: row.random_move_in_field_set,
    npc: row.npc,
    attackMobId: row.attack_mob_id,
    attackIndex: row.attack_index,
    inc: row.inc,
    incFatigue: row.inc_fatigue,
    exp: row.exp,
    expinc: row.expinc,
    expBuff: row.exp_buff,
    maxLevelBuff: row.max_level_buff,
    cp: row.cp,
    eventPoint: row.event_point,
    eventRate: row.event_rate,
    consumeOnPickup: row.consume_on_pickup,
    onlyPickup: row.only_pickup,
    runOnPickup: row.run_on_pickup,
    repeatEffect: row.repeat_effect,
    otherParty: row.other_party,
    party: row.party,
    mob: parseNumberArray(row.mob_json),
    morphRandom: row.morph_random_json
      ? (JSON.parse(row.morph_random_json) as MorphRandomEntry[])
      : null,
    skillbook: parseNumberArray(row.skillbook_json),
    summonMobs: row.summon_mob_json
      ? (JSON.parse(row.summon_mob_json) as SummonMobEntry[])
      : null,
  };
}

const COLUMNS = [
  'item_id',
  'hp',
  'mp',
  'hp_r',
  'mp_r',
  'mhp',
  'mhp_r',
  'mmp_r',
  'mhp_r_rate',
  'mmp_r_rate',
  'time',
  'pad',
  'mad',
  'pdd',
  'mdd',
  'acc',
  'eva',
  'speed',
  'jump',
  'luk',
  'pad_rate',
  'mad_rate',
  'pdd_rate',
  'mdd_rate',
  'acc_rate',
  'eva_rate',
  'speed_rate',
  'curse',
  'darkness',
  'poison',
  'seal',
  'weakness',
  'thaw',
  'barrier',
  'respect_pimmune',
  'respect_mimmune',
  'respect_fs',
  'defense_att',
  'defense_state',
  'prob',
  'itemupbyitem',
  'mesoupbyitem',
  'item_code',
  'item_range',
  'morph',
  'ghost',
  'move_to',
  'return_map_qr',
  'ignore_continent',
  'random_move_in_field_set',
  'npc',
  'attack_mob_id',
  'attack_index',
  'inc',
  'inc_fatigue',
  'exp',
  'expinc',
  'exp_buff',
  'max_level_buff',
  'cp',
  'event_point',
  'event_rate',
  'consume_on_pickup',
  'only_pickup',
  'run_on_pickup',
  'repeat_effect',
  'other_party',
  'party',
  'mob_json',
  'morph_random_json',
  'skillbook_json',
  'summon_mob_json',
] as const;

function specToParams(spec: ConsumableSpecRecord): (number | string | null)[] {
  return [
    spec.itemId,
    spec.hp,
    spec.mp,
    spec.hpR,
    spec.mpR,
    spec.mhp,
    spec.mhpR,
    spec.mmpR,
    spec.mhpRRate,
    spec.mmpRRate,
    spec.time,
    spec.pad,
    spec.mad,
    spec.pdd,
    spec.mdd,
    spec.acc,
    spec.eva,
    spec.speed,
    spec.jump,
    spec.luk,
    spec.padRate,
    spec.madRate,
    spec.pddRate,
    spec.mddRate,
    spec.accRate,
    spec.evaRate,
    spec.speedRate,
    spec.curse,
    spec.darkness,
    spec.poison,
    spec.seal,
    spec.weakness,
    spec.thaw,
    spec.barrier,
    spec.respectPimmune,
    spec.respectMimmune,
    spec.respectFs,
    spec.defenseAtt,
    spec.defenseState,
    spec.prob,
    spec.itemupbyitem,
    spec.mesoupbyitem,
    spec.itemCode,
    spec.itemRange,
    spec.morph,
    spec.ghost,
    spec.moveTo,
    spec.returnMapQr,
    spec.ignoreContinent,
    spec.randomMoveInFieldSet,
    spec.npc,
    spec.attackMobId,
    spec.attackIndex,
    spec.inc,
    spec.incFatigue,
    spec.exp,
    spec.expinc,
    spec.expBuff,
    spec.maxLevelBuff,
    spec.cp,
    spec.eventPoint,
    spec.eventRate,
    spec.consumeOnPickup,
    spec.onlyPickup,
    spec.runOnPickup,
    spec.repeatEffect,
    spec.otherParty,
    spec.party,
    spec.mob ? JSON.stringify(spec.mob) : null,
    spec.morphRandom ? JSON.stringify(spec.morphRandom) : null,
    spec.skillbook ? JSON.stringify(spec.skillbook) : null,
    spec.summonMobs ? JSON.stringify(spec.summonMobs) : null,
  ];
}

const INSERT_SQL = `INSERT INTO consumable_specs (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT(item_id) DO UPDATE SET ${COLUMNS.filter((c) => c !== 'item_id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')}`;

export function upsertConsumableSpecRow(sql: Sqlite, spec: ConsumableSpecRecord): void {
  sql.exec(INSERT_SQL, specToParams(spec));
}

export function upsertConsumableSpecs(sql: Sqlite, specs: ConsumableSpecRecord[]): number {
  sql.transaction(() => {
    for (const s of specs) upsertConsumableSpecRow(sql, s);
  });
  return specs.length;
}

export function getConsumableSpec(sql: Sqlite, itemId: number): ConsumableSpecRecord | null {
  const row = sql.selectObject<ConsumableSpecRow>(
    'SELECT * FROM consumable_specs WHERE item_id = ?',
    [itemId],
  );
  return row ? rowToConsumableSpec(row) : null;
}
