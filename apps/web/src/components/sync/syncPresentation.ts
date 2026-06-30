// One place that turns a `SyncStatus` into the words and visuals the sync UI
// shows — the navbar indicator, the settings section, and the command palette
// all read from here so they never drift. All copy follows
// docs/writing_conventions.md: plain, terse, sentence case, second person, and
// nothing trademarked (sync is a generic feature, so this is easy to honour).

import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import type { SyncStatus } from '@scrolled/sync-core';
import type { BadgeTone } from '@scrolled/ui';

export interface SyncPresentation {
  /** Short label for a chip or button (e.g. "Synced"). */
  label: string;
  /** One line describing the state and any next step. */
  detail: string;
  icon: LucideIcon;
  tone: BadgeTone;
  /** Spin the icon while a cycle is in flight. */
  spin: boolean;
}

export function presentSyncStatus(status: SyncStatus): SyncPresentation {
  switch (status.state) {
    case 'syncing':
      return {
        label: 'Syncing',
        detail: 'Saving your latest changes.',
        icon: RefreshCw,
        tone: 'blue',
        spin: true,
      };
    case 'synced':
      return {
        label: 'Synced',
        detail: 'Your collections and preferences are up to date.',
        icon: CheckCircle2,
        tone: 'emerald',
        spin: false,
      };
    case 'offline':
      return {
        label: 'Offline',
        detail: "Can't reach the server. Your changes are saved here and will sync when you're back online.",
        icon: CloudOff,
        tone: 'amber',
        spin: false,
      };
    case 'error':
      return presentError(status);
    case 'idle':
    default:
      return {
        label: 'Connecting',
        detail: 'Getting ready to sync.',
        icon: RefreshCw,
        tone: 'slate',
        spin: false,
      };
  }
}

function presentError(status: SyncStatus): SyncPresentation {
  if (status.errorKind === 'auth') {
    return {
      label: 'Sign in again',
      detail: 'Your session expired. Sign in again to keep syncing.',
      icon: AlertTriangle,
      tone: 'red',
      spin: false,
    };
  }
  if (status.errorKind === 'protocol') {
    return {
      label: 'Update needed',
      detail: 'A newer version is required to sync. Refresh the page to update.',
      icon: AlertTriangle,
      tone: 'red',
      spin: false,
    };
  }
  return {
    label: 'Sync error',
    detail: status.error ?? 'Something went wrong while syncing.',
    icon: AlertTriangle,
    tone: 'red',
    spin: false,
  };
}

/** "just now" / "3m ago" / "2h ago" / "5d ago", relative to `now`. Returns
 *  "never" for a missing timestamp. Keeps the last-synced line compact. */
export function formatLastSynced(at: number | null, now: number): string {
  if (at == null) return 'never';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
