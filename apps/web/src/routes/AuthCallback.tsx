import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { appConfig } from '@/config';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * Landing point for the OAuth redirect. The identity provider exchanges the code
 * in the URL on init (Supabase's `detectSessionInUrl`); we just wait for the
 * session to resolve, then return home. A provider error is surfaced in the URL
 * query, so we read it for a clear message rather than spinning forever.
 */
export default function AuthCallback() {
  usePageTitle('Signing in');
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [error] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('error_description') ?? params.get('error');
  });

  useEffect(() => {
    if (user.isAuthenticated) navigate('/', { replace: true });
  }, [user.isAuthenticated, navigate]);

  if (!appConfig.features.enableAccounts) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <p className="text-destructive text-sm">Sign-in didn’t complete: {error}</p>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-sm"
            onClick={() => navigate('/sign-in', { replace: true })}
          >
            Try again
          </button>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Signing you in…</p>
      )}
    </main>
  );
}
