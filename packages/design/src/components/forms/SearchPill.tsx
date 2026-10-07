import { Search } from 'lucide-react';
import { Icon } from '../core/Icon';
import { Kbd } from '../core/Kbd';

export interface SearchPillProps {
  placeholder?: string;
  value?: string;
  shortcut?: string | null;
  width?: number | string;
  onClick?: () => void;
  /** float on the backdrop, sunken inside cards and popovers */
  tone?: 'float' | 'sunken';
}

export function SearchPill({
  placeholder = 'Search or jump to…',
  value,
  shortcut = '⌘K',
  width = 520,
  onClick,
  tone = 'float',
}: SearchPillProps) {
  return (
    <button
      type="button"
      className="sc-focus-ring"
      onClick={onClick}
      style={{
        border: 'none',
        textAlign: 'left',
        width,
        maxWidth: '100%',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 8px 0 16px',
        boxSizing: 'border-box',
        borderRadius: 999,
        background: tone === 'sunken' ? 'var(--surface-sunken)' : 'var(--surface-card)',
        boxShadow: tone === 'sunken' ? 'none' : 'var(--shadow-float)',
        color: value ? 'var(--text-1)' : 'var(--text-2)',
        cursor: 'text',
        font: 'var(--type-body)',
      }}
    >
      <Icon icon={Search} size={16} />
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value || placeholder}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  );
}
