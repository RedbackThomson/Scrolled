import { describe, expect, it } from 'vitest';
import type { ConsumableSpecRecord } from '@scrolled/game-db/db';
import { buildConsumableEffects } from './consumableEffects';

/** A spec with every field null; tests override only what they exercise. */
function emptySpec(overrides: Partial<ConsumableSpecRecord>): ConsumableSpecRecord {
  const base = {
    itemId: 1,
    hp: null,
    mp: null,
    hpR: null,
    mpR: null,
    mhp: null,
    mhpR: null,
    mmpR: null,
    mhpRRate: null,
    mmpRRate: null,
    time: null,
    pad: null,
    mad: null,
    pdd: null,
    mdd: null,
    acc: null,
    eva: null,
    speed: null,
    jump: null,
    luk: null,
    padRate: null,
    madRate: null,
    pddRate: null,
    mddRate: null,
    accRate: null,
    evaRate: null,
    speedRate: null,
    curse: null,
    darkness: null,
    poison: null,
    seal: null,
    weakness: null,
    thaw: null,
    barrier: null,
    respectPimmune: null,
    respectMimmune: null,
    respectFs: null,
    defenseAtt: null,
    defenseState: null,
    prob: null,
    itemupbyitem: null,
    mesoupbyitem: null,
    itemCode: null,
    itemRange: null,
    morph: null,
    ghost: null,
    moveTo: null,
    returnMapQr: null,
    ignoreContinent: null,
    randomMoveInFieldSet: null,
    npc: null,
    attackMobId: null,
    attackIndex: null,
    inc: null,
    incFatigue: null,
    exp: null,
    expinc: null,
    expBuff: null,
    maxLevelBuff: null,
    cp: null,
    eventPoint: null,
    eventRate: null,
    consumeOnPickup: null,
    onlyPickup: null,
    runOnPickup: null,
    repeatEffect: null,
    otherParty: null,
    party: null,
    mob: null,
    morphRandom: null,
    skillbook: null,
    summonMobs: null,
  } satisfies ConsumableSpecRecord;
  return { ...base, ...overrides };
}

describe('buildConsumableEffects', () => {
  it('renders flat recovery as a label/value row', () => {
    expect(buildConsumableEffects(emptySpec({ hp: 50 }))).toEqual([{ label: 'HP', value: '50' }]);
  });

  it('renders a timed stat buff with a trailing duration row', () => {
    expect(buildConsumableEffects(emptySpec({ pad: 20, time: 300000 }))).toEqual([
      { label: 'Weapon Attack', value: '+20' },
      { label: 'Duration', value: '5 minutes' },
    ]);
  });

  it('pairs prob as the value of the drop-bonus row', () => {
    expect(buildConsumableEffects(emptySpec({ itemupbyitem: 2, prob: 30, time: 3600000 }))).toEqual([
      { label: 'Item drop rate', value: '+30%' },
      { label: 'Duration', value: '1 hour' },
    ]);
  });

  it('decodes a monster-card resistance with prob as the magnitude', () => {
    expect(buildConsumableEffects(emptySpec({ defenseState: 'C', prob: 5, time: 1800000 }))).toEqual([
      { label: 'Curse resist', value: '+5%' },
      { label: 'Duration', value: '30 minutes' },
    ]);
  });

  it('collects cure flags into one row', () => {
    expect(buildConsumableEffects(emptySpec({ poison: 1, darkness: 1, weakness: 1 }))).toEqual([
      { label: 'Cures', value: 'Darkness, Poison, Weakness' },
    ]);
  });

  it('renders a warp as a linkable map reference', () => {
    expect(buildConsumableEffects(emptySpec({ moveTo: 104000000 }))).toEqual([
      { label: 'Warps to', refs: [{ entity: 'map', id: 104000000 }] },
    ]);
  });

  it('treats the town-return sentinel as plain text, not a link', () => {
    expect(buildConsumableEffects(emptySpec({ moveTo: 999999999 }))).toEqual([
      { label: 'Warps to', value: 'Nearest town' },
    ]);
  });

  it('collapses a summon-sack spawn table into distinct mob links with counts', () => {
    expect(
      buildConsumableEffects(
        emptySpec({
          summonMobs: [
            { mobId: 8830100, prob: 100 },
            { mobId: 8830100, prob: 100 },
            { mobId: 8830100, prob: 100 },
          ],
        }),
      ),
    ).toEqual([{ label: 'Summons', refs: [{ entity: 'mob', id: 8830100, note: '×3' }] }]);
  });

  it('shows a non-guaranteed summon probability but not 100%', () => {
    expect(
      buildConsumableEffects(emptySpec({ summonMobs: [{ mobId: 9400376, prob: 70 }] })),
    ).toEqual([{ label: 'Summons', refs: [{ entity: 'mob', id: 9400376, note: '(70%)' }] }]);
  });

  it('never emits a lone prob with no effect to anchor it', () => {
    expect(buildConsumableEffects(emptySpec({ prob: 50 }))).toEqual([]);
  });
});
