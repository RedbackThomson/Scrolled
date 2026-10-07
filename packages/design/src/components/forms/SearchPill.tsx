import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { Icon } from '../core/Icon';
import { Kbd } from '../core/Kbd';
import { TextField } from './TextField';

const HEIGHT = { sm: 32, md: 36, lg: 40 };

export interface SearchPillProps extends Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoFocus' | 'onKeyDown' | 'aria-label' | 'type' | 'id'
> {
  placeholder?: string;
  value?: string;
  /** Makes the pill a real search field; without it the pill is a launcher button. */
  onChange?: (value: string) => void;
  /** Launcher mode: what the pill opens (e.g. the command palette). */
  onClick?: () => void;
  /** Launcher mode only. */
  shortcut?: string | null;
  width?: number | string;
  size?: keyof typeof HEIGHT;
  /** float on the backdrop, sunken inside cards and popovers */
  tone?: 'float' | 'sunken';
}

export function SearchPill({
  placeholder = 'Search or jump to…',
  value,
  onChange,
  onClick,
  shortcut = '⌘K',
  width = 520,
  size = 'lg',
  tone = 'float',
  type = 'search',
  ...inputProps
}: SearchPillProps) {
  const style = {
    width,
    maxWidth: '100%',
    height: HEIGHT[size],
    display: 'flex',
    alignItems: 'center',
    gap: size === 'lg' ? 10 : 8,
    padding: '0 8px 0 16px',
    boxSizing: 'border-box' as const,
    borderRadius: 999,
    background: tone === 'sunken' ? 'var(--surface-sunken)' : 'var(--surface-card)',
    boxShadow: tone === 'sunken' ? 'none' : 'var(--shadow-float)',
    color: 'var(--text-2)',
    font: size === 'lg' ? 'var(--type-body)' : '600 13px var(--font-body)',
  };

  if (onChange) {
    return (
      <TextField
        {...inputProps}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        variant={tone}
        shape="pill"
        icon={Search}
        style={{
          width,
          maxWidth: '100%',
          height: HEIGHT[size],
          padding: '0 6px 0 12px',
          gap: size === 'lg' ? 10 : 8,
          font: size === 'lg' ? 'var(--type-body)' : '600 13px var(--font-body)',
        }}
        trailing={
          value ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange('')}
              className="sc-focus-ring"
              style={{
                width: 22,
                height: 22,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                borderRadius: 999,
                background: 'transparent',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              <Icon icon={X} size={13} />
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <button
      type="button"
      className="sc-focus-ring"
      onClick={onClick}
      style={{
        ...style,
        border: 'none',
        textAlign: 'left',
        color: value ? 'var(--text-1)' : 'var(--text-2)',
        cursor: 'text',
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
