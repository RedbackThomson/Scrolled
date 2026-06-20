import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { reloadForUpdate } from '@/lib/swReload';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  const reload = () => reloadForUpdate(updateServiceWorker);

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
