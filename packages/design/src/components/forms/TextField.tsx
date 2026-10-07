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

interface FieldChrome {
  label?: string;
  /** Right-aligned helper beside the label, e.g. "Optional" */
  hint?: string;
  /** A message under the field, or `true` to mark it invalid without one */
  error?: string | boolean;
  /** `ghost` stays borderless until hovered or focused, for editing text in place */
  variant?: 'default' | 'ghost';
  mono?: boolean;
  /** Force the focus look (for specs) */
  focused?: boolean;
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    FieldChrome {
  /** sm 28px for dense rows, md 38px, lg 48px for touch */
  size?: TextFieldSize;
  /** Leading icon inside the field */
  icon?: LucideIcon;
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChrome {}

const BOX: Record<TextFieldSize, string> = {
  sm: 'h-7 rounded-[8px] px-1.5 sm:text-xs',
  md: 'h-[38px] rounded-xl px-3 sm:text-sm',
  lg: 'h-12 rounded-[14px] px-3.5',
};

function boxClass(variant: FieldChrome['variant'], error: boolean, focused?: boolean) {
  return cn(
    'flex w-full min-w-0 items-center gap-2 border-2 text-base text-[color:var(--text-1)] transition-[box-shadow,border-color] duration-150',
    'focus-within:border-[color:var(--accent)] focus-within:bg-[var(--surface-card)] focus-within:shadow-[var(--shadow-input),var(--focus-ring)]',
    variant === 'ghost'
      ? 'border-transparent bg-transparent hover:border-[color:var(--border-1)]'
      : 'border-[color:var(--border-1)] bg-[var(--surface-card)] shadow-[var(--shadow-input)]',
    error && 'border-[color:var(--danger)]',
    focused && 'border-[color:var(--accent)] shadow-[var(--shadow-input),var(--focus-ring)]',
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

/** The text input: a bordered field with an optional label, hint, error and leading icon. `className` sizes the outer box. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    variant = 'default',
    mono,
    focused,
    size = 'md',
    icon,
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
        className={cn(boxClass(variant, !!error, focused), BOX[size], variant === 'ghost' && 'px-2')}
        style={style}
      >
        {icon && <Icon icon={icon} size={size === 'sm' ? 12 : 14} color="var(--text-2)" />}
        <input
          ref={ref}
          type={type}
          inputMode={inputMode}
          // Browsers autofill text fields unless told otherwise, which a tool like this rarely wants.
          autoComplete={autoComplete ?? 'off'}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, numeric && 'tabular-nums', mono && 'font-mono')}
          {...props}
        />
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
