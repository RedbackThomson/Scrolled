import { useState } from 'react';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** When set, renders as a settings row with the switch on the right */
  label?: string;
  description?: string;
  /** Accessible name when there's no visible `label` */
  ariaLabel?: string;
}

export function Switch({ checked, onChange, label, description, ariaLabel }: SwitchProps) {
  // Alternating between two identical keyframes restarts the stretch on every flip
  // without remounting the knob (which would skip its slide).
  const [flips, setFlips] = useState(0);
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label ?? ariaLabel}
      onClick={() => {
        setFlips((n) => n + 1);
        onChange?.(!checked);
      }}
      style={{
        width: 46,
        height: 28,
        flex: 'none',
        borderRadius: 999,
        border: 'none',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border-1)',
        boxShadow: 'inset 0 2px 0 rgba(0,0,0,.12)',
        transition: 'background 250ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,.25)',
          transition: 'left 480ms var(--ease-spring)',
          animation: flips ? `sc-knob-${flips % 2 ? 'a' : 'b'} 360ms var(--ease-out)` : 'none',
        }}
      />
    </button>
  );
  if (!label) return track;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        {description && (
          <span style={{ font: 'var(--type-meta)', fontSize: 12.5, color: 'var(--text-2)' }}>
            {description}
          </span>
        )}
      </div>
      {track}
    </div>
  );
}
