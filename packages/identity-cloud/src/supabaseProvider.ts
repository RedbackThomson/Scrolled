import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import {
  ANONYMOUS_SESSION,
  IdentityLoginError,
  type IdentityProvider,
  type LoginOptions,
  type SessionListener,
  type UserSession,
} from '@scrolled/identity-core';

export interface SupabaseIdentityConfig {
  supabaseUrl: string;
  /** Publishable client key (`sb_publishable_…`), or a legacy `anon` key. */
  supabaseKey: string;
  /** OAuth provider used when `login()` is called without an explicit one. */
  defaultProvider?: string;
}

function toUserSession(session: Session | null): UserSession {
  if (!session?.user) return ANONYMOUS_SESSION;
  const { user } = session;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof meta[key] === 'string' ? (meta[key] as string) : null;
  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: str('full_name') ?? str('name'),
    avatarUrl: str('avatar_url') ?? str('picture'),
    isAuthenticated: true,
    mode: 'cloud',
  };
}

/**
 * Supabase-backed identity. The SDK persists the session to localStorage and
 * refreshes it automatically; `onAuthStateChange` keeps our mirrored session in
 * step (and propagates sign-in/out across tabs). PKCE + `detectSessionInUrl`
 * means the OAuth redirect lands on the callback route and the code exchange
 * happens transparently.
 */
export function createSupabaseIdentityProvider(config: SupabaseIdentityConfig): IdentityProvider {
  const client: SupabaseClient = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  let current: UserSession = ANONYMOUS_SESSION;
  const listeners = new Set<SessionListener>();

  const emit = (session: Session | null) => {
    current = toUserSession(session);
    for (const listener of listeners) listener(current);
  };

  client.auth.onAuthStateChange((_event, session) => emit(session));

  return {
    getSession: () => current,

    async initialize() {
      const { data } = await client.auth.getSession();
      emit(data.session);
      return current;
    },

    async getAccessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },

    async login(options?: LoginOptions) {
      const provider = options?.provider ?? config.defaultProvider;
      if (!provider) {
        throw new IdentityLoginError('No OAuth provider specified for sign-in.');
      }
      const redirectTo =
        options?.redirectTo ??
        (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined);
      const { error } = await client.auth.signInWithOAuth({
        // The interface speaks generic provider ids; the Supabase enum is wider
        // than our `string`, so this is the one spot the cast belongs.
        provider: provider as Parameters<typeof client.auth.signInWithOAuth>[0]['provider'],
        options: { redirectTo },
      });
      if (error) throw new IdentityLoginError(error.message);
    },

    async logout() {
      const { error } = await client.auth.signOut();
      if (error) throw new IdentityLoginError(error.message);
    },

    subscribe(listener: SessionListener) {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
