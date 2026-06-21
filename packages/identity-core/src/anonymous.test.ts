import { describe, expect, it, vi } from 'vitest';
import { createAnonymousProvider } from './anonymous';
import { ANONYMOUS_SESSION } from './types';

describe('createAnonymousProvider', () => {
  it('reports an unauthenticated anonymous session', async () => {
    const provider = createAnonymousProvider();
    expect(provider.getSession()).toEqual(ANONYMOUS_SESSION);
    expect(provider.getSession().isAuthenticated).toBe(false);
    await expect(provider.initialize()).resolves.toEqual(ANONYMOUS_SESSION);
    await expect(provider.getAccessToken()).resolves.toBeNull();
  });

  it('has inert login/logout', async () => {
    const provider = createAnonymousProvider();
    await expect(provider.login()).resolves.toBeUndefined();
    await expect(provider.logout()).resolves.toBeUndefined();
  });

  it('fires the subscriber once with the anonymous session and unsubscribes cleanly', () => {
    const provider = createAnonymousProvider();
    const listener = vi.fn();
    const unsubscribe = provider.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(ANONYMOUS_SESSION);
    expect(() => unsubscribe()).not.toThrow();
  });
});
