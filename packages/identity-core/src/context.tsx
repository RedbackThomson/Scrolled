import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { IdentityProvider, LoginOptions, UserSession } from './types';

interface IdentityContextValue {
  session: UserSession;
  login: (options?: LoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

interface IdentityProviderHostProps {
  provider: IdentityProvider;
  children: ReactNode;
}

/**
 * Holds the active `IdentityProvider`, mirrors its session into React state, and
 * exposes it through context. With the anonymous provider this resolves
 * synchronously and never re-renders, so it is free to mount unconditionally.
 */
export function IdentityProviderHost({ provider, children }: IdentityProviderHostProps) {
  const [session, setSession] = useState<UserSession>(() => provider.getSession());

  useEffect(() => {
    let active = true;
    const unsubscribe = provider.subscribe((next) => {
      if (active) setSession(next);
    });
    void provider.initialize();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [provider]);

  const value = useMemo<IdentityContextValue>(
    () => ({
      session,
      login: (options) => provider.login(options),
      logout: () => provider.logout(),
      getAccessToken: () => provider.getAccessToken(),
    }),
    [provider, session],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

function useIdentityContext(): IdentityContextValue {
  const value = useContext(IdentityContext);
  if (!value) {
    throw new Error('useIdentity must be used within an IdentityProviderHost');
  }
  return value;
}

/** The full identity surface: current session plus the login/logout/token actions. */
export function useIdentity(): IdentityContextValue {
  return useIdentityContext();
}

/** The common read path for UI: just the current session. */
export function useCurrentUser(): UserSession {
  return useIdentityContext().session;
}
