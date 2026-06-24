// Applies a pending auto dataset update — a data-revision gap opened by an app
// update — without a second click, so updating the app also unlocks its data.
// Renders nothing: progress and failures surface in the sidebar status row
// (DbStatusIndicator). Mounted once in AppShell so the apply fires exactly once;
// a failure stops the auto-retry and leaves the manual retry in the sidebar.

import { useEffect, useRef } from 'react';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';

export function DatasetAutoUpdate(): null {
  const { mode, applying, error, apply } = useDatasetUpdate();
  const triggered = useRef(false);

  useEffect(() => {
    if (mode === 'auto' && !triggered.current && !applying && !error) {
      triggered.current = true;
      apply();
    }
  }, [mode, applying, error, apply]);

  return null;
}
