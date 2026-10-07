import { afterEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'scrolled.motion';

async function loadStore() {
  vi.resetModules();
  return import('./motion');
}

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  delete document.documentElement.dataset.clouds;
});

describe('motion store', () => {
  it('follows the device until the user chooses', async () => {
    const { useMotion } = await loadStore();
    const s = useMotion.getState();
    expect([s.backdrop, s.drift, s.motion]).toEqual(['clouds', null, null]);
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(document.documentElement.dataset.clouds).toBeUndefined();
  });

  it('persists choices and sets data-motion', async () => {
    const { useMotion } = await loadStore();
    useMotion.getState().setMotion(false);
    useMotion.getState().setBackdrop('sky');
    expect(document.documentElement.dataset.motion).toBe('off');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      backdrop: 'sky',
      drift: null,
      motion: false,
    });
  });

  it('restores stored choices on load', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ backdrop: 'sky', drift: true, motion: true }),
    );
    const { useMotion } = await loadStore();
    expect(useMotion.getState().drift).toBe(true);
    expect(document.documentElement.dataset.motion).toBe('on');
    expect(document.documentElement.dataset.clouds).toBe('running');
  });

  it('ignores malformed storage', async () => {
    localStorage.setItem(STORAGE_KEY, '{nope');
    const { useMotion } = await loadStore();
    expect(useMotion.getState().backdrop).toBe('clouds');
  });
});
