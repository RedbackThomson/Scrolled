// Deep-link + wiki-home helpers. `VITE_SCROLLED_BASE_URL` is read at build time
// and interpreted in one of three modes:
//
//   - Unset or empty  →  every helper returns null; chips render as plain
//                        labels and the "Back to wiki" button is hidden. This
//                        is the safe default for local dev where Navigator
//                        runs standalone with no wiki reachable.
//   - "/"             →  co-deploy case (wiki + Navigator on the same origin).
//                        Helpers return root-relative paths — `/items/:id` etc.
//                        — which the browser resolves against the current host.
//   - Full origin     →  standalone deploys against a remote wiki, e.g.
//     ("https://…")      `https://scrolled.dev`. Helpers return absolute URLs.
//
// Standalone Navigator deploys MUST set this to a wiki origin or the deep-link
// chips degrade to plain labels — the graph itself still works, only the
// entity chips lose their outbound links.

const rawBaseUrl =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SCROLLED_BASE_URL : undefined;

/**
 * Normalised base URL, or null when unset. `"/"` is preserved as `"/"` (not
 * stripped to empty); a trailing slash on a full origin is dropped so
 * `${base}/items/:id` doesn't produce a `//items/:id`.
 */
export const scrolledBaseUrl: string | null = normalise(rawBaseUrl);

function normalise(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed === '/') return '/';
  return trimmed.replace(/\/+$/, '');
}

function buildUrl(path: string): string | null {
  if (scrolledBaseUrl === null) return null;
  // For the root-relative co-deploy case, `${'/'}${path}` would double the
  // leading slash; strip it.
  if (scrolledBaseUrl === '/') return path;
  return `${scrolledBaseUrl}${path}`;
}

export function itemUrl(id: number): string | null {
  return buildUrl(`/items/${id}`);
}

export function questUrl(id: number): string | null {
  return buildUrl(`/quests/${id}`);
}

export function npcUrl(id: number): string | null {
  return buildUrl(`/npcs/${id}`);
}

/**
 * URL to the wiki root. Powers the "Back to wiki" button in Navigator's
 * header — null when the env is unset so the button hides in standalone dev.
 */
export function wikiHomeUrl(): string | null {
  if (scrolledBaseUrl === null) return null;
  if (scrolledBaseUrl === '/') return '/';
  return `${scrolledBaseUrl}/`;
}
