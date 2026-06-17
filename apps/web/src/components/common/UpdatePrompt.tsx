import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  // vite-plugin-pwa only reloads via a one-shot workbox `controlling` listener,
  // which silently never fires if the waiting worker already took control or that
  // listener was already consumed — leaving the toast stuck. Drive the reload
  // ourselves: skip waiting, reload on the next controller change, and fall back
  // to a plain reload so the button always acts.
  const reload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => window.location.reload(),
        { once: true },
      );
    }
    void updateServiceWorker(true);
    window.setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border p-3 shadow-lg"
    >
      <p className="text-sm">A new version is available. Reload to update.</p>
      <div className="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button size="sm" onClick={reload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
