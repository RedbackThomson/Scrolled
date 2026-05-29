import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './useIsMobile';

interface FakeMql {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
  onchange: null;
}

function makeMql(initial: boolean): FakeMql {
  return {
    matches: initial,
    media: '(max-width: 767.98px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe('useIsMobile', () => {
  it('reflects the initial matchMedia state', () => {
    const mql = makeMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mql = makeMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    const handler = mql.addEventListener.mock.calls[0]?.[1] as
      | ((event: MediaQueryListEvent) => void)
      | undefined;
    expect(handler).toBeTypeOf('function');

    act(() => {
      mql.matches = true;
      handler?.({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);
  });

  it('unsubscribes the listener on unmount', () => {
    const mql = makeMql(false);
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('falls back to addListener/removeListener when addEventListener is missing', () => {
    const mql = makeMql(false) as unknown as Record<string, unknown>;
    delete mql.addEventListener;
    delete mql.removeEventListener;
    window.matchMedia = vi.fn().mockReturnValue(mql);
    const { unmount } = renderHook(() => useIsMobile());
    expect((mql.addListener as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    unmount();
    expect((mql.removeListener as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('returns false when matchMedia is not available', () => {
    // Simulate SSR / a browser without matchMedia (e.g. very old environments).
    (window as unknown as { matchMedia: undefined }).matchMedia = undefined;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
