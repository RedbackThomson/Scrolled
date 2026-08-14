import { useState } from 'react';
import { CloudDownload, Loader2 } from 'lucide-react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@scrolled/ui';

/** Rebuilds this device's collections from the account, discarding anything it
 *  has not managed to upload. The recovery path when a device looks out of step. */
export function SyncResyncButton({ disabled }: { disabled?: boolean }) {
  const { status, resync } = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await resync();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <CloudDownload className="h-4 w-4" />
        Replace from account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace this device&rsquo;s collections?</DialogTitle>
            <DialogDescription>
              Your collections, groups, pinned searches, and settings on this device will be
              replaced with the copy stored on your account.
              {status.pendingChanges > 0 && (
                <>
                  {' '}
                  {status.pendingChanges.toLocaleString()} change
                  {status.pendingChanges === 1 ? '' : 's'} that haven&rsquo;t uploaded yet will be
                  lost.
                </>
              )}{' '}
              Your loaded game data is untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Replace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
