import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from '../core/Icon';
import { cn } from '../../lib/cn';

export interface FacetPillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  /** The applied value; set means the facet is active and fills with its hue */
  valueLabel?: string;
  hue?: number;
  /** Its value popover is showing */
  open?: boolean;
}

/** A per-column dropdown pill in the facet bar. Opens that column's value popover. */
export const FacetPill = forwardRef<HTMLButtonElement, FacetPillProps>(function FacetPill(
  { label, valueLabel, hue = 235, open, className, style, ...props },
  ref,
) {
  const active = valueLabel != null;
  const edge = open ? 'var(--accent)' : active ? `oklch(0.7 0.12 ${hue} / .7)` : 'var(--border-1)';
  const lip = active ? 'none' : 'inset 0 -2px 0 var(--border-1)';
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open ?? false}
      className={cn(
        'sc-focus-ring ease-spring inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 text-[13px] font-semibold transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5',
        className,
      )}
      style={{
        padding: '4px 10px 4px 12px',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-1)',
        cursor: 'pointer',
        borderColor: edge,
        background: active ? `oklch(0.72 0.12 ${hue} / .16)` : 'var(--surface-card)',
        boxShadow: open ? `${lip === 'none' ? '' : `${lip}, `}0 0 0 4px var(--accent-glow)` : lip,
        ...style,
      }}
      {...props}
    >
      {active ? (
        <>
          <span style={{ color: 'var(--text-2)' }}>{label}</span>
          <b style={{ fontWeight: 700 }}>{valueLabel}</b>
        </>
      ) : (
        label
      )}
      <Icon icon={ChevronDown} size={13} />
    </button>
  );
});
