// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildSkillTemplateValues,
  hasSkillPlaceholders,
  renderSkillTemplate,
} from './skillTemplate';
import type { SkillLevelRecord } from '@/db';

function blankLevel(overrides: Partial<SkillLevelRecord> = {}): SkillLevelRecord {
  return {
    skillId: 1,
    level: 1,
    mpCost: null,
    hpCost: null,
    damagePercent: null,
    hits: null,
    targets: null,
    durationSeconds: null,
    cooldownSeconds: null,
    chancePercent: null,
    x: null,
    y: null,
    z: null,
    pad: null,
    mad: null,
    pdd: null,
    mdd: null,
    acc: null,
    eva: null,
    speed: null,
    jump: null,
    hp: null,
    mp: null,
    hpPercent: null,
    mpPercent: null,
    description: null,
    rawJson: null,
    ...overrides,
  };
}

describe('renderSkillTemplate', () => {
  it('substitutes a single #x placeholder', () => {
    expect(renderSkillTemplate('Boost by #x%.', { x: 60 })).toBe('Boost by 60%.');
  });

  it('substitutes multiple placeholders', () => {
    expect(
      renderSkillTemplate('HP and MP +#x% for #time sec.', { x: 60, time: 600 }),
    ).toBe('HP and MP +60% for 600 sec.');
  });

  it('leaves unresolved placeholders as #name', () => {
    expect(renderSkillTemplate('Mystery #q hits.', { x: 10 })).toBe('Mystery #q hits.');
  });

  it('returns text without placeholders unchanged', () => {
    expect(renderSkillTemplate('Passive buff.', { x: 1 })).toBe('Passive buff.');
  });

  it('does not match a leading digit (so #10 stays literal)', () => {
    expect(renderSkillTemplate('Costs #10 MP and #mpCon HP.', { mpCon: 12 })).toBe(
      'Costs #10 MP and 12 HP.',
    );
  });
});

describe('buildSkillTemplateValues', () => {
  it('renames camelCase fields back to WZ placeholders', () => {
    const values = buildSkillTemplateValues(
      blankLevel({
        mpCost: 12,
        damagePercent: 110,
        durationSeconds: 600,
        cooldownSeconds: 30,
        chancePercent: 60,
        hpPercent: 50,
        mpPercent: 25,
      }),
    );
    expect(values).toMatchObject({
      mpCon: 12,
      damage: 110,
      time: 600,
      cooltime: 30,
      prop: 60,
      hpR: 50,
      mpR: 25,
    });
  });

  it('passes 1:1 fields through unchanged', () => {
    const values = buildSkillTemplateValues(blankLevel({ x: 7, y: 8, z: 9, pad: 30 }));
    expect(values).toMatchObject({ x: 7, y: 8, z: 9, pad: 30 });
  });

  it('merges unknown keys from rawJson without overwriting known ones', () => {
    const values = buildSkillTemplateValues(
      blankLevel({ mpCost: 12, rawJson: JSON.stringify({ mpCon: 99, extra: 5, label: 'foo' }) }),
    );
    expect(values.mpCon).toBe(12);
    expect(values.extra).toBe(5);
    expect(values.label).toBe('foo');
  });

  it('skips null fields', () => {
    const values = buildSkillTemplateValues(blankLevel({ mpCost: null }));
    expect('mpCon' in values).toBe(false);
  });

  it('renders a real-looking Hyper Body template end-to-end', () => {
    const level = blankLevel({ x: 60, durationSeconds: 600, mpCost: 30 });
    const rendered = renderSkillTemplate(
      'Increase Max HP and Max MP by #x% for #time sec.',
      buildSkillTemplateValues(level),
    );
    expect(rendered).toBe('Increase Max HP and Max MP by 60% for 600 sec.');
  });
});

describe('hasSkillPlaceholders', () => {
  it('returns true when the template contains #name', () => {
    expect(hasSkillPlaceholders('Boost by #x%.')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(hasSkillPlaceholders('Passive buff.')).toBe(false);
  });

  it('returns false for null / empty', () => {
    expect(hasSkillPlaceholders(null)).toBe(false);
    expect(hasSkillPlaceholders('')).toBe(false);
  });

  it('returns false for a bare # with no name', () => {
    expect(hasSkillPlaceholders('Costs # MP.')).toBe(false);
  });
});
