// The provider-agnostic identity contract. The core app is identity-aware — it
// reads a `UserSession` and calls `login`/`logout` — but never aware of *how*
// auth is implemented. Concrete providers (anonymous, Supabase, …) implement
// `IdentityProvider`; only the bootstrap layer chooses one.

/** How the current session was produced. `anonymous` means no account at all. */
export type SessionMode = 'anonymous' | 'cloud';

export interface UserSession {
  /** `'anonymous'` sentinel when not signed in; the provider's user id otherwise. */
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAuthenticated: boolean;
  mode: SessionMode;
}

export const ANONYMOUS_SESSION: UserSession = {
  userId: 'anonymous',
  displayName: null,
  email: null,
  avatarUrl: null,
  isAuthenticated: false,
  mode: 'anonymous',
};

export type SessionListener = (session: UserSession) => void;
export type Unsubscribe = () => void;

export interface LoginOptions {
  /** OAuth provider id understood by the concrete identity provider, e.g. `'google'`. */
  provider?: string;
  /** Absolute URL the provider should return to after authenticating. */
  redirectTo?: string;
}

export interface IdentityProvider {
  /** Last-known session, synchronously. Never throws; returns anonymous until resolved. */
  getSession(): UserSession;
  /** Resolve any persisted session at boot. Resolves to the current session. */
  initialize(): Promise<UserSession>;
  /** Bearer token for an authenticated backend. `null` when anonymous. Unused until sync lands. */
  getAccessToken(): Promise<string | null>;
  login(options?: LoginOptions): Promise<void>;
  logout(): Promise<void>;
  /** Subscribe to session changes. Fires once with the current session on subscribe. */
  subscribe(listener: SessionListener): Unsubscribe;
}
