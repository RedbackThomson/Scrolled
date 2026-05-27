import type { AnalyticsProvider } from './types';

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

export function cloudflareWebAnalytics(token: string): AnalyticsProvider {
  return {
    name: 'cloudflare',
    init() {
      // `spa: true` makes the beacon track route changes in the
      // History API without needing a per-route hook.
      const script = document.createElement('script');
      script.defer = true;
      script.src = BEACON_SRC;
      script.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }));
      document.head.appendChild(script);
    },
  };
}
