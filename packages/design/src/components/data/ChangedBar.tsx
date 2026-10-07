import { Pencil } from 'lucide-react';
import { Button } from '../core/Button';
import { Icon } from '../core/Icon';

export interface ChangedBarProps {
  onRevert: () => void;
  onUpdate: () => void;
  updating?: boolean;
  /** Defaults to "Changed from saved" */
  label?: string;
}

/** The phone-width bar shown when a loaded saved search no longer matches its filters. */
export function ChangedBar({
  onRevert,
  onUpdate,
  updating,
  label = 'Changed from saved',
}: ChangedBarProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 8px 8px 12px',
        borderRadius: 16,
        background: 'linear-gradient(90deg, var(--gold-glow), transparent)',
        border: '2px solid var(--gold-edge)',
      }}
    >
      <Icon icon={Pencil} size={15} color="var(--gold-edge)" />
      <span style={{ flex: 1, font: '700 13px var(--font-body)' }}>{label}</span>
      <button
        type="button"
        onClick={onRevert}
        className="sc-focus-ring"
        style={{
          minHeight: 36,
          padding: '0 6px',
          border: 'none',
          borderRadius: 10,
          background: 'none',
          color: 'var(--text-2)',
          font: '700 13px var(--font-body)',
          cursor: 'pointer',
        }}
      >
        Revert
      </button>
      <Button size="sm" onClick={onUpdate} disabled={updating} style={{ height: 36 }}>
        Update
      </Button>
    </div>
  );
}
