import { lazy, Suspense, useEffect, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useCommandPalette } from '@/stores/useCommandPalette';

const Palette = lazy(() =>
  import('@/components/command-palette/Palette').then((m) => ({ default: m.Palette })),
);

/**
 * Keeps cmdk and palette providers off the critical path until the user opens
 * the palette or the browser is idle. Mod+K still registers immediately.
 */
export function CommandPaletteHost() {
  const open = useCommandPalette((s) => s.open);
  const toggle = useCommandPalette((s) => s.toggle);
  const [armed, setArmed] = useState(open);

  useEffect(() => {
    if (open) setArmed(true);
  }, [open]);

  useEffect(() => {
    const idle = globalThis.requestIdleCallback?.(() => setArmed(true), { timeout: 5_000 });
    const timeout =
      idle == null ? globalThis.setTimeout(() => setArmed(true), 5_000) : undefined;
    return () => {
      if (idle != null) globalThis.cancelIdleCallback?.(idle);
      if (timeout != null) globalThis.clearTimeout(timeout);
    };
  }, []);

  useHotkey('Mod+K', () => {
    setArmed(true);
    toggle();
  });

  if (!armed) return null;

  return (
    <Suspense fallback={null}>
      <Palette />
    </Suspense>
  );
}
