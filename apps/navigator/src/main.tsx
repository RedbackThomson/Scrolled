import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setThemePersistence } from '@scrolled/ui';

import { App } from '@/App';
import '@scrolled/ui/tokens.css';
import '@xyflow/react/dist/style.css';
import '@/styles/index.css';

setThemePersistence({
  persist: (mode) => {
    try {
      localStorage.setItem('navigator.theme', mode);
    } catch {
      // Storage may be blocked; the theme store still applies the class.
    }
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element missing');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
