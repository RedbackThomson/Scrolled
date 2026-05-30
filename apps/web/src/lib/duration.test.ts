import { describe, expect, it } from 'vitest';
import { formatDurationSeconds } from './duration';

describe('formatDurationSeconds', () => {
  it('renders round-day cooldowns in days', () => {
    expect(formatDurationSeconds(86400)).toBe('1 day');
    expect(formatDurationSeconds(86400 * 7)).toBe('7 days');
  });

  it('renders round-hour cooldowns in hours', () => {
    expect(formatDurationSeconds(3600)).toBe('1 hour');
    expect(formatDurationSeconds(3600 * 24)).toBe('1 day');
    expect(formatDurationSeconds(3600 * 6)).toBe('6 hours');
  });

  it('keeps the largest whole unit rather than rounding up', () => {
    expect(formatDurationSeconds(5400)).toBe('90 minutes');
  });

  it('falls back to seconds for sub-minute or non-aligned values', () => {
    expect(formatDurationSeconds(45)).toBe('45 seconds');
    expect(formatDurationSeconds(1)).toBe('1 second');
    expect(formatDurationSeconds(3601)).toBe('3601 seconds');
  });

  it('treats zero / negatives as zero', () => {
    expect(formatDurationSeconds(0)).toBe('0 seconds');
    expect(formatDurationSeconds(-30)).toBe('0 seconds');
  });

  describe('short form', () => {
    it('shortens days / hours / minutes', () => {
      expect(formatDurationSeconds(86400, { short: true })).toBe('1 d');
      expect(formatDurationSeconds(86400 * 7, { short: true })).toBe('7 d');
      expect(formatDurationSeconds(3600, { short: true })).toBe('1 hr');
      expect(formatDurationSeconds(3600 * 6, { short: true })).toBe('6 hr');
      expect(formatDurationSeconds(60, { short: true })).toBe('1 min');
      expect(formatDurationSeconds(3420, { short: true })).toBe('57 min');
      expect(formatDurationSeconds(5400, { short: true })).toBe('90 min');
    });

    it('drops the space for seconds', () => {
      expect(formatDurationSeconds(45, { short: true })).toBe('45s');
      expect(formatDurationSeconds(1, { short: true })).toBe('1s');
      expect(formatDurationSeconds(3601, { short: true })).toBe('3601s');
    });

    it('zero / negatives stay zero', () => {
      expect(formatDurationSeconds(0, { short: true })).toBe('0s');
      expect(formatDurationSeconds(-30, { short: true })).toBe('0s');
    });
  });
});
