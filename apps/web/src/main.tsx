import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { RouterProvider } from 'react-router-dom';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6';
import { IdentityProviderHost } from '@scrolled/identity-core/react';

import { router } from '@/router';
import { UpdatePrompt } from '@/components/common/UpdatePrompt';
import { initAnalytics } from '@/analytics';
import { initMcp } from '@/mcp';
import { createIdentityProvider } from '@/identity/createProvider';
import { bootstrapSyncedState } from '@/lib/syncedStateBootstrap';
import '@/styles/index.css';

initAnalytics();
initMcp();
bootstrapSyncedState();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element missing');

async function bootstrap() {
  const identityProvider = await createIdentityProvider();

  createRoot(rootEl!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <IdentityProviderHost provider={identityProvider}>
          <HotkeysProvider>
            <NuqsAdapter>
              <RouterProvider router={router} />
              <UpdatePrompt />
            </NuqsAdapter>
          </HotkeysProvider>
        </IdentityProviderHost>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
