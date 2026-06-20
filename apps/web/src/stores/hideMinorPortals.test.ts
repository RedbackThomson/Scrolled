import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'scrolled.hide-minor-portals';

async function loadStore() {
  vi.resetModules();
  return import('./hideMinorPortals');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('hideMinorPortals store', () => {
  it('defaults to true when nothing is stored', async () => {
    const { useHideMinorPortals } = await loadStore();
    expect(useHideMinorPortals.getState().enabled).toBe(true);
  });

  it('restores a stored "false" on load', async () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    const { useHideMinorPortals } = await loadStore();
    expect(useHideMinorPortals.getState().enabled).toBe(false);
  });

  it('treats anything other than "false" as true', async () => {
    localStorage.setItem(STORAGE_KEY, '0');
    const { useHideMinorPortals } = await loadStore();
    expect(useHideMinorPortals.getState().enabled).toBe(true);
  });

  it('setEnabled updates state and persists', async () => {
    const { useHideMinorPortals } = await loadStore();
    useHideMinorPortals.getState().setEnabled(false);
    expect(useHideMinorPortals.getState().enabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    useHideMinorPortals.getState().setEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('toggle flips the current value and persists', async () => {
    const { useHideMinorPortals } = await loadStore();
    expect(useHideMinorPortals.getState().enabled).toBe(true);
    useHideMinorPortals.getState().toggle();
    expect(useHideMinorPortals.getState().enabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });
});
