import { useState, type CSSProperties } from 'react';

export interface TextFieldProps {
  label?: string;
  /** Right-aligned helper, e.g. "Optional" */
  hint?: string;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  /** Force the focus look (for specs) */
  focused?: boolean;
  error?: string;
  onChange?: (v: string) => void;
}

export function TextField({
  label,
  hint,
  value,
  placeholder,
  multiline,
  rows = 3,
  focused,
  error,
  onChange,
}: TextFieldProps) {
  const [f, setF] = useState(false);
  const on = focused || f;
  const style: CSSProperties = {
    height: multiline ? undefined : 38,
    padding: multiline ? '9px 12px' : '0 12px',
    boxSizing: 'border-box',
    borderRadius: 12,
    border: `2px solid ${error ? 'var(--danger)' : on ? 'var(--accent)' : 'var(--border-1)'}`,
    background: 'var(--surface-card)',
    color: 'var(--text-1)',
    font: 'var(--type-body)',
    outline: 'none',
    resize: 'vertical',
    boxShadow: on ? 'var(--shadow-input), var(--focus-ring)' : 'var(--shadow-input)',
    transition: 'box-shadow var(--dur-fast), border-color var(--dur-fast)',
  };
  const shared = {
    value,
    placeholder,
    onFocus: () => setF(true),
    onBlur: () => setF(false),
    style,
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
      {label && (
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            font: '600 13px var(--font-display)',
            color: 'var(--text-2)',
          }}
        >
          <span>{label}</span>
          {hint && <span style={{ font: 'var(--type-meta)' }}>{hint}</span>}
        </span>
      )}
      {multiline ? (
        <textarea {...shared} rows={rows} onChange={(e) => onChange?.(e.target.value)} />
      ) : (
        <input {...shared} onChange={(e) => onChange?.(e.target.value)} />
      )}
      {error && <span style={{ font: 'var(--type-meta)', color: 'var(--danger)' }}>{error}</span>}
    </label>
  );
}
