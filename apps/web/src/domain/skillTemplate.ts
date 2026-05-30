// Templated skill descriptions.
//
// `String.wz/Skill.img/<id>/{desc,h,h1,h2}` strings use `#name` placeholders
// that resolve to the matching field on `Skill.wz/.../level/<N>`. Per the
// in-game convention, `#x`, `#y`, and `#z` are reused with skill-specific
// meanings and so MUST NOT be globally interpreted — they're just keys.
// Anything that can't be resolved is left as `#name` in the output so the
// rendering loss is visible rather than silent.

import type { SkillLevelRecord } from '@/db';

/**
 * Per-level keys persisted on `skill_levels` as camelCase columns, mapped
 * back to the original WZ placeholder name they came from. Anything not
 * in this table (e.g. unknown fields preserved in `raw_json`) keeps its
 * WZ name verbatim — see `buildSkillTemplateValues`.
 */
export const SKILL_FIELD_TO_PLACEHOLDER: Readonly<Record<string, string>> = {
  mpCost: 'mpCon',
  hpCost: 'hpCon',
  damagePercent: 'damage',
  hits: 'attackCount',
  targets: 'mobCount',
  durationSeconds: 'time',
  cooldownSeconds: 'cooltime',
  chancePercent: 'prop',
  hpPercent: 'hpR',
  mpPercent: 'mpR',
  // 1:1 fields — placeholder name matches the column name.
  x: 'x',
  y: 'y',
  z: 'z',
  pad: 'pad',
  mad: 'mad',
  pdd: 'pdd',
  mdd: 'mdd',
  acc: 'acc',
  eva: 'eva',
  speed: 'speed',
  jump: 'jump',
  hp: 'hp',
  mp: 'mp',
};

/**
 * Collapse a `SkillLevelRecord` into the `{ placeholder → value }` shape
 * `renderSkillTemplate` consumes. Known columns are renamed back to
 * their WZ placeholder; any extra keys preserved in `raw_json` come
 * through untouched so they remain available to the renderer.
 */
export function buildSkillTemplateValues(
  level: SkillLevelRecord,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [field, placeholder] of Object.entries(SKILL_FIELD_TO_PLACEHOLDER)) {
    const value = (level as unknown as Record<string, unknown>)[field];
    if (typeof value === 'number') out[placeholder] = value;
  }
  if (level.rawJson) {
    try {
      const raw = JSON.parse(level.rawJson) as unknown;
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof value === 'number' || typeof value === 'string') {
            // Known WZ keys are already covered above; rawJson only carries
            // fields the extractor didn't recognize, so we never overwrite
            // a resolved value with an unparsed one.
            if (!(key in out)) out[key] = value;
          }
        }
      }
    } catch {
      // A malformed `raw_json` blob (shouldn't happen — we wrote it ourselves
      // with JSON.stringify) is treated the same as no extra fields.
    }
  }
  return out;
}

const PLACEHOLDER_RE = /#([a-zA-Z]\w*)/g;

/**
 * Substitute `#name` placeholders in `template` with matching entries
 * from `values`. Unresolved placeholders are left as-is so the missing
 * key is visible to the reader. Non-template strings (no `#`) round-trip
 * unchanged.
 */
export function renderSkillTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(PLACEHOLDER_RE, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/** Return true if `template` contains at least one `#name` placeholder. */
export function hasSkillPlaceholders(template: string | null | undefined): boolean {
  if (!template) return false;
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(template);
}
