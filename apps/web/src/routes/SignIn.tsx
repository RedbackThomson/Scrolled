import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';
import { usePageTitle } from '@/hooks/usePageTitle';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  gitlab: 'GitLab',
  discord: 'Discord',
  apple: 'Apple',
};

function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export default function SignIn() {
  usePageTitle('Sign in');
  const user = useCurrentUser();
  const { login } = useIdentity();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hand-typed on a build without accounts: there is nothing to sign into.
  if (!appConfig.features.enableAccounts) return <Navigate to="/" replace />;
  // Already signed in — no reason to be here.
  if (user.isAuthenticated) return <Navigate to="/" replace />;

  const providers = appConfig.identity.cloud?.oauthProviders ?? [];

  const onSignIn = async (provider: string) => {
    setError(null);
    setPending(provider);
    try {
      await login({ provider });
      // OAuth navigates away; if it returns without redirecting, clear pending.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
      setPending(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to keep your collections and preferences with your account.
          </p>
        </div>

        <div className="space-y-2">
          {providers.map((provider) => (
            <Button
              key={provider}
              variant="outline"
              className="w-full"
              disabled={pending !== null}
              onClick={() => void onSignIn(provider)}
            >
              {pending === provider ? 'Redirecting…' : `Continue with ${providerLabel(provider)}`}
            </Button>
          ))}
        </div>

        {error && <p className="text-destructive text-center text-sm">{error}</p>}

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground mx-auto block text-sm"
          onClick={() => navigate('/')}
        >
          Continue without an account
        </button>
      </div>
    </main>
  );
}
