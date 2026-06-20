import { describe, expect, it } from 'vitest';
import {
  CURRENT_DATA_REVISION,
  MINIMUM_SUPPORTED_DATA_REVISION,
  evaluateDataState,
} from './dataVersion';

describe('evaluateDataState', () => {
  it('keeps the constants coherent (minimum never exceeds current)', () => {
    expect(MINIMUM_SUPPORTED_DATA_REVISION).toBeLessThanOrEqual(CURRENT_DATA_REVISION);
  });

  it('flags a pre-tracking library (revision 0) for rebuild', () => {
    // An absent app_meta key reads as 0; with minimum >= 1 this must rebuild.
    expect(evaluateDataState(0)).toBe('reinitialize-required');
  });

  it('flags anything below the minimum for rebuild', () => {
    expect(evaluateDataState(MINIMUM_SUPPORTED_DATA_REVISION - 1)).toBe('reinitialize-required');
  });

  it('treats the current revision as up to date', () => {
    expect(evaluateDataState(CURRENT_DATA_REVISION)).toBe('current');
  });

  it('treats a future revision as up to date (newer build wrote it)', () => {
    expect(evaluateDataState(CURRENT_DATA_REVISION + 1)).toBe('current');
  });

  it('recommends an update for readable-but-stale revisions', () => {
    // Only meaningful once a release widens the gap (current > minimum). Pick
    // a revision inside the [minimum, current) band so the assertion holds
    // for any current configuration; fall back to the degenerate case below.
    if (MINIMUM_SUPPORTED_DATA_REVISION === CURRENT_DATA_REVISION) {
      // Degenerate band: no "stale but readable" range exists, so anything
      // below the minimum is reinitialize-required and the assertion is
      // trivially satisfied.
      expect(true).toBe(true);
      return;
    }
    const between = MINIMUM_SUPPORTED_DATA_REVISION;
    expect(evaluateDataState(between)).toBe('update-recommended');
  });

  it('places exactly the [minimum, current) band in update-recommended', () => {
    for (let r = MINIMUM_SUPPORTED_DATA_REVISION; r < CURRENT_DATA_REVISION; r++) {
      expect(evaluateDataState(r)).toBe('update-recommended');
    }
  });
});
