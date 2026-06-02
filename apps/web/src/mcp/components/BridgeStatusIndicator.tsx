// Tiny pill used by the palette and (optionally) the top bar. Hidden when
// the bridge is idle — there's no value showing "Disabled" everywhere.

import { cn } from '@/lib/utils';
import { useBridgeStatus } from '../bridge/status';

export function BridgeStatusIndicator({ className }: { className?: string }) {
  const { status } = useBridgeStatus();
  if (status === 'idle' || status === 'closed') return null;
  const tone =
    status === 'open'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-destructive';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      <span className={cn('h-2 w-2 rounded-full', tone)} />
      MCP {status}
    </span>
  );
}
