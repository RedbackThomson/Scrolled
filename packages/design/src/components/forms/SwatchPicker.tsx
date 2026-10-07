export interface SwatchOption {
  value: string;
  color: string;
  label?: string;
}

export interface SwatchPickerProps {
  options: SwatchOption[];
  value?: string;
  onChange?: (v: string) => void;
  size?: number;
}

export function SwatchPicker({ options, value, onChange, size = 26 }: SwatchPickerProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.label || o.value}
            aria-label={o.label || o.value}
            aria-pressed={on}
            onClick={() => onChange?.(o.value)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              background: o.color,
              boxShadow: on
                ? `0 0 0 3px var(--surface-card), 0 0 0 5px ${o.color}`
                : 'inset 0 -3px 0 rgba(0,0,0,.15)',
              transform: on ? 'scale(1.08)' : 'none',
              transition: 'transform var(--dur-base) var(--ease-spring)',
            }}
          />
        );
      })}
    </div>
  );
}
