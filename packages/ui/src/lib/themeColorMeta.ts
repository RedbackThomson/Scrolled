export function syncThemeColorMeta(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim();
  if (!bg) return;
  meta.content = bg;
}
