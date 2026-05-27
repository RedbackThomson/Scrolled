import type { AnalyticsProvider } from './types';

export type { AnalyticsProvider } from './types';

const OPTOUT_KEY = 'scrolled.analytics.optout';

interface AnalyticsConfig {
  provider: string;
  token: string;
  allowedHosts: string[];
}

function readConfig(): AnalyticsConfig | null {
  const provider = import.meta.env.VITE_ANALYTICS_PROVIDER;
  const token = import.meta.env.VITE_ANALYTICS_TOKEN;
  const hosts = import.meta.env.VITE_ANALYTICS_ALLOWED_HOSTS;
  if (!provider || !token || !hosts) return null;
  const allowedHosts = hosts
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (allowedHosts.length === 0) return null;
  return { provider, token, allowedHosts };
}

function hostAllowed(allowed: string[]): boolean {
  if (typeof window === 'undefined') return false;
  return allowed.includes(window.location.hostname);
}

function privacySignal(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (navigator.doNotTrack === '1') return true;
  // GPC: https://globalprivacycontrol.org/
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return true;
  return false;
}

function readOptOut(): boolean {
  try {
    return window.localStorage.getItem(OPTOUT_KEY) === '1';
  } catch {
    return false;
  }
}

async function loadProvider(config: AnalyticsConfig): Promise<AnalyticsProvider | null> {
  // Dynamic imports keep provider code out of forks' bundles entirely —
  // when the gates fail, no provider module is fetched and no vendor URL
  // strings appear in the build output.
  switch (config.provider) {
    case 'cloudflare': {
      const { cloudflareWebAnalytics } = await import('./cloudflare');
      return cloudflareWebAnalytics(config.token);
    }
    default:
      return null;
  }
}

/**
 * Initialise pageview analytics if every gate passes: build-time env vars
 * set, hostname allow-listed, no browser privacy signal, no local opt-out.
 * Otherwise no-op.
 */
export function initAnalytics(): void {
  const config = readConfig();
  if (!config) return;
  if (!hostAllowed(config.allowedHosts)) return;
  if (privacySignal()) return;
  if (readOptOut()) return;
  void loadProvider(config).then((provider) => {
    provider?.init();
  });
}

/**
 * True when analytics *would* run on this deployment if the user hasn't
 * explicitly opted out. Used to decide whether to surface the Settings
 * toggle at all — forks and local dev get no toggle because there's
 * nothing to toggle.
 */
export function isAnalyticsAvailable(): boolean {
  const config = readConfig();
  if (!config) return false;
  return hostAllowed(config.allowedHosts);
}

export function isAnalyticsOptedOut(): boolean {
  return readOptOut();
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  try {
    if (optedOut) {
      window.localStorage.setItem(OPTOUT_KEY, '1');
    } else {
      window.localStorage.removeItem(OPTOUT_KEY);
    }
  } catch {
    // localStorage unavailable — privacy-restricted browser. Treat as opted
    // out implicitly; nothing to persist.
  }
}
