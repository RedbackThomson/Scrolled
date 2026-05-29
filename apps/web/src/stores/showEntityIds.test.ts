import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'scrolled.show-entity-ids';

async function loadStore() {
  vi.resetModules();
  return import('./showEntityIds');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('showEntityIds store', () => {
  it('defaults to false when nothing is stored', async () => {
    const { useShowEntityIds } = await loadStore();
    expect(useShowEntityIds.getState().enabled).toBe(false);
  });

  it('restores a stored "true" on load', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { useShowEntityIds } = await loadStore();
    expect(useShowEntityIds.getState().enabled).toBe(true);
  });

  it('treats anything other than "true" as false', async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const { useShowEntityIds } = await loadStore();
    expect(useShowEntityIds.getState().enabled).toBe(false);
  });

  it('setEnabled updates state and persists', async () => {
    const { useShowEntityIds } = await loadStore();
    useShowEntityIds.getState().setEnabled(true);
    expect(useShowEntityIds.getState().enabled).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    useShowEntityIds.getState().setEnabled(false);
    expect(useShowEntityIds.getState().enabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('toggle flips the current value and persists', async () => {
    const { useShowEntityIds } = await loadStore();
    expect(useShowEntityIds.getState().enabled).toBe(false);
    useShowEntityIds.getState().toggle();
    expect(useShowEntityIds.getState().enabled).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    useShowEntityIds.getState().toggle();
    expect(useShowEntityIds.getState().enabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });
});
