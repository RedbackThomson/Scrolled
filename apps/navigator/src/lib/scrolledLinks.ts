// Deep-link helpers for entity chips. Reads VITE_SCROLLED_BASE_URL at build time
// — when unset (the default), every helper returns null and the UI falls back to
// plain labels (per docs/navigator_implementation.md §6). The base URL lives
// here for now; §13 lists "where it lives — @scrolled/config or Navigator-local"
// as an open question, so this is the minimal-touch path until that's settled.

const rawBaseUrl =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SCROLLED_BASE_URL : undefined;

export const scrolledBaseUrl: string | null =
  typeof rawBaseUrl === 'string' && rawBaseUrl.trim().length > 0
    ? rawBaseUrl.trim().replace(/\/+$/, '')
    : null;

function buildUrl(path: string): string | null {
  return scrolledBaseUrl ? `${scrolledBaseUrl}${path}` : null;
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
