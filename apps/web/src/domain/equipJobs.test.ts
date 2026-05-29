import { describe, expect, it } from 'vitest';
import {
  ALL_EQUIP_CLASSES,
  BEGINNER_EQUIP_REQ_JOB,
  EQUIP_REQ_JOB_BIT,
  REWARD_JOB_BIT,
  formatEquipJobs,
  isAnyClass,
  parseEquipReqJob,
  parseRewardJob,
} from './equipJobs';

describe('parseEquipReqJob', () => {
  it('treats null / undefined / 0 as no restriction', () => {
    expect(parseEquipReqJob(null)).toEqual([...ALL_EQUIP_CLASSES]);
    expect(parseEquipReqJob(undefined)).toEqual([...ALL_EQUIP_CLASSES]);
    expect(parseEquipReqJob(0)).toEqual([...ALL_EQUIP_CLASSES]);
  });

  it('maps the -1 sentinel to Beginner only', () => {
    expect(parseEquipReqJob(BEGINNER_EQUIP_REQ_JOB)).toEqual(['Beginner']);
    expect(parseEquipReqJob(-1)).toEqual(['Beginner']);
  });

  it('decodes single-class bits without including Beginner', () => {
    expect(parseEquipReqJob(EQUIP_REQ_JOB_BIT.Warrior)).toEqual(['Warrior']);
    expect(parseEquipReqJob(EQUIP_REQ_JOB_BIT.Magician)).toEqual(['Magician']);
    expect(parseEquipReqJob(EQUIP_REQ_JOB_BIT.Bowman)).toEqual(['Bowman']);
    expect(parseEquipReqJob(EQUIP_REQ_JOB_BIT.Thief)).toEqual(['Thief']);
    expect(parseEquipReqJob(EQUIP_REQ_JOB_BIT.Pirate)).toEqual(['Pirate']);
  });

  it('decodes multi-class bitfields', () => {
    // 1|8 = Warrior + Thief (observed in real data, e.g. some daggers).
    expect(parseEquipReqJob(1 | 8)).toEqual(['Warrior', 'Thief']);
  });
});

describe('parseRewardJob', () => {
  it('treats null / 0 as no restriction', () => {
    expect(parseRewardJob(null)).toEqual([...ALL_EQUIP_CLASSES]);
    expect(parseRewardJob(0)).toEqual([...ALL_EQUIP_CLASSES]);
  });

  it('decodes single-class bits with Beginner at bit 0 and Pirate at bit 32', () => {
    expect(parseRewardJob(REWARD_JOB_BIT.Beginner)).toEqual(['Beginner']);
    expect(parseRewardJob(REWARD_JOB_BIT.Warrior)).toEqual(['Warrior']);
    expect(parseRewardJob(REWARD_JOB_BIT.Magician)).toEqual(['Magician']);
    expect(parseRewardJob(REWARD_JOB_BIT.Bowman)).toEqual(['Bowman']);
    expect(parseRewardJob(REWARD_JOB_BIT.Thief)).toEqual(['Thief']);
    expect(parseRewardJob(REWARD_JOB_BIT.Pirate)).toEqual(['Pirate']);
  });

  it('decodes the "every main class" bitfield (63 = 1|2|4|8|16|32)', () => {
    expect(parseRewardJob(63)).toEqual([...ALL_EQUIP_CLASSES]);
  });

  it('ignores high sub-class bits the picker does not model', () => {
    // 32800 = 32768 + 32 — Pirate + a sub-class advancement bit.
    expect(parseRewardJob(32 + 32768)).toEqual(['Pirate']);
  });
});

describe('isAnyClass / formatEquipJobs', () => {
  it('isAnyClass true iff all six classes are listed', () => {
    expect(isAnyClass([...ALL_EQUIP_CLASSES])).toBe(true);
    expect(isAnyClass(['Warrior'])).toBe(false);
  });

  it('formatEquipJobs collapses "all" to "Any"', () => {
    expect(formatEquipJobs([...ALL_EQUIP_CLASSES])).toBe('Any');
    expect(formatEquipJobs(['Warrior', 'Magician'])).toBe('Warrior, Magician');
  });
});
