import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { RouterProvider } from 'react-router-dom';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6';

import { router } from '@/router';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import '@/styles/index.css';

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

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <NuqsAdapter>
          <RouterProvider router={router} />
          <UpdatePrompt />
        </NuqsAdapter>
      </HotkeysProvider>
    </QueryClientProvider>
  </StrictMode>,
);
