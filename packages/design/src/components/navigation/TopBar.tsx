import type { ReactNode } from 'react';
import { Sun } from 'lucide-react';
import { SearchPill } from '../forms/SearchPill';
import { IconButton } from '../core/IconButton';

export interface TopBarProps {
  onSearch?: () => void;
  onTheme?: () => void;
  right?: ReactNode;
}

export function TopBar({ onSearch, onTheme, right }: TopBarProps) {
  return (
    <header
      style={{
        position: 'relative',
        height: 'var(--topbar-height)',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 24px 0 12px',
      }}
    >
      <SearchPill onClick={onSearch} />
      <div style={{ flex: 1 }} />
      {right}
      <IconButton icon={Sun} label="Toggle theme" variant="float" size={38} onClick={onTheme} />
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'var(--surface-sunken)',
          boxShadow: 'var(--shadow-float)',
        }}
      />
    </header>
  );
}
