import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@scrolled/design';
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
      data-surface="tooltip"
      className="bg-card text-card-foreground sc-toast pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg py-2.5 pl-2.5 pr-3 shadow-[0_14px_30px_rgba(10,20,50,.35)]"
    >
      <span className="bg-primary text-primary-foreground grid h-7 w-7 shrink-0 place-items-center rounded-full">
        <RefreshCw className="h-[15px] w-[15px]" aria-hidden />
      </span>
      <p className="text-[13.5px] font-semibold">A new version is available. Reload to update.</p>
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
