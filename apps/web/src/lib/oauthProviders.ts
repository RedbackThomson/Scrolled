// Human-readable labels for OAuth provider ids. Kept generic — the app shows the
// service name, it doesn't reason about any provider's behavior. Unknown ids
// fall back to a capitalized id so a newly enabled provider still reads sensibly.
const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  gitlab: 'GitLab',
  discord: 'Discord',
  twitch: 'Twitch',
  apple: 'Apple',
  azure: 'Microsoft',
  twitter: 'Twitter',
  facebook: 'Facebook',
  spotify: 'Spotify',
  slack: 'Slack',
};

export function oauthProviderLabel(id: string): string {
  return OAUTH_PROVIDER_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
