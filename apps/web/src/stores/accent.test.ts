import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'scrolled.accent';

async function loadStore() {
  vi.resetModules();
  return import('./accent');
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
});

afterEach(() => {
  localStorage.clear();
});

describe('accent store', () => {
  it('defaults to green when nothing is stored and applies it to the document', async () => {
    const { useAccent } = await loadStore();
    expect(useAccent.getState().accent).toBe('green');
    expect(document.documentElement.dataset.accent).toBe('green');
  });

  it('restores a valid stored accent on load', async () => {
    localStorage.setItem(STORAGE_KEY, 'violet');
    const { useAccent } = await loadStore();
    expect(useAccent.getState().accent).toBe('violet');
    expect(document.documentElement.dataset.accent).toBe('violet');
  });

  it('falls back to the default for an unknown stored value', async () => {
    localStorage.setItem(STORAGE_KEY, 'chartreuse');
    const { useAccent } = await loadStore();
    expect(useAccent.getState().accent).toBe('green');
  });

  it('setAccent updates state, the document attribute, and persistence', async () => {
    const { useAccent } = await loadStore();
    useAccent.getState().setAccent('teal');
    expect(useAccent.getState().accent).toBe('teal');
    expect(document.documentElement.dataset.accent).toBe('teal');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('teal');
  });
});
