import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'scrolled.accent';

async function loadStore() {
  vi.resetModules();
  return import('./accent');
}

function setMeta(content: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = content;
  return meta;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    const accent =
      el === document.documentElement ? (document.documentElement.dataset.accent ?? '') : '';
    return {
      getPropertyValue: (name: string) =>
        name === '--surface-page' && accent ? `bg-${accent}` : '',
    } as CSSStyleDeclaration;
  });
});

afterEach(() => {
  localStorage.clear();
  document.querySelector('meta[name="theme-color"]')?.remove();
  vi.restoreAllMocks();
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

  it('syncs <meta name="theme-color"> on initial load and on accent change', async () => {
    const meta = setMeta('#000000');
    localStorage.setItem(STORAGE_KEY, 'rose');
    const { useAccent } = await loadStore();
    expect(meta.content).toBe('bg-rose');
    useAccent.getState().setAccent('amber');
    expect(meta.content).toBe('bg-amber');
  });
});
