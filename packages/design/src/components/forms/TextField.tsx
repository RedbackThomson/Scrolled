import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Icon } from '../core/Icon';

export type TextFieldSize = 'sm' | 'md' | 'lg';

/**
 * `default` is bordered on a card, `ghost` stays borderless until hovered or
 * focused (editing text in place), `float` sits on the page backdrop and
 * `sunken` sits inside cards and popovers.
 */
export type TextFieldVariant = 'default' | 'ghost' | 'float' | 'sunken';

interface FieldChrome {
  label?: string;
  /** Right-aligned helper beside the label, e.g. "Optional" */
  hint?: string;
  /** A message under the field, or `true` to mark it invalid without one */
  error?: string | boolean;
  variant?: TextFieldVariant;
  mono?: boolean;
  /** Force the focus look (for specs) */
  focused?: boolean;
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldChrome {
  /** sm 28px for dense rows, md 38px, lg 48px for touch */
  size?: TextFieldSize;
  shape?: 'rounded' | 'pill';
  /** Leading icon inside the field */
  icon?: LucideIcon;
  /** Inside the field before the input, after the icon, e.g. a "MIN" tag */
  leading?: ReactNode;
  /** Inside the field after the input, e.g. a clear button or keycap */
  trailing?: ReactNode;
  /** Let the contents wrap onto more lines; the size becomes a minimum height */
  wrap?: boolean;
  inputClassName?: string;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChrome {}

const HEIGHT: Record<TextFieldSize, string> = { sm: 'h-7', md: 'h-[38px]', lg: 'h-12' };
const MIN_HEIGHT: Record<TextFieldSize, string> = {
  sm: 'min-h-7',
  md: 'min-h-[38px]',
  lg: 'min-h-12',
};
const BOX: Record<TextFieldSize, string> = {
  sm: 'rounded-[8px] px-1.5 sm:text-xs',
  md: 'rounded-xl px-3 sm:text-sm',
  lg: 'rounded-[14px] px-3.5',
};

const VARIANT: Record<TextFieldVariant, string> = {
  default:
    'border-[color:var(--border-1)] bg-[var(--surface-card)] [box-shadow:var(--shadow-input)] focus-within:[box-shadow:var(--shadow-input),var(--focus-ring)]',
  ghost:
    'border-transparent bg-transparent hover:border-[color:var(--border-1)] focus-within:bg-[var(--surface-card)] focus-within:[box-shadow:var(--focus-ring)]',
  float:
    'border-transparent bg-[var(--surface-card)] [box-shadow:var(--shadow-float)] focus-within:[box-shadow:var(--focus-ring),var(--shadow-float)]',
  sunken:
    'border-transparent bg-[var(--surface-sunken)] focus-within:[box-shadow:var(--focus-ring)]',
};

function boxClass(variant: TextFieldVariant, error: boolean, focused?: boolean) {
  return cn(
    'flex w-full min-w-0 items-center gap-2 border-2 text-base text-[color:var(--text-1)] transition-[box-shadow,border-color] duration-150 focus-within:border-[color:var(--accent)]',
    VARIANT[variant],
    error && 'border-[color:var(--danger)]',
    focused && 'border-[color:var(--accent)] [box-shadow:var(--shadow-input),var(--focus-ring)]',
  );
}

const CONTROL =
  'sc-input-text w-full min-w-0 flex-1 self-stretch bg-transparent outline-none placeholder:text-[color:var(--text-2)] placeholder:opacity-70 disabled:cursor-not-allowed disabled:opacity-60';

function Frame({
  label,
  hint,
  error,
  className,
  children,
}: Pick<FieldChrome, 'label' | 'hint' | 'error'> & { className?: string; children: ReactNode }) {
  const message = typeof error === 'string' && error ? error : null;
  if (!label && !message) return <div className={cn('min-w-0', className)}>{children}</div>;
  return (
    <label className={cn('flex min-w-0 flex-col gap-[5px]', className)}>
      {label && (
        <span className="font-display flex justify-between text-[13px] font-semibold text-[color:var(--text-2)]">
          <span>{label}</span>
          {hint && <span className="font-sans text-[11.5px] font-medium">{hint}</span>}
        </span>
      )}
      {children}
      {message && <span className="text-xs text-[color:var(--danger)]">{message}</span>}
    </label>
  );
}

/** The text input: a field with an optional label, hint, error, icon and inline extras. `className` sizes the outer box. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    variant = 'default',
    mono,
    focused,
    size = 'md',
    shape = 'rounded',
    icon,
    leading,
    trailing,
    wrap,
    inputClassName,
    className,
    style,
    autoComplete,
    type = 'text',
    inputMode,
    ...props
  },
  ref,
) {
  const numeric = type === 'number' || inputMode === 'numeric' || inputMode === 'decimal';
  return (
    <Frame label={label} hint={hint} error={error} className={className}>
      <span
        className={cn(
          boxClass(variant, !!error, focused),
          BOX[size],
          wrap ? cn(MIN_HEIGHT[size], 'flex-wrap gap-1.5 py-1') : HEIGHT[size],
          variant === 'ghost' && 'px-2',
          shape === 'pill' && 'rounded-full',
        )}
        style={style}
      >
        {icon && (
          <Icon
            icon={icon}
            size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
            color="var(--text-2)"
          />
        )}
        {leading}
        <input
          ref={ref}
          type={type}
          inputMode={inputMode}
          // Browsers autofill text fields unless told otherwise, which a tool like this rarely wants.
          autoComplete={autoComplete ?? 'off'}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, numeric && 'tabular-nums', mono && 'font-mono', inputClassName)}
          {...props}
        />
        {trailing}
      </span>
    </Frame>
  );
});

/** The multi-line counterpart of `TextField`. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, variant = 'default', mono, focused, className, style, rows = 3, ...props },
  ref,
) {
  return (
    <Frame label={label} hint={hint} error={error} className={className}>
      <span
        className={cn(boxClass(variant, !!error, focused), 'rounded-xl px-3 py-2 sm:text-sm')}
        style={style}
      >
        <textarea
          ref={ref}
          rows={rows}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'resize-y', mono && 'font-mono')}
          {...props}
        />
      </span>
    </Frame>
  );
});
