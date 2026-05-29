import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const JOB_KEY = 'scrolled.character-preferences.job';
const GENDER_KEY = 'scrolled.character-preferences.gender';

async function loadStore() {
  vi.resetModules();
  return import('./characterPreferences');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('characterPreferences store', () => {
  it('defaults to null/null when nothing is stored', async () => {
    const { useCharacterPreferences } = await loadStore();
    const state = useCharacterPreferences.getState();
    expect(state.job).toBeNull();
    expect(state.gender).toBeNull();
  });

  it('restores a stored job and gender on load', async () => {
    localStorage.setItem(JOB_KEY, 'Warrior');
    localStorage.setItem(GENDER_KEY, 'female');
    const { useCharacterPreferences } = await loadStore();
    const state = useCharacterPreferences.getState();
    expect(state.job).toBe('Warrior');
    expect(state.gender).toBe('female');
  });

  it('coerces unknown job values to null', async () => {
    localStorage.setItem(JOB_KEY, 'Pinata');
    const { useCharacterPreferences } = await loadStore();
    expect(useCharacterPreferences.getState().job).toBeNull();
  });

  it('coerces unknown gender values to null', async () => {
    localStorage.setItem(GENDER_KEY, 'other');
    const { useCharacterPreferences } = await loadStore();
    expect(useCharacterPreferences.getState().gender).toBeNull();
  });

  it('setJob persists and clears', async () => {
    const { useCharacterPreferences } = await loadStore();
    useCharacterPreferences.getState().setJob('Magician');
    expect(useCharacterPreferences.getState().job).toBe('Magician');
    expect(localStorage.getItem(JOB_KEY)).toBe('Magician');
    useCharacterPreferences.getState().setJob(null);
    expect(useCharacterPreferences.getState().job).toBeNull();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
  });

  it('setGender persists and clears', async () => {
    const { useCharacterPreferences } = await loadStore();
    useCharacterPreferences.getState().setGender('male');
    expect(useCharacterPreferences.getState().gender).toBe('male');
    expect(localStorage.getItem(GENDER_KEY)).toBe('male');
    useCharacterPreferences.getState().setGender(null);
    expect(useCharacterPreferences.getState().gender).toBeNull();
    expect(localStorage.getItem(GENDER_KEY)).toBeNull();
  });

  it('clear() resets both preferences', async () => {
    localStorage.setItem(JOB_KEY, 'Thief');
    localStorage.setItem(GENDER_KEY, 'female');
    const { useCharacterPreferences } = await loadStore();
    useCharacterPreferences.getState().clear();
    expect(useCharacterPreferences.getState().job).toBeNull();
    expect(useCharacterPreferences.getState().gender).toBeNull();
    expect(localStorage.getItem(JOB_KEY)).toBeNull();
    expect(localStorage.getItem(GENDER_KEY)).toBeNull();
  });
});

describe('genderToWzCode', () => {
  it('maps male → 0, female → 1, null → null', async () => {
    const { genderToWzCode } = await loadStore();
    expect(genderToWzCode('male')).toBe(0);
    expect(genderToWzCode('female')).toBe(1);
    expect(genderToWzCode(null)).toBeNull();
  });
});
