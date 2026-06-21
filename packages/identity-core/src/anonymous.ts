import { ANONYMOUS_SESSION, type IdentityProvider, type SessionListener } from './types';

/**
 * The open-source baseline: no accounts, no network, no auth SDK. Every getter
 * returns the anonymous session and the actions are inert. This is what the
 * self-hosted and local builds run, so the rest of the app can consume identity
 * uniformly without ever branching on "is sign-in configured".
 */
export function createAnonymousProvider(): IdentityProvider {
  return {
    getSession: () => ANONYMOUS_SESSION,
    initialize: () => Promise.resolve(ANONYMOUS_SESSION),
    getAccessToken: () => Promise.resolve(null),
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    subscribe: (listener: SessionListener) => {
      listener(ANONYMOUS_SESSION);
      return () => {};
    },
  };
}
